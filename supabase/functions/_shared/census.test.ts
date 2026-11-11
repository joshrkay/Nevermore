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
      // The file said neither, so both are recorded as defaults, not answers.
      assumed: ["classification", "employment_type"],
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
    expect(row).toEqual({
      first_name: "Ana", last_name: "", work_state: "", compensation_type: "salary", employment_type: "full_time", classification: "w2",
      assumed: ["classification", "employment_type"],
    });
  });
});

describe("normalizeCensusRow: defaults are recorded, never passed off as answers", () => {
  it("records nothing when the row states everything", () => {
    const row = normalizeCensusRow({ first_name: "Ana", classification: "1099", employment_type: "part_time", annual_salary: 50000 }, NOW);
    expect(row).not.toHaveProperty("assumed");
  });

  it("takes employment type from weekly hours as an answer", () => {
    expect(normalizeCensusRow({ first_name: "Ana", classification: "W2", hours_per_week: 20 }, NOW)?.assumed).toBeUndefined();
    expect(normalizeCensusRow({ first_name: "Ana", classification: "W2", hours_per_week: 40 }, NOW)).toMatchObject({ employment_type: "full_time" });
  });

  it("marks a year's pay worked out at assumed full-time hours, but not one at stated hours", () => {
    const assumedHours = normalizeCensusRow({ first_name: "Ana", classification: "w2", employment_type: "full_time", hourly_rate: 20 }, NOW);
    expect(assumedHours).toMatchObject({ annual_salary: 41600, compensation_type: "hourly", assumed: ["annual_salary"] });
    const statedHours = normalizeCensusRow({ first_name: "Ana", classification: "w2", hourly_rate: 20, hours_per_week: 30 }, NOW);
    expect(statedHours).toMatchObject({ annual_salary: 31200 });
    expect(statedHours).not.toHaveProperty("assumed");
  });

  it("keeps what a saved row recorded, as long as the value is still the default", () => {
    const saved = normalizeCensusRow({ first_name: "Ana", annual_salary: 41600, compensation_type: "hourly", employment_type: "full_time", classification: "w2", assumed: ["classification", "employment_type", "annual_salary"] }, NOW);
    expect(saved?.assumed).toEqual(["classification", "employment_type", "annual_salary"]);
    // A value that is no longer the default was answered since: the old record of a default goes.
    const answered = normalizeCensusRow({ first_name: "Ana", classification: "1099", employment_type: "part_time", assumed: ["classification", "employment_type"] }, NOW);
    expect(answered).not.toHaveProperty("assumed");
  });

  it("ignores anything in a saved list it doesn't know", () => {
    const row = normalizeCensusRow({ first_name: "Ana", classification: "w2", employment_type: "full_time", assumed: ["ssn", 4, "classification"] }, NOW);
    expect(row?.assumed).toEqual(["classification"]);
  });

  it("survives being read again unchanged", () => {
    const once = normalizeCensus([{ first_name: "Ana", hourly_rate: 20 }], NOW);
    expect(normalizeCensus(once, NOW)).toEqual(once);
    expect(once[0].assumed).toEqual(["classification", "employment_type", "annual_salary"]);
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

// K-2.1: what health underwriters rate a group on, read from the census file.
describe("normalizeCensusRow: gender, hire date, COBRA status and home state (K-2.1)", () => {
  const base = { first_name: "Ana", last_name: "Diaz", classification: "w2", employment_type: "full_time" };
  const read = (extra: Record<string, unknown>) => normalizeCensusRow({ ...base, ...extra }, NOW);

  it("reads gender however a roster writes it", () => {
    for (const v of ["F", "f", "Female", "female", "Woman"]) expect(read({ gender: v })?.gender, v).toBe("F");
    for (const v of ["M", "male", "Male", "Man"]) expect(read({ gender: v })?.gender, v).toBe("M");
    for (const v of ["X", "Non-binary", "nonbinary", "Other"]) expect(read({ gender: v })?.gender, v).toBe("X");
    for (const v of ["", "unknown", "N/A", 1, null]) expect(read({ gender: v }), String(v)).not.toHaveProperty("gender");
  });

  it("reads a hire date in the formats rosters use, and keeps none it can't read", () => {
    expect(read({ hire_date: "2019-04-01" })?.hire_date).toBe("2019-04-01");
    expect(read({ hire_date: "4/1/2019" })?.hire_date).toBe("2019-04-01");
    expect(read({ hire_date: "April 1, 2019" })?.hire_date).toBe("2019-04-01");
    // Excel's serial number for 2019-04-01.
    expect(read({ hire_date: 43556 })?.hire_date).toBe("2019-04-01");
    expect(read({ hire_date: "last spring" })).not.toHaveProperty("hire_date");
    expect(read({ hire_date: "2031-01-01" })).not.toHaveProperty("hire_date");
  });

  it("reads COBRA status as yes or no", () => {
    for (const v of ["Y", "yes", "Yes", "true", true, "COBRA", "Active COBRA", "on cobra"]) expect(read({ cobra: v })?.cobra, String(v)).toBe(true);
    for (const v of ["N", "no", "No", "false", false, "Active", "not on cobra"]) expect(read({ cobra: v })?.cobra, String(v)).toBe(false);
    for (const v of ["", "maybe", null, 3]) expect(read({ cobra: v }), String(v)).not.toHaveProperty("cobra");
  });

  // Review finding: a cell that says no in other words is a no.
  it("reads a negative COBRA status however it is worded", () => {
    for (const v of ["No COBRA", "Non-COBRA", "Not COBRA", "No - active", "never on cobra"]) expect(read({ cobra: v })?.cobra, v).toBe(false);
  });

  it("reads a home state by code or name, apart from the work state", () => {
    expect(read({ work_state: "CA", home_state: "Nevada" })).toMatchObject({ work_state: "CA", home_state: "NV" });
    expect(read({ work_state: "CA", home_state: "Atlantis" })).not.toHaveProperty("home_state");
  });

  it("survives being saved and read again", () => {
    const row = read({ gender: "F", hire_date: "4/1/2019", cobra: "no", home_state: "NV" })!;
    expect(row).toMatchObject({ gender: "F", hire_date: "2019-04-01", cobra: false, home_state: "NV" });
    expect(normalizeCensusRow(JSON.parse(JSON.stringify(row)), NOW)).toEqual(row);
  });
});

// K-2.2: what a workers' comp underwriter needs to assign class codes.
describe("normalizeCensusRow: worksite, remote and travels (K-2.2)", () => {
  const base = { first_name: "Ana", last_name: "Diaz", classification: "w2", employment_type: "full_time" };
  const read = (extra: Record<string, unknown>) => normalizeCensusRow({ ...base, ...extra }, NOW);

  it("keeps a worksite as text, cut to 200 characters, and none when blank", () => {
    expect(read({ worksite: "  Oakland   warehouse " })?.worksite).toBe("Oakland warehouse");
    expect(read({ worksite: "x".repeat(250) })?.worksite).toHaveLength(200);
    expect(read({ worksite: "  " })).not.toHaveProperty("worksite");
  });

  it("reads whether someone works remotely", () => {
    for (const v of ["Y", "yes", true, "Remote", "WFH", "Work from home", "Hybrid", "Fully remote"]) expect(read({ remote: v })?.remote, String(v)).toBe(true);
    for (const v of ["N", "no", false, "Onsite", "On-site", "In office", "Office"]) expect(read({ remote: v })?.remote, String(v)).toBe(false);
    for (const v of ["", "sometimes?", null]) expect(read({ remote: v }), String(v)).not.toHaveProperty("remote");
  });

  it("reads whether someone travels for work", () => {
    for (const v of ["Y", "yes", true, "Travels", "Frequent travel"]) expect(read({ travels: v })?.travels, String(v)).toBe(true);
    for (const v of ["N", "no", false, "None", "No travel"]) expect(read({ travels: v })?.travels, String(v)).toBe(false);
    for (const v of ["", null, 7]) expect(read({ travels: v }), String(v)).not.toHaveProperty("travels");
  });

  // Review finding: a cell that says no in other words is a no.
  it("reads a negative remote or travel answer however it is worded", () => {
    for (const v of ["Not remote", "Non-remote", "No remote work", "never remote"]) expect(read({ remote: v })?.remote, v).toBe(false);
    for (const v of ["Does not travel", "Doesn't travel", "Never travels", "Non-travel", "No business travel"]) expect(read({ travels: v })?.travels, v).toBe(false);
  });

  it("survives being saved and read again", () => {
    const row = read({ worksite: "Oakland warehouse", remote: "no", travels: "yes" })!;
    expect(row).toMatchObject({ worksite: "Oakland warehouse", remote: false, travels: true });
    expect(normalizeCensusRow(JSON.parse(JSON.stringify(row)), NOW)).toEqual(row);
  });
});
