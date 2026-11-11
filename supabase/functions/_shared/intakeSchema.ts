// The canonical intake schema, version 3: chamber_data as JSON Schema (draft 2020-12), and a strict
// validator for it. Version 2 was version 1 plus the workers' comp block (decision D18). Version 3 adds the
// common questions (Epic K): what PEOs and their carriers already ask on their own forms. Each version only
// adds optional answers, so every v1 or v2 answer set is a v3 one.
//
// Each top-level property also carries an `x-intake` annotation (label, section, required, rank: see
// IntakeFieldMeta). It is part of the published contract, and the validator ignores it. Strict means a value is accepted as it is or refused with a reason. Nothing is
// trimmed, upper-cased, split or converted, and an unknown key is an error at every level.
//
// Where it runs (data that reaches an intake from outside the browser's own edits):
//   * chamber-extract checks each field the model extracted before answering (extraction.ts).
//   * The Chamber checks a local backup of unsaved answers before offering to restore it.
//   * The Chamber checks a saved intake when it loads one, and logs what doesn't match. Rows saved by
//     earlier versions stay editable: the sanitiser (src/data/chamberValidation.ts) still loads them.
//
// The database (public.chamber_data_error) is the floor every save must clear. Anything this schema
// accepts, the database accepts: the caps, codes and value lists are the same, and
// src/data/schemaSync.test.ts compares them with the migrations. This schema is stricter in three
// ways: unknown keys inside a census row or a dependent are refused (the database tolerates them so an
// older client can save a newer census), the legacy `employees` roster is not part of the schema, and a
// census row must carry the fields every writer gives it.
//
// docs/intake-schema.v3.json is this schema, printed (npm run schema:intake). docs/intake-schema.v1.json and
// v2.json are those versions as they were published, and are never rewritten. src/data/intakeSchema.test.ts
// keeps v3.json equal to this schema and checks that v3 only adds to v2.
//
// No imports: it runs under Deno (the edge functions) and Vite (the app) alike.

export const INTAKE_SCHEMA_VERSION = 3;

// The 50 states, DC and the five inhabited territories (the migrations' sync block us_state_codes).
export const STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC", "AS", "GU", "MP", "PR", "VI",
] as const;

// The limits the database holds (the migrations' sync blocks caps and caps_person).
export const LIMITS = {
  text: 1000,
  name: 200,
  dob: 40,
  count: 1_000_000,
  salary: 1_000_000,
  states: 60,
  listItems: 100,
  census: 5000,
  dependents: 20,
  censusId: 64,
  experienceMod: 10,
  dollars: 100_000_000,
  // New in v3 (the migrations' sync block row_caps holds each list of rows to its cap).
  yearMin: 1600,
  yearMax: 2100,
  entities: 50,
  ownersOfficers: 20,
  lossYears: 5,
  medicalPlans: 20,
  sutaRates: 60,
  percent: 100,
  // An amount with cents, such as a monthly premium rate.
  money: 1_000_000,
} as const;

/** How an employer is organised, as PEO and carrier forms ask it (K-1.1). */
export const ENTITY_TYPES = ["sole_proprietorship", "partnership", "llc", "c_corporation", "s_corporation", "nonprofit", "other"] as const;

// ---------- What the schema says about each field, beyond its rule ----------

/** Where a field belongs. Dependents sit inside each employee in the census, so they have no section of their own. */
export const FIELD_SECTIONS = ["company", "locations", "census", "benefits", "payroll", "workers_comp", "operations"] as const;
export type FieldSection = (typeof FIELD_SECTIONS)[number];

export const SECTION_LABELS: Record<FieldSection, string> = {
  company: "Company",
  locations: "Locations",
  census: "Census",
  benefits: "Benefits",
  payroll: "Payroll",
  workers_comp: "Workers' comp",
  operations: "Operations & HR",
};

/**
 * Published on each top-level property as `x-intake`.
 * - `required`: the intake needs the field before it is ready to certify (GLOSSARY.md, D2, D25): the
 *   answers src/data/readiness.ts requires and the certification gate checks.
 * - `rank`: the order Lenore asks in, 1 first. Every required field ranks before every recommended one (D25).
 */
export interface IntakeFieldMeta {
  label: string;
  section: FieldSection;
  required: boolean;
  rank: number;
}

// The required fields, in the order Lenore asks for them: readiness.ts's list (src/data/intakeSchema.test.ts).
export const REQUIRED_FIELDS = ["company_name", "states", "pay_frequency"] as const;

