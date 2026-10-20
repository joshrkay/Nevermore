import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import { mergeChamberData, parseChamberData, sanitizeChamberPatch } from "./chamberValidation";

describe("sanitizeChamberPatch", () => {
  it("returns an empty patch for non-objects", () => {
    expect(sanitizeChamberPatch(null)).toEqual({});
    expect(sanitizeChamberPatch("CA")).toEqual({});
    expect(sanitizeChamberPatch([1, 2])).toEqual({});
  });

  it("keeps valid fields and drops unknown keys", () => {
    expect(sanitizeChamberPatch({ company_name: "Acme", employee_count: 12, reply: "hi", __proto__x: 1 })).toEqual({
      company_name: "Acme",
      employee_count: 12,
    });
  });

  it("drops fields with the wrong type instead of rejecting the patch", () => {
    expect(sanitizeChamberPatch({ company_name: "Acme", has_401k: "maybe", employees: null })).toEqual({
      company_name: "Acme",
    });
  });

  it("normalizes state codes and accepts comma-separated strings", () => {
    expect(sanitizeChamberPatch({ hq_state: "ca", states: "ca, TX, California, tx" })).toEqual({
      hq_state: "CA",
      states: ["CA", "TX"],
    });
  });

  it("coerces numeric strings for counts and rejects negatives", () => {
    expect(sanitizeChamberPatch({ employee_count: "1,200", fein_count: -1 })).toEqual({ employee_count: 1200 });
  });

  it("keeps valid employees, fills defaults, and drops nameless ones", () => {
    const patch = sanitizeChamberPatch({
      employees: [
        { first_name: "Ada", state: "ca", dependents: [{ first_name: "Bo", relationship: "kid" }] },
        { last_name: "No first name" },
        "garbage",
      ],
    });
    expect(patch.employees).toEqual([
      {
        first_name: "Ada",
        last_name: "",
        dob: "",
        state: "CA",
        title: "",
        salary: null,
        classification: "W2",
        dependents: [{ first_name: "Bo", last_name: "", dob: "", relationship: "other" }],
      },
    ]);
  });
});

describe("worker classification", () => {
  const classify = (classification: unknown) =>
    sanitizeChamberPatch({ employees: [{ first_name: "Ada", classification }] }).employees?.map((e) => e.classification);

  it("normalizes common spellings", () => {
    expect(classify("w-2")).toEqual(["W2"]);
    expect(classify("Employee")).toEqual(["W2"]);
    expect(classify("1099 Contractor")).toEqual(["1099"]);
    expect(classify("independent_contractor")).toEqual(["1099"]);
    expect(classify("freelancer")).toEqual(["1099"]);
  });

  it("treats a missing label as W-2", () => {
    expect(classify(undefined)).toEqual(["W2"]);
  });

  it("drops workers whose label can't be recognized instead of counting them as W-2", () => {
    expect(classify("K-1 owner")).toEqual([]);
    expect(classify(42)).toEqual([]);
  });
});

describe("mergeChamberData", () => {
  it("merges only validated fields over existing data", () => {
    const prev = { ...EMPTY_CHAMBER_DATA, company_name: "Old", states: ["NY"] };
    const next = mergeChamberData(prev, { states: "not-a-list-of-states", industry: "Design" });
    expect(next.company_name).toBe("Old");
    expect(next.industry).toBe("Design");
    expect(next.states).toEqual([]); // "not-a-list-of-states" has no valid codes
  });
});

describe("parseChamberData", () => {
  it("fills every field from defaults when stored data is malformed", () => {
    expect(parseChamberData(undefined)).toEqual(EMPTY_CHAMBER_DATA);
    expect(parseChamberData({ states: 5, employees: "x" })).toEqual(EMPTY_CHAMBER_DATA);
  });
});
