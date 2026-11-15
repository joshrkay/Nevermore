// The CSV file an export makes (story CRM-S3.8a; docs/BROKER_CRM_BUILD.md D-210 and the decisions after it). Tested through the pages that
// use it (D-50), never on its own.

/**
 * A cell a spreadsheet could run as a formula when the file is opened (CSV injection): it starts with `=`, `+`, `-` or `@` (after any spaces),
 * or with a tab, a carriage return or a line feed, which some spreadsheets skip before reading one. A partner named `=HYPERLINK(...)` is such a
 * cell. The rule is deliberately wider than the four characters: a name is never worth a formula.
 */
const LIKE_A_FORMULA = /^( *[=+\-@]|[\t\r\n])/;

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
