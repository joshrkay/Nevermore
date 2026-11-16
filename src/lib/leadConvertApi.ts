import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ContactError, refusal } from "@/lib/contactApi";

// What the Convert dialog asks the database (story CRM-L2.2, slice 8.6, screen 22; 20261122250000_convert_lead.sql): the possible matches, and the conversion
// itself. The database decides every rule: who may convert (the level rule on the lead's owner, D-809), that a Not a fit, Converted or binned lead cannot be,
// that a contact needs a name and an email or a phone, which accounts may be used, and that all of it happens or none (D-810). This only puts the dialog's choices
// into its parameters and its answers and refusals into the screen's shape and words.

/** An account that may be the same business as the lead (the duplicate match, D-193), one the person may use. */
export interface ConvertMatch {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  /** Why it matched: its name and state, or a contact with the lead's email. */
  reasons: ("name" | "email" | "website")[];
}

/** What the person chose in the dialog. */
export interface ConvertChoice {
  /** The existing account to use, or null to make one. */
  accountId: string | null;
  /** Whether to make a contact. */
  makeContact: boolean;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  makeOpportunity: boolean;
  opportunityName: string;
  /** A date (YYYY-MM-DD), or blank for none. */
  targetStart: string;
}

/** What converting made: the account (and whether it was made or an existing one used), the contact (null when none was made) and the opportunity (null when unticked). */
export interface Converted {
  account: { id: string; name: string; created: boolean };
  contact: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
}

// The project's compiler setting makes every zod object key optional, so each schema is given its exact shape (as leadPageApi's are).
type ConvertedRow = {
  account: { id: string; name: string; created: boolean };
  contact: { id: string; first_name: string | null; last_name: string } | null;
  opportunity: { id: string; name: string } | null;
};
const matchShape = z.object({
  id: z.string().min(1), name: z.string(), city: z.string().nullable(), state: z.string().nullable(), reasons: z.array(z.enum(["name", "email", "website"])),
}) as unknown as z.ZodType<ConvertMatch>;
const contextSchema = z.object({ matches: z.array(matchShape) });
const convertedSchema = z.object({
  account: z.object({ id: z.string().min(1), name: z.string(), created: z.boolean() }),
  contact: z.object({ id: z.string().min(1), first_name: z.string().nullable(), last_name: z.string() }).nullable(),
  opportunity: z.object({ id: z.string().min(1), name: z.string() }).nullable(),
}) as unknown as z.ZodType<ConvertedRow>;

const CONTEXT_FALLBACK = "Couldn't look for matching accounts. You can still convert the lead.";
const CONVERT_FALLBACK = "Couldn't convert the lead. Check your connection and try again.";

/** The accounts the person may use instead of making one. A failure is thrown: the dialog then offers making one, and says it couldn't look. */
export async function getConvertMatches(firmId: string, leadId: string): Promise<ConvertMatch[]> {
  const { data, error } = await supabase.rpc("lead_convert_context", { p_firm_id: firmId, p_lead_id: leadId });
  if (error) throw refusal(error, CONTEXT_FALLBACK);
  const parsed = contextSchema.safeParse(data);
  if (!parsed.success) throw new ContactError("failed", CONTEXT_FALLBACK);
  return parsed.data.matches;
}

/** Converts the lead. A refusal is a `ContactError` in the database's words; nothing was made when it is thrown. */
export async function convertLead(firmId: string, leadId: string, c: ConvertChoice): Promise<Converted> {
  const { data, error } = await supabase.rpc("convert_lead", {
    p_lead_id: leadId, p_account_id: c.accountId, p_make_contact: c.makeContact, p_first_name: c.firstName, p_last_name: c.lastName, p_contact_email: c.email,
    p_contact_phone: c.phone, p_make_opportunity: c.makeOpportunity, p_opportunity_name: c.opportunityName, p_target_start: c.targetStart.trim() === "" ? null : c.targetStart.trim(),
    p_firm_id: firmId,
  });
  if (error) throw refusal(error, CONVERT_FALLBACK);
  const parsed = convertedSchema.safeParse(data);
  if (!parsed.success) throw new ContactError("failed", CONVERT_FALLBACK);
  const p = parsed.data;
  return {
    account: p.account,
    contact: p.contact ? { id: p.contact.id, name: [p.contact.first_name, p.contact.last_name].filter(Boolean).join(" ") } : null,
    opportunity: p.opportunity,
  };
}
