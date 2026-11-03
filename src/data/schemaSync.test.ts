import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { CLASSIFICATIONS, COMPENSATION_TYPES, COVERAGE_TIERS, EMPLOYMENT_TYPES, MAX_ANNUAL_SALARY, MAX_CENSUS_ROWS, MAX_DEPENDENTS as CENSUS_MAX_DEPENDENTS } from "@/data/census";
import {
  COUNT_MAX,
  DOB_MAX,
  MAX_DEPENDENTS,
  MAX_EMPLOYEES,
  MAX_LIST_ITEMS,
  MAX_STATES,
  NAME_MAX,
  SALARY_MAX,
  TEXT_MAX,
  US_STATE_CODES,
} from "@/data/chamberValidation";
import { FIELD_KINDS } from "@/data/provenance";
import { DRAFT_RETENTION_DAYS } from "@/data/intakeLifecycle";
import { PEO_NAME_MAX } from "@/data/peoCatalog";
import { MAX_EMPLOYEES as EXTRACT_MAX_EMPLOYEES, US_STATE_CODES as EXTRACT_STATE_CODES } from "../../supabase/functions/document-extract/parse";
import { INTAKE_SCHEMA_V1, INTAKE_SCHEMA_VERSION, LIMITS, STATE_CODES as SCHEMA_STATE_CODES, type JsonSchema } from "../../supabase/functions/_shared/intakeSchema";

// The server (supabase/migrations/20261027090000_intake_validation_and_versioning.sql, and later
// migrations that replace its functions) refuses what the client sanitiser would never produce, so the
// two sides must hold the same lists and limits. The migrations mark what is compared with
// `-- sync:begin <name>` / `-- sync:end <name>` comments. A function a later migration replaces is the
// one the database runs, so a block is read from the latest migration that defines it.
const migrationFiles = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
const latest = new Map<string, string[]>();
for (const file of migrationFiles) {
  const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
  const here = new Map<string, string[]>();
  for (const m of sql.matchAll(/--\s*sync:begin\s+(\w+)\s*\n([\s\S]*?)--\s*sync:end\s+\1\b/g)) {
    here.set(m[1], [...(here.get(m[1]) ?? []), m[2]]);
  }
  for (const [name, found] of here) latest.set(name, found);
}

const blocks = (name: string): string[] => {
  const found = latest.get(name) ?? [];
  expect(found.length, `sync block ${name} missing from the migrations`).toBeGreaterThan(0);
  return found;
};

const quoted = (sql: string) => [...sql.matchAll(/'([^']+)'/g)].map((m) => m[1]);

