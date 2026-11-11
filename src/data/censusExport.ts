// The census as a file a PEO's underwriters can read without re-keying it (joshrkay/Nevermore#86): the certified
// census in a PEO census layout (GLOSSARY.md), or in our own layout, the census template's columns, for any PEO
// whose layout we don't hold. Built in the browser from the certified copy; never the draft.
import { CENSUS_TEMPLATE_COLUMNS, type CensusEmployee, type CensusTemplateColumn } from "./census";

/** A PEO's census columns, in order, each filled from one census fact, or left blank when we don't collect it. */
export interface PeoCensusLayout {
  /** The PEO whose template this is; null for our own layout. */
  peo: string | null;
  columns: { header: string; from: CensusTemplateColumn | null }[];
}

/** Our own layout: the census template's columns under their own names. */
export const OUR_CENSUS_LAYOUT: PeoCensusLayout = {
  peo: null,
  columns: CENSUS_TEMPLATE_COLUMNS.map((c) => ({ header: c, from: c })),
};

/** One CSV field, defused if it would run as a formula, then quoted with its quotes doubled when it holds a comma,
 * a quote or a line break (RFC 4180). */
function cell(value: unknown): string {
  // A yes-or-no fact (COBRA status) is written as the census template takes it, so the file reads back the same.
  const raw = value === undefined || value === null ? "" : typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
  // A leading =, +, -, @, tab or carriage return makes a spreadsheet run the value as a formula: the prospect
  // typed it, and an underwriter opens the file. An apostrophe keeps it text (OWASP, CSV injection).
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The census in a layout, as CSV (CRLF rows, a header row first), and the headers it leaves blank. */
export function censusExport(census: readonly CensusEmployee[], layout: PeoCensusLayout): { csv: string; blankColumns: string[] } {
  const listsDependents = layout.columns.some((c) => c.from === "relationship");
  const rows = [
    layout.columns.map((c) => cell(c.header)),
    ...census.flatMap((e) => [
      // An employee's own row leaves the relationship blank, as the census template takes it.
      layout.columns.map((c) => (c.from && c.from !== "relationship" ? cell(e[c.from]) : "")),
      // Their dependents follow directly under them (K-2.3), each with what is held of them (name, relationship, date of
      // birth) and so nothing of the employee's. A layout with no relationship column could not tell them from employees, so leaves them out.
      ...(listsDependents ? (e.dependents ?? []) : []).map((d) =>
        layout.columns.map((c) => (c.from ? cell((d as unknown as Record<string, unknown>)[c.from]) : "")),
      ),
    ]),
  ];
  const blankColumns = layout.columns.filter((c) => c.from === null).map((c) => c.header);
  return { csv: rows.map((r) => r.join(",")).join("\r\n") + "\r\n", blankColumns };
}

/**
 * The PEO census layouts we hold, one per PEO whose own census template we have, each tested against a sample of
 * that template. None yet: add one when a PEO's template is in hand, never from a guess at its columns.
 */
export const PEO_CENSUS_LAYOUTS: readonly PeoCensusLayout[] = [];

/** A PEO's own layout when we hold one (its name compared ignoring case), otherwise our own. */
export function layoutFor(peo: string | null, layouts: readonly PeoCensusLayout[] = PEO_CENSUS_LAYOUTS): PeoCensusLayout {
  const wanted = peo?.trim().toLowerCase();
  return (wanted && layouts.find((l) => l.peo?.toLowerCase() === wanted)) || OUR_CENSUS_LAYOUT;
}
