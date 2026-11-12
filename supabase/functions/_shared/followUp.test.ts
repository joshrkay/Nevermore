import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSettled, readyToCertify, unsettledFields } from "./followUp";
import { parseChamberData } from "../../../src/data/chamberValidation";
import { parseProvenance } from "../../../src/data/provenance";
import { censusSummary, isReadyToCertify, statusesOf } from "../../../src/data/followUp";
import { INTAKE_FIELDS } from "./intakeSchema";

describe("isSettled (D26)", () => {
  it("counts an answer, 0 and false included, and an inferred one", () => {
    expect(isSettled("Acme", "confirmed")).toBe(true);
    expect(isSettled("Acme", "inferred")).toBe(true);
    expect(isSettled(0, undefined)).toBe(true);
    expect(isSettled(false, "confirmed")).toBe(true);
    expect(isSettled(["NY"], "inferred")).toBe(true);
  });

  it("counts a field the prospect doesn't know or that doesn't apply, though neither holds an answer", () => {
    expect(isSettled(null, "unknown")).toBe(true);
    expect(isSettled(null, "not_applicable")).toBe(true);
  });

  it("doesn't count no answer, a blank one, an empty list, a conflict or a partial answer", () => {
    expect(isSettled(null, undefined)).toBe(false);
    expect(isSettled("  ", undefined)).toBe(false);
    expect(isSettled([], undefined)).toBe(false);
    expect(isSettled("Acme", "conflicting")).toBe(false);
    expect(isSettled(["CA"], "incomplete")).toBe(false);
  });
});

describe("unsettledFields", () => {
  it("lists every field in rank order when nothing is captured, less what is excluded", () => {
    const all = unsettledFields({}, {});
    // An ACORD 130 question's explanation is asked for only after a yes (K-3.4), so none is listed yet.
    expect(all.map((f) => f.key)).toEqual(INTAKE_FIELDS.map((f) => f.key).filter((key) => !key.endsWith("_explain")));
    expect(all.map((f) => f.rank)).toEqual([...all.map((f) => f.rank)].sort((a, b) => a - b));
    expect(unsettledFields({}, {}, { exclude: new Set(["census"]) }).map((f) => f.key)).not.toContain("census");
  });

  it("drops what is settled and keeps the rest in order", () => {
    const next = unsettledFields(
      { company_name: "Acme", states: ["CA"], pay_frequency: "weekly", employee_count: 0 },
      { company_name: "conflicting", states: "incomplete", pay_frequency: "confirmed", industry: "unknown" },
      { exclude: new Set(["census"]) },
    ).map((f) => f.key);
    expect(next.slice(0, 3)).toEqual(["company_name", "states", "hq_state"]);
    for (const settled of ["pay_frequency", "employee_count", "industry"]) expect(next).not.toContain(settled);
  });
});

describe("readyToCertify (D26, D2)", () => {
  const base = { company_name: "Acme", states: ["NY"], pay_frequency: "weekly" };

  it("is ready when every answer certification needs is given, none in conflict or incomplete; inferred counts", () => {
    expect(readyToCertify(base, {})).toBe(true);
    expect(readyToCertify(base, { company_name: "inferred", states: "confirmed" })).toBe(true);
    expect(readyToCertify(base, { company_name: "conflicting" })).toBe(false);
    expect(readyToCertify(base, { states: "incomplete" })).toBe(false);
    expect(readyToCertify({ ...base, pay_frequency: " " }, {})).toBe(false);
  });

  it("doesn't let unknown or doesn't apply stand in for an answer certification needs", () => {
    expect(readyToCertify({ ...base, pay_frequency: null }, { pay_frequency: "unknown" })).toBe(false);
    expect(readyToCertify({ ...base, states: [] }, { states: "not_applicable" })).toBe(false);
  });

  it("counts the census's work states for states, as B-2.2's rule does: a settled census answers it", () => {
    const noStates = { ...base, states: [] };
    expect(readyToCertify(noStates, {})).toBe(false);
    expect(readyToCertify(noStates, {}, { rows: 3, workStates: true })).toBe(true);
    expect(readyToCertify(noStates, {}, { rows: 3, workStates: false })).toBe(false);
    expect(readyToCertify({ ...base, states: ["CA"] }, { states: "incomplete" }, { rows: 3, workStates: true })).toBe(true);
    expect(readyToCertify({ ...base, states: ["CA"] }, { states: "incomplete" })).toBe(false);
  });

  it("asks nothing about states the census already gives", () => {
    expect(unsettledFields({}, {}, { census: { rows: 2, workStates: true } }).map((f) => f.key)).not.toContain("states");
    // Unless the states answer or the census itself is in conflict: then the states question is still open.
    expect(unsettledFields({}, { states: "conflicting" }, { census: { rows: 2, workStates: true } }).map((f) => f.key)).toContain("states");
    expect(unsettledFields({}, { census: "conflicting" }, { census: { rows: 2, workStates: true } }).map((f) => f.key)).toContain("states");
  });
});

