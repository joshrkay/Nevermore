import { z } from "zod";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import type { ChamberData } from "./chamberTypes";
import { normalizeCensus } from "./census";
import { redactSensitive } from "./sensitive";

// Extracted data comes from an LLM (edge function or voice agent <extract> tags) or
// from a stored jsonb column, so every field is checked before it reaches state.
// Invalid fields are dropped individually rather than rejecting the whole patch.
// Free text never keeps a Social Security or bank account number (see sensitive.ts).

const text = z.string().transform(redactSensitive).pipe(z.string().trim().min(1).max(1000));
const nullableText = text.nullable();

const stateCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/)
  .transform((s) => s.toUpperCase());

// Accepts a proper array or a comma-separated string ("CA, TX").
const listOf = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.split(",") : v),
    z.array(z.unknown()).transform((arr) =>
      arr.flatMap((el) => {
        const r = item.safeParse(el);
        return r.success ? [r.data as z.output<T>] : [];
      }),
    ),
  );

const count = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? Number(v.replace(/,/g, "")) : v),
  z.number().int().nonnegative().max(1_000_000),
);

type FieldSchemas = { [K in keyof ChamberData]: z.ZodType<ChamberData[K], z.ZodTypeDef, unknown> };

const FIELD_SCHEMAS: FieldSchemas = {
  company_name: nullableText,
  industry: nullableText,
  hq_state: stateCode.nullable(),
  states: listOf(stateCode).transform((s) => [...new Set(s)]),
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

  // Rows are checked one by one (supabase/functions/_shared/census.ts); an invalid row is dropped.
  census: z.array(z.unknown()).transform((rows) => normalizeCensus(rows)),
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Keeps only known, well-formed fields from an untrusted patch. Data saved before the census
 * contract (and older voice extractions) name the roster `employees`; it is read as `census`.
 */
export function sanitizeChamberPatch(raw: unknown): Partial<ChamberData> {
  if (!isPlainObject(raw)) return {};
  const input: Record<string, unknown> =
    "employees" in raw && !("census" in raw) ? { ...raw, census: raw.employees } : raw;
  const patch: Partial<Record<keyof ChamberData, unknown>> = {};
  for (const key of Object.keys(FIELD_SCHEMAS) as (keyof ChamberData)[]) {
    if (!(key in input)) continue;
    const result = FIELD_SCHEMAS[key].safeParse(input[key]);
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
