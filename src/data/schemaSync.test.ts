import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { CENSUS_ASSUMABLE, CLASSIFICATIONS, COMPENSATION_TYPES, COVERAGE_TIERS, EMPLOYMENT_TYPES, MAX_ANNUAL_SALARY, MAX_CENSUS_ROWS, MAX_DEPENDENTS as CENSUS_MAX_DEPENDENTS } from "@/data/census";
import {
  COUNT_MAX,
  DOB_MAX,
  DOLLARS_MAX,
  EXPERIENCE_MOD_MAX,
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
import { RETENTION } from "@/data/dataPolicy";
import { INTAKE_CONSENT_VERSION } from "@/data/intakeConsent";
import { AI_ERROR_CODES } from "../../supabase/functions/_shared/ai/errors";
import { PEO_NAME_MAX } from "@/data/peoCatalog";
import { BLOCKING_STATUSES, REQUIRED_ITEMS } from "@/data/readiness";
import { isFileId } from "@/data/manuscript";
import { MAX_EMPLOYEES as EXTRACT_MAX_EMPLOYEES, US_STATE_CODES as EXTRACT_STATE_CODES } from "../../supabase/functions/document-extract/parse";
import { INTAKE_SCHEMA, INTAKE_SCHEMA_VERSION, LIMITS, STATE_CODES as SCHEMA_STATE_CODES, type JsonSchema } from "../../supabase/functions/_shared/intakeSchema";

// The server (supabase/migrations/20261027090000_intake_validation_and_versioning.sql, and later
// migrations that replace its functions) refuses what the client sanitiser would never produce, so the
// two sides must hold the same lists and limits. The migrations mark what is compared with
// `-- sync:begin <name>` / `-- sync:end <name>` comments. Each block belongs to the function or constraint
// it sits in, and the one the database runs is the latest migration's definition of that function. So
// each owner's blocks are read from the latest migration that defines the owner: a migration replacing
// one function that holds a `caps` block leaves another function's `caps` block to be read where it was.
const migrationFiles = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
const latest = new Map<string, { name: string; body: string }[]>();
for (const file of migrationFiles) {
  const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
  const owners = [...sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)|ADD\s+CONSTRAINT\s+(\w+)/g)];
  const here = new Map<string, { name: string; body: string }[]>();
  for (const m of sql.matchAll(/--\s*sync:begin\s+(\w+)\s*\n([\s\S]*?)--\s*sync:end\s+\1\b/g)) {
    const owner = owners.filter((o) => o.index! < m.index!).at(-1);
    const key = owner ? owner[1] ?? owner[2] : file;
    here.set(key, [...(here.get(key) ?? []), { name: m[1], body: m[2] }]);
  }
  for (const [owner, found] of here) latest.set(owner, found);
}

const ownersOf = (name: string) => [...latest].filter(([, found]) => found.some((b) => b.name === name)).map(([owner]) => owner).sort();

const blocks = (name: string): string[] => {
  const found = [...latest.values()].flat().filter((b) => b.name === name).map((b) => b.body);
  expect(found.length, `sync block ${name} missing from the migrations`).toBeGreaterThan(0);
  return found;
};

