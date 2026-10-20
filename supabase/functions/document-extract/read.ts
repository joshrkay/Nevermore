// @deno-types="https://cdn.sheetjs.com/xlsx-0.20.3/package/types/index.d.ts"
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
import { extractText, getDocumentProxy } from "npm:unpdf@1.8.1";
import {
  censusCandidates,
  findCensus,
  isPasswordError,
  MAX_EXTRACT_BYTES,
  MAX_PDF_PAGES,
  MIN_PDF_TEXT_CHARS,
  sniffFormat,
  type Candidate,
  type ExtractionStatus,
  type TextSection,
} from "./parse.ts";

// Turns a document's bytes into candidate fields, or a status saying why it couldn't be read.
// File-format work lives here; the model is reached only through `ask`.

export type Outcome = { status: ExtractionStatus; message?: string; candidates?: Candidate[] };
export type AskModel = (sections: TextSection[]) => Promise<Candidate[]>;

/** The model call was refused by the rate limit; the document stays ready to read later. */
export class AiQuotaError extends Error {}

/** Reads a stored document's bytes into candidates. `ask` reads free text with the model. */
export async function readDocument(bytes: Uint8Array, fileName: string, ask: AskModel): Promise<Outcome> {
  if (bytes.length > MAX_EXTRACT_BYTES) return { status: "too_large" };
  const format = sniffFormat(bytes, fileName);
  switch (format) {
    case "encrypted_office":
      return { status: "encrypted" };
    case "doc":
    case "docx":
      return { status: "unsupported", message: "Word files are saved for your advisor but not read automatically." };
    case "unknown":
      return { status: "unsupported", message: "This file's contents don't match a PDF, Excel, or CSV file." };
    case "pdf":
      return await readPdf(bytes, ask);
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

  const candidates: Candidate[] = [];
  const otherSheets: TextSection[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws || !ws["!ref"]) continue;
    const firstRow = XLSX.utils.decode_range(ws["!ref"]).s.r + 1;
    // Raw values, so dates arrive as Dates whatever the sheet's display format, then as ISO text.
    const rows = XLSX.utils
      .sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "", blankrows: true })
      .map((row) => row.map(cellToText));
    const label = format === "csv" ? "CSV" : `Sheet ${name}`;
    // A roster is mapped column by column here, so employee details never go to the model.
    const census = candidates.some((c) => c.field === "employees") ? null : findCensus(rows, label, firstRow);
    if (census) candidates.push(...censusCandidates(census));
    else otherSheets.push({ label, text: XLSX.utils.sheet_to_csv(ws) });
  }
  if (otherSheets.some((s) => s.text.replace(/[,\s]/g, "").length > 0)) {
    const fromText = await ask(otherSheets);
    const taken = new Set(candidates.map((c) => c.field));
    candidates.push(...fromText.filter((c) => !taken.has(c.field)));
  }
  return { status: "extracted", candidates };
}

function cellToText(v: unknown): string {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  return v === null || v === undefined ? "" : String(v);
}
