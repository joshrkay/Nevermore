import { z } from "zod";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import type { ChamberData, ChamberEmployee } from "./chamberTypes";

// Extracted data comes from an LLM (edge function or voice agent <extract> tags) or
// from a stored jsonb column, so every field is checked before it reaches state.
// Invalid fields are dropped individually rather than rejecting the whole patch.

// The server (public.chamber_data_error, migration 20261027090000) enforces the same limits and
// rejects a write that breaks one. Everything below is therefore the stricter side of that contract:
// valid sanitiser output can never be refused. src/data/schemaSync.test.ts compares the two sides.
export const US_STATE_CODES: readonly string[] = [
  "AK", "AL", "AR", "AS", "AZ", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "GU", "HI", "IA", "ID", "IL", "IN", "KS", "KY",
  "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MP", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH", "OK",
  "OR", "PA", "PR", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VI", "VT", "WA", "WI", "WV", "WY",
];
export const MAX_EMPLOYEES = 5000;
export const MAX_DEPENDENTS = 20;
export const MAX_STATES = 60;
export const MAX_LIST_ITEMS = 100;
export const COUNT_MAX = 1_000_000;
export const SALARY_MAX = 1_000_000;
export const TEXT_MAX = 1000;

const STATE_CODE_SET: ReadonlySet<string> = new Set(US_STATE_CODES);

// Postgres jsonb refuses NUL and unpaired surrogates before any trigger can name the field, so they
// are removed here instead of becoming an unattributable save failure.
const UNPAIRED_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;
const clean = (v: unknown) => (typeof v === "string" ? v.split("\u0000").join("").replace(UNPAIRED_SURROGATE, "") : v);
const str = (schema: z.ZodString) => z.preprocess(clean, schema) as unknown as z.ZodType<string, z.ZodTypeDef, unknown>;

const text = str(z.string().trim().min(1).max(TEXT_MAX));
const nullableText = text.nullable();

const stateCode = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .refine((s) => STATE_CODE_SET.has(s));

// Accepts a proper array or a comma-separated string ("CA, TX"). Invalid items are dropped before
// the cap applies, so they never use up a slot; the cap truncates rather than rejecting the list.
const listOf = <T extends z.ZodTypeAny>(item: T, max = MAX_LIST_ITEMS) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.split(",") : v),
    z.array(z.unknown()).transform((arr) => {
      const out: z.output<T>[] = [];
      for (const el of arr) {
        const r = item.safeParse(el);
        if (r.success) out.push(r.data as z.output<T>);
        if (out.length >= max) break;
      }
      return out;
    }),
  );

const countUpTo = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v.replace(/,/g, "")) : v),
    z.number().int().nonnegative().max(max),
  );
const count = countUpTo(COUNT_MAX);

// Maps common spellings to the two classifications. A missing label means a regular
// employee (rosters rarely label W-2s), but an unrecognized label is rejected rather
// than guessed: miscounting a contractor as W-2 corrupts headcount and AB5 flags.
const classification = z.preprocess(
  (v) => {
    if (v === undefined || v === null || v === "") return "W2";
    if (typeof v !== "string") return v;
    const key = v.trim().toLowerCase().replace(/[\s_-]+/g, " ");
    if (/^(w ?2|w ?2 employee|employee|full time|part time)$/.test(key)) return "W2";
    if (/^(1099|1099 contractor|contractor|independent contractor|freelance|freelancer)$/.test(key)) return "1099";
    return v;
  },
  z.enum(["W2", "1099"]),
);

// Cast because the app tsconfig is non-strict, which makes zod infer every key as optional.
const employeeSchema = z.object({
  first_name: text,
  last_name: str(z.string().trim().max(200)).catch(""),
  dob: str(z.string().trim().max(40)).catch(""),
  // An unlisted state becomes blank rather than dropping the employee, as an over-long one always did.
  state: z.string().trim().transform((s) => s.toUpperCase()).transform((s) => (STATE_CODE_SET.has(s) ? s : "")).catch(""),
  title: str(z.string().trim().max(200)).catch(""),
  salary: countUpTo(SALARY_MAX).nullable().catch(null),
  classification,
  dependents: listOf(
    z.object({
      first_name: text,
      last_name: str(z.string().trim().max(200)).catch(""),
      dob: str(z.string().trim().max(40)).catch(""),
      relationship: z.enum(["spouse", "domestic_partner", "child", "other"]).catch("other"),
    }),
    MAX_DEPENDENTS,
  ).catch([]),
}) as unknown as z.ZodType<ChamberEmployee, z.ZodTypeDef, unknown>;

type FieldSchemas = { [K in keyof ChamberData]: z.ZodType<ChamberData[K], z.ZodTypeDef, unknown> };

const FIELD_SCHEMAS: FieldSchemas = {
  company_name: nullableText,
  industry: nullableText,
  hq_state: stateCode.nullable(),
  states: listOf(stateCode, Number.POSITIVE_INFINITY).transform((s) => [...new Set(s)].slice(0, MAX_STATES)),
  employee_count: count.nullable(),
  start_month: nullableText,
  multiple_entities: z.boolean().nullable(),
  fein_count: count.nullable(),

  virgin_medical: z.boolean().nullable(),
  current_carrier: nullableText,
  renewal_date: nullableText,
  rate_history: nullableText,
  benefits_waiting_period: nullableText,
  ancillary_benefits: listOf(text),
  has_401k: z.boolean().nullable(),
  retirement_type: nullableText,
  employer_contributes: z.boolean().nullable(),

  payroll_vendor: nullableText,
  pay_frequency: nullableText,
  funding_days: count.nullable(),
  has_nonexempt: z.boolean().nullable(),
  nonexempt_count: count.nullable(),
  exempt_count: count.nullable(),
  pto_types: listOf(text),
  accrual_method: nullableText,

  has_handbook: z.boolean().nullable(),
  handbook_last_updated: nullableText,
  hr_staff_count: count.nullable(),
  has_1099: z.boolean().nullable(),
  ca_contractors: z.boolean().nullable(),
  uses_physical_clocks: z.boolean().nullable(),
  uses_mobile_app: z.boolean().nullable(),
  uses_computer_timekeeping: z.boolean().nullable(),
  shift_differentials: z.boolean().nullable(),
  hris_system: nullableText,
  key_challenges: nullableText,
  business_goals: nullableText,

  employees: listOf(employeeSchema, MAX_EMPLOYEES),
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Keeps only known, well-formed fields from an untrusted patch. */
export function sanitizeChamberPatch(raw: unknown): Partial<ChamberData> {
  if (!isPlainObject(raw)) return {};
  const patch: Partial<Record<keyof ChamberData, unknown>> = {};
  for (const key of Object.keys(FIELD_SCHEMAS) as (keyof ChamberData)[]) {
    if (!(key in raw)) continue;
    const result = FIELD_SCHEMAS[key].safeParse(raw[key]);
    if (result.success) patch[key] = result.data;
  }
  return patch as Partial<ChamberData>;
}

/** Rebuilds a complete ChamberData from untrusted input, defaulting anything missing or invalid. */
export function parseChamberData(raw: unknown): ChamberData {
  return { ...EMPTY_CHAMBER_DATA, ...sanitizeChamberPatch(raw) };
}

/** Merges an untrusted patch into existing data. */
export function mergeChamberData(prev: ChamberData, raw: unknown): ChamberData {
  return { ...prev, ...sanitizeChamberPatch(raw) };
}
