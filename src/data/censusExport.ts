// The census as a file a PEO's underwriters can read without re-keying it (joshrkay/Nevermore#86, L-3.1): the certified
// census in a PEO census layout (GLOSSARY.md), the one in the PEO's requirement profile in use, or in our own layout,
// the census template's columns, for any other PEO. Built in the browser from the certified copy; never the draft. The
// CSV is written here; an xlsx, and the PEO's own template filled, in src/lib/censusWorkbook.ts.
import { CENSUS_TEMPLATE_COLUMNS, type CensusEmployee, type CensusTemplateColumn } from "./census";
import { findPeo, type PeoRecord } from "./peoCatalog";

/** Which of a PEO's own templates the census fills, and where: the sheet, its header row and its first row of data. */
export interface TemplateWorkbookRef {
  /** The template's record (peo_census_templates). */
  id: number;
  sheet: string;
  headerRow: number;
  firstRow: number;
}

/** A PEO's census columns, in order, each filled from one census fact, or left blank when we don't collect it. */
export interface PeoCensusLayout {
  /** The PEO whose layout this is; null for our own layout. */
  peo: string | null;
  columns: { header: string; from: CensusTemplateColumn | null }[];
  /** The file it is written as. */
  format: "csv" | "xlsx";
  /** The PEO's own template the census fills, when it has one; then the file is that workbook. */
  template: TemplateWorkbookRef | null;
}

/** Our own layout: the census template's columns under their own names, as CSV. */
export const OUR_CENSUS_LAYOUT: PeoCensusLayout = {
  peo: null,
  columns: CENSUS_TEMPLATE_COLUMNS.map((c) => ({ header: c, from: c })),
  format: "csv",
  template: null,
};

/** One CSV field, defused if it would run as a formula, then quoted with its quotes doubled when it holds a comma,
 * a quote or a line break (RFC 4180). */
function cell(value: unknown): string {
  const raw = value === undefined || value === null ? "" : String(value);
  // A leading =, +, -, @, tab or carriage return makes a spreadsheet run the value as a formula: the prospect
  // typed it, and an underwriter opens the file. An apostrophe keeps it text (OWASP, CSV injection).
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The census in a layout, as CSV (CRLF rows, a header row first), and the headers it leaves blank. */
export function censusExport(census: readonly CensusEmployee[], layout: PeoCensusLayout): { csv: string; blankColumns: string[] } {
  const rows = [
    layout.columns.map((c) => cell(c.header)),
    ...census.map((e) => layout.columns.map((c) => (c.from ? cell(e[c.from]) : ""))),
  ];
  return { csv: rows.map((r) => r.join(",")).join("\r\n") + "\r\n", blankColumns: blankColumnsOf(layout) };
}

/** The census's values in a layout, row by row: a number as a number, a blank column or missing fact as "". */
export function censusCells(census: readonly CensusEmployee[], layout: PeoCensusLayout): (string | number)[][] {
  return census.map((e) => layout.columns.map((c) => {
    const v = c.from ? e[c.from] : undefined;
    return v === undefined || v === null ? "" : typeof v === "number" ? v : String(v);
  }));
}

/** The headers a layout leaves blank: what the intake doesn't collect, listed beside the download. */
export const blankColumnsOf = (layout: PeoCensusLayout): string[] => layout.columns.filter((c) => c.from === null).map((c) => c.header);

/**
 * The census layout a PEO's file is in: the one its requirement profile in use holds when it is a listed PEO with
 * one, otherwise our own. A PEO typed in that isn't on the list never has one.
 */
export function censusLayoutFor(peo: string | null, catalog: readonly PeoRecord[]): PeoCensusLayout {
  const found = peo ? findPeo(catalog, peo) : undefined;
  return (found?.listed && found.profile?.censusLayout) || OUR_CENSUS_LAYOUT;
}
