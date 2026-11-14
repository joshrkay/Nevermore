import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { classifyApiError } from "@/lib/advisorApi";

// What the Export button asks the database (story CRM-S3.8b, D-48; 20261119090000_export.sql). One call, `export_rows`, returns the rows of a
// table AND records the export in the firm's record in the same step, so the count in the record is the count of the rows given and an export
// cannot be made without its record. The database decides every rule: which tables, who may take each, which rows the person may see, the
// fresh sign-in for a whole table, the refusal of Nevermore support, the most rows and the alert to the owners. This only puts its answer
// and its refusals into the page's shape and words. The CSV and the button are CRM-S3.8a's.

/** The tables that can be exported today. A later table is added here when the database's list (`export_table_registry`) gains it. */
export type ExportTable = "referral_partners" | "firm_activity";

/** A value in a row: text, a number, a yes or no, or nothing. A column never holds anything else. */
export type ExportValue = string | number | boolean | null;

export interface ExportColumn {
  /** Never changes: the key of the column in each row. */
  id: string;
  /** The column's heading, in words. */
  label: string;
}

export interface ExportResult {
  table: ExportTable;
  /** The table's name in words ("Referral partners"). */
  label: string;
  /** The columns in the order a file shows them. A row holds each of these and nothing else. */
  columns: ExportColumn[];
  rows: Record<string, ExportValue>[];
  /** How many rows were given and recorded: always `rows.length`. */
  count: number;
  /** For a selection: how many of the ids named gave no row (not the person's to see, or not there). Always 0 for a whole table. */
  skipped: number;
  /** When the database took the rows (ISO text). */
  exportedAt: string;
}

/** Why an export did not happen. `signInAgain`: the person signed in too long ago for a whole table; sign in again, then try again. */
export type ExportFailure = "signInAgain" | "support" | "tooMany" | "notAllowed" | "invalid" | "failed";

export class ExportError extends Error {
  constructor(readonly kind: ExportFailure, message: string) {
    super(message);
  }
}

export interface ExportRequest {
  firmId: string;
  table: ExportTable;
  /** The table's own filters, as the page shows them (`{}` for none): referral partners take `kind` and `search`; the firm's record `person` and `kind`. */
  filters?: Record<string, Json>;
  /** The ids of the records selected, to export only them (at most 1,000); leave out for every row that matches the filters. */
  ids?: string[];
}

const value = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const answer = z.object({
  table: z.enum(["referral_partners", "firm_activity"]),
  label: z.string().min(1),
  columns: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(1),
  rows: z.array(z.record(value)),
  count: z.number().int().min(0),
  skipped: z.number().int().min(0),
  exportedAt: z.string().min(1),
});

const FALLBACK = "Couldn't export. Try again.";

type DbError = { code?: string; message?: string };

function refusal(error: DbError): Error {
  // A session the server no longer accepts is said in its own words, and signs the person out.
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    case "PT401": return new ExportError("signInAgain", "Sign in again to export a whole table.");
    case "PT423": return new ExportError("support", "Nevermore support can look, not change, so it can't export.");
    // The database words these itself, plainly, and says what to do: the limit, a table it doesn't list, filters or ids it doesn't take.
    case "PT413": return new ExportError("tooMany", error.message || "That is too many rows. Narrow it with a filter and export again.");
    case "22023": return new ExportError("invalid", error.message || FALLBACK);
    case "42501": return new ExportError("notAllowed", /owner/i.test(error.message ?? "") ? "Only an owner of the firm can export that." : "You aren't a member of this firm.");
    default: return new ExportError("failed", FALLBACK);
  }
}

/**
 * Takes a table out: every row that matches the filters (a whole table, which asks for a sign-in within the last 12 hours), or the records
 * named by `ids`. The database records the export (who, when, which table, how many rows) in the same step, so there is nothing to record here.
 * A refusal is an `ExportError` with the reason in `kind`; an answer that is not exactly the agreed shape, or whose count is not its rows, is
 * a failed export, never a file with something missing.
 */
export async function exportRows(request: ExportRequest): Promise<ExportResult> {
  const { data, error } = await supabase.rpc("export_rows", {
    p_firm_id: request.firmId,
    p_table: request.table,
    p_filters: request.filters ?? {},
    p_ids: request.ids ?? null,
  });
  if (error) throw refusal(error);
  const parsed = answer.safeParse(data);
  if (!parsed.success) throw new ExportError("failed", FALLBACK);
  const result = parsed.data as ExportResult;
  // What came back must be what was asked for and must hold together: the table, a count that is the rows, each column once, and in every row
  // exactly the columns declared (a file made from anything else would have a column of blanks or one nobody listed).
  const ids = result.columns.map((c) => c.id);
  const declared = new Set(ids);
  const consistent =
    result.table === request.table &&
    result.count === result.rows.length &&
    declared.size === ids.length &&
    result.rows.every((row) => Object.keys(row).length === declared.size && Object.keys(row).every((k) => declared.has(k)));
  if (!consistent) throw new ExportError("failed", FALLBACK);
  return result;
}
