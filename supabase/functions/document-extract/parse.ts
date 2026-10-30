// Pure helpers for document-extract: no Deno or network imports, so they're unit-tested
// with the frontend suite (vitest includes supabase/functions/**/*.test.ts).

import { isW2, normalizeCensus, parseMoney, type CensusEmployee } from "../_shared/census.ts";
import { isSensitiveHeader, redactSensitive } from "../_shared/sensitive.ts";

export const MAX_EXTRACT_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 50;
export const MAX_AI_TEXT_CHARS = 20_000;
/** Below this much text across the whole PDF, treat it as a scan. */
export const MIN_PDF_TEXT_CHARS = 200;

export type SniffedFormat = "pdf" | "xlsx" | "xls" | "docx" | "doc" | "csv" | "encrypted_office" | "unknown";

export type ExtractionStatus = "extracted" | "no_data" | "unsupported" | "encrypted" | "unreadable" | "too_large" | "failed";

export interface Candidate {
  field: string;
  value: unknown;
  location: string | null;
  /** For a census: the row facts the file had columns for. The rest are defaults or blank. */
  facts?: string[];
}

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);
const latin1 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
};
// Zip entry names and OLE stream names sit near the start or in a directory at the end.
const SAMPLE_BYTES = 64 * 1024;
const sample = (bytes: Uint8Array) =>
  bytes.length <= 2 * SAMPLE_BYTES
    ? latin1(bytes)
    : latin1(bytes.subarray(0, SAMPLE_BYTES)) + latin1(bytes.subarray(bytes.length - SAMPLE_BYTES));
const ext = (name: string) => name.toLowerCase().split(".").pop() ?? "";

/** Identifies the file by its contents (magic bytes), using the extension only to break ties. */
export function sniffFormat(bytes: Uint8Array, fileName: string): SniffedFormat {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // OOXML is a zip; its entry names appear in plain text in the local headers.
    const names = sample(bytes);
    if (names.includes("xl/")) return "xlsx";
    if (names.includes("word/")) return "docx";
    return "unknown";
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    // A password-protected .xlsx/.docx is stored as an OLE container with an EncryptionInfo stream.
    const utf16 = sample(bytes).replace(/\0/g, "");
    if (utf16.includes("EncryptionInfo") || ["xlsx", "docx"].includes(ext(fileName))) return "encrypted_office";
    if (utf16.includes("Workbook") || utf16.includes("Book") || ext(fileName) === "xls") return "xls";
    if (utf16.includes("WordDocument") || ext(fileName) === "doc") return "doc";
    return "unknown";
  }
  if (looksLikeDelimitedText(bytes)) return "csv";
  return "unknown";
}

function looksLikeDelimitedText(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, 4096);
  if (head.length === 0 || head.includes(0)) return false;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(head.length < bytes.length ? trimPartialUtf8(head) : head);
  } catch {
    return false;
  }
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return /[,\t;]/.test(firstLine);
}

// The 4 KB sample may cut a multi-byte character in half; drop the partial tail.
function trimPartialUtf8(b: Uint8Array): Uint8Array {
  let end = b.length;
  for (let i = 1; i <= 3 && end - i >= 0; i++) {
    const byte = b[end - i];
    if ((byte & 0xc0) === 0x80) continue; // continuation byte
    const len = byte >= 0xf0 ? 4 : byte >= 0xe0 ? 3 : byte >= 0xc0 ? 2 : 1;
    if (len > i) end -= i;
    break;
  }
  return b.subarray(0, end);
}

// ---- Census sheets ---------------------------------------------------------------------------

/** What a spreadsheet column can hold, before a row becomes a census row (_shared/census.ts). */
export type ColumnKey =
  | "first_name" | "last_name" | "full_name" | "dob" | "age" | "work_state" | "home_state" | "zip_code"
  | "job_title" | "annual_salary" | "hourly_rate" | "hours_per_week" | "compensation_type"
  | "employment_type" | "classification" | "coverage_tier" | "class_code";

