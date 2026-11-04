import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "./chamberTypes";
import { parseChamberData } from "./chamberValidation";
import { parseProvenance } from "./provenance";
import { RECOMMENDED_ITEMS, REQUIRED_ITEMS } from "./readiness";
import { certificationBlockingItems, isIntakeComplete, requiredItems } from "./requiredItems";

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

describe("certificationBlockingItems", () => {
  const at = "2026-11-04T12:00:00Z";
  const conflicting = { status: "conflicting" as const, source: { kind: "transcript" as const, message_id: "m1" }, updated_at: at, candidates: [] };
  const withStatus = (status: "inferred" | "incomplete") => ({ status, source: { kind: "transcript" as const, message_id: "m1" }, updated_at: at });
  const census = [{ ...DEMO_CHAMBER_DATA.census[0], work_state: "OR" }];
  const blocking = (data: Parameters<typeof certificationBlockingItems>[0], provenance: Parameters<typeof certificationBlockingItems>[1], verified: ReadonlySet<string> = new Set()) =>
    certificationBlockingItems(data, provenance, verified).map((i) => `${i.state} ${i.viaCensus ? "census" : i.item}`);

  it("is the required items missing, in order, and never the census", () => {
    expect(blocking(EMPTY_CHAMBER_DATA, {})).toEqual(["missing company_name", "missing states", "missing pay_frequency"]);
    expect(blocking(EMPTY_CHAMBER_DATA, {}, new Set(["company_name", "states", "pay_frequency"]))).toHaveLength(3);
    expect(blocking(DEMO_CHAMBER_DATA, {})).toEqual([]);
    expect(blocking({ ...DEMO_CHAMBER_DATA, census: [] }, { census: conflicting })).toEqual([]);
  });

  it("doesn't block on required answers that are only incomplete or unconfirmed", () => {
    expect(blocking(DEMO_CHAMBER_DATA, { company_name: withStatus("incomplete"), pay_frequency: withStatus("inferred"), states: withStatus("inferred") })).toEqual([]);
  });

  // The database's gate (EA008) reads the field statuses, not the advisor's reviews: the browser asks the same.
  it("blocks on a required field in conflict, whoever verified it", () => {
    expect(blocking(DEMO_CHAMBER_DATA, { pay_frequency: conflicting, industry: conflicting }, new Set(["pay_frequency"]))).toEqual(["conflicting pay_frequency"]);
  });

  it("blocks on states in conflict even when the census names states, as the database does", () => {
    expect(blocking({ ...DEMO_CHAMBER_DATA, census }, { states: conflicting })).toEqual(["conflicting states"]);
  });

  // The database never reads the census, so this one is the browser's (B-2.2), and a verified census settles it.
  it("blocks, in the browser only, when a census in conflict is all that gives the states, until an advisor verifies it", () => {
    const data = { ...DEMO_CHAMBER_DATA, states: [], census };
    expect(blocking(data, { census: conflicting })).toEqual(["conflicting census"]);
    expect(blocking(data, { census: conflicting }, new Set(["census"]))).toEqual([]);
  });
});
