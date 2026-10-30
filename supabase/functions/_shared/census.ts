// The canonical employee census row (chamber_data.census) and the rules that turn loosely typed
// values (a spreadsheet cell, a voice extraction, a row saved by an earlier version) into one.
// No imports beyond the redaction rules: document-extract runs it under Deno, and the front end
// re-exports it (src/data/census.ts), so a row means the same thing on both sides.

import { redactSensitive } from "./sensitive.ts";

// The values a census row takes. The intake database accepts the same lists
// (migration 20261029092000) and src/data/schemaSync.test.ts compares them.
export const COVERAGE_TIERS = ["EE", "EE+SP", "EE+CH", "FAM", "WAIVE"] as const;
export const COMPENSATION_TYPES = ["salary", "hourly"] as const;
export const EMPLOYMENT_TYPES = ["full_time", "part_time"] as const;
export const CLASSIFICATIONS = ["w2", "1099"] as const;

export type CoverageTier = (typeof COVERAGE_TIERS)[number];
export type CompensationType = (typeof COMPENSATION_TYPES)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type WorkerClassification = (typeof CLASSIFICATIONS)[number];

/** The most people an intake holds; the database refuses a longer census. */
export const MAX_CENSUS_ROWS = 5000;
/** The most dependents one person holds; the database refuses more. */
export const MAX_DEPENDENTS = 20;
/** The most a year's pay can be; the database refuses more. */
export const MAX_ANNUAL_SALARY = 1_000_000;

export interface CensusDependent {
  first_name: string;
  last_name: string;
  dob: string;
  relationship: "spouse" | "domestic_partner" | "child" | "other";
}

export interface CensusEmployee {
  id: string; // generated uuid
  first_name: string;
  last_name: string;
  dob?: string; // YYYY-MM-DD
  age?: number;
  work_state: string; // 2-letter uppercase; "" until known
  zip_code?: string;
  job_title?: string;
  annual_salary?: number;
  compensation_type: CompensationType;
  employment_type: EmploymentType;
  classification: WorkerClassification;
  coverage_tier?: CoverageTier;
  class_code?: string; // Workers' comp 4-digit code if present
  /** Dependents the prospect named in conversation. Not read from documents. */
  dependents?: CensusDependent[];
}

export const COVERAGE_TIER_LABELS: Record<CoverageTier, string> = {
  EE: "Employee Only",
  "EE+SP": "Employee + Spouse",
  "EE+CH": "Employee + Child(ren)",
  FAM: "Employee + Family",
  WAIVE: "Waived",
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Postgres jsonb refuses NUL and unpaired surrogates before any check can name the field, so they are
// removed here rather than becoming a save that fails without saying why.
const UNPAIRED_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;

/** A string without the characters the database can't store. */
export const stripUnstorable = (s: string) => s.split("\u0000").join("").replace(UNPAIRED_SURROGATE, "");

/** Cell or field text: trimmed, unstorable characters and sensitive numbers removed, capped. Empty for anything else. */
export function cleanText(v: unknown, max = 200): string {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  if (typeof v !== "string") return "";
  return redactSensitive(stripUnstorable(v)).replace(/\s+/g, " ").trim().slice(0, max);
}

// Lower case, punctuation as single spaces: "W-2 / 1099" -> "w 2 1099".
const key = (v: unknown) => cleanText(v).toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim();

// ---------- Dates and ages ----------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function isoDate(y: number, m: number, d: number): string | undefined {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  return date.toISOString().slice(0, 10);
}

// Excel stores dates as days since 1899-12-30. Only plausible birth dates (1927 to 2119) are read this way.
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const fromExcelSerial = (n: number) => new Date(EXCEL_EPOCH + Math.round(n) * 86_400_000).toISOString().slice(0, 10);

/**
 * A date of birth as YYYY-MM-DD. Reads ISO dates, US month/day/year (two-digit years are the most
 * recent past year), month names ("Mar 15, 1988", "15 March 1988"), Excel serial numbers and Dates.
 * Undefined for anything else, and for dates before 1900 or after `now`.
 */
export function normalizeDob(v: unknown, now: Date = new Date()): string | undefined {
  let iso: string | undefined;
  if (v instanceof Date) {
    iso = Number.isNaN(v.getTime()) ? undefined : v.toISOString().slice(0, 10);
  } else if (typeof v === "number") {
    iso = v >= 10_000 && v <= 80_000 ? fromExcelSerial(v) : undefined;
  } else if (typeof v === "string") {
    iso = parseDateText(v.trim(), now);
  }
  if (!iso || iso < "1900-01-01" || iso > now.toISOString().slice(0, 10)) return undefined;
  return iso;
}

