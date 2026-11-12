// The census as a spreadsheet in a PEO census layout (GLOSSARY.md; L-3.1): a new .xlsx, or the PEO's own template
// filled, beside the CSV that src/data/censusExport.ts writes; and the check that a file reads back to the rows it was
// written from, which the publish review runs on sample rows and each profile's test runs (src/test/censusRoundTrip.ts).
//
// Spreadsheets are read and written with exceljs, loaded only when a census file is made or checked, so it never
// weighs on the intake's first load. Every value is written as a plain value, never a formula: a string cell that
// starts with =, +, -, @ or a tab stays text, as the CSV defuses it with an apostrophe (censusExport.ts).
//
// A template is filled by matching its header row's text to the layout's headers, ignoring case and the spaces at
// either end. Every one of the layout's headers must be there, or nothing is written: never a half-filled file.
// Everything else in the workbook is kept, except what exceljs can't keep (charts, pivot tables, macros, links to
// other workbooks), so a template holding any of those is refused rather than quietly changed.
import type { CensusEmployee } from "@/data/census";
import { censusCells, censusExport, type PeoCensusLayout } from "@/data/censusExport";
import { peoSlug } from "@/data/peoCatalog";
import { unpacksTooLarge, zipEntries } from "../../supabase/functions/_shared/zipDirectory.ts";

type Workbook = import("exceljs").Workbook;
type Worksheet = import("exceljs").Worksheet;
type Failure = { ok: false; message: string };
type Result<T> = ({ ok: true } & T) | Failure;
/** Whether `r` failed; narrows it either way. */
const failed = <T>(r: Result<T>): r is Failure => !r.ok;

const excel = async () => (await import("exceljs")).default;

const NOT_A_WORKBOOK = "The file given as the PEO template workbook isn't an Excel workbook we can read.";
const TOO_LARGE = "The PEO template workbook unpacks to more than 100 MB, far more than a census form needs. Ask the PEO for a plain copy.";
const losesParts = (parts: readonly string[]) =>
  `The PEO template workbook holds parts that filling it would lose (${parts.join(", ")}): charts, pivot tables, macros, slicers, data connections or the like. Ask the PEO for a plain copy.`;

/**
 * The parts of a workbook filling keeps. exceljs rebuilds the file from what it understands, so a part it doesn't
 * know is dropped without a word; a template holding any part not on this list is refused, naming it. Each kind is
 * checked against a workbook built in censusWorkbook.test.ts. Two go, harmlessly, and are allowed: the calculation
 * chain (a spreadsheet rebuilds it from the formulas, which are kept) and the printer's own settings (the page setup,
 * orientation and margins, is in the sheet and kept). Folders a zip lists on their own are no parts at all.
 */
const KEPT_PARTS = [
  /\/$/,
  /^\[Content_Types\]\.xml$/,
  /^_rels\/\.rels$/,
  /^docProps\/(app|core)\.xml$/,
  /^xl\/workbook\.xml$/,
  /^xl\/_rels\/workbook\.xml\.rels$/,
  /^xl\/worksheets\/[^/]+\.xml$/,
  /^xl\/worksheets\/_rels\/[^/]+\.xml\.rels$/,
  /^xl\/styles\.xml$/,
  /^xl\/sharedStrings\.xml$/,
  /^xl\/theme\/[^/]+\.xml$/,
  /^xl\/drawings\/[^/]+\.(xml|vml)$/,
  /^xl\/drawings\/_rels\/[^/]+\.(xml|vml)\.rels$/,
  /^xl\/media\/[^/]+$/,
  /^xl\/comments[^/]*\.xml$/,
  /^xl\/tables\/[^/]+\.xml$/,
  /^xl\/calcChain\.xml$/,
  /^xl\/printerSettings\/[^/]+\.bin$/,
];

/** Whether filling a PEO template workbook keeps part `name` (or drops it harmlessly). */
export const isKeptPart = (name: string) => KEPT_PARTS.some((p) => p.test(name));

const key = (header: string) => header.trim().toLowerCase();

/** The names of the parts in a zip file (an .xlsx is one), from its central directory; null when it isn't a zip. */
export function templateParts(bytes: Uint8Array): string[] | null {
  return zipEntries(bytes)?.map((e) => e.name) ?? null;
}

