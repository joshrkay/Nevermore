import { exportFileName } from "@/data/exportTables";
import { csvField, csvLines } from "@/lib/csv";
import type { ExportResult, ExportValue } from "@/lib/exportApi";

// The file an export is given as (story CRM-S3.8a, D-48): the database's answer, made into a CSV in the browser, with the columns the page shows. Nothing
// is added to the answer: every value in the file comes from a row the database gave (exportApi.ts refuses an answer whose rows hold anything but the
// columns it declared), so a file can hold nothing the database did not decide the person may take.

/**
 * One column of the table on the page, as the person sees it: its heading, and how the page writes its value. `id` is the database's column the value
 * comes from (the one the page shows, or the main one of several the page puts together); an answer that lacks it is not made into a file.
 */
export interface ShownColumn {
  id: string;
  /** The column's heading as the page words it. */
  heading: string;
  /** The value as the page words it, from the whole row; without it the database's own value is written. */
  text?: (row: Record<string, ExportValue>) => string;
}

/** The day an export was taken, as the database says it (the answer's own text), so the name never depends on this browser's clock or zone. */
const dayOf = (result: ExportResult) => (/^\d{4}-\d{2}-\d{2}/.exec(result.exportedAt)?.[0]) ?? new Date().toISOString().slice(0, 10);

/**
 * The CSV and the name of the file for an export: a heading row of the shown columns' words, then a row for each row the database gave, in the order
 * the page shows the columns, written as RFC 4180 with every cell made safe to open in a spreadsheet (`csvField`). Columns the page does not show are
 * left out. It starts with a byte order mark so a spreadsheet reads a name with an accent as it was written.
 * Throws when the answer lacks a column the page shows: the page and the database disagree, and a file with a column of blanks would mislead.
 */
export function exportFile(result: ExportResult, shown: readonly ShownColumn[]): { blob: Blob; name: string } {
  const declared = new Set(result.columns.map((c) => c.id));
  if (shown.length === 0 || shown.some((c) => !declared.has(c.id))) throw new Error("The export lacks a column the page shows");
  const lines = [
    shown.map((c) => csvField(c.heading)),
    ...result.rows.map((row) => shown.map((c) => csvField(c.text ? c.text(row) : row[c.id]))),
  ];
  return { blob: new Blob(["\uFEFF", csvLines(lines)], { type: "text/csv;charset=utf-8" }), name: exportFileName(result.table, dayOf(result)) };
}
