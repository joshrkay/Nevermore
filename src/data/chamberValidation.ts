import { z } from "zod";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import type { AcordAnswers, ChamberData, EntityType } from "./chamberTypes";
import { ACORD_130_QUESTIONS, acordAnswerKey, acordExplainKey } from "../../supabase/functions/_shared/acord130.ts";
import { normalizeCensus, stripUnstorable } from "./census";
import { redactSensitive } from "./sensitive";
import { isNaicsCode } from "../../supabase/functions/_shared/naics2022.ts";

// Extracted data comes from an LLM (chamber-extract, for typed and spoken messages alike, or
// document-extract) or from a stored jsonb column, so every field is checked before it reaches state.
// Invalid fields are dropped individually rather than rejecting the whole patch.
// Free text never keeps a Social Security or bank account number (see sensitive.ts).

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
export const EXPERIENCE_MOD_MAX = 10;
export const DOLLARS_MAX = 100_000_000;
export const TEXT_MAX = 1000;
export const NAME_MAX = 200;
export const DOB_MAX = 40;
export const YEAR_MIN = 1600;
export const YEAR_MAX = 2100;
export const MAX_ENTITIES = 50;
export const MAX_OWNERS_OFFICERS = 20;
export const MONEY_MAX = 1_000_000;
export const MAX_LOSS_YEARS = 5;
export const MAX_MEDICAL_PLANS = 20;
export const MAX_SUTA_RATES = 60;

const STATE_CODE_SET: ReadonlySet<string> = new Set(US_STATE_CODES);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Postgres jsonb refuses NUL and unpaired surrogates before any trigger can name the field, so they
// are removed here instead of becoming an unattributable save failure. Sensitive numbers go too.
const clean = (v: unknown) => (typeof v === "string" ? redactSensitive(stripUnstorable(v)) : v);
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

// Numbers people write with symbols: "$18,400", "0.92". Anything else is left for the schema to refuse.
const numberText = (strip: RegExp) => (v: unknown) =>
  typeof v === "string" && v.trim() !== "" ? Number(v.replace(strip, "")) : v;

// An experience mod such as 0.92, kept to two decimal places as carriers publish it.
const experienceMod = z.preprocess(
  numberText(/[\s,]/g),
  z.number().finite().min(0).max(EXPERIENCE_MOD_MAX).transform((n) => Math.round(n * 100) / 100),
);

// Whole dollars: cents are rounded away, and a figure over the cap is dropped rather than capped.
const dollars = z.preprocess(
  numberText(/[\s$,]/g),
  z.number().finite().nonnegative().transform(Math.round).pipe(z.number().max(DOLLARS_MAX)),
);

// A FEIN is kept as its nine digits. It is read from the nine digits alone or from the way a FEIN is
// written (12-3456789), and from nothing else: 123-45-6789 is how a Social Security number is written.
// It is not free text, so the redaction free text gets (any nine digits in a row) is not applied to it.
const fein = z
  .string()
  .trim()
  .regex(/^(?:\d{9}|\d{2}-\d{7})$/)
  .transform((s) => s.replace("-", ""));

// How people write each entity type, once lower-cased and stripped to letters and digits.
const ENTITY_TYPE_SPELLINGS: Record<string, EntityType> = {
  soleproprietorship: "sole_proprietorship", soleproprietor: "sole_proprietorship", soleprop: "sole_proprietorship",
  partnership: "partnership", generalpartnership: "partnership", limitedpartnership: "partnership", lp: "partnership", llp: "partnership",
  llc: "llc", limitedliabilitycompany: "llc",
  ccorporation: "c_corporation", ccorp: "c_corporation", corporation: "c_corporation", corp: "c_corporation", inc: "c_corporation",
  scorporation: "s_corporation", scorp: "s_corporation",
  nonprofit: "nonprofit", notforprofit: "nonprofit", "501c3": "nonprofit",
  other: "other",
};
const entityType = z
  .string()
  .transform((s) => ENTITY_TYPE_SPELLINGS[s.toLowerCase().replace(/[^a-z0-9]/g, "")])
  .refine((v): v is EntityType => v !== undefined);

// A NAICS code: six digits that name one of the 2022 industries. A number is read as its digits.
const naicsCode = z.preprocess(
  (v) => (typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : v),
  z.string().refine(isNaicsCode),
);

const year = z.preprocess(
  (v) => (typeof v === "string" && /^\s*\d{4}\s*$/.test(v) ? Number(v) : v),
  z.number().int().min(YEAR_MIN).max(YEAR_MAX),
);

/**
 * A list of rows, each an object of optional answers (the v3 lists: legal entities, owners and officers and so
 * on). A key whose value is invalid is dropped from its row, a row left with nothing is dropped from the list,
 * and the list stops at `max`. Unknown keys are dropped, as everywhere.
 */
