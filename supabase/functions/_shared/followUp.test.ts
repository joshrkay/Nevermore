import { describe, expect, it } from "vitest";
import { isSettled, unsettledFields } from "./followUp";
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