// The recommended fields ranked first (D25, a draft for the product team to edit), the census before all
// of them: it is recommended, not required (D2), since today it only comes from an uploaded file. Every
// other field follows in the order the schema lists it.
const RANKED_RECOMMENDED = [
  "census", "employee_count", "industry", "hq_state", "current_carrier", "renewal_date", "payroll_vendor",
  "wc_carrier", "wc_renewal_date", "wc_experience_mod", "wc_annual_premium",
  // New in v3: the single-value common questions follow the fields ranked before them (Epic K).
  "fein", "entity_type", "year_founded", "street_address", "website", "operations_description", "naics_code",
  "in_peo", "current_peo", "peo_renewal_date",
] as const;

/** A JSON Schema, as far as this module reads one. */
export type JsonSchema = { [keyword: string]: unknown };

// Text with at least one character other than a space: the database's btrim(x) <> ''.
const NOT_BLANK = "[^ ]";

const text = (maxLength: number = LIMITS.text): JsonSchema => ({ type: ["string", "null"], maxLength });
const count: JsonSchema = { type: ["integer", "null"], minimum: 0, maximum: LIMITS.count };
const flag: JsonSchema = { type: ["boolean", "null"] };
const textList: JsonSchema = { type: "array", maxItems: LIMITS.listItems, items: { type: "string", maxLength: LIMITS.text } };
// An experience modification factor such as 0.92: a fraction, so not a count.
const experienceMod: JsonSchema = { type: ["number", "null"], minimum: 0, maximum: LIMITS.experienceMod };
const dollars: JsonSchema = { type: ["integer", "null"], minimum: 0, maximum: LIMITS.dollars };
// A federal employer identification number: the nine digits, with no hyphen.
const FEIN_PATTERN = "^[0-9]{9}$";
const FEIN_TITLE = "nine digits, such as 123456789";
const fein: JsonSchema = { title: FEIN_TITLE, type: ["string", "null"], pattern: FEIN_PATTERN };
// A six-digit NAICS code. The schema holds its shape; the sanitiser and chat extraction also hold it to the 2022
// industries (naics2022.ts).
const naicsCode: JsonSchema = { title: "a six-digit NAICS code, such as 541430", type: ["string", "null"], pattern: "^[0-9]{6}$" };
const choice = (values: readonly string[]): JsonSchema => ({ type: ["string", "null"], enum: [...values, null] });
const year: JsonSchema = { type: ["integer", "null"], minimum: LIMITS.yearMin, maximum: LIMITS.yearMax };
// An amount with cents inside a row, such as a monthly premium rate.
const money: JsonSchema = { type: "number", minimum: 0, maximum: LIMITS.money };
const rows = (def: string, maxItems: number): JsonSchema => ({ type: "array", maxItems, items: { $ref: `#/$defs/${def}` } });

