import { describe, expect, it } from "vitest";
import { CLASSIFICATIONS, COMPENSATION_TYPES, COVERAGE_TIERS, EMPLOYMENT_TYPES } from "./census";
import { CENSUS_TEMPLATE_COLUMNS, CENSUS_TEMPLATE_GUIDE, censusTemplateCsv } from "./censusTemplate";
import { isSensitiveHeader } from "./sensitive";
import { normaliseHeader } from "../document-extract/parse";

// US-2.3d. That every header is read as its column is tested with the reader (document-extract/parse.test.ts).
describe("census template", () => {
  it("has exactly the census columns, in order, as its only row", () => {
    expect(censusTemplateCsv()).toBe(
      "first_name,last_name,dob,gender,hire_date,work_state,home_state,zip_code,job_title,annual_salary,compensation_type,employment_type,classification,coverage_tier,cobra,class_code\r\n",
    );
  });

  it("has no SSN or bank column", () => {
    for (const column of CENSUS_TEMPLATE_COLUMNS) {
      expect(isSensitiveHeader(normaliseHeader(column)), column).toBe(false);
      expect(column).not.toMatch(/ssn|social|tax_?id|tin|bank|routing|account|iban/i);
    }
  });

  it("says what goes in every column, naming each value a coded column accepts", () => {
    expect(Object.keys(CENSUS_TEMPLATE_GUIDE)).toEqual([...CENSUS_TEMPLATE_COLUMNS]);
    const accepts: [keyof typeof CENSUS_TEMPLATE_GUIDE, readonly string[]][] = [
      ["compensation_type", COMPENSATION_TYPES],
      ["employment_type", EMPLOYMENT_TYPES],
      ["classification", CLASSIFICATIONS],
      ["coverage_tier", COVERAGE_TIERS],
    ];
    for (const [column, values] of accepts) {
      for (const value of values) expect(CENSUS_TEMPLATE_GUIDE[column], column).toContain(value);
    }
    expect(CENSUS_TEMPLATE_GUIDE.compensation_type).toBe("salary or hourly");
    // K-2.1: what a health underwriter rates the group on.
    expect(CENSUS_TEMPLATE_GUIDE.gender).toBe("F, M or X");
    expect(CENSUS_TEMPLATE_GUIDE.cobra).toMatch(/^yes or no/);
    expect(CENSUS_TEMPLATE_GUIDE.hire_date).toMatch(/YYYY-MM-DD or MM\/DD\/YYYY/);
  });
});
