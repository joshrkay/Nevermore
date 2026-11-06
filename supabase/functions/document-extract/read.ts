// @deno-types="https://cdn.sheetjs.com/xlsx-0.20.3/package/types/index.d.ts"
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
import { extractText, getDocumentProxy } from "npm:unpdf@1.8.1";
import {
  clampSheetRange,
  docxContent,
  isPasswordError,
  MAX_EXTRACT_BYTES,
  MAX_PDF_PAGES,
  MAX_SHEET_ROWS,
  MAX_XLSX_UNZIPPED_BYTES,
  mergeCandidates,
  MIN_PDF_TEXT_CHARS,
  paragraphSections,
  readGrids,
  sheetCutOff,
  sniffFormat,
  type Candidate,
  type ExtractionStatus,
  type Grid,
  type TextSection,
} from "./parse.ts";
import { readZipEntry, unzippedSize, ZipTooLargeError } from "./zip.ts";

// Turns a document's bytes into candidate fields, or a status saying why it couldn't be read.
// File-format work lives here; what the tables and text mean is decided in parse.ts, and the model
// is reached only through `ask`.

export type Outcome = { status: ExtractionStatus; message?: string; notes?: string[]; candidates?: Candidate[] };
export type AskModel = (sections: TextSection[]) => Promise<Candidate[]>;

// word/document.xml is the text of the document plus markup; a 10 MB .docx rarely holds more than this.
const MAX_DOCX_XML_BYTES = 40 * 1024 * 1024;

/** Reads a stored document's bytes into candidates. `ask` reads free text with the model. */
export async function readDocument(bytes: Uint8Array, fileName: string, ask: AskModel): Promise<Outcome> {
  if (bytes.length > MAX_EXTRACT_BYTES) return { status: "too_large" };
  const format = sniffFormat(bytes, fileName);
  switch (format) {
    case "encrypted_office":
      return { status: "encrypted" };
    case "doc":
      return { status: "unsupported", message: "Older Word (.doc) files are saved for your advisor but not read. Save it as .docx or PDF to have it read." };
    case "unknown":
      return { status: "unsupported", message: "This file's contents don't match a PDF, Word, Excel, or CSV file." };
    case "pdf":
      return await readPdf(bytes, ask);
    case "docx":
      return await readDocx(bytes, ask);
    case "csv":
    case "xls":
    case "xlsx":
      return await readSpreadsheet(bytes, format, ask);
  }
}

async function readPdf(bytes: Uint8Array, ask: AskModel): Promise<Outcome> {
  let pages: string[];
  try {
    const pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > MAX_PDF_PAGES) return { status: "too_large" };
    const { text } = await extractText(pdf, { mergePages: false });
    pages = Array.isArray(text) ? text : [text];
  } catch (e) {
    if (isPasswordError(e)) return { status: "encrypted" };
    return { status: "unreadable", message: "This PDF couldn't be opened. It's saved for your advisor." };
  }
  const total = pages.reduce((n, p) => n + p.trim().length, 0);
  if (total < MIN_PDF_TEXT_CHARS) return { status: "unreadable" };
  const sections = pages.map((text, i) => ({ label: `Page ${i + 1}`, text })).filter((s) => s.text.trim());
  return { status: "extracted", candidates: await ask(sections) };
}

async function readDocx(bytes: Uint8Array, ask: AskModel): Promise<Outcome> {
  let xml: string;
  try {
    const entry = await readZipEntry(bytes, "word/document.xml", MAX_DOCX_XML_BYTES);
    if (!entry) return { status: "unreadable", message: "This Word file has no document text. It's saved for your advisor." };
    xml = new TextDecoder().decode(entry);
  } catch {
    return { status: "unreadable", message: "This Word file couldn't be opened. It's saved for your advisor." };
  }
  const { paragraphs, tables } = docxContent(xml);
  const grids: Grid[] = tables.map((rows, i) => ({ label: `Table ${i + 1}`, rows }));
  return await readTablesAndText(grids, paragraphSections(paragraphs), ask);
}

async function readSpreadsheet(bytes: Uint8Array, format: "csv" | "xls" | "xlsx", ask: AskModel): Promise<Outcome> {
  if (format === "xlsx") {
    // The library unzips the file itself, with no limit of its own.
    try {
      await unzippedSize(bytes, MAX_XLSX_UNZIPPED_BYTES);
    } catch (e) {
      if (e instanceof ZipTooLargeError) return { status: "too_large" };
      return { status: "unreadable", message: "This spreadsheet couldn't be opened. It's saved for your advisor." };
    }
  }

  let wb: XLSX.WorkBook;
  try {
    // sheetRows: a sheet's declared size is the file's to say, so no more rows are read than a census needs.
    wb = format === "csv"
      ? XLSX.read(new TextDecoder().decode(bytes), { type: "string", raw: true, sheetRows: MAX_SHEET_ROWS })
      : XLSX.read(bytes, { type: "array", cellDates: true, sheetRows: MAX_SHEET_ROWS });
  } catch (e) {
    if (isPasswordError(e)) return { status: "encrypted" };
    return { status: "unreadable", message: "This spreadsheet couldn't be opened. It's saved for your advisor." };
  }

  const grids: Grid[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws || !ws["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    // Raw values, so dates arrive as Dates whatever the sheet's display format, then as ISO text. Every
    // cell in the range is built, empty or not, so the range is clamped: sheetRows bounds the rows, not
    // the columns (A1:XFD200 is 3.3 million cells).
    const rows = XLSX.utils
      .sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "", blankrows: true, range: clampSheetRange(range) })
      .map((row) => row.map(cellToText));
    // sheetRows cuts !ref to the rows read; an .xls or .xlsx keeps its declared range in !fullref. A CSV declares
    // none, so one that filled every row read counts as running past them.
    const fullref = ws["!fullref"];
    const declaredRows = fullref
      ? XLSX.utils.decode_range(fullref).e.r - range.s.r + 1
      : rows.length >= MAX_SHEET_ROWS ? Number.POSITIVE_INFINITY : rows.length;
    grids.push({
      label: format === "csv" ? "CSV" : `Sheet ${name}`,
      firstRow: range.s.r + 1,
      rows,
      cutOff: sheetCutOff(rows, declaredRows),
    });
  }
  return await readTablesAndText(grids, [], ask);
}

// A census table is mapped column by column, so employee details never go to the model; the rest
// (other tables and the document's prose) is read by the model for company-level facts.
async function readTablesAndText(grids: Grid[], prose: TextSection[], ask: AskModel): Promise<Outcome> {
  const { candidates, notes, textSections } = readGrids(grids);
  const text = [...prose, ...textSections];
  const fromText = text.length > 0 ? await ask(text) : [];
  return { status: "extracted", notes, candidates: mergeCandidates(candidates, fromText) };
}

function cellToText(v: unknown): string {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  return v === null || v === undefined ? "" : String(v);
}
