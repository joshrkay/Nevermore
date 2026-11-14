// The CSV file an export makes (story CRM-S3.8a; docs/BROKER_CRM_BUILD.md D-210 and the decisions after it). Tested through the pages that
// use it (D-50), never on its own.

/**
 * A cell a spreadsheet could run as a formula when the file is opened (CSV injection): it starts with `=`, `+`, `-` or `@` (D-234), or with one of
 * those hidden behind what a spreadsheet or the person may not see or may skip: any space or control character (Unicode white space, which takes in
 * the no-break and ideographic spaces and the byte order mark, a vertical tab, a form feed) or any invisible format character (a zero-width space or
 * joiner, a direction mark), or written in its fullwidth form (U+FF1D, U+FF0B, U+FF0D, U+FF20). A cell that starts with a tab, a carriage return
 * or a line feed is held back whatever follows. A partner named `=HYPERLINK(...)` is such a cell. The rule is deliberately wider than the four
 * characters, and errs on the side of plain text, which costs one apostrophe: a name is never worth a formula. Written with \u{...} codes, never
 * as the invisible characters themselves.
 */
const LIKE_A_FORMULA = /^(?:[\s\p{Cc}\p{Cf}]*[=+\-@\u{ff1d}\u{ff0b}\u{ff0d}\u{ff20}]|[\t\r\n])/u;

/** A cell as plain text: one apostrophe in front of what could be a formula, so a spreadsheet shows it and never runs it. */
const plainText = (text: string) => (LIKE_A_FORMULA.test(text) ? `'${text}` : text);

/** U+FEFF, which a Blob writes as the three bytes EF BB BF at the start of the file (written as a code, not as the invisible character itself). */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** One cell, as RFC 4180 writes it: in double quotes when it holds a comma, a double quote or a line break, with each double quote doubled. */
function cell(text: string): string {
  const safe = plainText(text);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * The file's name: what it holds and the day it was made, counted in the person's own time zone (the evening of the 14th in California is the
 * 15th in UTC), and nothing else: no firm, no person. "referral-partners-2026-11-14.csv".
 */
export function csvFileName(what: string, madeAt: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(madeAt));
  const part = (type: string) => day.find((p) => p.type === type)?.value ?? "";
  return `${what}-${part("year")}-${part("month")}-${part("day")}.csv`;
}

/**
 * The CSV file of a header line and the rows under it: UTF-8, with a byte order mark so that a spreadsheet (Excel, which otherwise reads a file
 * with no mark in the computer's own code page) shows an accent or another script as it was typed, and lines ending in CRLF as RFC 4180 has them.
 */
export function csvFile(header: readonly string[], rows: readonly (readonly string[])[]): Blob {
  const text = [header, ...rows].map((line) => line.map(cell).join(",")).join("\r\n") + "\r\n";
  return new Blob([BYTE_ORDER_MARK, text], { type: "text/csv;charset=utf-8" });
}