describe("reading the migrations' sync blocks", () => {
  it("keeps each function's blocks from the latest migration that defines that function", () => {
    // 20261103120000 replaces chamber_data_error; the census row's caps stay those of 20261029092000.
    expect(ownersOf("caps")).toEqual(["public.chamber_data_census_row_error", "public.chamber_data_error"]);
    expect(ownersOf("field_kinds")).toEqual(["public.chamber_data_field_kind"]);
    expect(ownersOf("intake_schema_version")).toEqual(["chamber_sessions_schema_version_check"]);
  });
});

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
      // Entered as a number, held to the dollars cap rather than the count cap.
      if (key === "wc_annual_premium") return "dollars";
      const kind = FIELD_KINDS[key as keyof typeof FIELD_KINDS];
      if (kind === "decimal") return "experience_mod";
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
      max_experience_mod: EXPERIENCE_MOD_MAX,
      max_dollars: DOLLARS_MAX,
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

  it("requires the same answers before certifying", () => {
    const keys = [...blocks("required_items").join("\n").matchAll(/THEN '(\w+)' END/g)].map((m) => m[1]);
    expect(keys).toEqual(REQUIRED_ITEMS.map((item) => item.key));
  });

  // A required answer that is conflicting or incomplete blocks certifying on both sides (20261104100000).
  it("refuses the same unsettled field statuses on a required answer", () => {
    expect(quoted(blocks("unsettled_statuses").join("\n"))).toEqual([...BLOCKING_STATUSES]);
  });

  // The File ID the database assigns (D15) is one the Manuscript route accepts.
  it("assigns File IDs in the form the Manuscript route accepts", () => {
    const sql = blocks("reference_format").join("\n");
    expect(sql).toMatch(/format\('EAA-%s-%s', p_year, lpad\(n::text, 4, '0'\)\)/);
    expect(isFileId("EAA-2026-0001")).toBe(true);
    expect(isFileId("EAA-2026-12345")).toBe(true);
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

  // chamber-extract keeps its own field list (it can't import from src/). Chat asks for every answer the
  // intake holds except the census, which comes from a document, so a field added to ChamberData and not
  // to the tool would never be extracted from chat.
  it("has chamber-extract ask for every answer but the census, as the JSON type of the kind the client edits", () => {
    const { census: _census, ...answers } = EMPTY_CHAMBER_DATA;
    expect(Object.keys(CHAT_FIELD_TYPES).sort()).toEqual(Object.keys(answers).sort());
    const kindOf = (schema: unknown) => {
      const json = JSON.stringify(schema);
      if (json === '{"type":"string"}') return "text";
      if (json === '{"type":"integer"}') return "number";
      if (json === '{"type":"number"}') return "decimal";
      if (json === '{"type":"boolean"}') return "boolean";
      if (json === '{"type":"array","items":{"type":"string"}}') return "list";
      return json;
    };
    expect(Object.fromEntries(Object.entries(CHAT_FIELD_TYPES).map(([key, schema]) => [key, kindOf(schema)]))).toEqual(FIELD_KINDS);
  });

  // The intake schema (supabase/functions/_shared/intakeSchema.ts) must never accept what the database
  // refuses, so it holds the same codes, caps and value lists, and checks each key as the same kind.
  describe("intake schema", () => {
    const props = INTAKE_SCHEMA.properties as Record<string, JsonSchema>;
    const defs = INTAKE_SCHEMA.$defs as Record<string, JsonSchema>;
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
        max_experience_mod: LIMITS.experienceMod, max_dollars: LIMITS.dollars,
      }).toEqual(Object.fromEntries(server));
      expect(props.wc_experience_mod.maximum).toBe(server.get("max_experience_mod"));
      expect(props.wc_annual_premium.maximum).toBe(server.get("max_dollars"));
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

    it("lists the same defaulted facts a census row can carry", () => {
      const items = row.assumed.items as JsonSchema;
      expect(items.enum).toEqual([...CENSUS_ASSUMABLE]);
      expect(row.assumed.maxItems).toBe(CENSUS_ASSUMABLE.length);
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
        if (types.includes("number")) return "experience_mod";
        if (types.includes("integer")) return schema.maximum === LIMITS.dollars ? "dollars" : "count";
        if (types.includes("boolean")) return "boolean";
        return "text";
      };
      const schemaKinds = Object.fromEntries(Object.entries(props).map(([key, schema]) => [key, kindOf(schema)]));
      // The legacy roster is the one key the database knows and v1 does not.
      const dbKinds = Object.fromEntries([...serverKinds].filter(([key]) => !LEGACY_KEYS.includes(key)));
      expect(schemaKinds).toEqual(dbKinds);
    });
  });

  // An extraction event stores the code the function answered with, so both lists must be the same.
  it("records exactly the error codes the AI functions answer with", () => {
    expect(quoted(blocks("ai_error_codes").join("\n"))).toEqual([...AI_ERROR_CODES]);
  });

  // The Chamber tells a prospect how long a draft is kept; the database is what keeps (and expires) it.
  it("tells prospects the retention window the database applies", () => {
    const days = /interval\s+'(\d+) days'/.exec(blocks("draft_retention").join("\n"))?.[1];
    expect(Number(days)).toBe(DRAFT_RETENTION_DAYS);
  });

  // The Privacy page and docs/DATA_HANDLING.md state these (src/data/dataPolicy.ts); the database deletes
  // and prunes by them (20261104091000_ops_monitoring.sql, 20261104092000_data_retention_and_deletion.sql).
  it.each([
    ["closed_draft_retention", "days", RETENTION.closedDraftDays],
    ["submitted_record_retention", "years", RETENTION.submittedYears],
    ["ops_event_retention", "days", RETENTION.opsEventDays],
    ["email_event_retention", "days", RETENTION.emailEventDays],
    ["ai_event_retention", "days", RETENTION.aiEventDays],
  ] as const)("states the %s window the database enforces", (block, unit, value) => {
    const found = new RegExp(`interval\\s+'(\\d+) ${unit}'`).exec(blocks(block).join("\n"))?.[1];
    expect(Number(found)).toBe(value);
  });

  // docs/RUNBOOK.md tells whoever is on call when each kind alerts; public.ops_alert_rules() is what alerts.
  it("documents the alert thresholds the monitor applies", () => {
    const rules = [...blocks("ops_alert_rules").join("\n").matchAll(/\('(\w+)'(?:::text)?,\s*(\d+),\s*(\d+),\s*(\d+)\)/g)].map((m) => ({
      kind: m[1],
      window: Number(m[2]),
      threshold: Number(m[3]),
      cooldown: Number(m[4]),
    }));
    expect(rules.map((r) => r.kind).sort()).toEqual(["ai_failed", "app_error", "auth_denied", "deletion_failed", "upload_failed"]);
    const runbook = readFileSync("docs/RUNBOOK.md", "utf8");
    for (const r of rules) {
      const row = new RegExp(
        `\\| \`${r.kind}\` \\| ${r.threshold} events? \\| ${r.window} minutes \\| ${r.cooldown} minutes \\|`,
      );
      expect(runbook, `docs/RUNBOOK.md alert row for ${r.kind}`).toMatch(row);
    }
  });

  it("documents the caps on browser reports", () => {
    const caps = blocks("ops_report_caps").join("\n");
    const cap = (name: string) => Number(new RegExp(`${name} constant integer := (\\d+);`).exec(caps)?.[1]);
    const runbook = readFileSync("docs/RUNBOOK.md", "utf8");
    expect(runbook).toContain(`drops reports past ${cap("per_account")} an hour per`);
    expect(runbook).toContain(`${cap("signed_out")} an hour for all signed-out visitors`);
    expect(runbook).toContain(`${cap("everyone").toLocaleString("en-US")} an hour overall`);
  });

  // A prospect agrees to the wording in src/data/intakeConsent.ts; the database refuses any other version.
  it("asks for agreement to the consent version the database requires", () => {
    expect(quoted(blocks("intake_consent_version").join("\n"))).toEqual([INTAKE_CONSENT_VERSION]);
  });
});
