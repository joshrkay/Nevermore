import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// What the New account and Add a contact forms ask the database while a person types (story CRM-S4.2; 20261120120000_spot_a_duplicate.sql): which of the firm's records
// may be the same as the one being made, by the one rule the chain at certification uses (D-193). The database decides what the person may see: a record they may see
// comes in full, one they may not comes as a mask that says only that one exists and whom to ask. This only checks the answer is that shape and drops anything else, so
// a mask can never carry a record's name or id on to the screen. A check is advice and never stops a save, so a failed one is an error the form ignores.

export type DuplicateReason = "website" | "name" | "email";

/** Whom to ask about a record the person may not see: its owner, or the firm's owners when it has none or theirs has left. Names only. */
export interface WhoToAsk {
  kind: "owner" | "firm_owners";
  names: string[];
}

export type DuplicateMatch =
  | { visible: true; kind: "account"; id: string; name: string; archived: boolean; reasons: DuplicateReason[]; owner: { id: string; name: string } | null }
  | { visible: true; kind: "contact"; id: string; name: string; archived: boolean; reasons: DuplicateReason[]; owner: { id: string; name: string } | null; account: { id: string; name: string } }
  | { visible: false; kind: "account" | "contact"; ask: WhoToAsk };

export interface Duplicates {
  matches: DuplicateMatch[];
  /** How many more records the person may see matched than the list holds. */
  more: number;
}

const FAILED = "Couldn't check for a duplicate.";

// The project's compiler setting makes every zod object key optional, so each schema is given its exact shape (as contactApi's are).
const ref = z.object({ id: z.string().min(1), name: z.string() }) as unknown as z.ZodType<{ id: string; name: string }>;
const reasons = z.array(z.enum(["website", "name", "email"])) as unknown as z.ZodType<DuplicateReason[]>;
const who = z.object({ kind: z.enum(["owner", "firm_owners"]), names: z.array(z.string()) }) as unknown as z.ZodType<WhoToAsk>;

const seenAccount = z.object({ kind: z.literal("account"), visible: z.literal(true), id: z.string().min(1), name: z.string(), archived: z.boolean(), reasons, owner: ref.nullable() });
const seenContact = z.object({ kind: z.literal("contact"), visible: z.literal(true), id: z.string().min(1), name: z.string(), archived: z.boolean(), reasons, owner: ref.nullable(), account: ref });
const masked = z.object({ kind: z.enum(["account", "contact"]), visible: z.literal(false), ask: who });
const answer = z.object({ matches: z.array(z.union([seenAccount, seenContact, masked])), more: z.number().int().min(0) }) as unknown as z.ZodType<Duplicates>;

function read(data: unknown, error: unknown): Duplicates {
  if (error) throw new Error(FAILED);
  const parsed = answer.safeParse(data);
  if (!parsed.success) throw new Error(FAILED);
  return parsed.data;
}

/** The firm's accounts that may be the same business as the one being typed: by website, or by name and state (D-193). */
export async function checkAccountDuplicates(firmId: string, fields: { name: string; website: string; state: string }): Promise<Duplicates> {
  const { data, error } = await supabase.rpc("duplicate_account_check", { p_firm_id: firmId, p_name: fields.name, p_website: fields.website, p_state: fields.state });
  return read(data, error);
}

/** The firm's contacts with the email being typed, ignoring case (D-193). */
export async function checkContactDuplicates(firmId: string, email: string): Promise<Duplicates> {
  const { data, error } = await supabase.rpc("duplicate_contact_check", { p_firm_id: firmId, p_email: email });
  return read(data, error);
}