// Header spellings, after normaliseHeader ("Work State:" -> "work state").
const SYNONYMS: Record<ColumnKey, string[]> = {
  first_name: ["first", "first name", "given name", "fname", "forename", "first nm", "legal first name"],
  last_name: ["last", "last name", "surname", "family name", "lname", "last nm", "legal last name"],
  full_name: ["name", "employee", "employee name", "full name", "worker", "worker name", "associate", "associate name", "team member", "legal name"],
  dob: ["dob", "date of birth", "birth date", "birthdate", "birthday", "bday", "d o b"],
  age: ["age", "current age", "age in years", "attained age"],
  work_state: ["state", "work state", "work location state", "location state", "st", "ee state", "employment state", "worksite state", "job state", "state worked", "work st", "state of employment", "work location"],
  home_state: ["home state", "residence state", "resident state", "state of residence", "res state"],
  zip_code: ["zip", "zip code", "zipcode", "postal code", "postal", "work zip", "home zip", "zip 5", "postcode", "residence zip"],
  job_title: ["title", "job title", "position", "job", "role", "occupation", "job description", "position title", "job name", "job role"],
  annual_salary: ["salary", "annual salary", "annual pay", "annual compensation", "compensation", "annual earnings", "annual wage", "annual wages", "wages", "base salary", "annual base", "base pay", "yearly salary", "salary amount", "annual income", "annualized salary", "annual rate", "annual base salary"],
  hourly_rate: ["hourly rate", "hourly", "rate per hour", "hourly wage", "hourly pay", "pay rate", "rate", "hr rate", "wage rate", "hourly pay rate"],
  hours_per_week: ["hours", "hours per week", "weekly hours", "hrs week", "hrs per week", "scheduled hours", "standard hours", "std hours", "average weekly hours", "avg hours"],
  compensation_type: ["pay type", "salary hourly", "salaried hourly", "hourly salary", "comp type", "compensation type", "pay basis", "pay class", "wage type", "salary type", "pay frequency type"],
  employment_type: ["employment type", "ft pt", "full time part time", "ft part time", "full part time", "time type", "fte status", "employment status", "status ft pt", "work schedule"],
  classification: ["classification", "worker type", "employee type", "emp type", "type", "tax type", "w2 1099", "w 2 1099", "1099 w2", "worker classification", "tax status", "worker category", "employment classification"],
  coverage_tier: ["coverage tier", "tier", "coverage", "coverage level", "medical tier", "medical coverage", "election", "medical election", "plan tier", "benefit tier", "enrollment tier", "health coverage", "coverage type", "med tier", "medical"],
  class_code: ["class code", "wc class code", "wc code", "workers comp code", "workers comp class", "comp code", "ncci code", "wc class", "workers compensation code", "workers comp class code", "gov class", "class"],
};

// Words a header may carry that don't change what the column holds ("Employee DOB", "Current Salary").
const FILLER = new Set(["employee", "employees", "ee", "emp", "worker", "current", "the", "of", "usd", "amount", "s"]);

// A header that names a column by its key words rather than an exact phrase.
const KEYWORDS: [ColumnKey, (t: Set<string>) => boolean][] = [
  ["dob", (t) => t.has("dob") || [...t].some((w) => w.startsWith("birth"))],
  ["zip_code", (t) => t.has("zip") || t.has("postal")],
  ["home_state", (t) => t.has("state") && (t.has("home") || t.has("residence") || t.has("resident"))],
  ["work_state", (t) => t.has("state") && !t.has("status")],
  ["class_code", (t) => t.has("class") && (t.has("code") || t.has("wc") || t.has("comp"))],
  ["classification", (t) => t.has("1099") || t.has("w2")],
  ["coverage_tier", (t) => t.has("tier") || t.has("coverage") || t.has("election")],
  ["hourly_rate", (t) => t.has("hourly") || (t.has("rate") && (t.has("hour") || t.has("hr")))],
  ["hours_per_week", (t) => t.has("hours") || t.has("hrs")],
  ["annual_salary", (t) => t.has("salary") || (t.has("annual") && (t.has("pay") || t.has("compensation") || t.has("wage") || t.has("wages") || t.has("earnings")))],
  ["employment_type", (t) => (t.has("full") || t.has("part")) && t.has("time")],
  ["job_title", (t) => t.has("title") || t.has("position") || t.has("occupation")],
  ["first_name", (t) => t.has("first")],
  ["last_name", (t) => t.has("last") || t.has("surname")],
  ["age", (t) => t.has("age")],
];

