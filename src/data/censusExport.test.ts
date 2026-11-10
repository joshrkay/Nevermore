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
      "first_name,last_name,dob,work_state,zip_code,job_title,annual_salary,compensation_type,employment_type,classification,coverage_tier,class_code",
      "Sarah,Chen,1988-03-15,CA,94107,Senior Designer,105000,salary,full_time,w2,FAM,8810",
      "Marcus,Rivera,,,,,,salary,full_time,w2,,",
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
    const [first, last, , , , title] = csv.split("\r\n")[1].match(/("([^"]|"")*"|[^,]*)/g)!.filter((_, i) => i % 2 === 0);
    expect(first).toBe('"\'=HYPERLINK(""https://x.example"",""x"")"');
    expect(last).toBe("'@SUM(A1)");
    expect(title).toBe("'+1");
  });
});

describe("layoutFor", () => {
  it("gives a PEO its own layout, whatever the capitalisation, and any other PEO our own", () => {
    expect(layoutFor("sample peo", [SAMPLE_LAYOUT])).toBe(SAMPLE_LAYOUT);
    expect(layoutFor("TriNet", [SAMPLE_LAYOUT])).toBe(OUR_CENSUS_LAYOUT);
    expect(layoutFor(null, [SAMPLE_LAYOUT])).toBe(OUR_CENSUS_LAYOUT);
  });
});