const rowsOf = <Row extends object>(shape: { [K in keyof Row]-?: z.ZodType<NonNullable<Row[K]>, z.ZodTypeDef, unknown> }, max: number) =>
  z.array(z.unknown()).transform((items) => {
    const out: Row[] = [];
    for (const item of items) {
      if (!isPlainObject(item)) continue;
      const row: Record<string, unknown> = {};
      for (const key of Object.keys(shape) as (keyof Row & string)[]) {
        if (!(key in item)) continue;
        const result = shape[key].safeParse(item[key]);
        if (result.success) row[key] = result.data;
      }
      if (Object.keys(row).length > 0) out.push(row as Row);
      if (out.length >= max) break;
    }
    return out;
  });

// Text held to the shorter cap a name or title has; longer is dropped, as with any text.
const nameText = str(z.string().trim().min(1).max(NAME_MAX));

// A percentage from 0 to 100, as people write it ("60%", "12.5"), kept to two decimal places.
const percent = z.preprocess(
  numberText(/[\s%,]/g),
  z.number().finite().min(0).max(100).transform((n) => Math.round(n * 100) / 100),
);

// Yes or no, as a person or a model writes it.
const yesNo = z.preprocess(
  (v) => (typeof v === "string" ? (/^\s*(y|yes|true)\s*$/i.test(v) ? true : /^\s*(n|no|false)\s*$/i.test(v) ? false : v) : v),
  z.boolean(),
);

// An amount to the cent, as an invoice prints it ("$612.40"); over the cap is dropped, not capped.
const money = z.preprocess(
  numberText(/[\s$,]/g),
  z.number().finite().nonnegative().transform((n) => Math.round(n * 100) / 100).pipe(z.number().max(MONEY_MAX)),
);

// A tax rate as a percentage, as a state's notice prints it ("2.68125%"), kept to four decimal places.
const taxRate = z.preprocess(
  numberText(/[\s%,]/g),
  z.number().finite().min(0).max(100).transform((n) => Math.round(n * 10_000) / 10_000),
);

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

  wc_carrier: nullableText,
  wc_renewal_date: nullableText,
  wc_experience_mod: experienceMod.nullable(),
  wc_annual_premium: dollars.nullable(),

  fein: fein.nullable(),
  entity_type: entityType.nullable(),
  year_founded: year.nullable(),
  street_address: nullableText,
  website: nullableText,
  entities: rowsOf<ChamberData["entities"][number]>({ legal_name: text, fein }, MAX_ENTITIES),
  owners_officers: rowsOf<ChamberData["owners_officers"][number]>(
    { name: nameText, title: nameText, ownership_percent: percent, duties: text, covered: yesNo },
    MAX_OWNERS_OFFICERS,
  ),
  loss_history: rowsOf<ChamberData["loss_history"][number]>(
    { policy_year: year, carrier: nameText, premium: dollars, experience_mod: experienceMod, claims: count, paid: dollars, reserved: dollars, valuation_date: nameText, no_coverage: yesNo },
    MAX_LOSS_YEARS,
  ),
  medical_plans: rowsOf<ChamberData["medical_plans"][number]>(
    {
      name: nameText, carrier: nameText,
      rate_ee: money, rate_ee_sp: money, rate_ee_ch: money, rate_fam: money,
      renewal_rate_ee: money, renewal_rate_ee_sp: money, renewal_rate_ee_ch: money, renewal_rate_fam: money,
      employer_contribution: nameText, enrolled: count,
    },
    MAX_MEDICAL_PLANS,
  ),
  // One rate per state: a second row for a state already listed is dropped.
  suta_rates: rowsOf<ChamberData["suta_rates"][number]>({ state: stateCode, rate: taxRate, year }, Number.POSITIVE_INFINITY).transform((rates) => {
    const seen = new Set<string>();
    return rates.filter((r) => r.state === undefined || (!seen.has(r.state) && seen.add(r.state))).slice(0, MAX_SUTA_RATES);
  }),
  // The ACORD 130 questions (K-3.4): a yes or no each, with a text explanation.
  ...(Object.fromEntries(
    ACORD_130_QUESTIONS.flatMap((q) => [[acordAnswerKey(q.number), yesNo.nullable()], [acordExplainKey(q.number), nullableText]]),
  ) as { [K in keyof AcordAnswers]: z.ZodType<AcordAnswers[K], z.ZodTypeDef, unknown> }),
  naics_code: naicsCode.nullable(),
  operations_description: nullableText,
  in_peo: z.boolean().nullable(),
  current_peo: nullableText,
  peo_renewal_date: nullableText,

  // Rows are checked one by one (supabase/functions/_shared/census.ts): an invalid row is dropped and the
  // census stops at the most the intake holds.
  census: z.array(z.unknown()).transform((rows) => normalizeCensus(rows, undefined, MAX_EMPLOYEES)),
};

/**
 * Keeps only known, well-formed fields from an untrusted patch. Data saved before the census contract
 * (and older voice extractions) name the roster `employees`; it is read as `census`, and never written back.
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
