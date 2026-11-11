import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "./chamberTypes";
import type { CensusEmployee } from "./census";
import type { ProvenanceMap } from "./provenance";
import { workersCompApplication, workersCompFilename, type WorkersCompSource } from "./workersCompApplication";

// Made up for the tests: nobody real.
const source = (data: Partial<ChamberData>, provenance: ProvenanceMap = {}, over: Partial<WorkersCompSource> = {}): WorkersCompSource => ({
  intake: { data: { ...EMPTY_CHAMBER_DATA, ...data }, provenance, verified: new Set() },
  fileId: "EAA-2026-0042",
  version: 3,
  changedSince: false,
  ...over,
});

describe("workersCompApplication: our own summary of the certified answers, in the standard application's order", () => {
  it("is titled as our own data, says which certified version it is from, and is not the ACORD form", () => {
    const app = workersCompApplication(source({ company_name: "Acme Bakery LLC" }));
    expect(app.title).toBe("Workers' compensation application data");
    expect(app.companyName).toBe("Acme Bakery LLC");
    expect(app.fromVersion).toBe("From certified version 3");
    expect(app.ourOwn).toBe(
      "This is our own summary of the certified answers, laid out in the order of the standard workers' compensation application. It is not the ACORD form, and it is not filled in on it.",
    );
    expect(app.sections.map((s) => s.title)).toEqual([
      "Applicant", "Locations", "Owners and officers", "Rating by state", "Prior carriers and loss history", "Nature of business", "General questions",
    ]);
    expect(JSON.stringify(app)).not.toMatch(/ACORD 130|\(20\d\d\/\d\d\)/);
  });
});

const section = (app: ReturnType<typeof workersCompApplication>, title: string) => app.sections.find((s) => s.title === title)!.entries;
const by = { source: { kind: "prospect_edit" as const }, updated_at: "2026-11-13T10:00:00Z" };

describe("workersCompApplication: what the certified answers hold, and blanks for the rest, never guessed", () => {
  it("fills the applicant from the answers it holds, and leaves what the intake doesn't ask blank: a count of FEINs is not a FEIN", () => {
    const app = workersCompApplication(source({ company_name: "Acme Bakery LLC", hq_state: "CA", multiple_entities: false, fein_count: 1 }));
    expect(section(app, "Applicant")).toEqual([
      { label: "Legal name", value: "Acme Bakery LLC" },
      { label: "Doing business as (DBA)", value: null },
      { label: "FEIN", value: null },
      { label: "Number of FEINs", value: "1" },
      { label: "More than one legal entity", value: "No" },
      { label: "Type of entity", value: null },
      { label: "Mailing address", value: null },
      { label: "Headquarters state", value: "CA" },
      { label: "Contact name, phone and email", value: null },
      { label: "Years in business", value: null },
      { label: "Website", value: null },
    ]);
  });

  it("says when an answer wasn't confirmed or is incomplete, and leaves one the prospect didn't know or that conflicts blank", () => {
    const app = workersCompApplication(source(
      { company_name: "Acme", industry: "Bakery", wc_carrier: "Old Carrier", wc_annual_premium: 12000, wc_experience_mod: 0.92, hq_state: null },
      {
        company_name: { status: "inferred", ...by },
        industry: { status: "incomplete", ...by },
        wc_carrier: { status: "conflicting", ...by },
        hq_state: { status: "unknown", ...by },
        wc_renewal_date: { status: "not_applicable", ...by },
      },
    ));
    expect(section(app, "Applicant")[0]).toEqual({ label: "Legal name", value: "Acme (not confirmed by the prospect)" });
    expect(section(app, "Applicant")[7]).toEqual({ label: "Headquarters state", value: null, note: "the prospect didn't know" });
    expect(section(app, "Nature of business")[0]).toEqual({ label: "Industry, as the prospect described it", value: "Bakery (incomplete)" });
    expect(section(app, "Prior carriers and loss history").slice(0, 4)).toEqual([
      { label: "Current workers' comp carrier", value: null, note: "the answers given conflict" },
      { label: "Renewal date", value: "Doesn't apply" },
      { label: "Annual premium", value: "$12,000" },
      { label: "Experience modification", value: "0.92" },
    ]);
  });

  it("takes an answer an advisor verified as it stands", () => {
    const from = source({ company_name: "Acme" }, { company_name: { status: "inferred", ...by } });
    const app = workersCompApplication({ ...from, intake: { ...from.intake, verified: new Set(["company_name"]) } });
    expect(section(app, "Applicant")[0]).toEqual({ label: "Legal name", value: "Acme" });
  });

  it("lists every blank at the start, with a count, section by section, so the advisor knows before sending", () => {
    const app = workersCompApplication(source({ company_name: "Acme", industry: "Bakery", states: ["CA"], hq_state: "CA", employee_count: 2 }));
    expect(app.blanks.length).toBeGreaterThan(10);
    expect(app.blanks).toContain("Applicant: FEIN");
    expect(app.blanks).toContain("Owners and officers: Names, titles and share owned");
    expect(app.blanks).toContain("Prior carriers and loss history: Claims in the past five years");
    expect(app.blanks).toContain("Rating by state: Census");
    expect(app.blanks).not.toContain("Applicant: Legal name");
    // Every blank is in its section, and nothing in a section is blank without being listed.
    const listed = app.sections.flatMap((s) => s.entries.filter((e) => e.value === null).map((e) => `${s.title}: ${e.label}${e.note ? ` (${e.note})` : ""}`));
    expect(app.blanks).toEqual(listed);
    expect(app.intakeGaps).toBe(
      "The intake doesn't ask most of what a workers' comp application needs yet, such as owners and officers, addresses and loss history, so much of this is blank. Fill the blanks in with the employer before sending.",
    );
  });

  it("asks the general questions as blanks, but for what the intake holds", () => {
    const general = section(workersCompApplication(source({ has_1099: true, ca_contractors: false })), "General questions");
    expect(general[0]).toEqual({ label: "Uses 1099 contractors", value: "Yes" });
    expect(general[1]).toEqual({ label: "Contractors in California", value: "No" });
    expect(general.slice(2).every((e) => e.value === null)).toBe(true);
    expect(general.map((e) => e.label)).toContain("Subcontractors' certificates of insurance");
  });
});