/** The census as a new workbook: one sheet, "Census", the layout's headers on row 1 and one row per employee. */
export async function writeCensusXlsx(census: readonly CensusEmployee[], layout: PeoCensusLayout, about: { title: string }): Promise<Uint8Array> {
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  wb.title = about.title;
  wb.subject = about.title;
  const ws = wb.addWorksheet("Census");
  layout.columns.forEach((c, i) => {
    ws.getCell(1, i + 1).value = c.header;
  });
  ws.getRow(1).font = { bold: true };
  censusCells(census, layout).forEach((row, r) => row.forEach((v, c) => {
    if (v !== "") ws.getCell(r + 2, c + 1).value = v;
  }));
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

/** A workbook from its bytes, or null when it can't be read. */
async function loadWorkbook(bytes: Uint8Array): Promise<Workbook | null> {
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
    return wb;
  } catch {
    return null;
  }
}

const sheetNamed = (wb: Workbook, name: string): Worksheet | undefined => wb.worksheets.find((s) => key(s.name) === key(name));

/** Where each of the layout's columns is in the template's header row, or the headers it doesn't have. */
function matchHeaders(ws: Worksheet, headerRow: number, layout: PeoCensusLayout): { at: number[]; missing: string[] } {
  const found = new Map<string, number>();
  ws.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, col) => {
    const text = key(cell.text ?? "");
    if (text && !found.has(text)) found.set(text, col);
  });
  const missing = layout.columns.filter((c) => !found.has(key(c.header))).map((c) => c.header);
  return { missing, at: layout.columns.map((c) => found.get(key(c.header)) ?? 0) };
}

const quotedList = (items: readonly string[]) =>
  items.length === 1 ? `"${items[0]}"` : `${items.slice(0, -1).map((i) => `"${i}"`).join(", ")} or "${items[items.length - 1]}"`;

/** The template, and where in it the census goes, or why it can't be filled. Nothing is written yet. */
async function openTemplate(bytes: Uint8Array, layout: PeoCensusLayout): Promise<Result<{ wb: Workbook; ws: Worksheet; at: number[]; firstRow: number }>> {
  const t = layout.template;
  if (!t) return { ok: false, message: "This census layout doesn't fill a template." };
  const entries = zipEntries(bytes);
  if (!entries) return { ok: false, message: NOT_A_WORKBOOK };
  // Checked before anything is unpacked.
  if (unpacksTooLarge(entries)) return { ok: false, message: TOO_LARGE };
  const lost = entries.map((e) => e.name).filter((p) => !isKeptPart(p));
  if (lost.length > 0) return { ok: false, message: losesParts(lost) };
  const wb = await loadWorkbook(bytes);
  if (!wb) return { ok: false, message: NOT_A_WORKBOOK };
  const ws = sheetNamed(wb, t.sheet);
  if (!ws) return { ok: false, message: `The PEO template workbook has no sheet called "${t.sheet}".` };
  const match = matchHeaders(ws, t.headerRow, layout);
  if (match.missing.length > 0) {
    return { ok: false, message: `The PEO template workbook's headers don't match the census layout: row ${t.headerRow} of the sheet "${ws.name}" has no ${quotedList(match.missing)}.` };
  }
  return { ok: true, wb, ws, at: match.at, firstRow: t.firstRow };
}

const shown = (text: string) => (text.length > 60 ? `${text.slice(0, 57)}...` : text);

/**
 * The first thing the template holds in the rows `count` employees would be written to, from `firstRow` down, in
 * any column (not only the layout's): writing there would put an employee over the PEO's own words, a footer, a
 * totals row, a signature line or an example row. Null when those rows are empty.
 */
function inTheWay(ws: Worksheet, firstRow: number, count: number): Failure | null {
  let found: Failure | null = null;
  ws.eachRow({ includeEmpty: false }, (row, r) => {
    if (found || r < firstRow || r >= firstRow + count) return;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (found || cell.value === null || cell.value === undefined || cell.text.trim() === "") return;
      found = {
        ok: false,
        message: `The PEO template workbook has "${shown(cell.text.trim())}" in ${cell.address}, where employee ${r - firstRow + 1} would go. Remove it, or use a template workbook with more room.`,
      };
    });
  });
  return found;
}

/**
 * Whether the census can be written into the PEO template workbook, checked before the download is offered: its
 * headers match and nothing it holds is where an employee would go. Nothing is written.
 */
