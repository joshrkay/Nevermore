import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// What a screen asks the database for the history of one record (story CRM-S5.2; D-45). The database decides who may read it: any current
// member of the record's firm (and a support session), and nothing else; a record of another firm, one that does not exist and a caller who
// may not see it all get the same refusal. The screens that show a history (CRM-A2.1, CRM-L2.1) only render what this returns.

/** The tables that keep a history. A table is added here when the migration that attaches its trigger adds it to the database's list. */
export type RecordHistoryTable = "referral_partners";

/** One entry of a record's history: its creation, or the change of one field. A value that was not there is null. */
export type RecordHistoryEntry = {
  /** Random, never a number shared with other firms; a page starts after the last entry's `at` and `entryKey`. */
  entryKey: string;
  at: string;
  /** The fields changed by one save share this, so a screen can show them as one change. */
  changeId: string;
  kind: "created" | "changed";
  /** A member's email, "Nevermore" (who at Nevermore is never shown, D-33) or "System". */
  who: string;
  whoKind: "member" | "nevermore" | "system";
  /** The field changed; null for the creation. */
  field: string | null;
  /** The value as it was: a JSON string, number or boolean. A date is its ISO text. Null when there was no value. */
  from: Json | null;
  to: Json | null;
};

export class RecordHistoryError extends Error {}

export type RecordHistoryPage = {
  entries: RecordHistoryEntry[];
  /** Pass to the next call to read on; null when this page was the last. */
  next: { at: string; entryKey: string } | null;
};

/**
 * One page of a record's history, newest first. `key` names the record within its firm (a referral partner's code; several columns are a compact JSON array of the parts). The page is full when
 * `next` is set, so the caller asks again with it until it is null.
 */
export async function listRecordHistory(
  firmId: string,
  table: RecordHistoryTable,
  key: string,
  options: { limit?: number; after?: { at: string; entryKey: string } | null } = {},
): Promise<RecordHistoryPage> {
  const limit = options.limit ?? 50;
  const { data, error } = await supabase.rpc("record_history_list", {
    p_firm_id: firmId,
    p_table: table,
    p_key: key,
    p_limit: limit,
    p_after_at: options.after?.at ?? null,
    p_after_key: options.after?.entryKey ?? null,
  });
  if (error) {
    throw new RecordHistoryError(error.code === "PT404" ? "This record's history isn't available." : "Couldn't load the history. Try again.");
  }
  const entries = (data ?? []).map((row) => ({
    entryKey: row.entry_key,
    at: row.at,
    changeId: row.change_id,
    kind: row.kind as RecordHistoryEntry["kind"],
    who: row.who,
    whoKind: row.who_kind as RecordHistoryEntry["whoKind"],
    field: row.field,
    from: row.from_value,
    to: row.to_value,
  }));
  const last = entries[entries.length - 1];
  return { entries, next: entries.length === limit && last ? { at: last.at, entryKey: last.entryKey } : null };
}