describe("readiness and the certification gate agree", () => {
  const answers = { company_name: "Acme", states: [], pay_frequency: "weekly" };
  const census = { rows: 2, workStates: true };

  it("doesn't call states from a census in conflict ready: the gate refuses it", () => {
    expect(readyToCertify(answers, { census: "conflicting" }, census)).toBe(false);
    expect(readyToCertify(answers, { census: "inferred" }, census)).toBe(true);
    expect(readyToCertify(answers, {}, census)).toBe(true);
    // The database never reads the census, so an advisor's verification of it settles it.
    expect(readyToCertify(answers, { census: "conflicting" }, census, new Set(["census"]))).toBe(true);
  });

  it("doesn't call a required answer in conflict ready, verified or not: the gate reads the field's own status (EA008)", () => {
    expect(readyToCertify({ ...answers, states: ["NY"] }, { states: "conflicting" }, census)).toBe(false);
    expect(readyToCertify(answers, { pay_frequency: "conflicting" }, census)).toBe(false);
    expect(readyToCertify(answers, { pay_frequency: "conflicting" }, census, new Set(["pay_frequency"]))).toBe(false);
    // An advisor's verification does settle an answer that is only incomplete or unconfirmed.
    expect(readyToCertify(answers, { pay_frequency: "incomplete" }, census)).toBe(false);
    expect(readyToCertify(answers, { pay_frequency: "incomplete" }, census, new Set(["pay_frequency"]))).toBe(true);
  });

  it("is the browser's rule for every one of B-2.2's shared cases (src/data/requiredItems.cases.json)", () => {
    const { cases } = JSON.parse(readFileSync("src/data/requiredItems.cases.json", "utf8")) as {
      cases: { name: string; data: Record<string, unknown>; provenance: Record<string, unknown>; verified: string[]; expected: Record<string, string> }[];
    };
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      // What the browser sends: the answers and statuses as it loads them, and the census as a summary.
      const data = parseChamberData(c.data);
      const provenance = parseProvenance(c.provenance);
      const verified = new Set(c.verified);
      const shared = readyToCertify(data as unknown as Record<string, unknown>, statusesOf(provenance), censusSummary(data), verified);
      expect(shared, c.name).toBe(isReadyToCertify(data, provenance, verified));
    }
  });
});

// K-3.4: the ACORD 130 questions in what Lenore asks next.
describe("the ACORD 130 questions among the unsettled fields", () => {
  const keys = (answers: Record<string, unknown> = {}, statuses: Record<string, string> = {}) => unsettledFields(answers, statuses).map((f) => f.key);

  it("asks a question before its explanation, and the explanation only after a yes", () => {
    expect(keys()).toContain("wcq_06");
    expect(keys()).not.toContain("wcq_06_explain");
    expect(keys({ wcq_06: false })).not.toContain("wcq_06_explain");
    const yes = keys({ wcq_06: true });
    expect(yes).toContain("wcq_06_explain");
    expect(yes).not.toContain("wcq_06");
    expect(keys({ wcq_06: true, wcq_06_explain: "About 20%" })).not.toContain("wcq_06_explain");
  });

  it("asks them after the answers Lenore already asked for, in the form's order", () => {
    const all = keys();
    expect(all.indexOf("wcq_01")).toBeGreaterThan(all.indexOf("peo_renewal_date"));
    expect(all.filter((k) => /^wcq_\d\d$/.test(k)).slice(0, 3)).toEqual(["wcq_01", "wcq_02", "wcq_03"]);
  });
});
