import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { classifyApiError } from "@/lib/advisorApi";

// What the New opportunity form asks the database (story CRM-A2.3, screen 25; 20261120130000_opportunity_create.sql). Two calls: what the form needs (the
// account, its contacts, the firm's referral partners, the people who may own it) and the making. The database decides every rule: who may see an account, an
// archived account, a closing firm and Nevermore support, each field (D-29), the source, the owner (the level rule, D-209). This only puts its answers and
// refusals into the screen's shape and words, as `contactApi` does for adding a contact.

export type OpportunityFailure = "invalid" | "notAllowed" | "notFound" | "archived" | "readOnly" | "failed";

export class OpportunityError extends Error {
  constructor(readonly kind: OpportunityFailure, message: string, readonly code?: string) {
    super(message);
  }
}

type DbError = { code?: string; message?: string };

/** An ended session is said in its own words (and signs the person out); the database's refusals keep their plain words; anything else is a failure to try again. */
function refusal(error: DbError, fallback: string): Error {
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    case "PT404": return new OpportunityError("notFound", "That account isn't available any more. Reload the page.", error.code);
    case "PT423": return new OpportunityError("readOnly", error.message || "This can't be changed right now.", error.code);
    case "55000": return new OpportunityError("archived", error.message || "This account is archived. Nothing can be added to it.", error.code);
    case "22023": return new OpportunityError("invalid", error.message || fallback, error.code);
    case "42501": return new OpportunityError("notAllowed", error.message || "You can't do that.", error.code);
    default: return new OpportunityError("failed", fallback, error.code);
  }
}

const CONTEXT_FALLBACK = "Couldn't load the account.";
const SAVE_FALLBACK = "Couldn't save the opportunity. Check your connection and try again.";

// The project's compiler setting makes every zod object key optional, so each schema is given its exact shape (as contactApi's are).
type Context = {
  account: { id: string; name: string; archived: boolean; employees: number | null };
  main_contact: { id: string; name: string } | null;
  contacts: { id: string; name: string; title: string | null; is_main: boolean }[];
  partners: { code: string; name: string }[];
  owners: { id: string; name: string }[];
};
const contextSchema = z.object({
  account: z.object({ id: z.string().min(1), name: z.string(), archived: z.boolean(), employees: z.number().nullable() }),
  main_contact: z.object({ id: z.string().min(1), name: z.string() }).nullable(),
  contacts: z.array(z.object({ id: z.string().min(1), name: z.string(), title: z.string().nullable(), is_main: z.boolean() })),
  partners: z.array(z.object({ code: z.string().min(1), name: z.string() })),
  owners: z.array(z.object({ id: z.string().min(1), name: z.string() })),
}) as unknown as z.ZodType<Context>;

export interface NewOpportunityContext {
  account: { id: string; name: string; archived: boolean; employees: number | null };
  /** The account's main contact, offered as the opportunity's. */
  mainContact: { id: string; name: string } | null;
  /** The account's contacts, the main contact first: the choices for the opportunity's main contact. */
  contacts: { id: string; name: string; title: string | null; isMain: boolean }[];
  /** The firm's own referral partners, for a Referral. */
  partners: { code: string; name: string }[];
  /** The people the database lets this person give the opportunity to (the level rule, and who sees the account). */
  owners: { id: string; name: string }[];
}

export async function getNewOpportunityContext(firmId: string, accountId: string): Promise<NewOpportunityContext> {
  const { data, error } = await supabase.rpc("opportunity_create_context", { p_firm_id: firmId, p_account_id: accountId });
  if (error) throw refusal(error, CONTEXT_FALLBACK);
  const parsed = contextSchema.safeParse(data);
  if (!parsed.success) throw new OpportunityError("failed", CONTEXT_FALLBACK);
  const c = parsed.data;
  return {
    account: c.account,
    mainContact: c.main_contact,
    contacts: c.contacts.map((x) => ({ id: x.id, name: x.name, title: x.title, isMain: x.is_main })),
    partners: c.partners,
    owners: c.owners,
  };
}

/** What a person gives the form, every text as typed (a blank is nothing). */
export interface NewOpportunity {
  name: string;
  /** A day ("2028-01-01") or empty. */
  targetStart: string;
  employees: number | null;
  mainContactId: string | null;
  expectedClose: string;
  /** Dollars, or null for none. */
  value: number | null;
  source: string;
  /** The referral partner's code, only with the source Referral. */
  referralPartnerCode: string | null;
  nextStep: string;
  /** The person chosen as the owner; null leaves it to the database, which makes the maker the owner. */
  ownerId: string | null;
}

const madeSchema = z.object({
  record: z.object({ id: z.string().min(1), version: z.number().int(), stage: z.string() }).passthrough(),
}) as unknown as z.ZodType<{ record: { id: string; version: number; stage: string } }>;

export interface MadeOpportunity {
  id: string;
  version: number;
  stage: string;
}

/**
 * Makes the opportunity on the account and answers its id: the form opens its page from it (D-442). A refusal is an `OpportunityError`: `invalid` (the database says
 * what is wrong, in words), `notAllowed` (an owner the person may not choose), `archived`, `readOnly` (a closing firm, Nevermore support), `notFound` or `failed`.
 */
export async function createOpportunity(firmId: string, accountId: string, o: NewOpportunity): Promise<MadeOpportunity> {
  const { data, error } = await supabase.rpc("opportunity_create", {
    p_account_id: accountId,
    p_name: o.name,
    p_target_start: o.targetStart === "" ? null : o.targetStart,
    p_employees: o.employees,
    p_main_contact_id: o.mainContactId,
    p_expected_close: o.expectedClose === "" ? null : o.expectedClose,
    p_value: o.value,
    p_source: o.source === "" ? null : o.source,
    p_referral_partner_code: o.referralPartnerCode,
    p_next_step: o.nextStep,
    p_owner_id: o.ownerId,
    p_firm_id: firmId,
  });
  if (error) throw refusal(error, SAVE_FALLBACK);
  const parsed = madeSchema.safeParse(data);
  if (!parsed.success) throw new OpportunityError("failed", SAVE_FALLBACK);
  return { id: parsed.data.record.id, version: parsed.data.record.version, stage: parsed.data.record.stage };
}
