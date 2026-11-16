import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AccountError, refusal } from "@/lib/accountPageApi";

// What the New lead form asks the database (story CRM-L1.2a, slice 8.2; 20261121095500_create_lead.sql): one call, which makes the lead. The database decides
// every rule: who may make one and for whom (the level rule, D-809), a closing firm and Nevermore support, and each field. This only puts its answer and its
// refusals into the page's shape and words. Refusals use the workspace's one error (AccountError: invalid, notAllowed, readOnly, failed), as every form does.

/** What a person types into the form, every text as typed (a blank is nothing). */
export interface NewLead {
  name: string;
  title: string;
  business: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  employees: number | null;
  currentProvider: string;
  note: string;
  /** The person chosen as the owner; null leaves it to the database, which makes the maker the owner. */
  ownerId: string | null;
}

/** The made lead, as much of it as the page needs to open it. */
export interface MadeLead {
  id: string;
  version: number;
  name: string;
  status: "new";
  source: "added_by_hand";
  ownerId: string | null;
}

const madeSchema = z.object({
  id: z.string().min(1),
  version: z.number().int(),
  name: z.string().min(1),
  status: z.literal("new"),
  source: z.literal("added_by_hand"),
  owner_id: z.string().nullable(),
});

const SAVE_FALLBACK = "Couldn't save the lead. Try again.";

/** Makes the lead in the firm and answers it as made: New, Added by hand, its first version. A refusal is an `AccountError` with the database's words. */
export async function createLead(firmId: string, lead: NewLead): Promise<MadeLead> {
  const { data, error } = await supabase.rpc("create_lead", {
    p_name: lead.name,
    p_title: lead.title,
    p_business: lead.business,
    p_email: lead.email,
    p_phone: lead.phone,
    p_city: lead.city,
    p_state: lead.state,
    p_employees: lead.employees,
    p_current_provider: lead.currentProvider,
    p_note: lead.note,
    p_owner_id: lead.ownerId,
    p_firm_id: firmId,
  });
  if (error) throw refusal(error, SAVE_FALLBACK);
  const parsed = madeSchema.safeParse(data);
  if (!parsed.success) throw new AccountError("failed", SAVE_FALLBACK);
  const m = parsed.data;
  return { id: m.id, version: m.version, name: m.name, status: m.status, source: m.source, ownerId: m.owner_id };
}
