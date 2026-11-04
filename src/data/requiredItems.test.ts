import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import { parseChamberData } from "./chamberValidation";
import { parseProvenance } from "./provenance";
import { RECOMMENDED_ITEMS, REQUIRED_ITEMS } from "./readiness";
import { isIntakeComplete, requiredItems } from "./requiredItems";

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
    for (const field of ["company_name", "states", "pay_frequency", "census"]) {
      const seen = new Set(cases.map((c) => c.expected[field]));
      expect([...seen].sort()).toEqual(["conflicting", "incomplete", "missing", "settled", "unconfirmed"]);
    }
  });
});

describe("requiredItems", () => {
  it("lists readiness's required items, then the recommended census, in their order, with their keys and labels", () => {
    const items = requiredItems(EMPTY_CHAMBER_DATA, {}, new Set());
    expect(items.map(({ item, label, field, required, state }) => ({ item, label, field, required, state }))).toEqual([
      { item: "company_name", label: "Company legal name", field: "company_name", required: true, state: "missing" },
      { item: "states", label: "States of operation", field: "states", required: true, state: "missing" },
      { item: "pay_frequency", label: "Pay frequency", field: "pay_frequency", required: true, state: "missing" },
      { item: "census", label: "Employee census", field: "census", required: false, state: "missing" },
    ]);
    expect(items.map((i) => i.readiness)).toEqual([...REQUIRED_ITEMS, ...RECOMMENDED_ITEMS]);
  });

  it("is there exactly when readiness says it is", () => {
    const census = parseChamberData({ census: [{ first_name: "Ada", last_name: "Lee", work_state: "OR" }] }).census;
    for (const data of [
      EMPTY_CHAMBER_DATA,
      { ...EMPTY_CHAMBER_DATA, company_name: "  ", pay_frequency: "Weekly" },
      { ...EMPTY_CHAMBER_DATA, states: ["CA"] },
      { ...EMPTY_CHAMBER_DATA, census },
    ]) {
      for (const i of requiredItems(data, {}, new Set())) expect(i.state === "missing").toBe(i.readiness.missing(data));
    }
  });

  it("is complete when the three required items are settled, whatever the census", () => {
    const answered = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", states: ["CA"], pay_frequency: "Weekly" };
    const inferred = { status: "inferred" as const, source: { kind: "transcript" as const, message_id: "m1" }, updated_at: "2026-11-03T12:00:00Z" };
    expect(isIntakeComplete(requiredItems(answered, {}, new Set()))).toBe(true);
    expect(isIntakeComplete(requiredItems(answered, { pay_frequency: inferred }, new Set()))).toBe(false);
    expect(isIntakeComplete(requiredItems(answered, { pay_frequency: inferred }, new Set(["pay_frequency"])))).toBe(true);
    expect(isIntakeComplete(requiredItems({ ...answered, company_name: null }, {}, new Set()))).toBe(false);
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
