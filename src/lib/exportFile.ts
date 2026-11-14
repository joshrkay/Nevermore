import { exportFileName } from "@/data/exportTables";
import { csvField, csvLines } from "@/lib/csv";
import type { ExportResult } from "@/lib/exportApi";

// The file an export is given as (story CRM-S3.8a, D-48): the database's answer, made into a CSV in the browser. Nothing is added to the answer and
// nothing is left out of it: the columns are the ones the database declared, in its order, with its words as the heading, and each row holds exactly
// those (exportApi.ts refuses an answer that does not). So a file can hold nothing the database did not decide the person may take.

/** The day an export was taken, as the database says it (the answer's own text), so the name never depends on this browser's clock or zone. */
const dayOf = (result: ExportResult) => (/^\d{4}-\d{2}-\d{2}/.exec(result.exportedAt)?.[0]) ?? new Date().toISOString().slice(0, 10);

/**
 * The CSV and the name of the file for an export: a heading row of the columns' words, then a row for each, written as RFC 4180 with every cell made
 * safe to open in a spreadsheet (`csvField`). It starts with a byte order mark so a spreadsheet reads a name with an accent as it was written.
 */
export function exportFile(result: ExportResult): { blob: Blob; name: string } {
  const lines = [
    result.columns.map((c) => csvField(c.label)),
    ...result.rows.map((row) => result.columns.map((c) => csvField(row[c.id]))),
  ];
  return { blob: new Blob(["﻿", csvLines(lines)], { type: "text/csv;charset=utf-8" }), name: exportFileName(result.table, dayOf(result)) };
}