// Each answer's rule, section and label, in the order the schema lists them.
const FIELDS: [key: string, rule: JsonSchema, section: FieldSection, label: string][] = [
  ["company_name", text(), "company", "Company legal name"],
  ["industry", text(), "company", "Industry"],
  ["hq_state", { title: "a US state or territory code such as CA", type: ["string", "null"], enum: [...STATE_CODES, null] }, "locations", "HQ state"],
  ["states", { type: "array", maxItems: LIMITS.states, items: { $ref: "#/$defs/stateCode" } }, "locations", "States of operation"],
  ["employee_count", count, "company", "Employee count"],
  ["start_month", text(), "company", "Target start"],
  ["multiple_entities", flag, "company", "Multiple entities"],
  ["fein_count", count, "company", "FEIN count"],

  ["virgin_medical", flag, "benefits", "First-time medical coverage"],
  ["current_carrier", text(), "benefits", "Current carrier"],
  ["renewal_date", text(), "benefits", "Renewal date"],
  ["rate_history", text(), "benefits", "Rate history"],
  ["benefits_waiting_period", text(), "benefits", "Waiting period"],
  ["ancillary_benefits", textList, "benefits", "Ancillary benefits"],
  ["has_401k", flag, "benefits", "Retirement plan"],
  ["retirement_type", text(), "benefits", "Retirement plan type"],
  ["employer_contributes", flag, "benefits", "Employer retirement contribution"],

  ["payroll_vendor", text(), "payroll", "Payroll vendor"],
  ["pay_frequency", text(), "payroll", "Pay frequency"],
  ["funding_days", count, "payroll", "Funding lead time"],
  ["has_nonexempt", flag, "payroll", "Nonexempt employees"],
  ["nonexempt_count", count, "payroll", "Nonexempt count"],
  ["exempt_count", count, "payroll", "Exempt count"],
  ["pto_types", textList, "payroll", "PTO types"],
  ["accrual_method", text(), "payroll", "Accrual method"],

  ["has_handbook", flag, "operations", "Employee handbook"],
  ["handbook_last_updated", text(), "operations", "Handbook last updated"],
  ["hr_staff_count", count, "operations", "In-house HR staff"],
  ["has_1099", flag, "census", "1099 contractors"],
  ["ca_contractors", flag, "census", "California contractors"],
  ["uses_physical_clocks", flag, "operations", "Physical time clocks"],
  ["uses_mobile_app", flag, "operations", "Mobile timekeeping"],
  ["uses_computer_timekeeping", flag, "operations", "Computer timekeeping"],
  ["shift_differentials", flag, "operations", "Shift differentials"],
  ["hris_system", text(), "operations", "HRIS system"],
  ["key_challenges", text(), "operations", "Key challenges"],
  ["business_goals", text(), "operations", "Business goals"],

  // New in v2 (D18).
  ["wc_carrier", text(), "workers_comp", "Workers' comp carrier"],
  ["wc_renewal_date", text(), "workers_comp", "Workers' comp renewal date"],
  ["wc_experience_mod", experienceMod, "workers_comp", "Experience mod"],
  ["wc_annual_premium", dollars, "workers_comp", "Workers' comp annual premium"],

  // New in v3 (Epic K, the common questions). K-1.1: who the employer is.
  ["fein", fein, "company", "FEIN"],
  ["entity_type", choice(ENTITY_TYPES), "company", "Entity type"],
  ["year_founded", year, "company", "Year founded"],
  ["street_address", text(), "company", "Street address"],
  ["website", text(), "company", "Website"],
  ["entities", rows("entity", LIMITS.entities), "company", "Legal entities"],
  // K-1.2: the industry as a code and a description, beside the free-text `industry`.
  ["naics_code", naicsCode, "company", "NAICS code"],
  ["operations_description", text(), "company", "Description of operations"],
  // K-1.3: whether the employer is in a PEO now. "No" closes the other two (src/data/provenance.ts).
  ["in_peo", flag, "company", "In a PEO now"],
  ["current_peo", text(), "company", "Current PEO"],
  ["peo_renewal_date", text(), "company", "PEO agreement renewal"],

  // K-3.1: each owner and officer, for pricing workers' comp inclusions and exclusions.
  ["owners_officers", rows("ownerOfficer", LIMITS.ownersOfficers), "workers_comp", "Owners and officers"],
  // K-3.3: five policy years of workers' comp loss history.
  ["loss_history", rows("lossYear", LIMITS.lossYears), "workers_comp", "Loss history"],
  // K-4.1: each current medical plan, for a side-by-side with what the employer pays now.
  ["medical_plans", rows("medicalPlan", LIMITS.medicalPlans), "benefits", "Current medical plans"],
  // K-4.2: the employer's unemployment tax rate in each state of operation.
  ["suta_rates", rows("sutaRate", LIMITS.sutaRates), "payroll", "State unemployment tax rates"],

  ["census", { type: "array", maxItems: LIMITS.census, items: { $ref: "#/$defs/censusRow" } }, "census", "Employee census"],
];

const RANKED_KEYS: string[] = [
  ...REQUIRED_FIELDS,
  ...RANKED_RECOMMENDED,
  ...FIELDS.map(([key]) => key).filter((key) => !(REQUIRED_FIELDS as readonly string[]).includes(key) && !(RANKED_RECOMMENDED as readonly string[]).includes(key)),
];