export async function templateWorkbookFits(template: Uint8Array, census: readonly CensusEmployee[], layout: PeoCensusLayout): Promise<{ ok: true } | Failure> {
  const opened = await openTemplate(template, layout);
  if (failed(opened)) return opened;
  return inTheWay(opened.ws, opened.firstRow, census.length) ?? { ok: true };
}

/**
 * The census written into a PEO's own template, under its headers from its first row of data, the rest of the
 * workbook as it was; or why it can't be, with nothing written.
 */
export async function fillTemplateWorkbook(template: Uint8Array, census: readonly CensusEmployee[], layout: PeoCensusLayout): Promise<Result<{ bytes: Uint8Array }>> {
  const opened = await openTemplate(template, layout);
  if (failed(opened)) return opened;
  const { wb, ws, at, firstRow } = opened;
  const blocked = inTheWay(ws, firstRow, census.length);
  if (blocked) return blocked;
  censusCells(census, layout).forEach((row, r) => row.forEach((v, c) => {
    // A column the intake can't fill is left as the template has it.
    if (layout.columns[c].from !== null) ws.getCell(firstRow + r, at[c]).value = v === "" ? null : v;
  }));
  return { ok: true, bytes: new Uint8Array(await wb.xlsx.writeBuffer()) };
}

/** One CSV file's rows (RFC 4180), each value as written. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === "\"" && text[i + 1] === "\"") { field += "\""; i++; }
      else if (ch === "\"") quoted = false;
      else field += ch;
    } else if (ch === "\"") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\r" && text[i + 1] === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; }
    else field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** A CSV value as a spreadsheet shows it: the apostrophe that kept it from running as a formula taken off. */
const undefused = (v: string) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);

const cellText = (ws: Worksheet, row: number, col: number): string => {
  const cell = ws.getCell(row, col);
  if (cell.value === null || cell.value === undefined) return "";
  return typeof cell.value === "number" ? String(cell.value) : cell.text;
};

/** The rows of `ws` from `firstRow` in columns `at`, as text, until a row with none of them filled. */
function rowsFrom(ws: Worksheet, firstRow: number, at: number[]): string[][] {
  const rows: string[][] = [];
  for (let r = firstRow; r <= Math.max(ws.rowCount, firstRow); r++) {
    const row = at.map((c) => cellText(ws, r, c));
    if (row.every((v) => v === "")) break;
    rows.push(row);
  }
  return rows;
}

/**
 * A census file read back as a spreadsheet shows it: the data rows, each value as text in the layout's column order.
 * A CSV and a new workbook have the headers on their first row; a template has them where its layout says.
 */
export async function readCensusBack(file: string | Uint8Array, layout: PeoCensusLayout): Promise<string[][]> {
  if (typeof file === "string") return parseCsv(file).slice(1).map((r) => r.map(undefused));
  const wb = await loadWorkbook(file);
  const t = layout.template;
  const ws = wb && (t ? sheetNamed(wb, t.sheet) : wb.getWorksheet("Census"));
  if (!ws) return [];
  const match = matchHeaders(ws, t ? t.headerRow : 1, layout);
  return match.missing.length === 0 ? rowsFrom(ws, t ? t.firstRow : 2, match.at) : [];
}

/** Writes the census in a layout: a CSV, a new workbook, or the PEO's template filled. */
async function write(census: readonly CensusEmployee[], layout: PeoCensusLayout, title: string, template: Uint8Array | null): Promise<Result<{ file: string | Uint8Array }>> {
  if (layout.template) {
    if (!template) return { ok: false, message: "The census layout fills the PEO template workbook, so that file is needed to check it." };
    const filled = await fillTemplateWorkbook(template, census, layout);
    return failed(filled) ? filled : { ok: true, file: filled.bytes };
  }
  if (layout.format === "xlsx") return { ok: true, file: await writeCensusXlsx(census, layout, { title }) };
  return { ok: true, file: censusExport(census, layout).csv };
}

/**
 * Whether the census, written in `layout` and read back, gives the same rows (for a layout that fills the PEO's
 * template, written into `template`). The publish review runs it on SAMPLE_CENSUS before a layout is published.
 */