const person = (over: Partial<CensusEmployee>): CensusEmployee => ({
  id: Math.random().toString(36), first_name: "Sam", last_name: "Sample", work_state: "CA",
  compensation_type: "salary", employment_type: "full_time", classification: "w2", ...over,
});

describe("workersCompApplication: the rating table, by state and class code, from the certified census only", () => {
  const census: CensusEmployee[] = [
    // Out of order on purpose: the table sorts states and class codes.
    person({ work_state: "NY", annual_salary: 70000, classification: "1099" }),
    person({ work_state: "CA", class_code: "8810", annual_salary: 85000 }),
    person({ work_state: "CA", class_code: "8810", annual_salary: 41600.5, employment_type: "part_time", compensation_type: "hourly" }),
    // Pay worked out from an hourly rate at full-time hours, and hours not stated: neither is counted as given.
    person({ work_state: "CA", class_code: "8810", annual_salary: 52000, compensation_type: "hourly", assumed: ["employment_type", "annual_salary"] }),
    person({ work_state: "", class_code: "8810", annual_salary: 60000 }),
    person({ work_state: "CA", class_code: "5183" }),
  ];
  const app = workersCompApplication(source({ census, employee_count: 6 }));

  it("groups by state then class code, counts full and part time as stated, and sums only the pay the census states", () => {
    expect(app.ratingTable).toEqual([
      { state: "CA", rows: [
        { classCode: "5183", employees: 1, fullTime: 1, partTime: 0, hoursNotStated: 0, contractors: 0, pay: null, basis: "No pay in the census for the 1 person here." },
        { classCode: "8810", employees: 3, fullTime: 1, partTime: 1, hoursNotStated: 1, contractors: 0, pay: 126600.5,
          basis: "$85,000 + $41,600.50 = $126,600.50, the pay the census states for 2 of 3. 1 has a year's pay worked out from an hourly rate at full-time hours, which isn't counted." },
      ] },
      { state: "NY", rows: [
        { classCode: null, employees: 1, fullTime: 1, partTime: 0, hoursNotStated: 0, contractors: 1, pay: 70000,
          basis: "$70,000, the pay the census states for 1 of 1. Includes 1 the census marks 1099." },
      ] },
      { state: null, rows: [
        { classCode: "8810", employees: 1, fullTime: 1, partTime: 0, hoursNotStated: 0, contractors: 0, pay: 60000, basis: "$60,000, the pay the census states for 1 of 1." },
      ] },
    ]);
  });

  it("lists what the census lacks as blanks, rather than estimating it", () => {
    expect(section(app, "Rating by state")).toEqual([
      { label: "Employees, as answered", value: "6" },
      { label: "Employees in the census", value: "6" },
      { label: "Class code", value: null, note: "the census has none for 1 of 6" },
      { label: "Annual pay", value: null, note: "the census has none for 1 of 6, and 1 is worked out from an hourly rate" },
      { label: "Work state", value: null, note: "the census has none for 1 of 6" },
      { label: "Description of each class code", value: null },
      { label: "Estimated pay for the policy period", value: null },
    ]);
  });

  it("has no rating table without a census, and says so", () => {
    const none = workersCompApplication(source({}));
    expect(none.ratingTable).toEqual([]);
    expect(section(none, "Rating by state")).toEqual([
      { label: "Employees, as answered", value: null },
      { label: "Census", value: null },
      { label: "Description of each class code", value: null },
      { label: "Estimated pay for the policy period", value: null },
    ]);
  });
});

