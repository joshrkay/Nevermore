import { describe, expect, it } from "vitest";
import type { CensusEmployee } from "./census";
import { censusExport, censusLayoutFor, OUR_CENSUS_LAYOUT, type PeoCensusLayout } from "./censusExport";
import type { PeoRecord } from "./peoCatalog";

const sarah: CensusEmployee = {
  id: "1", first_name: "Sarah", last_name: "Chen", dob: "1988-03-15", work_state: "CA", zip_code: "94107",
  job_title: "Senior Designer", annual_salary: 105000, compensation_type: "salary", employment_type: "full_time",
  classification: "w2", coverage_tier: "FAM", class_code: "8810",
};

describe("censusExport in our own layout", () => {
  it("writes the census template's header, then one row per employee in the same column order", () => {
    const { csv, blankColumns } = censusExport([sarah, { ...sarah, id: "2", first_name: "Marcus", last_name: "Rivera", dob: undefined, work_state: "", zip_code: undefined, job_title: undefined, annual_salary: undefined, class_code: undefined, coverage_tier: undefined }], OUR_CENSUS_LAYOUT);
    expect(csv.split("\r\n")).toEqual([
      "first_name,last_name,relationship,dob,gender,hire_date,work_state,home_state,zip_code,worksite,remote,travels,job_title,annual_salary,compensation_type,employment_type,classification,coverage_tier,cobra,class_code",
      "Sarah,Chen,,1988-03-15,,,CA,,94107,,,,Senior Designer,105000,salary,full_time,w2,FAM,,8810",
      "Marcus,Rivera,,,,,,,,,,,,,salary,full_time,w2,,,",
      "",
    ]);
    expect(blankColumns).toEqual([]);
  });
});

// A sample layout, as a PEO's own template would name its columns. No real PEO's template is in the repo yet.
const SAMPLE_LAYOUT: PeoCensusLayout = {
  peo: "Sample PEO",
  format: "csv",
  template: null,
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
    const { csv } = censusExport([], { ...SAMPLE_LAYOUT, columns: [{ header: "Name, Last", from: "last_name" }] });
    expect(csv).toBe('"Name, Last"\r\n');
  });

  it("defuses a value a spreadsheet would run as a formula", () => {
    const { csv } = censusExport([{ ...sarah, first_name: "=HYPERLINK(\"https://x.example\",\"x\")", last_name: "@SUM(A1)", job_title: "+1" }], OUR_CENSUS_LAYOUT);
    const row = csv.split("\r\n")[1];
    expect(row.startsWith('"\'=HYPERLINK(""https://x.example"",""x"")",\'@SUM(A1),')).toBe(true);
    // The job title, between the ZIP and the salary.
    expect(row).toContain(",94107,,,,'+1,105000,");
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

// K-2.3: PEOs that want dependents one by one get them, in the layout the census template takes.
describe("censusExport with dependents", () => {
  const withFamily: CensusEmployee = { ...sarah, dependents: [{ first_name: "Michael", last_name: "Chen", dob: "1985-06-12", relationship: "spouse" }, { first_name: "Emma", last_name: "Chen", dob: "", relationship: "child" }] };

  it("writes a row for each dependent directly under their employee, with who they are and nothing of the employee's", () => {
    const rows = censusExport([withFamily, { ...sarah, id: "2", first_name: "Marcus", last_name: "Rivera" }], OUR_CENSUS_LAYOUT).csv.split("\r\n").map((line) => line.split(","));
    const [header, , spouse, child, marcus] = rows;
    const at = (row: string[], column: string) => row[header.indexOf(column)];
    expect([at(spouse, "first_name"), at(spouse, "last_name"), at(spouse, "relationship"), at(spouse, "dob")]).toEqual(["Michael", "Chen", "spouse", "1985-06-12"]);
    expect([at(child, "first_name"), at(child, "relationship"), at(child, "dob")]).toEqual(["Emma", "child", ""]);
    // A dependent's row carries no pay, class code or work state.
    expect(spouse.filter((cell) => cell !== "")).toHaveLength(4);
    expect(at(marcus, "first_name")).toBe("Marcus");
    expect(rows).toHaveLength(6);
  });

  it("writes a PEO's own relationship column, and leaves dependents out of a layout that has none", () => {
    const layout = { peo: "Sample PEO", format: "csv" as const, template: null, columns: [{ header: "First", from: "first_name" as const }, { header: "Rel", from: "relationship" as const }] };
    expect(censusExport([withFamily], layout).csv).toBe("First,Rel\r\nSarah,\r\nMichael,spouse\r\nEmma,child\r\n");
    const none = { peo: "Other PEO", format: "csv" as const, template: null, columns: [{ header: "First", from: "first_name" as const }, { header: "State", from: "work_state" as const }] };
    expect(censusExport([withFamily], none).csv).toBe("First,State\r\nSarah,CA\r\n");
  });
});

describe("censusLayoutFor: the census layout in the PEO's profile in use, or ours", () => {
  const peo = (name: string, layout: PeoCensusLayout | null, listed = true, id = 5): PeoRecord => ({ id, name, listed, lastVerified: null, profile: {
    version: 3, neededToQuote: [], neededBeforeSigning: [], censusLayout: layout, documents: [], extraQuestions: [], sources: {}, publishedAt: null,
    rules: { minHeadcount: null, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null },
  } });
  const catalog = [peo("Sample PEO", SAMPLE_LAYOUT), peo("No Layout PEO", null, true, 6), peo("Delisted PEO", SAMPLE_LAYOUT, false, 7)];

  it("gives a listed PEO the layout its profile in use holds, whatever the capitalisation", () => {
    expect(censusLayoutFor("sample peo", catalog)).toBe(SAMPLE_LAYOUT);
  });

  it("gives our own to a PEO typed in that isn't on the list, one whose profile has no census layout, one not listed, or none", () => {
    expect(censusLayoutFor("Some Other PEO", catalog)).toBe(OUR_CENSUS_LAYOUT);
    expect(censusLayoutFor("No Layout PEO", catalog)).toBe(OUR_CENSUS_LAYOUT);
    expect(censusLayoutFor("Delisted PEO", catalog)).toBe(OUR_CENSUS_LAYOUT);
    expect(censusLayoutFor(null, catalog)).toBe(OUR_CENSUS_LAYOUT);
    expect(OUR_CENSUS_LAYOUT).toMatchObject({ peo: null, format: "csv", template: null });
  });
});
