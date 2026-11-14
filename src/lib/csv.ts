// One way to write a CSV (RFC 4180), shared by every file the browser builds from rows: the census (src/data/censusExport.ts) and an export of a
// table (src/lib/exportFile.ts, story CRM-S3.8a). A CSV is opened in a spreadsheet by someone other than the person who typed what is in it, so
// every value is made safe to open: see `csvField`.

/**
 * One CSV field, defused if it would run as a formula, then quoted with its quotes doubled when it holds a comma, a quote or a line break (RFC 4180).
 * A yes-or-no is written as "yes" or "no", and nothing as nothing.
 */
export function csvField(value: unknown): string {
  const raw = value === undefined || value === null ? "" : typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
  // A leading =, +, -, @, tab or carriage return makes a spreadsheet run the value as a formula: the prospect (or a partner's name) was typed
  // by someone else, and a member opens the file. An apostrophe keeps it text (OWASP, CSV injection).
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows of already-written fields as a file's text: CRLF between rows and after the last. */
export const csvLines = (rows: readonly (readonly string[])[]): string => rows.map((r) => r.join(",")).join("\r\n") + "\r\n";