/**
 * Lower case with punctuation as single spaces, without a parenthesised hint ("DOB (MM/DD/YYYY)").
 * "#" reads as "number", so "Employee #" isn't taken for a name column.
 */
export const normaliseHeader = (h: unknown) =>
  String(h ?? "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/#/g, " number ").replace(/[^a-z0-9]+/g, " ").trim();

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/** How well a normalised header names a column: exact 100, after filler words 90, by key word 70, a typo 60. */
function headerScore(h: string, key: ColumnKey): number {
  if (!h) return 0;
  const synonyms = SYNONYMS[key];
  if (synonyms.includes(h)) return 100;
  const words = h.split(" ");
  const stripped = words.filter((w) => !FILLER.has(w)).join(" ");
  if (stripped && synonyms.includes(stripped)) return 90;
  const rule = KEYWORDS.find(([k]) => k === key);
  if (rule && rule[1](new Set(words))) return 70;
  for (const s of synonyms) {
    if (s.length >= 5 && Math.abs(s.length - h.length) <= 2 && editDistance(h, s) <= (s.length >= 9 ? 2 : 1)) return 60;
  }
  return 0;
}

export interface ColumnMap {
  columns: Partial<Record<ColumnKey, number>>;
  /** Columns holding an SSN or bank details: never read, and blanked before any text goes to the model. */
  sensitive: number[];
}

/** Matches a header row to census columns, best match first, one column per key and one key per column. */
export function mapCensusColumns(header: unknown[]): ColumnMap {
  const names = header.map(normaliseHeader);
  const sensitive = names.flatMap((h, i) => (isSensitiveHeader(h) ? [i] : []));
  const scored: { col: number; key: ColumnKey; score: number }[] = [];
  names.forEach((h, col) => {
    if (sensitive.includes(col)) return;
    for (const key of Object.keys(SYNONYMS) as ColumnKey[]) {
      const score = headerScore(h, key);
      if (score > 0) scored.push({ col, key, score });
    }
  });
  scored.sort((a, b) => b.score - a.score || a.col - b.col);
  const columns: ColumnMap["columns"] = {};
  const taken = new Set<number>();
  for (const { col, key } of scored) {
    if (columns[key] !== undefined || taken.has(col)) continue;
    columns[key] = col;
    taken.add(col);
  }
  return { columns, sensitive };
}

// Facts beyond the name that make a sheet a census rather than any list with names on it.
const CENSUS_FACTS: ColumnKey[] = [
  "dob", "age", "work_state", "home_state", "zip_code", "job_title", "annual_salary", "hourly_rate",
  "classification", "coverage_tier", "class_code", "employment_type",
];

const cell = (row: unknown[], i: number | undefined) => (i === undefined ? undefined : row[i]);
const hasText = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";
const looksLikeName = (v: unknown) => /\p{L}/u.test(String(v ?? ""));

export interface CensusResult {
  census: CensusEmployee[];
  location: string;
  /** Census row facts the sheet had a column for, so a merge never overwrites a stated fact with a default. */
  facts: string[];
  /** Rows with content that couldn't become a census row (no name, or a worker type that isn't W-2 or 1099). */
  skipped: number;
  /** Headers of columns that were never read because they hold an SSN or bank details. */
  ignoredColumns: string[];
}

/**
 * Reads an employee census from a sheet's rows (first row first). Returns null when the sheet
 * doesn't look like one: it needs a name column and at least two other census columns within the
 * first 10 rows. `firstRow` is the spreadsheet row number of rows[0], for saying where it was found.
 */
export function findCensus(rows: unknown[][], sheet: string, firstRow = 1, now: Date = new Date()): CensusResult | null {
  for (let h = 0; h < Math.min(rows.length, 10); h++) {
    const header = rows[h] ?? [];
    const { columns: c, sensitive } = mapCensusColumns(header);
    const nameCol = c.first_name ?? c.full_name;
    const facts = CENSUS_FACTS.filter((k) => c[k] !== undefined);
    if (nameCol === undefined || facts.length < 2) continue;

    const raw: Record<string, unknown>[] = [];
    let skipped = 0;
    let firstData = -1;
    let lastData = h;
    for (let r = h + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      if (!row.some(hasText)) continue;
      const name = cell(row, nameCol);
      // Totals and notes under the table aren't people.
      if (!looksLikeName(name) || /^(total|totals|grand total|count|average|subtotal)\b/i.test(String(name).trim())) {
        if (hasText(name) || row.some(hasText)) skipped++;
        continue;
      }
      const hourly = cell(row, c.hourly_rate);
      // A "pay rate" of 85,000 is a salary, not an hourly rate.
      const hourlyIsAnnual = (parseMoney(hourly) ?? 0) >= 1000;
      raw.push({
        first_name: cell(row, c.first_name),
        last_name: cell(row, c.last_name),
        full_name: cell(row, c.full_name),
        dob: cell(row, c.dob),
        age: cell(row, c.age),
        work_state: c.work_state !== undefined ? cell(row, c.work_state) : cell(row, c.home_state),
        zip_code: cell(row, c.zip_code),
        job_title: cell(row, c.job_title),
        annual_salary: cell(row, c.annual_salary) ?? (hourlyIsAnnual ? hourly : undefined),
        hourly_rate: hourlyIsAnnual ? undefined : hourly,
        hours_per_week: cell(row, c.hours_per_week),
        compensation_type: cell(row, c.compensation_type),
        // An "Employee Type" column often says full or part time rather than W-2 or 1099.
        employment_type: cell(row, c.employment_type) ?? cell(row, c.classification),
        classification: cell(row, c.classification),
        coverage_tier: cell(row, c.coverage_tier),
        class_code: cell(row, c.class_code),
      });
      if (firstData === -1) firstData = r;
      lastData = r;
    }
    const census = normalizeCensus(raw, now);
    skipped += raw.length - census.length;
    if (census.length === 0) return null;
    const has = (...keys: ColumnKey[]) => keys.some((k) => c[k] !== undefined);
    const stated: [string, boolean][] = [
      ["dob", has("dob")],
      ["age", has("age")],
      ["work_state", has("work_state", "home_state")],
      ["zip_code", has("zip_code")],
      ["job_title", has("job_title")],
      ["annual_salary", has("annual_salary", "hourly_rate")],
      ["compensation_type", has("compensation_type", "hourly_rate")],
      ["employment_type", has("employment_type", "hours_per_week")],
      ["classification", has("classification")],
      ["coverage_tier", has("coverage_tier")],
      ["class_code", has("class_code")],
    ];
    return {
      census,
      location: `${sheet}, rows ${firstRow + firstData}–${firstRow + lastData}`,
      facts: stated.filter(([, yes]) => yes).map(([fact]) => fact),
      skipped,
      ignoredColumns: sensitive.map((i) => String(header[i] ?? "").trim()).filter(Boolean),
    };
  }
  return null;
}

/** The census plus the headcount, states and contractor facts it implies. */
export function censusCandidates({ census, location, facts }: CensusResult): Candidate[] {
  const states = [...new Set(census.map((e) => e.work_state).filter(Boolean))].sort();
  const contractors = census.filter((e) => !isW2(e));
  const candidates: Candidate[] = [
    { field: "census", value: census, location, facts },
    { field: "employee_count", value: census.filter(isW2).length, location },
  ];
  if (states.length > 0) candidates.push({ field: "states", value: states, location });
  if (contractors.length > 0) candidates.push({ field: "has_1099", value: true, location });
  if (contractors.some((e) => e.work_state === "CA")) candidates.push({ field: "ca_contractors", value: true, location });
  return candidates;
}

/** What the prospect should know about how a census was read. */
export function censusNotes({ skipped, ignoredColumns }: CensusResult): string[] {
  const notes: string[] = [];
  if (ignoredColumns.length > 0) {
    notes.push(
      `The ${ignoredColumns.join(", ")} column${ignoredColumns.length === 1 ? " wasn't" : "s weren't"} read and ` +
        "nothing from it is kept with your intake. The file itself still contains it; consider uploading a copy without it.",
    );
  }
  if (skipped > 0) {
    notes.push(
      `${skipped} row${skipped === 1 ? " was" : "s were"} left out: no name, a total line, or a worker type that isn't W-2 or 1099.`,
    );
  }
  return notes;
}

/**
 * A sheet as text for the model: comma-separated rows with SSN and bank columns blanked and any
 * sensitive number in the remaining cells removed.
 */
export function sheetText(rows: unknown[][]): string {
  const sensitive = new Set<number>();
  for (const row of rows.slice(0, 10)) mapCensusColumns(row).sensitive.forEach((i) => sensitive.add(i));
  const text = rows
    .map((row) => row.map((v, i) => (sensitive.has(i) ? "" : String(v ?? "").replace(/[\r\n,]+/g, " ").trim())).join(","))
    .filter((line) => line.replace(/,/g, "").trim())
    .join("\n");
  return redactSensitive(text);
}

// ---- Tables and text, from any format ---------------------------------------------------------

/** A table of cells: a spreadsheet's sheet or a Word document's table. */
export interface Grid {
  label: string;
  rows: unknown[][];
  /** Spreadsheet row number of rows[0], so a location reads "rows 3–40". */
  firstRow?: number;
}

export interface GridReading {
  candidates: Candidate[];
  notes: string[];
  /** Tables that aren't a census, as text for the model. */
  textSections: TextSection[];
}

/**
 * Reads the first census found among `grids` column by column, so employee details never go to the
 * model; every other table becomes text for it.
 */
export function readGrids(grids: Grid[], now: Date = new Date()): GridReading {
  const candidates: Candidate[] = [];
  const notes: string[] = [];
  const textSections: TextSection[] = [];
  let found = false;
  for (const g of grids) {
    const census = found ? null : findCensus(g.rows, g.label, g.firstRow ?? 1, now);
    if (census) {
      found = true;
      candidates.push(...censusCandidates(census));
      notes.push(...censusNotes(census));
      continue;
    }
    const text = sheetText(g.rows);
    if (text.replace(/[,\s]/g, "")) textSections.push({ label: g.label, text });
  }
  return { candidates, notes, textSections };
}

/** Candidates from tables first; the model's reading of the text only fills fields they didn't. */
export function mergeCandidates(fromTables: Candidate[], fromText: Candidate[]): Candidate[] {
  const taken = new Set(fromTables.map((c) => c.field));
  return [...fromTables, ...fromText.filter((c) => !taken.has(c.field))];
}

// ---- Word documents --------------------------------------------------------------------------

export interface DocxContent {
  /** Paragraph text outside tables, in order. */
  paragraphs: string[];
  /** Each table's rows of cell text. */
  tables: string[][][];
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_m, e: string) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : XML_ENTITIES[e.toLowerCase()]);

