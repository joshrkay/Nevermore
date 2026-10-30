// @deno-types="https://cdn.sheetjs.com/xlsx-0.20.3/package/types/index.d.ts"
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
import { extractText, getDocumentProxy } from "npm:unpdf@1.8.1";
import {
  docxContent,
  isPasswordError,
  MAX_EXTRACT_BYTES,
  MAX_PDF_PAGES,
  mergeCandidates,
  MIN_PDF_TEXT_CHARS,
  paragraphSections,
  readGrids,
  sniffFormat,
  type Candidate,
  type ExtractionStatus,
  type Grid,
  type TextSection,
} from "./parse.ts";
import { readZipEntry } from "./zip.ts";

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
  let wb: XLSX.WorkBook;
  try {
    wb = format === "csv"
      ? XLSX.read(new TextDecoder().decode(bytes), { type: "string", raw: true })
      : XLSX.read(bytes, { type: "array", cellDates: true });
  } catch (e) {
    if (isPasswordError(e)) return { status: "encrypted" };
    return { status: "unreadable", message: "This spreadsheet couldn't be opened. It's saved for your advisor." };
  }

  const grids: Grid[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws || !ws["!ref"]) continue;
    grids.push({
      label: format === "csv" ? "CSV" : `Sheet ${name}`,
      firstRow: XLSX.utils.decode_range(ws["!ref"]).s.r + 1,
      // Raw values, so dates arrive as Dates whatever the sheet's display format, then as ISO text.
      rows: XLSX.utils
        .sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "", blankrows: true })
        .map((row) => row.map(cellToText)),
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
