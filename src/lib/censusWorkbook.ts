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

type Workbook = import("exceljs").Workbook;
type Worksheet = import("exceljs").Worksheet;
type Failure = { ok: false; message: string };
type Result<T> = ({ ok: true } & T) | Failure;
/** The failure of `r`, or null when it worked. */
const failureOf = (r: { ok: boolean }): Failure | null => (r.ok ? null : (r as Failure));

const excel = async () => (await import("exceljs")).default;

const NOT_A_WORKBOOK = "The template file isn't an Excel workbook we can read.";
const LOSES_PARTS = "The template has charts, pivot tables or macros, which filling it would lose. Ask the PEO for a plain copy.";
/** The parts of a workbook exceljs drops when it saves one. */
const PARTS_LOST = [/^xl\/charts\//, /^xl\/chartsheets\//, /^xl\/pivotTables\//, /^xl\/pivotCache\//, /^xl\/vbaProject\.bin$/i, /^xl\/externalLinks\//];

const key = (header: string) => header.trim().toLowerCase();

/** The names of the parts in a zip file (an .xlsx is one), from its central directory; null when it isn't a zip. */
export function templateParts(bytes: Uint8Array): string[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end of central directory record: 22 bytes, then a comment of up to 64 KiB.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const names: string[] = [];
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) return null;
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    names.push(decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)));
    at += 46 + nameLength + extra + comment;
  }
  return names;
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
  const parts = templateParts(bytes);
  if (!parts) return { ok: false, message: NOT_A_WORKBOOK };
  if (parts.some((p) => PARTS_LOST.some((lost) => lost.test(p)))) return { ok: false, message: LOSES_PARTS };
  const wb = await loadWorkbook(bytes);
  if (!wb) return { ok: false, message: NOT_A_WORKBOOK };
  const ws = sheetNamed(wb, t.sheet);
  if (!ws) return { ok: false, message: `The template has no sheet called "${t.sheet}".` };
  const match = matchHeaders(ws, t.headerRow, layout);
  if (match.missing.length > 0) {
    return { ok: false, message: `The template's headers don't match the census layout: row ${t.headerRow} of the sheet "${ws.name}" has no ${quotedList(match.missing)}.` };
  }
  return { ok: true, wb, ws, at: match.at, firstRow: t.firstRow };
}

/**
 * The census written into a PEO's own template, under its headers from its first row of data, the rest of the
 * workbook as it was; or why it can't be, with nothing written.
 */
export async function fillCensusTemplate(template: Uint8Array, census: readonly CensusEmployee[], layout: PeoCensusLayout): Promise<Result<{ bytes: Uint8Array }>> {
  const opened = await openTemplate(template, layout);
  const failed = failureOf(opened);
  if (failed) return failed;
  const { wb, ws, at, firstRow } = opened as Extract<typeof opened, { ok: true }>;
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
    if (!template) return { ok: false, message: "The census layout fills the PEO's template, so the template file is needed to check it." };
    const filled = await fillCensusTemplate(template, census, layout);
    return failureOf(filled) ?? { ok: true, file: (filled as { bytes: Uint8Array }).bytes };
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
  const failed = failureOf(written);
  if (failed) return failed;
  const back = await readCensusBack((written as { file: string | Uint8Array }).file, layout);
  const expected = censusCells(census, layout).map((r) => r.map(String));
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

/**
 * Sample rows for the round-trip check, about nobody real: what a file can get wrong, a comma, a quote, a line
 * break, a value that looks like a formula, an accent and an emoji, a number, a blank.
 */
export const SAMPLE_CENSUS: readonly CensusEmployee[] = [
  { id: "s1", first_name: "Ana María", last_name: "Sample-One", dob: "1985-04-12", work_state: "CA", zip_code: "94107", job_title: "Designer, \"Senior\"", annual_salary: 98500, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "FAM", class_code: "8810" },
  { id: "s2", first_name: "=1+1", last_name: "Sample Two", work_state: "NY", job_title: "@lead 🚚", annual_salary: 41600.5, compensation_type: "hourly", employment_type: "part_time", classification: "w2" },
  { id: "s3", first_name: "Lee", last_name: "Sample\nThree", dob: "2001-12-31", work_state: "", zip_code: "02134", job_title: "-", compensation_type: "salary", employment_type: "full_time", classification: "1099", class_code: "0042" },
];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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
  const result = await write(census, layout, title, about.template ?? null);
  const failed = failureOf(result);
  if (failed) return failed;
  const written = result as { file: string | Uint8Array };
  const csv = typeof written.file === "string";
  const filename = `${about.fileId}-census${layout.peo ? `-${slug(layout.peo)}` : ""}${about.version !== null ? `-v${about.version}` : ""}.${csv ? "csv" : "xlsx"}`;
  const blob = csv
    ? new Blob([written.file as string], { type: "text/csv;charset=utf-8" })
    : new Blob([written.file as Uint8Array<ArrayBuffer>], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { ok: true, blob, filename };
}
