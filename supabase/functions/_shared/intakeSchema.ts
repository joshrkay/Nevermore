// The canonical intake schema, version 1: chamber_data as JSON Schema (draft 2020-12), and a strict
// validator for it. Strict means a value is accepted as it is or refused with a reason. Nothing is
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
// older client can save a newer census), the legacy `employees` roster is not part of v1, and a census
// row must carry the fields every v1 writer gives it.
//
// docs/intake-schema.v1.json is this schema, printed. src/data/intakeSchema.test.ts keeps the two equal.
//
// No imports: it runs under Deno (the edge functions) and Vite (the app) alike.

export const INTAKE_SCHEMA_VERSION = 1;

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
} as const;

/** A JSON Schema, as far as this module reads one. */
export type JsonSchema = { [keyword: string]: unknown };

// Text with at least one character other than a space: the database's btrim(x) <> ''.
const NOT_BLANK = "[^ ]";

const text = (maxLength: number = LIMITS.text): JsonSchema => ({ type: ["string", "null"], maxLength });
const count: JsonSchema = { type: ["integer", "null"], minimum: 0, maximum: LIMITS.count };
const flag: JsonSchema = { type: ["boolean", "null"] };
const textList: JsonSchema = { type: "array", maxItems: LIMITS.listItems, items: { type: "string", maxLength: LIMITS.text } };

export const INTAKE_SCHEMA_V1: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:edgar-allan-advisory:intake:chamber-data:v1",
  title: "Intake answers (chamber_data), version 1",
  description:
    "What a prospect's intake holds. Every key is optional; an unanswered question is null (or an empty list). " +
    "Generated from supabase/functions/_shared/intakeSchema.ts.",
  type: "object",
  additionalProperties: false,
  properties: {
    company_name: text(),
    industry: text(),
    hq_state: { title: "a US state or territory code such as CA", type: ["string", "null"], enum: [...STATE_CODES, null] },
    states: { type: "array", maxItems: LIMITS.states, items: { $ref: "#/$defs/stateCode" } },
    employee_count: count,
    start_month: text(),
    multiple_entities: flag,
    fein_count: count,

    virgin_medical: flag,
    current_carrier: text(),
    renewal_date: text(),
    rate_history: text(),
    benefits_waiting_period: text(),
    ancillary_benefits: textList,
    has_401k: flag,
    retirement_type: text(),
    employer_contributes: flag,

    payroll_vendor: text(),
    pay_frequency: text(),
    funding_days: count,
    has_nonexempt: flag,
    nonexempt_count: count,
    exempt_count: count,
    pto_types: textList,
    accrual_method: text(),

    has_handbook: flag,
    handbook_last_updated: text(),
    hr_staff_count: count,
    has_1099: flag,
    ca_contractors: flag,
    uses_physical_clocks: flag,
    uses_mobile_app: flag,
    uses_computer_timekeeping: flag,
    shift_differentials: flag,
    hris_system: text(),
    key_challenges: text(),
    business_goals: text(),

    census: { type: "array", maxItems: LIMITS.census, items: { $ref: "#/$defs/censusRow" } },
  },
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
        dependents: { type: "array", maxItems: LIMITS.dependents, items: { $ref: "#/$defs/dependent" } },
        // Which of the row's values are defaults rather than answers (CENSUS_ASSUMABLE in census.ts).
        // Added to v1 without a new version: it is optional, and the database already tolerated it.
        assumed: { type: "array", maxItems: 3, items: { type: "string", enum: ["classification", "employment_type", "annual_salary"] } },
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

// The keywords this validator implements. Anything else in a schema is an error, so a rule can't be
// written into the schema and then silently not enforced.
const ANNOTATIONS = new Set(["$schema", "$id", "title", "description", "deprecated", "$defs"]);
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

assertSupportedSchema(INTAKE_SCHEMA_V1);

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
      issues.push({ path: here, reason: schema.pattern === NOT_BLANK ? "must not be blank" : "is not in the expected format" });
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

/** Checks a whole chamber_data object (or a patch of some of its keys) against intake schema v1. */
export function validateChamberData(value: unknown): IntakeIssue[] {
  return validateAgainst(INTAKE_SCHEMA_V1, value);
}

/** Checks one top-level answer. An unknown field is an issue too. */
export function validateIntakeField(field: string, value: unknown): IntakeIssue[] {
  const properties = INTAKE_SCHEMA_V1.properties as Record<string, JsonSchema>;
  if (!Object.prototype.hasOwnProperty.call(properties, field)) return [{ path: field, reason: "is not a known intake field" }];
  return validateAgainst(properties[field], value, field, INTAKE_SCHEMA_V1);
}
