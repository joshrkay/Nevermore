import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { classifyApiError } from "@/lib/advisorApi";
import { AccountError } from "@/lib/accountPageApi";

// What archiving, restoring and deleting an account, and changing its owner, ask the database (story CRM-A1.1c;
// 20261119160000_account_archive_delete_owner.sql). The database decides every rule (who may see an account, the level rule D-209, a closing firm, Nevermore
// support, an account that has an opportunity); this puts its answers and refusals in words and checks an answer is exactly the agreed shape.

type DbError = { code?: string; message?: string };

function refusal(error: DbError, fallback: string): Error {
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    case "PT404": return new AccountError("notFound", "This account isn't available.", error.code);
    case "PT423": return new AccountError("readOnly", error.message || "This can't be changed right now.", error.code);
    case "22023": return new AccountError("invalid", error.message || fallback, error.code);
    case "42501": return new AccountError("notAllowed", error.message || "You can't change this account.", error.code);
    // The account has an opportunity: the database's words say to archive it instead.
    case "PT409": return new AccountError("hasOpportunities", error.message || "This account has opportunities. Archive it instead.", error.code);
    default: return new AccountError("failed", fallback, error.code);
  }
}

const changedSchema = z.object({ changed: z.boolean() }).passthrough();
const deletedSchema = z.object({ deleted: z.literal(true), name: z.string() });
const ownerSchema = z.object({
  owner: z.object({ id: z.string(), name: z.string().nullable() }),
  opportunities_changed: z.number().int().min(0),
  opportunities_skipped: z.number().int().min(0),
}).passthrough();

const FAILED = "Couldn't do that. Try again.";

/** Archives the account. `changed` is false when it already was. */
export async function archiveAccount(firmId: string, accountId: string): Promise<{ changed: boolean }> {
  const { data, error } = await supabase.rpc("archive_account", { p_account_id: accountId, p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't archive the account. Try again.");
  const parsed = changedSchema.safeParse(data);
  if (!parsed.success) throw new AccountError("failed", "Couldn't archive the account. Try again.");
  return { changed: parsed.data.changed };
}

/** Restores an archived account. `changed` is false when it was not archived. */
export async function restoreAccount(firmId: string, accountId: string): Promise<{ changed: boolean }> {
  const { data, error } = await supabase.rpc("restore_account", { p_account_id: accountId, p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't restore the account. Try again.");
  const parsed = changedSchema.safeParse(data);
  if (!parsed.success) throw new AccountError("failed", "Couldn't restore the account. Try again.");
  return { changed: parsed.data.changed };
}

/** Deletes an account that has no opportunity, with its contacts, calls, notes and tasks. One that has an opportunity is refused (kind "hasOpportunities"): it can only be archived. */
export async function deleteAccount(firmId: string, accountId: string): Promise<{ name: string }> {
  const { data, error } = await supabase.rpc("delete_account", { p_account_id: accountId, p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't delete the account. Try again.");
  const parsed = deletedSchema.safeParse(data);
  if (!parsed.success) throw new AccountError("failed", "Couldn't delete the account. Try again.");
  return { name: parsed.data.name };
}

export interface OwnerChanged {
  ownerName: string | null;
  opportunitiesChanged: number;
  /** Open opportunities the person may not change (a colleague's), left as they were. */
  opportunitiesSkipped: number;
}

/** Gives the account to another current member and, when `withOpenOpportunities`, its open opportunities the person may change. */
export async function changeAccountOwner(firmId: string, accountId: string, ownerId: string, withOpenOpportunities: boolean): Promise<OwnerChanged> {
  const { data, error } = await supabase.rpc("change_account_owner", {
    p_account_id: accountId, p_owner_id: ownerId, p_change_open_opportunities: withOpenOpportunities, p_firm_id: firmId,
  });
  if (error) throw refusal(error, "Couldn't change the owner. Try again.");
  const parsed = ownerSchema.safeParse(data);
  if (!parsed.success) throw new AccountError("failed", FAILED);
  return { ownerName: parsed.data.owner.name, opportunitiesChanged: parsed.data.opportunities_changed, opportunitiesSkipped: parsed.data.opportunities_skipped };
}

const idsSchema = z.array(z.string());

/**
 * Which of the given accounts (at most 100, the page's rows) the person may change by the level rule: the table offers its row actions on these only.
 * Nothing for a closing firm and for Nevermore support. A failure throws; the page then offers no actions rather than ones that may be refused.
 */
export async function accountsCanChange(firmId: string, accountIds: string[]): Promise<string[]> {
  if (accountIds.length === 0) return [];
  const { data, error } = await supabase.rpc("accounts_can_change", { p_firm_id: firmId, p_ids: accountIds });
  if (error) throw refusal(error, "Couldn't check which accounts you can change.");
  const parsed = idsSchema.safeParse(data);
  if (!parsed.success) throw new AccountError("failed", "Couldn't check which accounts you can change.");
  return parsed.data;
}