function parseDateText(s: string, now: Date): string | undefined {
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) return isoDate(fullYear(m[3], now), +m[1], +m[2]);
  m = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
  if (m) return monthName(m[1]) ? isoDate(+m[3], monthName(m[1])!, +m[2]) : undefined;
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,9})\.?[\s,-]+(\d{2}|\d{4})$/i);
  if (m) return monthName(m[2]) ? isoDate(fullYear(m[3], now), monthName(m[2])!, +m[1]) : undefined;
  return undefined;
}

function monthName(s: string): number | undefined {
  const i = MONTHS.indexOf(s.slice(0, 3).toLowerCase());
  return i === -1 ? undefined : i + 1;
}

// For a birth date, '88 is 1988 and '05 is 2005: the latest year that isn't in the future.
function fullYear(y: string, now: Date): number {
  if (y.length === 4) return +y;
  const century = Math.floor(now.getUTCFullYear() / 100) * 100;
  return century + +y > now.getUTCFullYear() ? century - 100 + +y : century + +y;
}

/** Whole years, for a working-age employee (14 to 100). */
export function normalizeAge(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.trim()) : NaN;
  return Number.isFinite(n) && n >= 14 && n <= 100 ? Math.floor(n) : undefined;
}

/** Age in whole years on `on`, from a YYYY-MM-DD date of birth. */
export function ageOn(dob: string, on: Date = new Date()): number {
  const [y, m, d] = dob.split("-").map(Number);
  let age = on.getUTCFullYear() - y;
  if (on.getUTCMonth() + 1 < m || (on.getUTCMonth() + 1 === m && on.getUTCDate() < d)) age--;
  return age;
}

// ---------- Places ----------

const STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "puerto rico": "PR", guam: "GU", "virgin islands": "VI", "us virgin islands": "VI",
  "american samoa": "AS", "northern mariana islands": "MP", "washington dc": "DC", "washington d c": "DC",
};
/** The 50 states, DC and the five inhabited territories: the codes the intake database accepts. */
export const US_STATE_CODES: ReadonlySet<string> = new Set(Object.values(STATE_NAMES));
const STATE_CODES = US_STATE_CODES;

/** A two-letter US state or territory code from a code or a name. "" when it isn't one. */
export function normalizeState(v: unknown): string {
  const raw = cleanText(v, 60);
  if (/^[A-Za-z]{2}$/.test(raw)) return STATE_CODES.has(raw.toUpperCase()) ? raw.toUpperCase() : "";
  return STATE_NAMES[raw.toLowerCase().replace(/[^a-z]+/g, " ").trim()] ?? "";
}

/** 12345 or 12345-6789. Spreadsheets drop leading zeros, so a 3- or 4-digit number is padded. */
export function normalizeZip(v: unknown): string | undefined {
  const s = typeof v === "number" && Number.isInteger(v) ? String(v) : typeof v === "string" ? v.trim() : "";
  if (/^\d{3,4}$/.test(s)) return s.padStart(5, "0");
  const m = s.match(/^(\d{5})(?:[- ]?(\d{4}))?$/);
  if (!m) return undefined;
  return m[2] ? `${m[1]}-${m[2]}` : m[1];
}

// ---------- Pay and work ----------

/** A positive amount of money from 85000, "$85,000.00", "85k" or "$32.50/hr". */
export function parseMoney(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : undefined;
  if (typeof v !== "string") return undefined;
  const m = v.trim().toLowerCase().replace(/[$,\s]|usd/g, "").match(/^(\d+(?:\.\d+)?)(k)?(?:\/?(?:yr|year|annual|annually|hr|hour|hourly))?$/);
  if (!m) return undefined;
  const n = Number(m[1]) * (m[2] ? 1000 : 1);
  return n > 0 ? n : undefined;
}

/** Whole dollars a year, up to the most the intake holds. Pay above that is left blank, not capped. */
export function normalizeAnnualSalary(v: unknown): number | undefined {
  const n = parseMoney(v);
  return n !== undefined && Math.round(n) <= MAX_ANNUAL_SALARY ? Math.round(n) : undefined;
}

export function normalizeCompensationType(v: unknown): CompensationType | undefined {
  const k = key(v);
  if (/^(salary|salaried|s|annual|yearly|exempt salary)$/.test(k)) return "salary";
  if (/^(hourly|h|hr|hrly|per hour|non salaried|wage|wages)$/.test(k)) return "hourly";
  return undefined;
}

export function normalizeEmploymentType(v: unknown): EmploymentType | undefined {
  const k = key(v);
  if (/^(ft|f|full|full time|fulltime|full time employee|fte)$/.test(k)) return "full_time";
  if (/^(pt|p|part|part time|parttime|part time employee)$/.test(k)) return "part_time";
  return undefined;
}

/** Weekly hours to full or part time, at the ACA's 30-hour line. */
export function employmentTypeFromHours(v: unknown): EmploymentType | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 168) return undefined;
  return n >= 30 ? "full_time" : "part_time";
}