describe("workersCompApplication: which version, and its name", () => {
  it("says when the prospect has changed answers since certifying", () => {
    expect(workersCompApplication(source({}, {}, { changedSince: true })).changedNotice).toBe("The prospect has changed answers since certifying. These files are from version 3.");
    expect(workersCompApplication(source({})).changedNotice).toBeNull();
    expect(workersCompApplication(source({}, {}, { version: null })).fromVersion).toBe("From the certification on record");
  });

  it("is named for the File ID and the certified version", () => {
    expect(workersCompFilename(workersCompApplication(source({})))).toBe("EAA-2026-0042-workers-comp-application-v3.pdf");
    expect(workersCompFilename(workersCompApplication(source({}, {}, { version: null })))).toBe("EAA-2026-0042-workers-comp-application.pdf");
  });
});

describe("workersCompApplication: the census's places and long sums", () => {
  it("leaves the states of operation blank when none were given", () => {
    expect(section(workersCompApplication(source({ states: [] })), "Locations")[0]).toEqual({ label: "States of operation", value: null });
  });

  it("lists where the census says people work, and the states as answered", () => {
    const census = [person({ work_state: "NY", zip_code: "10001" }), person({ work_state: "CA", zip_code: "94110" }), person({ work_state: "CA", zip_code: "94107" }), person({ work_state: "TX" }), person({ work_state: "" })];
    expect(section(workersCompApplication(source({ census, states: ["CA", "NY", "TX"] })), "Locations")).toEqual([
      { label: "States of operation", value: "CA, NY, TX" },
      { label: "Work states and ZIP codes in the census", value: "CA: 94107, 94110 · NY: 10001 · TX: no ZIP given · No work state given: no ZIP given" },
      { label: "Address of each location", value: null },
    ]);
  });

  it("says pay worked out from an hourly rate isn't counted even when every row has an amount, and names a long sum by its count", () => {
    const census = [person({ class_code: "8810", annual_salary: 52000, compensation_type: "hourly", assumed: ["annual_salary"] }), person({ class_code: "8810", annual_salary: 1000 })];
    const app = workersCompApplication(source({ census }));
    expect(section(app, "Rating by state")).toContainEqual({ label: "Annual pay", value: null, note: "1 of 2 is worked out from an hourly rate" });
    // Cents add up exactly.
    const cents = workersCompApplication(source({ census: [person({ annual_salary: 100.1 }), person({ annual_salary: 200.2 })] }));
    expect(cents.ratingTable[0].rows[0].pay).toBe(300.3);
    const many = Array.from({ length: 11 }, () => person({ class_code: "8810", annual_salary: 1000 }));
    expect(workersCompApplication(source({ census: many })).ratingTable[0].rows[0].basis).toBe("The sum of 11 amounts, $11,000, the pay the census states for 11 of 11.");
  });
});