export async function censusRoundTrip(layout: PeoCensusLayout, census: readonly CensusEmployee[], template: Uint8Array | null): Promise<{ ok: true } | { ok: false; message: string }> {
  const written = await write(census, layout, "Census round-trip check", template);
  if (failed(written)) return written;
  const back = await readCensusBack(written.file, layout);
  // What each cell should read, worked out from the census itself, not from what wrote the file.
  const expected = census.map((e) => layout.columns.map((c) => {
    const v = c.from ? e[c.from] : undefined;
    return v === undefined || v === null ? "" : String(v);
  }));
  for (let r = 0; r < Math.max(expected.length, back.length); r++) {
    for (let c = 0; c < layout.columns.length; c++) {
      const want = expected[r]?.[c] ?? "";
      const got = back[r]?.[c] ?? "";
      if (want !== got) {
        return { ok: false, message: `The census doesn't read back from the file as written: row ${r + 1}, "${layout.columns[c].header}" reads "${got}" instead of "${want}".` };
      }
    }
  }
  return { ok: true };
}

/** The last row of `ws` with anything in it; 0 for an empty sheet. */
function lastRowHolding(ws: Worksheet): number {
  let last = 0;
  ws.eachRow({ includeEmpty: false }, (row, r) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value !== null && cell.value !== undefined && cell.text.trim() !== "") last = Math.max(last, r);
    });
  });
  return last;
}

/**
 * The check the publish review runs on a census layout: the round trip on SAMPLE_CENSUS, repeated to as many rows as
 * reach the last thing a PEO template workbook holds below its first row of data. A census can be any length, so a
 * template with anything there (a footer, a totals row, a signature line, example rows) is refused, saying what and
 * where, rather than published to be written over by a long census later.
 */
export async function checkLayoutRoundTrip(layout: PeoCensusLayout, template: Uint8Array | null): Promise<{ ok: true } | { ok: false; message: string }> {
  let rows = SAMPLE_CENSUS.length;
  if (layout.template && template) {
    const opened = await openTemplate(template, layout);
    if (failed(opened)) return opened;
    rows = Math.max(rows, lastRowHolding(opened.ws) - opened.firstRow + 1);
    // What filling refuses for this many rows, said for any census.
    const blocked = inTheWay(opened.ws, opened.firstRow, rows);
    if (blocked) return { ok: false, message: `${blocked.message} A census can be any length, so nothing can sit below the first row of data.` };
  }
  const census = Array.from({ length: rows }, (_, i) => ({ ...SAMPLE_CENSUS[i % SAMPLE_CENSUS.length], id: `s${i + 1}` }));
  return censusRoundTrip(layout, census, template);
}

/**
 * Sample rows for the round-trip check, about nobody real: what a file can get wrong, a comma, a quote, a line
 * break, a value that looks like a formula, an accent and an emoji, a number, a blank.
 */
export const SAMPLE_CENSUS: readonly CensusEmployee[] = [
  { id: "s1", first_name: "Ana María", last_name: "Sample-One", dob: "1985-04-12", work_state: "CA", zip_code: "94107", job_title: "Designer, \"Senior\"", annual_salary: 98500, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "FAM", class_code: "8810" },
  { id: "s2", first_name: "=1+1", last_name: "Sample Two", work_state: "NY", job_title: "@lead 🚚", annual_salary: 41600.5, compensation_type: "hourly", employment_type: "part_time", classification: "w2" },
  { id: "s3", first_name: "Lee", last_name: "Sample\nThree", dob: "2001-12-31", work_state: "", zip_code: "02134", job_title: "-", compensation_type: "salary", employment_type: "full_time", classification: "1099", class_code: "0042" },
];

/**
 * The census download: the certified census in a layout, named for the File ID, the PEO and the certified version
 * ("EAA-2026-0042-census-trinet-v3.xlsx"), or why it can't be made (a template that doesn't match).
 */
export async function censusFile(
  census: readonly CensusEmployee[],
  layout: PeoCensusLayout,
  about: { fileId: string; version: number | null; template?: Uint8Array | null },
): Promise<Result<{ blob: Blob; filename: string }>> {
  const title = `Census${layout.peo ? ` for ${layout.peo}` : ""}${about.version !== null ? `, certified version ${about.version}` : ""}`;
  const written = await write(census, layout, title, about.template ?? null);
  if (failed(written)) return written;
  const { file } = written;
  const filename = `${about.fileId}-census${layout.peo ? `-${peoSlug(layout.peo)}` : ""}${about.version !== null ? `-v${about.version}` : ""}.${typeof file === "string" ? "csv" : "xlsx"}`;
  const blob = typeof file === "string"
    ? new Blob([file], { type: "text/csv;charset=utf-8" })
    : new Blob([file as Uint8Array<ArrayBuffer>], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { ok: true, blob, filename };
}
