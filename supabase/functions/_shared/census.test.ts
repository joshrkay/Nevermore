import { describe, expect, it } from "vitest";
import {
  ageOn,
  censusGaps,
  censusRowId,
  normalizeAnnualSalary,
  normalizeCensus,
  normalizeCensusRow,
  normalizeClassCode,
  normalizeClassification,
  normalizeCoverageTier,
  normalizeDob,
  normalizeState,
  normalizeZip,
  samePerson,
} from "./census.ts";

const NOW = new Date("2026-10-29T12:00:00Z");

describe("normalizeDob", () => {
  it("reads the date formats rosters use", () => {
    expect(normalizeDob("1988-03-15", NOW)).toBe("1988-03-15");
    expect(normalizeDob("1988-03-15T00:00:00.000Z", NOW)).toBe("1988-03-15");
    expect(normalizeDob("3/15/1988", NOW)).toBe("1988-03-15");
    expect(normalizeDob("03-15-1988", NOW)).toBe("1988-03-15");
    expect(normalizeDob("Mar 15, 1988", NOW)).toBe("1988-03-15");
    expect(normalizeDob("15 March 1988", NOW)).toBe("1988-03-15");
    expect(normalizeDob(new Date("1988-03-15T00:00:00Z"), NOW)).toBe("1988-03-15");
    expect(normalizeDob(32217, NOW)).toBe("1988-03-15"); // Excel serial
  });

  it("puts two-digit years in the most recent past century", () => {
    expect(normalizeDob("3/15/88", NOW)).toBe("1988-03-15");
    expect(normalizeDob("3/15/05", NOW)).toBe("2005-03-15");
    expect(normalizeDob("3/15/30", NOW)).toBe("1930-03-15");
  });

  it("refuses impossible and future dates", () => {
    expect(normalizeDob("2/30/1990", NOW)).toBeUndefined();
    expect(normalizeDob("2027-01-01", NOW)).toBeUndefined();
    expect(normalizeDob("1850-01-01", NOW)).toBeUndefined();
    expect(normalizeDob("sometime in the 80s", NOW)).toBeUndefined();
    expect(normalizeDob(42, NOW)).toBeUndefined();
  });
});

describe("field normalisers", () => {
  it("reads states by code or name, and rejects anything else", () => {
    expect(normalizeState("ca")).toBe("CA");
    expect(normalizeState("New York")).toBe("NY");
    expect(normalizeState("Washington, D.C.")).toBe("DC");
    expect(normalizeState("XX")).toBe("");
    expect(normalizeState("Remote")).toBe("");
  });

  it("pads ZIP codes Excel stripped and keeps ZIP+4", () => {
    expect(normalizeZip(2134)).toBe("02134");
    expect(normalizeZip("94107")).toBe("94107");
    expect(normalizeZip("94107 1234")).toBe("94107-1234");
    expect(normalizeZip("941")).toBe("00941");
    expect(normalizeZip("ABCDE")).toBeUndefined();
  });

  it("reads salaries written as money", () => {
    expect(normalizeAnnualSalary("$85,000.00")).toBe(85000);
    expect(normalizeAnnualSalary("85k")).toBe(85000);
    expect(normalizeAnnualSalary(72500.4)).toBe(72500);
    expect(normalizeAnnualSalary("0")).toBeUndefined();
    expect(normalizeAnnualSalary("TBD")).toBeUndefined();
    expect(normalizeAnnualSalary(50_000_000)).toBeUndefined();
  });

  it("maps classification labels, leaving blanks undecided and refusing unknown ones", () => {
    expect(normalizeClassification("W-2")).toBe("w2");
    expect(normalizeClassification("Employee")).toBe("w2");
    expect(normalizeClassification("1099-NEC")).toBe("1099");
    expect(normalizeClassification("Independent Contractor")).toBe("1099");
    expect(normalizeClassification("")).toBeUndefined();
    expect(normalizeClassification("K-1 partner")).toBeNull();
  });

  it("maps coverage tier spellings", () => {
    expect(normalizeCoverageTier("Employee Only")).toBe("EE");
    expect(normalizeCoverageTier("EE + Spouse")).toBe("EE+SP");
    expect(normalizeCoverageTier("Employee & Child(ren)")).toBe("EE+CH");
    expect(normalizeCoverageTier("family")).toBe("FAM");
    expect(normalizeCoverageTier("Waived")).toBe("WAIVE");
    expect(normalizeCoverageTier("Gold PPO")).toBeUndefined();
  });

  it("reads workers' comp class codes as four digits", () => {
    expect(normalizeClassCode(8810)).toBe("8810");
    expect(normalizeClassCode("42")).toBe("0042");
    expect(normalizeClassCode("8742-01")).toBe("8742");
    expect(normalizeClassCode("clerical")).toBeUndefined();
  });
});

