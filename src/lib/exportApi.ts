import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { classifyApiError } from "@/lib/advisorApi";

// What the Export button asks the database for (story CRM-S3.8b; docs/BROKER_CRM_BUILD.md D-48, D-200 to D-214). One call,
// public.export_table, returns the rows AND records the export in the same step, so the button builds the CSV only from what this
// returns and never from the page on screen. The database decides everything: who may export (a current member at the firm's address;
// the firm's record, its owners), which rows (only those the person may see), which columns (a fixed list per table), the cap, the
// recent sign-in for a whole table, and the owners' alert. The button hides itself for the role `support` (D-123); the database refuses
// a support session anyway.

/** The columns each table exports, in the order a whole row has them. src/data/schemaSync.test.ts keeps these equal to the database's. */
export const EXPORT_COLUMNS = {
  referral_partners: ["code", "name", "kind", "created_at", "updated_at"],
  firm_activity: ["at", "who", "kind", "record_type", "record_id", "subject", "role", "rows"],
} as const;

export type ExportTable = keyof typeof EXPORT_COLUMNS;
export type ExportColumn<T extends ExportTable> = (typeof EXPORT_COLUMNS)[T][number];

/** A filter in the table frame's shape (the address codec's, D-44): a field of the table, an operator of its kind, and a value. */
export type ExportFilter = { field: string; op: string; value?: Json };

export type ExportOptions = {
  /** Every filter in force, "and". None: every row the person may see. */
  filters?: ExportFilter[];
  /**
   * The selection: the keys of the rows chosen (a partner's code, an entry's key), at least one. Left out or null: every row the filters
   * match. An empty list is refused (`invalid`) before the database is asked, never read as "every row" (D-212).
   */
  keys?: string[] | null;
  /** The person's time zone, which a date filter's days are counted in. */
  timeZone?: string;
};

export type ExportResult<T extends ExportTable> = {
  table: T;
  columns: ExportColumn<T>[];
  /** One array per row, its values in the order of `columns`: text, a number, or null for no value. A moment is UTC ISO text. */
  rows: (string | number | null)[][];
  rowCount: number;
  /** The export held every row the person may see in the table. */
  wholeTable: boolean;
  exportedAt: string;
};

/**
 * Why an export was refused, for the screen to act on:
 * - `sign_in_again` (PT428): a whole-table export, and the person last signed in more than 12 hours ago. Offer "Sign in again", which signs
 *   them out and back in at the firm's address, then let them press Export again.
 * - `too_many` (54000): more than 10,000 rows. Say so and ask them to narrow it with a filter.
 * - `support` (PT423): a Nevermore support session. The button should not have been shown.
 * - `forbidden` (42501): not a member here, or the firm's record for someone who is no owner.
 * - `invalid` (22023): the table, a column or a filter is not one the database takes (a bug in the caller, or an old bookmark).
 * - `failed`: anything else; "Try again".
 */
export type ExportRefusalReason = "sign_in_again" | "too_many" | "support" | "forbidden" | "invalid" | "failed";

export class ExportRefusal extends Error {
  constructor(message: string, readonly reason: ExportRefusalReason, readonly unauthenticated = false) {
    super(message);
  }
}

const REASONS: Record<string, ExportRefusalReason> = {
  PT428: "sign_in_again",
  "54000": "too_many",
  PT423: "support",
  "42501": "forbidden",
  "22023": "invalid",
};

const WORDS: Record<ExportRefusalReason, string> = {
  sign_in_again: "Sign in again to export the whole table: you last signed in more than 12 hours ago.",
  too_many: "This export holds more than 10,000 rows. Narrow it with a filter.",
  support: "Nevermore support can look, not export.",
  forbidden: "You can't export this table.",
  invalid: "This export couldn't be made. Reload the page and try again.",
  failed: "Couldn't export. Try again.",
};

/** The error to throw for a failed export: an ended session signs the person out, as every other call; a refusal says what to do. */
export function exportRefusal(error: { message: string; code?: string }): ExportRefusal {
  const reason = REASONS[error.code ?? ""] ?? "failed";
  if (reason === "failed") {
    const classified = classifyApiError(error, WORDS.failed);
    if (classified.unauthenticated) return new ExportRefusal(classified.message, "failed", true);
  }
  // The database's own sentence says how many rows there were, or which column or filter it refused.
  const message = (reason === "too_many" || reason === "invalid") && error.message ? error.message : WORDS[reason];
  return new ExportRefusal(message, reason);
}

/** Exports the rows of one table that match, in the columns asked, and records it. Throws `ExportRefusal`. */
export async function exportTable<T extends ExportTable>(
  firmId: string,
  table: T,
  columns: readonly ExportColumn<T>[],
  options: ExportOptions = {},
): Promise<ExportResult<T>> {
  // An empty selection is never "every row that matches" (D-212): a selection that lost its rows must not become the whole table.
  if (options.keys && options.keys.length === 0) {
    throw new ExportRefusal("Select at least one row to export, or clear the selection to export every row that matches.", "invalid");
  }
  const { data, error } = await supabase.rpc("export_table", {
    p_firm_id: firmId,
    p_table: table,
    p_columns: [...columns],
    p_filters: (options.filters ?? []) as Json,
    p_keys: options.keys ?? null,
    p_time_zone: options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  });
  if (error) throw exportRefusal(error);
  const answer = data as unknown as { table: T; columns: ExportColumn<T>[]; rows: (string | number | null)[][]; row_count: number; whole_table: boolean; exported_at: string };
  return {
    table: answer.table,
    columns: answer.columns,
    rows: answer.rows,
    rowCount: answer.row_count,
    wholeTable: answer.whole_table,
    exportedAt: answer.exported_at,
  };
}
