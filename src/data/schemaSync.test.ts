import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import {
  COUNT_MAX,
  MAX_DEPENDENTS,
  MAX_EMPLOYEES,
  MAX_LIST_ITEMS,
  MAX_STATES,
  SALARY_MAX,
  TEXT_MAX,
  US_STATE_CODES,
} from "@/data/chamberValidation";
import { FIELD_KINDS } from "@/data/provenance";
import { MAX_EMPLOYEES as EXTRACT_MAX_EMPLOYEES, US_STATE_CODES as EXTRACT_STATE_CODES } from "../../supabase/functions/document-extract/parse";

// The server (supabase/migrations/20261027090000_intake_validation_and_versioning.sql) refuses what the
// client sanitiser would never produce, so the two sides must hold the same lists and limits. The
// migration marks what is compared with `-- sync:begin <name>` / `-- sync:end <name>` comments.
const migration = readFileSync("supabase/migrations/20261027090000_intake_validation_and_versioning.sql", "utf8");

const blocks = (name: string): string[] => {
  const found: string[] = [];
  for (const m of migration.matchAll(/--\s*sync:begin\s+(\w+)\s*\n([\s\S]*?)--\s*sync:end\s+\1\b/g)) {
    if (m[1] === name) found.push(m[2]);
  }
  expect(found.length, `sync block ${name} missing from the migration`).toBeGreaterThan(0);
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
  for (const m of migration.matchAll(/WHEN field (?:= ('[^']+')|IN \(([^)]*)\)) THEN '(\w+)'/g)) {
    for (const key of quoted(m[1] ?? m[2])) serverKinds.set(key, m[3]);
  }

  it("knows exactly the top-level keys of an intake", () => {
    expect(serverKinds.size).toBeGreaterThan(0);
    expect([...serverKinds.keys()].sort()).toEqual(Object.keys(EMPTY_CHAMBER_DATA).sort());
  });

  it("checks each key as the kind the client edits it as", () => {
    const clientKind = (key: string) => {
      if (key === "employees") return "employees";
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
    for (const sql of blocks("caps")) {
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
      max_count: COUNT_MAX,
      max_salary: SALARY_MAX,
    });
  });

  // document-extract can't import from src/, so it keeps its own copies of the roster cap and the state list.
  it("has the same roster cap and state codes in document-extract", () => {
    expect(EXTRACT_MAX_EMPLOYEES).toBe(MAX_EMPLOYEES);
    expect([...EXTRACT_STATE_CODES].sort()).toEqual([...US_STATE_CODES].sort());
  });
});
