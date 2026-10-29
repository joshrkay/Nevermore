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

  it("keeps valid census rows, fills defaults, and drops nameless ones", () => {
    const patch = sanitizeChamberPatch({
      census: [
        { first_name: "Ada", work_state: "ca", dependents: [{ first_name: "Bo", relationship: "kid" }] },
        { last_name: "No first name" },
        "garbage",
      ],
    });
    expect(patch.census).toEqual([
      {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        first_name: "Ada",
        last_name: "",
        work_state: "CA",
        compensation_type: "salary",
        employment_type: "full_time",
        classification: "w2",
        dependents: [{ first_name: "Bo", last_name: "", dob: "", relationship: "other" }],
      },
    ]);
  });

  it("reads a roster saved as `employees` before the census contract", () => {
    const patch = sanitizeChamberPatch({
      employees: [{ first_name: "Sarah", last_name: "Chen", dob: "1988-03-15", state: "CA", title: "Designer", salary: 105000, classification: "W2", dependents: [] }],
    });
    expect(patch).not.toHaveProperty("employees");
    expect(patch.census).toEqual([
      {
        id: expect.any(String),
        first_name: "Sarah",
        last_name: "Chen",
        dob: "1988-03-15",
        work_state: "CA",
        job_title: "Designer",
        annual_salary: 105000,
        compensation_type: "salary",
        employment_type: "full_time",
        classification: "w2",
      },
    ]);
    // A current census wins over a stale `employees` key.
    expect(sanitizeChamberPatch({ census: [], employees: [{ first_name: "Old" }] }).census).toEqual([]);
  });

  it("keeps a census row's id, so saving and reloading doesn't change it", () => {
    const [row] = sanitizeChamberPatch({ census: [{ first_name: "Ada" }] }).census!;
    expect(sanitizeChamberPatch({ census: [row] }).census).toEqual([row]);
  });

  it("removes Social Security and bank account numbers from free text", () => {
    const patch = sanitizeChamberPatch({
      key_challenges: "Owner SSN is 123-45-6789; payroll from acct # 00012345",
      company_name: "Acme 987654321",
    });
    expect(patch.key_challenges).toBe("Owner SSN is [redacted]; payroll from acct [redacted]");
    expect(patch.company_name).toBe("Acme [redacted]");
  });
});

describe("worker classification", () => {
  const classify = (classification: unknown) =>
    sanitizeChamberPatch({ census: [{ first_name: "Ada", classification }] }).census?.map((e) => e.classification);

  it("normalizes common spellings", () => {
    expect(classify("w-2")).toEqual(["w2"]);
    expect(classify("Employee")).toEqual(["w2"]);
    expect(classify("1099 Contractor")).toEqual(["1099"]);
    expect(classify("independent_contractor")).toEqual(["1099"]);
    expect(classify("freelancer")).toEqual(["1099"]);
  });

  it("treats a missing label as W-2", () => {
    expect(classify(undefined)).toEqual(["w2"]);
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
    expect(parseChamberData({ census: { first_name: "not a list" } })).toEqual(EMPTY_CHAMBER_DATA);
  });
});