export const INTAKE_SCHEMA_V3: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:edgar-allan-advisory:intake:chamber-data:v3",
  title: "Intake answers (chamber_data), version 3",
  description:
    "What a prospect's intake holds. Every key is optional; an unanswered question is null (or an empty list). " +
    "Each property's x-intake gives its label, its section, whether an intake needs it to be ready to certify " +
    "(required), and the order Lenore asks in (rank, 1 first). Version 2 added the workers' comp block to version 1; " +
    "version 3 adds the common questions PEOs ask on their own forms. " +
    "Generated from supabase/functions/_shared/intakeSchema.ts.",
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(FIELDS.map(([key, rule, section, label]) => {
    const meta: IntakeFieldMeta = {
      label,
      section,
      required: (REQUIRED_FIELDS as readonly string[]).includes(key),
      rank: RANKED_KEYS.indexOf(key) + 1,
    };
    return [key, { ...rule, "x-intake": meta }];
  })),
  $defs: {
    stateCode: { title: "a US state or territory code such as CA", type: "string", enum: [...STATE_CODES] },
    censusRow: {
      type: "object",
      additionalProperties: false,
      required: ["id", "first_name", "last_name", "work_state", "compensation_type", "employment_type", "classification"],
      properties: {
        id: { type: "string", maxLength: LIMITS.censusId, pattern: NOT_BLANK },
        first_name: { type: "string", maxLength: LIMITS.text, pattern: NOT_BLANK },
        last_name: { type: "string", maxLength: LIMITS.name },
        dob: { type: "string", maxLength: LIMITS.dob },
        age: { type: "integer", minimum: 14, maximum: 100 },
        // Blank means the census did not say.
        work_state: { title: "blank or a US state or territory code such as CA", type: "string", enum: ["", ...STATE_CODES] },
        zip_code: { type: "string", pattern: "^[0-9]{5}(-[0-9]{4})?$" },
        job_title: { type: "string", maxLength: LIMITS.name },
        annual_salary: { type: "integer", minimum: 0, maximum: LIMITS.salary },
        compensation_type: { type: "string", enum: ["salary", "hourly"] },
        employment_type: { type: "string", enum: ["full_time", "part_time"] },
        classification: { type: "string", enum: ["w2", "1099"] },
        coverage_tier: { type: "string", enum: ["EE", "EE+SP", "EE+CH", "FAM", "WAIVE"] },
        class_code: { type: "string", pattern: "^[0-9]{4}$" },
        // New in v3 (K-2.1): what a health underwriter rates the group on. Each is optional.
        gender: { type: "string", enum: ["F", "M", "X"] },
        hire_date: { type: "string", maxLength: LIMITS.dob },
        cobra: { type: "boolean" },
        home_state: { title: "a US state or territory code such as CA", type: "string", enum: [...STATE_CODES] },
        // New in v3 (K-2.2): where and how each employee works, for assigning workers' comp class codes.
        worksite: { type: "string", maxLength: LIMITS.name },
        remote: { type: "boolean" },
        travels: { type: "boolean" },
        dependents: { type: "array", maxItems: LIMITS.dependents, items: { $ref: "#/$defs/dependent" } },
        // Which of the row's values are defaults rather than answers (CENSUS_ASSUMABLE in census.ts).
        // Added to v1 without a new version: it is optional, and the database already tolerated it.
        assumed: { type: "array", maxItems: 3, items: { type: "string", enum: ["classification", "employment_type", "annual_salary"] } },
      },
    },
    // One legal entity of an employer that is more than one (K-1.1). Every key of a v3 row is optional.
    entity: {
      type: "object",
      additionalProperties: false,
      properties: {
        legal_name: { type: "string", maxLength: LIMITS.text, pattern: NOT_BLANK },
        fein: { title: FEIN_TITLE, type: "string", pattern: FEIN_PATTERN },
      },
    },
    // One owner or officer (K-3.1): who they are, how much they own, what they do, and whether workers' comp covers them.
    ownerOfficer: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", maxLength: LIMITS.name, pattern: NOT_BLANK },
        title: { type: "string", maxLength: LIMITS.name },
        ownership_percent: { type: "number", minimum: 0, maximum: LIMITS.percent },
        duties: { type: "string", maxLength: LIMITS.text },
        covered: { type: "boolean" },
      },
    },
    // One policy year of workers' comp loss history (K-3.3). `claims: 0` is "no claims", and `no_coverage` is "no
    // prior coverage" that year: both are answers. `valuation_date` is the date the figures are valued as of.
    lossYear: {
      type: "object",
      additionalProperties: false,
      properties: {
        policy_year: { type: "integer", minimum: LIMITS.yearMin, maximum: LIMITS.yearMax },
        carrier: { type: "string", maxLength: LIMITS.name },
        premium: { type: "integer", minimum: 0, maximum: LIMITS.dollars },
        experience_mod: { type: "number", minimum: 0, maximum: LIMITS.experienceMod },
        claims: { type: "integer", minimum: 0, maximum: LIMITS.count },
        paid: { type: "integer", minimum: 0, maximum: LIMITS.dollars },
        reserved: { type: "integer", minimum: 0, maximum: LIMITS.dollars },
        valuation_date: { type: "string", maxLength: LIMITS.name },
        no_coverage: { type: "boolean" },
      },
    },
    // One current medical plan (K-4.1): its monthly rate for each coverage tier, the renewal rates when the
    // employer has them, what the employer contributes and how many are enrolled.
    medicalPlan: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", maxLength: LIMITS.name, pattern: NOT_BLANK },
        carrier: { type: "string", maxLength: LIMITS.name },
        rate_ee: money,
        rate_ee_sp: money,
        rate_ee_ch: money,
        rate_fam: money,
        renewal_rate_ee: money,
        renewal_rate_ee_sp: money,
        renewal_rate_ee_ch: money,
        renewal_rate_fam: money,
        employer_contribution: { type: "string", maxLength: LIMITS.name },
        enrolled: { type: "integer", minimum: 0, maximum: LIMITS.count },
      },
    },
    // One state's unemployment tax rate (K-4.2): the rate as a percentage, and the year it applies to.
    sutaRate: {
      type: "object",
      additionalProperties: false,
      properties: {
        state: { title: "a US state or territory code such as CA", type: "string", enum: [...STATE_CODES] },
        rate: { type: "number", minimum: 0, maximum: LIMITS.percent },
        year: { type: "integer", minimum: LIMITS.yearMin, maximum: LIMITS.yearMax },
      },
    },
    dependent: {
      type: "object",
      additionalProperties: false,
      required: ["first_name"],
      properties: {
        first_name: { type: "string", maxLength: LIMITS.text, pattern: NOT_BLANK },
        last_name: { type: "string", maxLength: LIMITS.name },
        dob: { type: "string", maxLength: LIMITS.dob },
        relationship: { type: "string", enum: ["spouse", "domestic_partner", "child", "other"] },
      },
    },
  },
};

