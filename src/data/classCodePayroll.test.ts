import { describe, expect, it } from "vitest";
import type { CensusEmployee } from "./census";
import { classCodePayroll, NO_CLASS_CODE } from "./classCodePayroll";

const person = (over: Partial<CensusEmployee>): CensusEmployee => ({
  id: Math.random().toString(36).slice(2), first_name: "A", last_name: "B", work_state: "CA", compensation_type: "salary", employment_type: "full_time", classification: "w2", ...over,
});

// K-3.2: the rating table a workers' comp underwriter starts from, worked out from the census alone.
describe("payroll by class code and state", () => {
  it("totals payroll and headcount, full and part time, for each class code in each state", () => {
    expect(classCodePayroll([
      person({ class_code: "8810", annual_salary: 100_000 }),
      person({ class_code: "8810", annual_salary: 50_000, employment_type: "part_time" }),
      person({ class_code: "5551", annual_salary: 60_000 }),
      person({ work_state: "TX", class_code: "8810", annual_salary: 70_000 }),
    ])).toEqual([
      { state: "CA", classCode: "5551", fullTime: 1, partTime: 0, payroll: 60_000 },
      { state: "CA", classCode: "8810", fullTime: 1, partTime: 1, payroll: 150_000 },
      { state: "TX", classCode: "8810", fullTime: 1, partTime: 0, payroll: 70_000 },
    ]);
  });

  it("totals people with no class code under 'No class code yet', after each state's coded rows", () => {
    const rows = classCodePayroll([
      person({ annual_salary: 40_000 }),
      person({ annual_salary: 45_000 }),
      person({ class_code: "8810", annual_salary: 100_000 }),
    ]);
    expect(rows).toEqual([
      { state: "CA", classCode: "8810", fullTime: 1, partTime: 0, payroll: 100_000 },
      { state: "CA", classCode: NO_CLASS_CODE, fullTime: 2, partTime: 0, payroll: 85_000 },
    ]);
    expect(NO_CLASS_CODE).toBe("No class code yet");
  });

  it("counts someone with no pay on the census, and adds nothing to the payroll for them", () => {
    expect(classCodePayroll([person({ class_code: "8810" }), person({ class_code: "8810", annual_salary: 30_000 })])).toEqual([
      { state: "CA", classCode: "8810", fullTime: 2, partTime: 0, payroll: 30_000 },
    ]);
  });

  it("leaves out 1099 contractors, who are not on the employer's payroll", () => {
    expect(classCodePayroll([person({ classification: "1099", class_code: "8810", annual_salary: 90_000 })])).toEqual([]);
  });

  it("puts people with no work state last, under no state", () => {
    expect(classCodePayroll([person({ work_state: "", class_code: "8810", annual_salary: 1 }), person({ work_state: "TX", class_code: "8810", annual_salary: 2 })]).map((r) => r.state)).toEqual(["TX", ""]);
  });

  it("is empty for an empty census", () => {
    expect(classCodePayroll([])).toEqual([]);
  });
});