describe("normalizeCensusRow", () => {
  it("builds a canonical row with defaults for unlabelled pay and hours", () => {
    expect(normalizeCensusRow({ first_name: "Ana", last_name: "Diaz", work_state: "tx", job_title: "Engineer", annual_salary: "$120,000" }, NOW)).toEqual({
      first_name: "Ana",
      last_name: "Diaz",
      work_state: "TX",
      job_title: "Engineer",
      annual_salary: 120000,
      compensation_type: "salary",
      employment_type: "full_time",
      classification: "w2",
    });
  });

  it("upgrades a row saved before the census contract", () => {
    const row = normalizeCensusRow(
      { first_name: "Sarah", last_name: "Chen", dob: "1988-03-15", state: "CA", title: "Designer", salary: 105000, classification: "W2", dependents: [{ first_name: "Emma", last_name: "Chen", dob: "2018-03-22", relationship: "child" }] },
      NOW,
    );
    expect(row).toMatchObject({ work_state: "CA", job_title: "Designer", annual_salary: 105000, classification: "w2", dob: "1988-03-15" });
    expect(row?.dependents).toEqual([{ first_name: "Emma", last_name: "Chen", dob: "2018-03-22", relationship: "child" }]);
  });

  it("annualises an hourly rate at the stated hours, or at full time", () => {
    expect(normalizeCensusRow({ first_name: "A", hourly_rate: "$20.00", hours_per_week: 20 }, NOW)).toMatchObject({
      compensation_type: "hourly",
      employment_type: "part_time",
      annual_salary: 20800,
    });
    expect(normalizeCensusRow({ first_name: "B", hourly_rate: 25 }, NOW)).toMatchObject({
      compensation_type: "hourly",
      employment_type: "full_time",
      annual_salary: 52000,
    });
  });

  it("splits a full name, either order", () => {
    expect(normalizeCensusRow({ full_name: "Rivera, Marcus" }, NOW)).toMatchObject({ first_name: "Marcus", last_name: "Rivera" });
    expect(normalizeCensusRow({ full_name: "Marcus J Rivera" }, NOW)).toMatchObject({ first_name: "Marcus", last_name: "J Rivera" });
  });

  it("drops rows without a first name or with an unrecognised classification", () => {
    expect(normalizeCensusRow({ last_name: "Only" }, NOW)).toBeNull();
    expect(normalizeCensusRow({ first_name: "K", classification: "K-1" }, NOW)).toBeNull();
    expect(normalizeCensusRow("Ana", NOW)).toBeNull();
  });

  it("never keeps a Social Security number in a text field", () => {
    const row = normalizeCensusRow({ first_name: "Ana", job_title: "Clerk 123-45-6789" }, NOW);
    expect(JSON.stringify(row)).not.toMatch(/6789/);
  });

  it("keeps the first 20 dependents, not counting invalid ones", () => {
    const dependents = [{ last_name: "no first" }, ...Array.from({ length: 25 }, (_, i) => ({ first_name: `D${i}`, relationship: "child" }))];
    const row = normalizeCensusRow({ first_name: "Ann", dependents }, NOW);
    expect(row?.dependents).toHaveLength(20);
    expect(row?.dependents?.[19].first_name).toBe("D19");
  });

  it("drops values that aren't valid and keeps the row", () => {
    const row = normalizeCensusRow({ first_name: "Ana", dob: "soon", age: 7, zip_code: "n/a", coverage_tier: "gold", class_code: "x", annual_salary: -5 }, NOW);
    expect(row).toEqual({ first_name: "Ana", last_name: "", work_state: "", compensation_type: "salary", employment_type: "full_time", classification: "w2" });
  });
});

describe("normalizeCensus", () => {
  it("keeps stored ids and derives stable ones for rows without", () => {
    const rows = [{ id: "keep-me", first_name: "A" }, { first_name: "B" }, { first_name: "B" }];
    const first = normalizeCensus(rows, NOW);
    const second = normalizeCensus(rows, NOW);
    expect(first.map((r) => r.id)).toEqual(second.map((r) => r.id));
    expect(first[0].id).toBe("keep-me");
    expect(new Set(first.map((r) => r.id)).size).toBe(3);
    expect(first[1].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("gives a duplicated id to only one row", () => {
    const out = normalizeCensus([{ id: "dup", first_name: "A" }, { id: "dup", first_name: "B" }], NOW);
    expect(out[0].id).toBe("dup");
    expect(out[1].id).not.toBe("dup");
  });

  it("drops invalid rows and non-arrays", () => {
    expect(normalizeCensus([{ first_name: "A" }, null, 5, { last_name: "x" }], NOW)).toHaveLength(1);
    expect(normalizeCensus({ first_name: "A" }, NOW)).toEqual([]);
  });
});

describe("helpers", () => {
  it("computes age on a date", () => {
    expect(ageOn("1988-03-15", NOW)).toBe(38);
    expect(ageOn("1988-11-15", NOW)).toBe(37);
  });

  it("lists what a row is missing for underwriting", () => {
    const [row] = normalizeCensus([{ first_name: "A", age: 40 }], NOW);
    expect(censusGaps(row)).toEqual(["work state", "job title", "annual salary"]);
  });

  it("matches the same person by name, unless their birth dates disagree", () => {
    const [a, b, c] = normalizeCensus(
      [{ first_name: "Ana", last_name: "Diaz", dob: "1990-01-01" }, { first_name: "ana", last_name: "DIAZ" }, { first_name: "Ana", last_name: "Diaz", dob: "1991-01-01" }],
      NOW,
    );
    expect(samePerson(a, b)).toBe(true);
    expect(samePerson(a, c)).toBe(false);
  });

  it("derives ids deterministically", () => {
    expect(censusRowId("x")).toBe(censusRowId("x"));
    expect(censusRowId("x")).not.toBe(censusRowId("y"));
  });
});