function paragraphTexts(xml: string): string[] {
  const out: string[] = [];
  for (const p of xml.replace(/<w:p\b[^>]*\/>/g, "").match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []) {
    let text = "";
    for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\b[^>]*\/>|<w:cr\/>/g)) {
      text += m[1] !== undefined ? decodeXml(m[1]) : m[0].startsWith("<w:tab") ? "\t" : "\n";
    }
    out.push(text.trim());
  }
  return out;
}

/** The text of a .docx body (word/document.xml): paragraphs, and tables as rows of cells. */
export function docxContent(xml: string): DocxContent {
  const tables: string[][][] = [];
  const body = xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (tbl) => {
    tables.push((tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []).map((tr) =>
      (tr.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) ?? []).map((tc) => paragraphTexts(tc).filter(Boolean).join(" "))));
    return "";
  });
  return { paragraphs: paragraphTexts(body).filter(Boolean), tables };
}

const SECTION_CHARS = 2000;

/** Paragraphs grouped into sections of about 2,000 characters, labelled by paragraph number. */
export function paragraphSections(paragraphs: string[]): TextSection[] {
  const sections: TextSection[] = [];
  let start = 0;
  let lines: string[] = [];
  let size = 0;
  const flush = (end: number) => {
    if (lines.length === 0) return;
    sections.push({ label: end === start ? `Paragraph ${start + 1}` : `Paragraphs ${start + 1}–${end + 1}`, text: lines.join("\n") });
    lines = [];
    size = 0;
  };
  paragraphs.forEach((p, i) => {
    if (lines.length > 0 && size + p.length > SECTION_CHARS) flush(i - 1);
    if (lines.length === 0) start = i;
    lines.push(p);
    size += p.length + 1;
  });
  flush(paragraphs.length - 1);
  return sections;
}

