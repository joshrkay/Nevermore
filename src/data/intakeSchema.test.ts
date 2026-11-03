import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import {
  assertSupportedSchema,
  INTAKE_SCHEMA_V1,
  INTAKE_SCHEMA_VERSION,
  MAX_ISSUES,
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

describe("intake schema v1", () => {
  it("is published as docs/intake-schema.v1.json (regenerate with npm run schema:intake)", () => {
    expect(readFileSync("docs/intake-schema.v1.json", "utf8")).toBe(`${JSON.stringify(INTAKE_SCHEMA_V1, null, 2)}\n`);
  });

  it("is version 1 and a draft 2020-12 JSON Schema", () => {
    expect(INTAKE_SCHEMA_VERSION).toBe(1);
    expect(INTAKE_SCHEMA_V1.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  });

  it("names exactly the answers an intake holds", () => {
    expect(Object.keys(INTAKE_SCHEMA_V1.properties as object).sort()).toEqual(Object.keys(EMPTY_CHAMBER_DATA).sort());
  });

  it("refuses to run a schema that uses a keyword the validator doesn't implement", () => {
    expect(() => assertSupportedSchema({ type: "string", format: "date" })).toThrow(/format/);
    expect(() => assertSupportedSchema({ properties: { a: { oneOf: [] } } })).toThrow(/oneOf at #\/properties\/a/);
    expect(() => assertSupportedSchema({ additionalProperties: { type: "string" } })).toThrow(/additionalProperties: false/);
    expect(() => assertSupportedSchema({ $ref: "https://example.com/x.json" })).toThrow(/local/);
    expect(() => assertSupportedSchema(INTAKE_SCHEMA_V1)).not.toThrow();
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

  it("refuses the legacy roster key, which v1 writers never send", () => {
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
