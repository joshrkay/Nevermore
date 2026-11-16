import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// What a screen asks the database for the history of one record (story CRM-S5.2; D-45). The database decides who may read it: any current
// member of the record's firm (and a support session), and nothing else; a record of another firm, one that does not exist and a caller who
// may not see it all get the same refusal. The screens that show a history (CRM-A2.1, CRM-L2.1) only render what this returns.

/** The tables that keep a history. A table is added here when the migration that attaches its trigger adds it to the database's list. */
export type RecordHistoryTable = "referral_partners" | "accounts" | "contacts" | "opportunities";

/** Why a stage changed when the move was not a person's own choice of stage. */
export type RecordHistoryCause = "quote_send" | "quote_recorded" | "quote_taken";

const CAUSES: readonly string[] = ["quote_send", "quote_recorded", "quote_taken"];

/** The cause in a person's words, naming the PEO when the database gave one ("the quote from Justworks was taken"); null for no cause. */
export function historyCauseText(cause: RecordHistoryCause | null, peo: string | null): string | null {
  if (cause === "quote_taken") return peo ? `the quote from ${peo} was taken` : "the quote was taken";
  if (cause === "quote_recorded") return peo ? `the quote from ${peo} was recorded` : "the quote was recorded";
  if (cause === "quote_send") return peo ? `the send to ${peo}` : "the send";
  return null;
}

/**
 * One entry of a record's history: its creation, the change of one field, or (an opportunity's only) a change of its stage, read from its submission's
 * status history (D-413). A value that was not there is null.
 */
export type RecordHistoryEntry = {
  /** Random, never a number shared with other firms; a page starts after the last entry's `at` and `entryKey`. */
  entryKey: string;
  at: string;
  /** The fields changed by one save share this, so a screen can show them as one change. */
  changeId: string;
  kind: "created" | "changed" | "stage_changed" | "merged";
  /** A member's email, "Nevermore" (who at Nevermore is never shown, D-33) or "System". */
  who: string;
  whoKind: "member" | "nevermore" | "system";
  /** The field changed; "stage" for a stage change; null for the creation. */
  field: string | null;
  /** The value as it was: a JSON string, number or boolean. A date is its ISO text. Null when there was no value. A stage is its code (qualifying, intake_under_way, ready_to_send, in_market, quoted, won, lost). */
  from: Json | null;
  to: Json | null;
  /** What made a stage change when no person chose it (ADR 0026): a send or a quote recorded; or the quote the employer took, on a win (D-473). Null for every other entry and for a person's own move. */
  cause: RecordHistoryCause | null;
  /** The PEO of the quote request that caused it; null when there is no cause or that quote request is gone. */
  causePeo: string | null;
  /** The name of the merged-away record an entry was copied from, or, for the "merged" entry, the record this one absorbed (D-203); null for every other entry. */
  mergedFrom: string | null;
};

export class RecordHistoryError extends Error {}

export type RecordHistoryPage = {
  entries: RecordHistoryEntry[];
  /** Pass to the next call to read on; null when this page was the last. */
  next: { at: string; entryKey: string } | null;
};

/**
 * One page of a record's history, newest first. `key` names the record within its firm (a referral partner's code, an account's, a contact's or an opportunity's id; several columns are a compact JSON array of the parts). The page is full when
 * `next` is set, so the caller asks again with it until it is null.
 */
// A cause the app doesn't know is read as none, and so is its PEO: an entry never names a PEO without a cause to put it in.
function causeOf(cause: string | null, peo: string | null): { cause: RecordHistoryCause | null; causePeo: string | null } {
  return cause !== null && CAUSES.includes(cause) ? { cause: cause as RecordHistoryCause, causePeo: peo } : { cause: null, causePeo: null };
}

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
    ...causeOf(row.cause, row.cause_peo),
  }));
  const last = entries[entries.length - 1];
  return { entries, next: entries.length === limit && last ? { at: last.at, entryKey: last.entryKey } : null };
}