// ---- AI-read fields from document text --------------------------------------------------------

/** Company-level facts a document may state. Individual employee details are never asked for. */
export const DOCUMENT_FIELDS = [
  "company_name", "industry", "hq_state", "states", "employee_count", "start_month",
  "virgin_medical", "current_carrier", "renewal_date", "rate_history", "benefits_waiting_period",
  "ancillary_benefits", "has_401k", "retirement_type", "employer_contributes",
  "payroll_vendor", "pay_frequency", "nonexempt_count", "exempt_count",
  "has_handbook", "has_1099", "ca_contractors",
] as const;

const BOOLEAN_FIELDS = new Set([
  "virgin_medical", "has_401k", "employer_contributes", "has_handbook", "has_1099", "ca_contractors",
]);

export interface TextSection {
  label: string;
  text: string;
}

/** Joins sections under numbered markers the model cites back, capped at the AI text limit. */
export function buildPromptText(sections: TextSection[]): string {
  let out = "";
  for (const [i, s] of sections.entries()) {
    // Sensitive numbers never reach the model.
    const chunk = `[[Section ${i + 1}]]\n${redactSensitive(s.text).trim()}\n\n`;
    if (out.length + chunk.length > MAX_AI_TEXT_CHARS) {
      out += chunk.slice(0, Math.max(0, MAX_AI_TEXT_CHARS - out.length));
      break;
    }
    out += chunk;
  }
  return out;
}

/** Turns the model's `fields` list into candidates, dropping unknown fields and empty values. */
export function shapeAiCandidates(raw: unknown, sections: TextSection[]): Candidate[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(DOCUMENT_FIELDS);
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { field, value, section } = item as Record<string, unknown>;
    if (typeof field !== "string" || !allowed.has(field) || seen.has(field)) continue;
    let v: unknown = value;
    if (typeof v === "string") v = redactSensitive(v).trim();
    if (v === null || v === undefined || v === "") continue;
    if (BOOLEAN_FIELDS.has(field) && typeof v === "string") {
      if (/^(yes|true|y)$/i.test(v)) v = true;
      else if (/^(no|false|n|none)$/i.test(v)) v = false;
      else continue;
    }
    const idx = typeof section === "number" ? section - 1 : Number(section) - 1;
    seen.add(field);
    out.push({ field, value: v, location: sections[idx]?.label ?? null });
  }
  return out;
}

/** The file's SHA-256, as lowercase hex (documents.file_sha256). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Classifies a parser error as a password-protected file. */
export function isPasswordError(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? "";
  const message = (e as { message?: string })?.message ?? String(e);
  return name === "PasswordException" || /password|encrypt/i.test(message);
}