/**
 * "w2" or "1099" from the many ways rosters label them. Undefined when blank (a roster rarely labels
 * its W-2s); null for a label it doesn't recognise, which is never guessed: counting a contractor
 * as W-2 corrupts headcount and the California AB5 flag.
 */
export function normalizeClassification(v: unknown): WorkerClassification | null | undefined {
  const k = key(v);
  if (!k) return undefined;
  if (/^(w ?2|w ?2 employee|employee|ee|emp|regular|full time|part time|ft|pt|salary|salaried|hourly|staff|exempt|non exempt|nonexempt)$/.test(k)) return "w2";
  if (/^(1099|1099 nec|1099 misc|1099 contractor|contractor|independent contractor|ic|freelance|freelancer|consultant|vendor)$/.test(k)) return "1099";
  return null;
}

export function normalizeCoverageTier(v: unknown): CoverageTier | undefined {
  const k = cleanText(v, 60).toUpperCase().replace(/\(REN\)|\(S\)/g, "").replace(/\s*(&|\/|\+|PLUS|AND)\s*/g, "+").replace(/\s+/g, " ").trim();
  if (/^(EE|E|EMP|EMPLOYEE|EMPLOYEE ONLY|EE ONLY|SINGLE|INDIVIDUAL|EO)$/.test(k)) return "EE";
  if (/^(ES|EE\+SP|EE\+S|EE\+SPOUSE|EMPLOYEE\+SPOUSE|EE\+DP|EMPLOYEE\+DOMESTIC PARTNER|EE\+PARTNER)$/.test(k)) return "EE+SP";
  if (/^(EC|EE\+CH|EE\+C|EE\+CHILD|EE\+CHILDREN|EMPLOYEE\+CHILD|EMPLOYEE\+CHILDREN|EE\+DEP|EE\+DEPENDENTS?)$/.test(k)) return "EE+CH";
  if (/^(F|FAM|FAMILY|EE\+FAM|EE\+FAMILY|EMPLOYEE\+FAMILY|EE\+SP\+CH|EE\+SPOUSE\+CHILDREN)$/.test(k)) return "FAM";
  if (/^(W|WV|WAIVE|WAIVED|WAIVER|DECLINE|DECLINED|NONE|NO COVERAGE|N\/A)$/.test(k)) return "WAIVE";
  return undefined;
}

/** A workers' comp class code as four digits ("8810"). Spreadsheets drop leading zeros ("42" is 0042). */
export function normalizeClassCode(v: unknown): string | undefined {
  const s = typeof v === "number" && Number.isInteger(v) ? String(v) : typeof v === "string" ? v.trim() : "";
  const m = s.match(/^(\d{1,4})(?:[-.]\d{1,2})?$/);
  return m && Number(m[1]) > 0 ? m[1].padStart(4, "0") : undefined;
}

// ---------- Rows ----------

const RELATIONSHIPS = new Set(["spouse", "domestic_partner", "child", "other"]);

/** Valid dependents, the first MAX_DEPENDENTS of them (invalid ones use no slot). */
function normalizeDependents(v: unknown, now: Date): CensusDependent[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((d) => {
    if (!isRecord(d)) return [];
    const first_name = cleanText(d.first_name);
    if (!first_name) return [];
    const relationship = typeof d.relationship === "string" && RELATIONSHIPS.has(d.relationship) ? d.relationship : "other";
    return [{
      first_name,
      last_name: cleanText(d.last_name),
      dob: normalizeDob(d.dob, now) ?? "",
      relationship: relationship as CensusDependent["relationship"],
    }];
  }).slice(0, MAX_DEPENDENTS);
}

function splitFullName(name: string): [string, string] {
  if (name.includes(",")) {
    const [last, first] = name.split(",", 2).map((s) => s.trim());
    return [first, last];
  }
  const parts = name.split(/\s+/);
  return [parts[0] ?? "", parts.slice(1).join(" ")];
}

const HOURS_PER_YEAR_FULL_TIME = 2080;

/**
 * One census row from loosely typed input, or null when it can't be one (no first name, or a
 * worker classification it doesn't recognise). Accepts the canonical keys, plus `full_name`,
 * `hourly_rate` and `hours_per_week` from a spreadsheet, and the keys rows were saved with before
 * the census contract (`state`, `title`, `salary`, "W2"). The id is left for normalizeCensus.
 *
 * Unknown pay type and hours default to salaried and full time, as an unlabelled roster usually
 * means; the prospect reviews every row before it is added.
 */
