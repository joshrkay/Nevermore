import { describe, expect, it } from "vitest";
import type { CensusEmployee } from "./census";
import { censusExport, layoutFor, OUR_CENSUS_LAYOUT } from "./censusExport";

const sarah: CensusEmployee = {
  id: "1", first_name: "Sarah", last_name: "Chen", dob: "1988-03-15", work_state: "CA", zip_code: "94107",
  job_title: "Senior Designer", annual_salary: 105000, compensation_type: "salary", employment_type: "full_time",
  classification: "w2", coverage_tier: "FAM", class_code: "8810",
};

describe("censusExport in our own layout", () => {
  it("writes the census template's header, then one row per employee in the same column order", () => {
    const { csv, blankColumns } = censusExport([sarah, { ...sarah, id: "2", first_name: "Marcus", last_name: "Rivera", dob: undefined, work_state: "", zip_code: undefined, job_title: undefined, annual_salary: undefined, class_code: undefined, coverage_tier: undefined }], OUR_CENSUS_LAYOUT);
    expect(csv.split("\r\n")).toEqual([
      "first_name,last_name,dob,gender,hire_date,work_state,home_state,zip_code,job_title,annual_salary,compensation_type,employment_type,classification,coverage_tier,cobra,class_code",
      "Sarah,Chen,1988-03-15,,,CA,,94107,Senior Designer,105000,salary,full_time,w2,FAM,,8810",
      "Marcus,Rivera,,,,,,,,,salary,full_time,w2,,,",
      "",
    ]);
    expect(blankColumns).toEqual([]);
  });
});

// A sample layout, as a PEO's own template would name its columns. No real PEO's template is in the repo yet.
const SAMPLE_LAYOUT = {
  peo: "Sample PEO",
  columns: [
    { header: "Employee Last Name", from: "last_name" as const },
    { header: "Employee First Name", from: "first_name" as const },
    { header: "Hire Date", from: null },
    { header: "Birth Date", from: "dob" as const },
    { header: "Gender", from: null },
    { header: "Work State", from: "work_state" as const },
  ],
};

describe("censusExport in a PEO census layout", () => {
  it("fills the PEO's columns from our census facts, in its order, and lists the columns we leave blank", () => {
    const { csv, blankColumns } = censusExport([sarah], SAMPLE_LAYOUT);
    expect(csv).toBe("Employee Last Name,Employee First Name,Hire Date,Birth Date,Gender,Work State\r\nChen,Sarah,,1988-03-15,,CA\r\n");
    expect(blankColumns).toEqual(["Hire Date", "Gender"]);
  });
});

describe("censusExport writes values a spreadsheet reads back as they are", () => {
  it("quotes a value holding a comma, a quote or a line break, doubling its quotes", () => {
    const { csv } = censusExport([{ ...sarah, job_title: 'Designer, "Senior"\nUX' }], OUR_CENSUS_LAYOUT);
    expect(csv.split("\r\n")[1]).toContain(',"Designer, ""Senior""\nUX",');
  });

  it("quotes a layout's header the same way", () => {
    const { csv } = censusExport([], { peo: "Sample PEO", columns: [{ header: "Name, Last", from: "last_name" }] });
    expect(csv).toBe('"Name, Last"\r\n');
  });

  it("defuses a value a spreadsheet would run as a formula", () => {
    const { csv } = censusExport([{ ...sarah, first_name: "=HYPERLINK(\"https://x.example\",\"x\")", last_name: "@SUM(A1)", job_title: "+1" }], OUR_CENSUS_LAYOUT);
    const row = csv.split("\r\n")[1];
    expect(row.startsWith('"\'=HYPERLINK(""https://x.example"",""x"")",\'@SUM(A1),')).toBe(true);
    // The job title, between the ZIP and the salary.
    expect(row).toContain(",94107,'+1,105000,");
  });
});

// K-2.1: the columns PEOs ask for are written as the census template takes them, so the file reads back the same.
describe("censusExport with gender, hire date, COBRA status and home state", () => {
  it("writes each as the template's guide says to write it: COBRA as yes or no", () => {
    const { csv } = censusExport([{ ...sarah, gender: "F", hire_date: "2019-04-01", cobra: false, home_state: "NV" }, { ...sarah, id: "2", cobra: true }], OUR_CENSUS_LAYOUT);
    const [header, first, second] = csv.split("\r\n").map((line) => line.split(","));
    const at = (row: string[], column: string) => row[header.indexOf(column)];
    expect([at(first, "gender"), at(first, "hire_date"), at(first, "cobra"), at(first, "home_state")]).toEqual(["F", "2019-04-01", "no", "NV"]);
    expect(at(second, "cobra")).toBe("yes");
  });
});

describe("layoutFor", () => {
  it("gives a PEO its own layout, whatever the capitalisation, and any other PEO our own", () => {
    expect(layoutFor("sample peo", [SAMPLE_LAYOUT])).toBe(SAMPLE_LAYOUT);
    expect(layoutFor("TriNet", [SAMPLE_LAYOUT])).toBe(OUR_CENSUS_LAYOUT);
    expect(layoutFor(null, [SAMPLE_LAYOUT])).toBe(OUR_CENSUS_LAYOUT);
  });
});