describe("server and client intake rules agree", () => {
  it("accepts exactly the state codes the client accepts", () => {
    const serverCodes = quoted(blocks("us_state_codes").join("\n"));
    expect(new Set(serverCodes).size, "duplicate state code in the migration").toBe(serverCodes.length);
    expect(serverCodes.length).toBe(56);
    expect([...serverCodes].sort()).toEqual([...US_STATE_CODES].sort());
  });

  // Each WHEN names one key (`= 'a'`) or several (`IN ('a', 'b')`) and the kind they are checked as.
  const serverKinds = new Map<string, string>();
  for (const m of blocks("field_kinds").join("\n").matchAll(/WHEN field (?:= ('[^']+')|IN \(([^)]*)\)) THEN '(\w+)'/g)) {
    for (const key of quoted(m[1] ?? m[2])) serverKinds.set(key, m[3]);
  }

  // The roster's old name stays valid on the server: intakes saved before the census, and browsers that
  // have not yet loaded the version that writes `census`, still save it. The front end reads it as `census`.
  const LEGACY_KEYS = ["employees"];

  it("knows exactly the top-level keys of an intake, and the roster's old name", () => {
    expect(serverKinds.size).toBeGreaterThan(0);
    expect([...serverKinds.keys()].sort()).toEqual([...Object.keys(EMPTY_CHAMBER_DATA), ...LEGACY_KEYS].sort());
  });

  it("checks each key as the kind the client edits it as", () => {
    const clientKind = (key: string) => {
      if (key === "employees" || key === "census") return key;
      const kind = FIELD_KINDS[key as keyof typeof FIELD_KINDS];
      if (kind === "number") return "count";
      if (kind === "list") return key === "states" ? "state_list" : "text_list";
      if (key === "hq_state") return "state";
      return kind;
    };
    const mismatched = [...serverKinds].filter(([key, kind]) => clientKind(key) !== kind).map(([key]) => key);
    expect(mismatched).toEqual([]);
  });

  it("holds the same caps and limits", () => {
    const server = new Map<string, number>();
    for (const sql of [...blocks("caps"), ...blocks("caps_person")]) {
      for (const m of sql.matchAll(/(max_\w+)\s+constant\s+integer\s*:=\s*(\d+)/g)) {
        const value = Number(m[2]);
        // A cap declared in two functions must say the same thing in both.
        expect(server.get(m[1]) ?? value, `${m[1]} differs between functions`).toBe(value);
        server.set(m[1], value);
      }
    }
    expect(Object.fromEntries(server)).toEqual({
      max_employees: MAX_EMPLOYEES,
      max_dependents: MAX_DEPENDENTS,
      max_states: MAX_STATES,
      max_list_items: MAX_LIST_ITEMS,
      max_text: TEXT_MAX,
      max_name: NAME_MAX,
      max_dob: DOB_MAX,
      max_count: COUNT_MAX,
      max_salary: SALARY_MAX,
    });
  });

  // The census row's allowed values are checked by name, because the server lists them inline.
  it("accepts exactly the census values the client writes", () => {
    const server = (name: string) => quoted(blocks(name).join("\n"));
    expect(server("census_compensation_types")).toEqual([...COMPENSATION_TYPES]);
    expect(server("census_employment_types")).toEqual([...EMPLOYMENT_TYPES]);
    expect(server("census_classifications")).toEqual([...CLASSIFICATIONS]);
    expect(server("census_coverage_tiers")).toEqual([...COVERAGE_TIERS]);
  });

  it("holds the same census limits as the shared census module", () => {
    expect(MAX_CENSUS_ROWS).toBe(MAX_EMPLOYEES);
    expect(CENSUS_MAX_DEPENDENTS).toBe(MAX_DEPENDENTS);
    expect(MAX_ANNUAL_SALARY).toBe(SALARY_MAX);
  });

  it("keeps the same longest PEO name", () => {
    const [sql] = blocks("chosen_peo_length");
    const limits = /BETWEEN\s+(\d+)\s+AND\s+(\d+)/.exec(sql);
    expect(limits?.slice(1).map(Number)).toEqual([1, PEO_NAME_MAX]);
  });

  // document-extract can't import from src/, so it keeps its own copies of the roster cap and the state list.
  it("has the same roster cap and state codes in document-extract", () => {
    expect(EXTRACT_MAX_EMPLOYEES).toBe(MAX_EMPLOYEES);
    expect([...EXTRACT_STATE_CODES].sort()).toEqual([...US_STATE_CODES].sort());
  });

  // Intake schema v1 (supabase/functions/_shared/intakeSchema.ts) must never accept what the database
  // refuses, so it holds the same codes, caps and value lists, and checks each key as the same kind.
  describe("intake schema v1", () => {
    const props = INTAKE_SCHEMA_V1.properties as Record<string, JsonSchema>;
    const defs = INTAKE_SCHEMA_V1.$defs as Record<string, JsonSchema>;
    const row = (defs.censusRow.properties ?? {}) as Record<string, JsonSchema>;
    const dependent = (defs.dependent.properties ?? {}) as Record<string, JsonSchema>;

    it("is the version the database records on each session", () => {
      const version = /schema_version\s*=\s*(\d+)/.exec(blocks("intake_schema_version").join("\n"))?.[1];
      expect(Number(version)).toBe(INTAKE_SCHEMA_VERSION);
    });

    it("accepts the same state codes", () => {
      expect([...SCHEMA_STATE_CODES].sort()).toEqual([...quoted(blocks("us_state_codes").join("\n"))].sort());
    });

    it("holds the same caps", () => {
      const server = new Map<string, number>();
      for (const sql of [...blocks("caps"), ...blocks("caps_person")]) {
        for (const m of sql.matchAll(/(max_\w+)\s+constant\s+integer\s*:=\s*(\d+)/g)) server.set(m[1], Number(m[2]));
      }
      expect({
        max_employees: LIMITS.census, max_dependents: LIMITS.dependents, max_states: LIMITS.states, max_list_items: LIMITS.listItems,
        max_text: LIMITS.text, max_name: LIMITS.name, max_dob: LIMITS.dob, max_count: LIMITS.count, max_salary: LIMITS.salary,
      }).toEqual(Object.fromEntries(server));
      expect(props.census.maxItems).toBe(server.get("max_employees"));
      expect(props.states.maxItems).toBe(server.get("max_states"));
      expect(props.pto_types.maxItems).toBe(server.get("max_list_items"));
      expect(row.annual_salary.maximum).toBe(server.get("max_salary"));
      expect(row.dependents.maxItems).toBe(server.get("max_dependents"));
      expect([row.last_name.maxLength, row.job_title.maxLength, dependent.last_name.maxLength]).toEqual(Array(3).fill(server.get("max_name")));
      expect([row.dob.maxLength, dependent.dob.maxLength]).toEqual(Array(2).fill(server.get("max_dob")));
    });

    it("accepts the same census values", () => {
      const server = (name: string) => quoted(blocks(name).join("\n"));
      expect(row.compensation_type.enum).toEqual(server("census_compensation_types"));
      expect(row.employment_type.enum).toEqual(server("census_employment_types"));
      expect(row.classification.enum).toEqual(server("census_classifications"));
      expect(row.coverage_tier.enum).toEqual(server("census_coverage_tiers"));
    });

    it("checks each key as the kind the database checks it as", () => {
      const kindOf = (schema: JsonSchema): string => {
        const types = ([] as unknown[]).concat(schema.type);
        if (types.includes("array")) {
          const items = schema.items as JsonSchema;
          if (items.$ref === "#/$defs/stateCode") return "state_list";
          if (items.$ref === "#/$defs/censusRow") return "census";
          return "text_list";
        }
        if (schema.enum) return "state";
        if (types.includes("integer")) return "count";
        if (types.includes("boolean")) return "boolean";
        return "text";
      };
      const schemaKinds = Object.fromEntries(Object.entries(props).map(([key, schema]) => [key, kindOf(schema)]));
      // The legacy roster is the one key the database knows and v1 does not.
      const dbKinds = Object.fromEntries([...serverKinds].filter(([key]) => !LEGACY_KEYS.includes(key)));
      expect(schemaKinds).toEqual(dbKinds);
    });
  });

  // The Chamber tells a prospect how long a draft is kept; the database is what keeps (and expires) it.
  it("tells prospects the retention window the database applies", () => {
    const days = /interval\s+'(\d+) days'/.exec(blocks("draft_retention").join("\n"))?.[1];
    expect(Number(days)).toBe(DRAFT_RETENTION_DAYS);
  });
});
