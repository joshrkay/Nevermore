import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AccountError, fieldsOf, fieldsSchema, refusal, SAVE_FALLBACK, type AccountFields } from "@/lib/accountPageApi";

// What the New account form asks the database (story CRM-A1.2; 20261119150000_create_account.sql): one call, which makes the account. The database decides every
// rule: who may make one and for whom (the level rule, D-209), a closing firm and Nevermore support, and each field (D-29). This only puts its answer and its
// refusals into the page's shape and words, as `accountPageApi` does for the save, and checks that an answer is exactly the agreed shape.

/** What a person types into the form, every text as typed (a blank is nothing). */
export interface NewAccount {
  name: string;
  tradeName: string;
  website: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  industry: string;
  employees: number | null;
  statesOfOperation: string[];
  currentProvider: string;
  /** The person chosen as the owner; null leaves it to the database, which makes the maker the owner (D-214). */
  ownerId: string | null;
}

/**
 * Makes the account in the firm and answers it as saved: its id, its first version, its source (always Added by hand, D-211). A refusal is an `AccountError`:
 * `invalid` (the database says what is wrong, in words), `notAllowed` (the owner chosen is not one the person may choose), `readOnly` (a closing firm, Nevermore
 * support) or `failed`.
 */
export async function createAccount(firmId: string, account: NewAccount): Promise<AccountFields> {
  const { data, error } = await supabase.rpc("create_account", {
    p_name: account.name,
    p_trade_name: account.tradeName,
    p_website: account.website,
    p_phone: account.phone,
    p_street: account.street,
    p_city: account.city,
    p_state: account.state,
    p_postal_code: account.postalCode,
    p_industry: account.industry,
    p_employees: account.employees,
    p_states_of_operation: account.statesOfOperation,
    p_current_provider: account.currentProvider,
    p_owner_id: account.ownerId,
    p_firm_id: firmId,
  });
  if (error) throw refusal(error, SAVE_FALLBACK);
  const parsed = fieldsSchema.safeParse(data);
  if (!parsed.success) throw new AccountError("failed", SAVE_FALLBACK);
  return fieldsOf(parsed.data);
}

const ownersSchema = z.array(z.object({ user_id: z.string().min(1), name: z.string().refine((n) => n.trim() !== "") }));
const OWNERS_FAILED = "Couldn't load the firm's people.";

/**
 * The people the person may give a new account to, by the level rule (D-209): an agent themselves, a lead the members of their teams, an owner anyone in the
 * firm. The database answers it, so the form never offers what `createAccount` would refuse.
 */
export async function listAccountOwners(firmId: string): Promise<{ value: string; label: string }[]> {
  const { data, error } = await supabase.rpc("account_owner_choices", { p_firm_id: firmId });
  if (error) throw new AccountError("failed", OWNERS_FAILED);
  const answer = ownersSchema.safeParse(data);
  if (!answer.success) throw new AccountError("failed", OWNERS_FAILED);
  return answer.data.map((m) => ({ value: m.user_id, label: m.name }));
}
