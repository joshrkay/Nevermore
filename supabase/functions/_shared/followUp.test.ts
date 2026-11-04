import { describe, expect, it } from "vitest";
import { isSettled, readyToCertify, unsettledFields } from "./followUp";
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
    expect(all.map((f) => f.key)).toEqual(INTAKE_FIELDS.map((f) => f.key));
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

  it("counts the census's work states for states, unless the states answer is in conflict or incomplete", () => {
    const noStates = { ...base, states: [] };
    expect(readyToCertify(noStates, {})).toBe(false);
    expect(readyToCertify(noStates, {}, { rows: 3, workStates: true })).toBe(true);
    expect(readyToCertify(noStates, {}, { rows: 3, workStates: false })).toBe(false);
    expect(readyToCertify({ ...base, states: ["CA"] }, { states: "incomplete" }, { rows: 3, workStates: true })).toBe(false);
  });

  it("asks nothing about states the census already gives", () => {
    expect(unsettledFields({}, {}, { census: { rows: 2, workStates: true } }).map((f) => f.key)).not.toContain("states");
    expect(unsettledFields({}, { states: "conflicting" }, { census: { rows: 2, workStates: true } }).map((f) => f.key)).toContain("states");
  });
});
