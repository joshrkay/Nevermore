import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import { parseChamberData } from "./chamberValidation";
import { parseProvenance } from "./provenance";
import { REQUIRED_ITEMS, requiredItems } from "./requiredItems";

// The same cases supabase/tests/required_items.sql runs through public.intake_required_items. Each stored
// intake is read the way the Chamber loads one, so this checks the browser against the database.
interface Case {
  name: string;
  data: unknown;
  provenance: unknown;
  verified: string[];
  expected: Record<string, string>;
}
const { cases } = JSON.parse(readFileSync("src/data/requiredItems.cases.json", "utf8")) as { cases: Case[] };

describe("requiredItems, against the shared cases", () => {
  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const items = requiredItems(parseChamberData(c.data), parseProvenance(c.provenance), new Set(c.verified));
    expect(Object.fromEntries(items.map((i) => [i.field, i.state]))).toEqual(c.expected);
  });

  it("covers every state of every item", () => {
    for (const { field } of REQUIRED_ITEMS) {
      const seen = new Set(cases.map((c) => c.expected[field]));
      expect([...seen].sort()).toEqual(["conflicting", "incomplete", "missing", "settled", "unconfirmed"]);
    }
  });
});

describe("requiredItems", () => {
  it("lists the four items in their fixed order, with today's labels", () => {
    expect(requiredItems(EMPTY_CHAMBER_DATA, {}, new Set())).toEqual([
      { item: "company_legal_name", label: "Company legal name", field: "company_name", state: "missing" },
      { item: "states_of_operation", label: "States of operation", field: "states", state: "missing" },
      { item: "pay_frequency", label: "Pay frequency", field: "pay_frequency", state: "missing" },
      { item: "employee_census", label: "Employee census", field: "census", state: "missing" },
    ]);
  });

  it("says when the census decides States of operation, and only then", () => {
    const census = parseChamberData({ census: [{ first_name: "Ada", last_name: "Lee", work_state: "OR" }] }).census;
    const at = "2026-11-03T12:00:00Z";
    const inferred = { status: "inferred" as const, source: { kind: "transcript" as const, message_id: "m1" }, updated_at: at };
    const states = (data: Partial<typeof EMPTY_CHAMBER_DATA>, provenance = {}) =>
      requiredItems({ ...EMPTY_CHAMBER_DATA, ...data }, provenance, new Set())[1];

    expect(states({ census }, { census: inferred })).toMatchObject({ state: "unconfirmed", viaCensus: true });
    expect(states({ census, states: ["CA"] }, { states: inferred })).toMatchObject({ state: "settled", viaCensus: true });
    expect(states({ census, states: ["CA"] }, { states: inferred, census: inferred }).viaCensus).toBeUndefined();
    expect(states({ states: ["CA"] }).viaCensus).toBeUndefined();
    expect(states({}).viaCensus).toBeUndefined();
  });
});