/** One way a value breaks the schema. `path` is zero-based, as the database names it: `states[2]`, `census[3].dob`. */
export interface IntakeIssue {
  path: string;
  reason: string;
}

/** The schema the intake follows now. */
export const INTAKE_SCHEMA = INTAKE_SCHEMA_V3;

/** Every top-level field with its x-intake metadata, in rank order (the order Lenore asks in). */
export const INTAKE_FIELDS: readonly ({ key: string } & IntakeFieldMeta)[] = Object.entries(INTAKE_SCHEMA.properties as Record<string, JsonSchema>)
  .map(([key, schema]) => ({ key, ...(schema["x-intake"] as IntakeFieldMeta) }))
  .sort((a, b) => a.rank - b.rank);

// The keywords this validator implements. Anything else in a schema is an error, so a rule can't be
// written into the schema and then silently not enforced. `x-intake` is this project's annotation.
const ANNOTATIONS = new Set(["$schema", "$id", "title", "description", "deprecated", "$defs", "x-intake"]);
const ASSERTIONS = new Set([
  "type", "enum", "maxLength", "pattern", "minimum", "maximum", "maxItems", "items", "properties", "required",
  "additionalProperties", "$ref",
]);

/** Throws when `schema` uses a keyword this validator does not implement, or a form of one it doesn't. */
export function assertSupportedSchema(schema: JsonSchema, at = "#"): void {
  for (const [keyword, value] of Object.entries(schema)) {
    if (!ANNOTATIONS.has(keyword) && !ASSERTIONS.has(keyword)) throw new Error(`Unsupported schema keyword ${keyword} at ${at}`);
    if (keyword === "additionalProperties" && value !== false) throw new Error(`Only additionalProperties: false is supported (at ${at})`);
    if (keyword === "$ref" && !(typeof value === "string" && /^#\/\$defs\/\w+$/.test(value))) throw new Error(`Only local #/$defs references are supported (at ${at})`);
  }
  const children: [string, unknown][] = [
    ...Object.entries((schema.properties ?? {}) as Record<string, unknown>).map(([k, v]) => [`${at}/properties/${k}`, v] as [string, unknown]),
    ...Object.entries((schema.$defs ?? {}) as Record<string, unknown>).map(([k, v]) => [`${at}/$defs/${k}`, v] as [string, unknown]),
    ...(schema.items ? [[`${at}/items`, schema.items] as [string, unknown]] : []),
  ];
  for (const [path, child] of children) assertSupportedSchema(child as JsonSchema, path);
}

assertSupportedSchema(INTAKE_SCHEMA_V3);

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

const matchesType = (v: unknown, type: string) => {
  const actual = typeOf(v);
  return actual === type || (type === "number" && actual === "integer");
};

const join = (base: string, key: string) => (base ? `${base}.${key}` : key);
// Characters, not UTF-16 units: JSON Schema's maxLength and Postgres's char_length both count code points.
const length = (s: string) => Array.from(s).length;
const patterns = new Map<string, RegExp>();
const regex = (source: string) => {
  let re = patterns.get(source);
  if (!re) patterns.set(source, (re = new RegExp(source, "u")));
  return re;
};

/** At most this many issues are collected, so a 5,000-row census can't flood a log. */
export const MAX_ISSUES = 50;

function check(schema: JsonSchema, value: unknown, path: string, root: JsonSchema, issues: IntakeIssue[]): void {
  if (issues.length >= MAX_ISSUES) return;
  const here = path || "chamber_data";
  if (typeof schema.$ref === "string") {
    const target = (root.$defs as Record<string, JsonSchema>)[schema.$ref.slice("#/$defs/".length)];
    if (!target) throw new Error(`Unknown schema reference ${schema.$ref}`);
    check(target, value, path, root, issues);
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
    if (!types.some((t) => matchesType(value, t))) {
      issues.push({ path: here, reason: `must be ${types.map((t) => (t === "null" ? "null" : `a${/^[aeiou]/.test(t) ? "n" : ""} ${t}`)).join(" or ")}` });
      return;
    }
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((allowed) => allowed === value)) {
    // A long list reads better by its title ("a US state or territory code such as CA").
    const shown = schema.enum.filter((v) => v !== null && v !== "");
    const reason = typeof schema.title === "string" ? `must be ${schema.title}`
      : shown.length > 8 ? "is not an allowed value" : `must be one of ${shown.join(", ")}`;
    issues.push({ path: here, reason });
    return;
  }

  if (typeof value === "string") {
    if (typeof schema.maxLength === "number" && length(value) > schema.maxLength) {
      issues.push({ path: here, reason: `must be at most ${schema.maxLength} characters` });
    }
    if (typeof schema.pattern === "string" && !regex(schema.pattern).test(value)) {
      const reason = schema.pattern === NOT_BLANK ? "must not be blank" : typeof schema.title === "string" ? `must be ${schema.title}` : "is not in the expected format";
      issues.push({ path: here, reason });
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) issues.push({ path: here, reason: `must be at least ${schema.minimum.toLocaleString("en-US")}` });
    if (typeof schema.maximum === "number" && value > schema.maximum) issues.push({ path: here, reason: `must be at most ${schema.maximum.toLocaleString("en-US")}` });
  }

  if (Array.isArray(value)) {
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      issues.push({ path: here, reason: `must have at most ${schema.maxItems} entries` });
      return;
    }
    if (schema.items) {
      value.forEach((item, i) => check(schema.items as JsonSchema, item, `${path || "chamber_data"}[${i}]`, root, issues));
    }
  }

  if (isPlainObject(value)) {
    const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
    for (const key of (schema.required ?? []) as string[]) {
      if (!(key in value)) issues.push({ path: join(path, key), reason: "is required" });
    }
    for (const [key, child] of Object.entries(value)) {
      if (key in properties) check(properties[key], child, join(path, key), root, issues);
      else if (schema.additionalProperties === false) issues.push({ path: join(path, key), reason: "is not a known intake field" });
    }
  }
}

/** Every way `value` breaks `schema` (up to MAX_ISSUES); empty when it conforms. */
export function validateAgainst(schema: JsonSchema, value: unknown, path = "", root: JsonSchema = schema): IntakeIssue[] {
  const issues: IntakeIssue[] = [];
  check(schema, value, path, root, issues);
  return issues.slice(0, MAX_ISSUES);
}

/** Checks a whole chamber_data object (or a patch of some of its keys) against the current intake schema. */
export function validateChamberData(value: unknown): IntakeIssue[] {
  return validateAgainst(INTAKE_SCHEMA, value);
}

/** Checks one top-level answer. An unknown field is an issue too. */
export function validateIntakeField(field: string, value: unknown): IntakeIssue[] {
  const properties = INTAKE_SCHEMA.properties as Record<string, JsonSchema>;
  if (!Object.prototype.hasOwnProperty.call(properties, field)) return [{ path: field, reason: "is not a known intake field" }];
  return validateAgainst(properties[field], value, field, INTAKE_SCHEMA);
}
