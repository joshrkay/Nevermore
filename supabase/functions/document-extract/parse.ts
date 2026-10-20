// Pure helpers for document-extract: no Deno or network imports, so they're unit-tested
// with the frontend suite (vitest includes supabase/functions/**/*.test.ts).

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

type CensusKey = "first_name" | "last_name" | "full_name" | "dob" | "state" | "title" | "salary" | "classification";

const HEADER_PATTERNS: [CensusKey, RegExp][] = [
  ["first_name", /^(first|first name|given name|fname|employee first name)$/],
  ["last_name", /^(last|last name|surname|family name|lname|employee last name)$/],
  ["full_name", /^(name|employee|employee name|full name|employee full name)$/],
  ["dob", /^(dob|date of birth|birth date|birthdate|birthday)$/],
  ["state", /^(state|work state|work location state|location state|st|ee state|home state)$/],
  ["title", /^(title|job title|position|job|role)$/],
  ["salary", /^(salary|annual salary|annual pay|annual compensation|compensation|annual earnings|annual wage|wages)$/],
  ["classification", /^(classification|worker type|employee type|emp type|type|tax type|w2 1099|w 2 1099)$/],
];

const normalizeHeader = (h: unknown) =>
  String(h ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function mapHeader(row: unknown[]): Partial<Record<CensusKey, number>> {
  const map: Partial<Record<CensusKey, number>> = {};
  row.forEach((cell, i) => {
    const h = normalizeHeader(cell);
    for (const [key, re] of HEADER_PATTERNS) {
      if (map[key] === undefined && re.test(h)) {
        map[key] = i;
        break;
      }
    }
  });
  return map;
}

const cellText = (row: unknown[], i: number | undefined) =>
  i === undefined ? "" : String(row[i] ?? "").trim();

function splitFullName(name: string): [string, string] {
  if (name.includes(",")) {
    const [last, first] = name.split(",", 2).map((s) => s.trim());
    return [first, last];
  }
  const parts = name.split(/\s+/);
  return [parts[0] ?? "", parts.slice(1).join(" ")];
}

function parseMoney(s: string): number | null {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return s && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export interface CensusEmployee {
  first_name: string;
  last_name: string;
  dob: string;
  state: string;
  title: string;
  salary: number | null;
  classification: string;
  dependents: never[];
}

export interface CensusResult {
  employees: CensusEmployee[];
  location: string;
}

/**
 * Reads an employee roster from a sheet's rows (as strings, first row first). Returns null when
 * the sheet doesn't look like a census: it needs a name column and at least two other census columns.
 * `firstRow` is the spreadsheet row number of rows[0], used to say where the data was found.
 */
export function findCensus(rows: unknown[][], sheet: string, firstRow = 1): CensusResult | null {
  for (let h = 0; h < Math.min(rows.length, 10); h++) {
    const map = mapHeader(rows[h] ?? []);
    const hasName = map.first_name !== undefined || map.full_name !== undefined;
    const others = (["dob", "state", "title", "salary", "classification"] as const).filter((k) => map[k] !== undefined);
    if (!hasName || others.length < 2) continue;

    const employees: CensusEmployee[] = [];
    let lastDataRow = h;
    for (let r = h + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      let first = cellText(row, map.first_name);
      let last = cellText(row, map.last_name);
      if (!first && map.full_name !== undefined) [first, last] = splitFullName(cellText(row, map.full_name));
      if (!first) continue;
      employees.push({
        first_name: first,
        last_name: last,
        dob: cellText(row, map.dob),
        state: cellText(row, map.state).toUpperCase(),
        title: cellText(row, map.title),
        salary: parseMoney(cellText(row, map.salary)),
        classification: cellText(row, map.classification),
        dependents: [],
      });
      lastDataRow = r;
    }
    if (employees.length === 0) return null;
    const from = firstRow + h + 1;
    const to = firstRow + lastDataRow;
    return { employees, location: `${sheet}, rows ${from}–${to}` };
  }
  return null;
}

const isW2 = (c: string) => !/1099|contractor|freelanc/i.test(c);

/** Roster plus the headcount, states, and contractor flag it implies. */
export function censusCandidates(census: CensusResult): Candidate[] {
  const { employees, location } = census;
  const states = [...new Set(employees.map((e) => e.state).filter((s) => /^[A-Z]{2}$/.test(s)))];
  const candidates: Candidate[] = [
    { field: "employees", value: employees, location },
    { field: "employee_count", value: employees.filter((e) => isW2(e.classification)).length, location },
  ];
  if (states.length > 0) candidates.push({ field: "states", value: states, location });
  if (employees.some((e) => !isW2(e.classification))) candidates.push({ field: "has_1099", value: true, location });
  return candidates;
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
    const chunk = `[[Section ${i + 1}]]\n${s.text.trim()}\n\n`;
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
    if (typeof v === "string") v = v.trim();
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

/** Classifies a parser error as a password-protected file. */
export function isPasswordError(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? "";
  const message = (e as { message?: string })?.message ?? String(e);
  return name === "PasswordException" || /password|encrypt/i.test(message);
}