export function normalizeCensusRow(raw: unknown, now: Date = new Date()): Omit<CensusEmployee, "id"> & { id?: string } | null {
  if (!isRecord(raw)) return null;
  let first_name = cleanText(raw.first_name);
  let last_name = cleanText(raw.last_name);
  if (!first_name && raw.full_name !== undefined) [first_name, last_name] = splitFullName(cleanText(raw.full_name));
  if (!first_name) return null;

  const classification = normalizeClassification(raw.classification);
  if (classification === null) return null;

  const hourlyRate = parseMoney(raw.hourly_rate);
  const employment_type =
    normalizeEmploymentType(raw.employment_type) ?? employmentTypeFromHours(raw.hours_per_week) ?? "full_time";
  let annual_salary = normalizeAnnualSalary(raw.annual_salary ?? raw.salary);
  const compensation_type =
    normalizeCompensationType(raw.compensation_type) ?? (hourlyRate !== undefined && annual_salary === undefined ? "hourly" : "salary");
  if (annual_salary === undefined && hourlyRate !== undefined) {
    // An hourly rate becomes a year's pay at the stated hours, or at full time when unstated.
    const hours = Number(raw.hours_per_week);
    const yearly = Number.isFinite(hours) && hours > 0 && hours <= 168
      ? hourlyRate * hours * 52
      : employment_type === "full_time" ? hourlyRate * HOURS_PER_YEAR_FULL_TIME : undefined;
    annual_salary = yearly === undefined ? undefined : normalizeAnnualSalary(yearly);
  }

  const row: Omit<CensusEmployee, "id"> & { id?: string } = {
    first_name,
    last_name,
    work_state: normalizeState(raw.work_state ?? raw.state),
    compensation_type,
    employment_type,
    classification: classification ?? "w2",
  };
  if (typeof raw.id === "string" && /^[A-Za-z0-9-]{1,64}$/.test(raw.id)) row.id = raw.id;
  const dob = normalizeDob(raw.dob, now);
  if (dob) row.dob = dob;
  const age = normalizeAge(raw.age);
  if (age !== undefined) row.age = age;
  const zip = normalizeZip(raw.zip_code ?? raw.zip);
  if (zip) row.zip_code = zip;
  const title = cleanText(raw.job_title ?? raw.title);
  if (title) row.job_title = title;
  if (annual_salary !== undefined) row.annual_salary = annual_salary;
  const tier = normalizeCoverageTier(raw.coverage_tier);
  if (tier) row.coverage_tier = tier;
  const classCode = normalizeClassCode(raw.class_code);
  if (classCode) row.class_code = classCode;
  const dependents = normalizeDependents(raw.dependents, now);
  if (dependents.length > 0) row.dependents = dependents;
  return row;
}

/**
 * A census from loosely typed rows: invalid rows dropped, and every row given an id. Rows that
 * arrive without one (or with one already used) get an id derived from the row, so reading the
 * same rows twice gives the same ids. Stops after `max` valid rows (invalid ones use no slot).
 */
export function normalizeCensus(rows: unknown, now: Date = new Date(), max = Number.POSITIVE_INFINITY): CensusEmployee[] {
  if (!Array.isArray(rows)) return [];
  const used = new Set<string>();
  const seen = new Map<string, number>();
  const out: CensusEmployee[] = [];
  for (const raw of rows) {
    if (out.length >= max) break;
    const row = normalizeCensusRow(raw, now);
    if (!row) continue;
    let id = row.id;
    if (!id || used.has(id)) {
      const seed = [row.first_name, row.last_name, row.dob ?? "", row.work_state].join("|").toLowerCase();
      const n = seen.get(seed) ?? 0;
      seen.set(seed, n + 1);
      id = censusRowId(`${seed}|${n}`);
      while (used.has(id)) id = censusRowId(`${id}+`);
    }
    used.add(id);
    out.push({ ...row, id });
  }
  return out;
}

/** A UUID-shaped id derived from `seed` (128-bit cyrb128 hash, version nibble 8). */
export function censusRowId(seed: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  const hex = [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, "0")).join("");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// ---------- Underwriting view ----------

export const isW2 = (e: Pick<CensusEmployee, "classification">) => e.classification === "w2";

export type CensusGap = "date of birth or age" | "work state" | "job title" | "annual salary";

/** The underwriting facts a row is still missing. */
export function censusGaps(e: CensusEmployee): CensusGap[] {
  const gaps: CensusGap[] = [];
  if (!e.dob && e.age === undefined) gaps.push("date of birth or age");
  if (!e.work_state) gaps.push("work state");
  if (!e.job_title) gaps.push("job title");
  if (e.annual_salary === undefined) gaps.push("annual salary");
  return gaps;
}

/** Same person: first and last name match, and their dates of birth don't disagree. */
export function samePerson(a: CensusEmployee, b: CensusEmployee): boolean {
  const name = (e: CensusEmployee) => `${e.first_name} ${e.last_name}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (name(a) !== name(b)) return false;
  return !a.dob || !b.dob || a.dob === b.dob;
}
