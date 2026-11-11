import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { REQUIRED_ITEMS } from "@/data/readiness";
import {
  assertSupportedSchema,
  FIELD_SECTIONS,
  INTAKE_FIELDS,
  INTAKE_SCHEMA,
  INTAKE_SCHEMA_VERSION,
  type JsonSchema,
  MAX_ISSUES,
  REQUIRED_FIELDS,
  validateChamberData,
  validateIntakeField,
} from "../../supabase/functions/_shared/intakeSchema";

const paths = (value: unknown) => validateChamberData(value).map((issue) => issue.path);
const row = (extra: Record<string, unknown> = {}) => ({
  id: "6f1c2a40-0001-4c1e-9a7b-3d5e00000001",
  first_name: "Sarah",
  last_name: "Chen",
  work_state: "CA",
  compensation_type: "salary",
  employment_type: "full_time",
  classification: "w2",
  ...extra,
});

describe("intake schema v3", () => {
  const props = INTAKE_SCHEMA.properties as Record<string, JsonSchema>;

  it("is published as docs/intake-schema.v3.json (regenerate with npm run schema:intake)", () => {
    expect(readFileSync("docs/intake-schema.v3.json", "utf8")).toBe(`${JSON.stringify(INTAKE_SCHEMA, null, 2)}\n`);
  });

  it("is version 3 and a draft 2020-12 JSON Schema", () => {
    expect(INTAKE_SCHEMA_VERSION).toBe(3);
    expect(INTAKE_SCHEMA.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(INTAKE_SCHEMA.$id).toBe("urn:edgar-allan-advisory:intake:chamber-data:v3");
  });

  it("names exactly the answers an intake holds", () => {
    expect(Object.keys(props).sort()).toEqual(Object.keys(EMPTY_CHAMBER_DATA).sort());
  });

  // A v2 answer set must stay valid (K-5.1: a v2 intake opens and certifies unchanged), so v3 may only add
  // optional answers, and optional keys inside a census row, to the v2 published in docs/.
  const v2 = JSON.parse(readFileSync("docs/intake-schema.v2.json", "utf8")) as JsonSchema;
  const v2Props = v2.properties as Record<string, JsonSchema>;
  const NEW_IN_V3: string[] = [
    // K-1.1 company identity
    "fein", "entity_type", "year_founded", "street_address", "website", "entities",
    // K-1.2 industry as a code and a description
    "naics_code", "operations_description",
  ];

  it("only adds the common questions to v2, changing nothing v2 had", () => {
    // The rank is the one thing v3 may change about a v2 field: new answers are asked among the old ones.
    const withoutMeta = ({ "x-intake": _meta, ...rule }: JsonSchema) => rule;
    expect(Object.keys(props).filter((key) => !(key in v2Props)).sort()).toEqual([...NEW_IN_V3].sort());
    for (const [key, rule] of Object.entries(v2Props)) expect(withoutMeta(props[key]), key).toEqual(withoutMeta(rule));
    expect(INTAKE_SCHEMA.additionalProperties).toBe(false);
  });

  it("keeps every rule v2 had inside a census row and a dependent, and requires nothing new of them", () => {
    const defs = INTAKE_SCHEMA.$defs as Record<string, JsonSchema>;
    for (const [name, was] of Object.entries(v2.$defs as Record<string, JsonSchema>)) {
      const { properties: wasProps, ...wasRest } = was;
      const { properties: nowProps, ...nowRest } = defs[name];
      expect(nowRest, name).toEqual(wasRest);
      for (const [key, rule] of Object.entries((wasProps ?? {}) as Record<string, JsonSchema>)) {
        expect((nowProps as Record<string, JsonSchema>)[key], `${name}.${key}`).toEqual(rule);
      }
    }
  });

  it("accepts every answer set v2 accepted", () => {
    const v2Answers = Object.fromEntries(Object.keys(v2Props).map((key) => [key, (DEMO_CHAMBER_DATA as unknown as Record<string, unknown>)[key]]));
    expect(validateChamberData(v2Answers)).toEqual([]);
  });

  it("gives every field a label, a section, a required flag and a rank", () => {
    for (const [key, schema] of Object.entries(props)) {
      const meta = schema["x-intake"] as Record<string, unknown>;
      expect(Object.keys(meta), key).toEqual(["label", "section", "required", "rank"]);
      expect(typeof meta.label === "string" && meta.label.trim() !== "", key).toBe(true);
      expect(FIELD_SECTIONS, key).toContain(meta.section);
    }
    expect(new Set(INTAKE_FIELDS.map((f) => f.label)).size).toBe(INTAKE_FIELDS.length);
    expect(INTAKE_FIELDS.map((f) => f.section).filter((s, i, all) => all.indexOf(s) === i).sort()).toEqual([...FIELD_SECTIONS].sort());
  });

  // One list of required answers (D2, D25): the one the Review, the Reckoning and the certification gate use.
  it("requires exactly the answers readiness requires before certifying, and ranks them first, in the order Lenore asks", () => {
    expect(INTAKE_FIELDS.filter((f) => f.required).map((f) => f.key)).toEqual(REQUIRED_ITEMS.map((item) => item.field));
    expect(INTAKE_FIELDS.filter((f) => f.required).map((f) => f.key)).toEqual([...REQUIRED_FIELDS]);
    expect(INTAKE_FIELDS.map((f) => f.rank)).toEqual(INTAKE_FIELDS.map((_, i) => i + 1));
    expect(INTAKE_FIELDS.slice(0, REQUIRED_FIELDS.length).every((f) => f.required)).toBe(true);
    expect(INTAKE_FIELDS.slice(0, 14).map((f) => f.key)).toEqual([
      "company_name", "states", "pay_frequency", "census",
      "employee_count", "industry", "hq_state", "current_carrier", "renewal_date", "payroll_vendor",
      "wc_carrier", "wc_renewal_date", "wc_experience_mod", "wc_annual_premium",
    ]);
  });

  it("puts the workers' comp block in its own section", () => {
    expect(INTAKE_FIELDS.filter((f) => f.section === "workers_comp").map((f) => f.key).sort()).toEqual([
      "wc_annual_premium", "wc_carrier", "wc_experience_mod", "wc_renewal_date",
    ]);
  });

  it("refuses to run a schema that uses a keyword the validator doesn't implement", () => {
    expect(() => assertSupportedSchema({ type: "string", format: "date" })).toThrow(/format/);
    expect(() => assertSupportedSchema({ properties: { a: { oneOf: [] } } })).toThrow(/oneOf at #\/properties\/a/);
    expect(() => assertSupportedSchema({ additionalProperties: { type: "string" } })).toThrow(/additionalProperties: false/);
    expect(() => assertSupportedSchema({ $ref: "https://example.com/x.json" })).toThrow(/local/);
    expect(() => assertSupportedSchema(INTAKE_SCHEMA)).not.toThrow();
  });
});

describe("validateChamberData", () => {
  it("accepts the empty intake, the demo intake and a partial one", () => {
    expect(validateChamberData(EMPTY_CHAMBER_DATA)).toEqual([]);
    expect(validateChamberData(DEMO_CHAMBER_DATA)).toEqual([]);
    expect(validateChamberData({ company_name: "Acme", employee_count: 0, has_401k: false })).toEqual([]);
  });

  it("names every problem by the path the database uses", () => {
    expect(paths({
      company_name: 7,
      hq_state: "ca",
      states: ["CA", "XX"],
      employee_count: -1,
      fein_count: 1.5,
      has_401k: "yes",
      pto_types: "Vacation",
      census: [row({ age: 9, zip_code: "n/a", dependents: [{ first_name: "Mia", relationship: "niece" }] })],
      reply: "hello",
    })).toEqual([
      "company_name", "hq_state", "states[1]", "employee_count", "fein_count", "has_401k", "pto_types",
      "census[0].age", "census[0].zip_code", "census[0].dependents[0].relationship", "reply",
    ]);
  });

  it("refuses a value that is not an object at all", () => {
    expect(validateChamberData([])).toEqual([{ path: "chamber_data", reason: "must be an object" }]);
    expect(validateChamberData(null)).toEqual([{ path: "chamber_data", reason: "must be an object" }]);
  });

  it("repairs nothing: case, spacing, number text and comma lists are refused as sent", () => {
    expect(paths({ hq_state: " CA", states: "CA, TX", employee_count: "12", pay_frequency: "  " })).toEqual(["hq_state", "states", "employee_count"]);
    // Blank text is an answer the database stores; only a census name must not be blank.
    expect(validateIntakeField("pay_frequency", "  ")).toEqual([]);
  });

  it("counts characters, not UTF-16 units, as the database does", () => {
    expect(validateChamberData({ company_name: "😀".repeat(1000) })).toEqual([]);
    expect(validateChamberData({ company_name: "😀".repeat(1001) })).toEqual([{ path: "company_name", reason: "must be at most 1000 characters" }]);
  });

  it("takes a whole number written with a decimal point as the integer it is", () => {
    expect(validateChamberData({ employee_count: 12.0, census: [row({ annual_salary: 85000.0 })] })).toEqual([]);
  });

  it("holds the census to the canonical row: required fields, known keys only, its own value lists", () => {
    expect(validateChamberData({ census: [row()] })).toEqual([]);
    expect(validateChamberData({ census: [{ first_name: "Sarah" }] }).map((i) => i.path)).toEqual([
      "census[0].id", "census[0].last_name", "census[0].work_state", "census[0].compensation_type",
      "census[0].employment_type", "census[0].classification",
    ]);
    expect(validateChamberData({ census: [row({ first_name: "   ", nickname: "S", classification: "W2", work_state: "" })] })).toEqual([
      { path: "census[0].first_name", reason: "must not be blank" },
      { path: "census[0].classification", reason: "must be one of w2, 1099" },
      { path: "census[0].nickname", reason: "is not a known intake field" },
    ]);
    expect(paths({ census: [row({ dependents: [{ last_name: "Chen", extra: true }] })] })).toEqual([
      "census[0].dependents[0].first_name", "census[0].dependents[0].extra",
    ]);
  });

  it("holds the workers' comp block to its rules: a fractional mod, whole dollars", () => {
    expect(validateChamberData({ wc_carrier: "Pinnacle Mutual", wc_renewal_date: "July 2026", wc_experience_mod: 0.92, wc_annual_premium: 18400 })).toEqual([]);
    expect(validateChamberData({ wc_experience_mod: 0, wc_annual_premium: 0 })).toEqual([]);
    expect(validateChamberData({ wc_experience_mod: 10, wc_annual_premium: 100_000_000 })).toEqual([]);
    expect(validateChamberData({ wc_experience_mod: null, wc_annual_premium: null })).toEqual([]);
    expect(validateChamberData({ wc_experience_mod: 10.01, wc_annual_premium: 100_000_001 })).toEqual([
      { path: "wc_experience_mod", reason: "must be at most 10" },
      { path: "wc_annual_premium", reason: "must be at most 100,000,000" },
    ]);
    expect(paths({ wc_experience_mod: "0.92", wc_annual_premium: 1200.5 })).toEqual(["wc_experience_mod", "wc_annual_premium"]);
    expect(paths({ wc_experience_mod: -0.1, wc_annual_premium: "$18,400" })).toEqual(["wc_experience_mod", "wc_annual_premium"]);
  });

  it("holds the company's identity to its rules: a nine-digit FEIN, a listed entity type, a real year (K-1.1)", () => {
    expect(validateChamberData({ fein: "123456789", entity_type: "llc", year_founded: 1998, street_address: "500 Main St, Austin, TX 78701", website: "meridian.example" })).toEqual([]);
    expect(validateChamberData({ fein: null, entity_type: null, year_founded: null, street_address: null, website: null })).toEqual([]);
    expect(validateChamberData({ fein: "12-3456789" })).toEqual([{ path: "fein", reason: "must be nine digits, such as 123456789" }]);
    expect(paths({ fein: "12345678" })).toEqual(["fein"]);
    expect(paths({ fein: 123456789 })).toEqual(["fein"]);
    expect(validateChamberData({ entity_type: "LLC" })).toEqual([
      { path: "entity_type", reason: "must be one of sole_proprietorship, partnership, llc, c_corporation, s_corporation, nonprofit, other" },
    ]);
    expect(paths({ year_founded: 1599 })).toEqual(["year_founded"]);
    expect(paths({ year_founded: 2101 })).toEqual(["year_founded"]);
    expect(paths({ year_founded: "1998" })).toEqual(["year_founded"]);
  });

  it("holds the industry as a six-digit code and a description of operations of up to 1,000 characters (K-1.2)", () => {
    expect(validateChamberData({ naics_code: "541430", operations_description: "Brand and packaging design for consumer goods." })).toEqual([]);
    expect(validateChamberData({ naics_code: null, operations_description: null })).toEqual([]);
    expect(validateChamberData({ naics_code: "54143" })).toEqual([{ path: "naics_code", reason: "must be a six-digit NAICS code, such as 541430" }]);
    expect(paths({ naics_code: 541430 })).toEqual(["naics_code"]);
    expect(paths({ naics_code: "5414300" })).toEqual(["naics_code"]);
    expect(validateChamberData({ operations_description: "x".repeat(1000) })).toEqual([]);
    expect(validateChamberData({ operations_description: "x".repeat(1001) })).toEqual([{ path: "operations_description", reason: "must be at most 1000 characters" }]);
  });

  it("lists each legal entity with its name and FEIN when the employer is more than one (K-1.1)", () => {
    expect(validateChamberData({ entities: [{ legal_name: "Meridian Creative LLC", fein: "123456789" }, { legal_name: "Meridian Studios Inc" }] })).toEqual([]);
    expect(validateChamberData({ entities: [] })).toEqual([]);
    expect(validateChamberData({ entities: [{ legal_name: " ", fein: "12-3456789", dba: "Meridian" }] })).toEqual([
      { path: "entities[0].legal_name", reason: "must not be blank" },
      { path: "entities[0].fein", reason: "must be nine digits, such as 123456789" },
      { path: "entities[0].dba", reason: "is not a known intake field" },
    ]);
    expect(validateChamberData({ entities: Array.from({ length: 51 }, () => ({ legal_name: "A" })) })).toEqual([
      { path: "entities", reason: "must have at most 50 entries" },
    ]);
    expect(paths({ entities: null })).toEqual(["entities"]);
  });

  it("refuses the legacy roster key, which no writer sends any more", () => {
    expect(paths({ employees: [] })).toEqual(["employees"]);
  });

  it("holds every list to its cap", () => {
    const states = Array.from({ length: 61 }, () => "CA");
    expect(validateChamberData({ states })).toEqual([{ path: "states", reason: "must have at most 60 entries" }]);
    expect(paths({ census: [row({ dependents: Array.from({ length: 21 }, () => ({ first_name: "D" })) })] })).toEqual(["census[0].dependents"]);
  });

  it(`stops at ${MAX_ISSUES} issues, so a bad census can't flood a log`, () => {
    const census = Array.from({ length: 500 }, () => ({ first_name: " " }));
    expect(validateChamberData({ census })).toHaveLength(MAX_ISSUES);
  });

  it("checks a single answer, and calls an unknown one unknown", () => {
    expect(validateIntakeField("states", ["NY"])).toEqual([]);
    expect(validateIntakeField("states", ["ny"])).toEqual([{ path: "states[0]", reason: "must be a US state or territory code such as CA" }]);
    expect(validateIntakeField("employee_count", null)).toEqual([]);
    expect(validateIntakeField("ssn", "123")).toEqual([{ path: "ssn", reason: "is not a known intake field" }]);
    expect(validateIntakeField("toString", "x")).toEqual([{ path: "toString", reason: "is not a known intake field" }]);
  });
});
