// One way to write a CSV (RFC 4180), shared by every file the browser builds from rows: the census (src/data/censusExport.ts) and an export of a
// table (src/lib/exportFile.ts, story CRM-S3.8a). A CSV is opened in a spreadsheet by someone other than the person who typed what is in it, so
// every value is made safe to open: see `csvField`.

// What makes a spreadsheet read a cell as a formula when it is the first character (OWASP, CSV injection): = + - @, a tab, a carriage return, a
// line feed, and the full-width forms of the four signs (U+FF1D, U+FF0B, U+FF0D, U+FF20), which an input method can turn back into the ASCII ones.
const STARTS_A_FORMULA = /^[=+\-@\t\r\n\uFF1D\uFF0B\uFF0D\uFF20]/;
// What makes a cell need quotes: a comma, a quote or a line break (RFC 4180), and a semicolon, which is the separator a spreadsheet set to a European
// locale splits on, so that a cell holding one would otherwise be read as several.
const NEEDS_QUOTES = /[",;\r\n]/;

/**
 * One CSV field, made safe to open: a value that starts with a character in STARTS_A_FORMULA is kept as text by a leading apostrophe, and a value with
 * a comma, a semicolon, a quote or a line break in it is put in double quotes with its quotes doubled. Both are done to every cell, a heading too.
 * That is all it does: it is not a guarantee about what a spreadsheet will do with a value that does not start with one of those characters.
 * A yes-or-no is written as "yes" or "no", and nothing as nothing.
 */
export function csvField(value: unknown): string {
  const raw = value === undefined || value === null ? "" : typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
  // The value was typed by someone else (a prospect, a partner's name), and a member opens the file.
  const text = STARTS_A_FORMULA.test(raw) ? `'${raw}` : raw;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows of already-written fields as a file's text: CRLF between rows and after the last. */
export const csvLines = (rows: readonly (readonly string[])[]): string => rows.map((r) => r.join(",")).join("\r\n") + "\r\n";
