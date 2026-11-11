import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "./chamberTypes";
import type { CensusEmployee } from "./chamberTypes";
import type { ProvenanceMap } from "./provenance";
import { REVIEW_FIELDS } from "./reviewFields";
import { ROW_LISTS } from "./rowColumns";
import { INTAKE_SCHEMA } from "./intakeSchema";
import {
  buildManuscript,
  certificationFromRow,
  coverageTier,
  eligibilityChecks,
  employeeFlag,
  isFileId,
  LEGACY_CONSENT_TEXT,
  manuscriptFilename,
  maskDob,
  NOT_APPLICABLE,
  wcSystem,
  type ChamberSubmission,
  rowProvenance,
} from "./manuscript";

const emp = (overrides: Partial<CensusEmployee> = {}): CensusEmployee => ({
  id: "e1",
  first_name: "A",
  last_name: "B",
  dob: "1990-01-01",
  work_state: "TX",
  job_title: "Designer",
  annual_salary: 50000,
  compensation_type: "salary",
  employment_type: "full_time",
  classification: "w2",
  dependents: [],
  ...overrides,
});

const AT = "2026-05-01T00:00:00Z";
const opts = { fileId: "EAA-1", date: new Date(AT) };
const source = { kind: "transcript" as const, message_id: "m1" };
const confirmed = { status: "confirmed" as const, source: { kind: "prospect_edit" as const }, updated_at: AT };

const certified: ChamberSubmission = {
  signer_name: "Jo Doe",
  signer_title: "CEO",
  signed_at: "2026-05-01T12:00:00Z",
  certified_at: "2026-05-01T12:00:03Z",
  file_id: "EAA-2026-0042",
  version: 2,
  data_version: 17,
  schema_version: 2,
  documents: [{ id: "d1", file_name: "census.csv", category: "employee_census", status: "extracted" }],
  consent_version: "v1",
  consent_text: ["I certify."],
};

describe("isFileId", () => {
  it("accepts the File IDs the database assigns, and the ones older intakes carry", () => {
    expect(isFileId("EAA-2026-0001")).toBe(true);
    expect(isFileId("EAA-2026-12345")).toBe(true);
    expect(isFileId("EAA-2026-0F1E2D3C")).toBe(true);
  });

  it("refuses anything else, so a guessed path can't become a query", () => {
    for (const bad of ["EAA-2026", "eaa-2026-0001", "EAA-2026-0001; drop", "", null, 42, "EAA-26-0001", "EAA-2026-" + "A".repeat(13)]) {
      expect(isFileId(bad)).toBe(false);
    }
  });
});

describe("eligibilityChecks", () => {
  it("reports unknown, not pass, for data that was never collected", () => {
    const checks = eligibilityChecks(EMPTY_CHAMBER_DATA);
    expect(checks.every((c) => c.status === "unknown")).toBe(true);
  });

  it("doesn't pass or fail headcount against a minimum nobody has sourced", () => {
    const [headcount] = eligibilityChecks({ ...EMPTY_CHAMBER_DATA, employee_count: 3 });
    expect(headcount.status).toBe("unknown");
    expect(headcount.label).toMatch(/not yet confirmed/);
  });

  it("fails headcount below the chosen PEO's sourced minimum, naming the PEO", () => {
    const peo = { name: "Example PEO", minHeadcount: 10, statesServed: null, excludedClassCodes: null, lastVerified: "2026-10-01" };
    const [headcount] = eligibilityChecks({ ...EMPTY_CHAMBER_DATA, employee_count: 3 }, peo);
    expect(headcount.status).toBe("fail");
    expect(headcount.label).toBe("Headcount meets Example PEO minimum (3 of 10 employees)");
  });
});

describe("eligibilityChecks: class codes", () => {
  const census = (class_code: string) => [{ id: "1", first_name: "A", last_name: "B", work_state: "CA", class_code, compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const }];
  const peo = { name: "Example PEO", minHeadcount: null, statesServed: null, excludedClassCodes: ["5551"], lastVerified: "2026-10-01" };
  const industry = (data: typeof EMPTY_CHAMBER_DATA, p?: typeof peo) => eligibilityChecks(data, p).find((c) => /^Industry/.test(c.label))!;

  it("passes when no census class code is one the chosen PEO excludes", () => {
    expect(industry({ ...EMPTY_CHAMBER_DATA, census: census("8810") }, peo)).toEqual({ label: "Industry — no class code Example PEO excludes", status: "pass" });
  });

  it("fails naming the excluded class code", () => {
    expect(industry({ ...EMPTY_CHAMBER_DATA, census: census("5551") }, peo)).toEqual({ label: "Industry — Example PEO lists class code 5551 as excluded", status: "fail" });
  });

  it("stays unknown with no PEO, or a PEO whose exclusions aren't sourced", () => {
    expect(industry({ ...EMPTY_CHAMBER_DATA, census: census("5551") }).status).toBe("unknown");
    expect(industry({ ...EMPTY_CHAMBER_DATA, census: census("5551") }, { ...peo, excludedClassCodes: null as unknown as string[] }).status).toBe("unknown");
  });
});

describe("employeeFlag", () => {
  it("flags CA 1099 contractors and sales titles", () => {
    expect(employeeFlag(emp({ classification: "1099", work_state: "CA" }))).toMatch(/AB5/);
    expect(employeeFlag(emp({ job_title: "Account Executive" }))).toMatch(/outside sales/);
    expect(employeeFlag(emp({ job_title: undefined }))).toBeNull();
    expect(employeeFlag(emp())).toBeNull();
  });
});

describe("coverageTier", () => {
  const spouse = { first_name: "S", last_name: "", dob: "", relationship: "spouse" as const };
  const child = { first_name: "C", last_name: "", dob: "", relationship: "child" as const };

  it("derives the tier from dependents", () => {
    expect(coverageTier(emp({ dependents: [spouse] }))).toBe("Employee + Spouse");
    expect(coverageTier(emp({ dependents: [child] }))).toBe("Employee + Child(ren)");
    expect(coverageTier(emp({ dependents: [spouse, child] }))).toBe("Employee + Family");
  });

  it("doesn't make up Employee Only when nobody named a tier or a dependent", () => {
    expect(coverageTier(emp())).toBeNull();
    expect(coverageTier(emp({ dependents: undefined }))).toBeNull();
    expect(coverageTier(emp({ coverage_tier: "EE" }))).toBe("Employee Only");
  });

  it("uses the tier the census states over one implied by dependents", () => {
    expect(coverageTier(emp({ coverage_tier: "EE+CH" }))).toBe("Employee + Child(ren)");
    expect(coverageTier(emp({ coverage_tier: "WAIVE", dependents: [spouse] }))).toBe("Waived");
  });
});

describe("wcSystem", () => {
  it("maps states to their rating system", () => {
    expect(wcSystem("CA")).toBe("WCIRB");
    expect(wcSystem("OH")).toBe("State fund");
    expect(wcSystem("TX")).toBe("NCCI");
  });
});

describe("buildManuscript", () => {
  it("uses the session's data rather than sample content", () => {
    const m = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, company_name: "Acme Robotics", states: ["OH"], census: [emp({ work_state: "OH" })] },
      {
        fileId: "EAA-2026-ABCDEF12",
        submission: { signer_name: "Jo Doe", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-2026-ABCDEF12" },
      },
    );
    expect(m.companyName).toBe("Acme Robotics");
    expect(m.states).toEqual([{ state: "OH", count: "1", system: "State fund" }]);
    expect(m.signer?.name).toBe("Jo Doe");
    expect(m.submittedTo).toBeNull(); // older submissions have no PEO recorded
    expect(JSON.stringify(m)).not.toMatch(/Meridian/);
  });

  it("names the PEO chosen at submission", () => {
    const m = buildManuscript(EMPTY_CHAMBER_DATA, {
      fileId: "EAA-1",
      submission: { signer_name: "Jo", signer_title: "", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-1", peo: "Justworks" },
    });
    expect(m.submittedTo).toBe("Justworks");
  });

  it("counts dependent tiers and lists open items for the demo data", () => {
    const m = buildManuscript(DEMO_CHAMBER_DATA, { fileId: "EAA-SAMPLE", date: new Date(AT) });
    const total = m.dependentTiers.reduce((sum, t) => sum + t.count, 0);
    expect(total).toBe(DEMO_CHAMBER_DATA.census.filter((e) => e.classification === "w2").length);
    expect(m.totalDependents).toBe("6");
    expect(m.open.some((o) => o.includes("Workers' comp"))).toBe(true);
    expect(m.signer).toBeNull();
  });

  it("carries the certification's version, data version, date and documents", () => {
    const m = buildManuscript({ ...EMPTY_CHAMBER_DATA, company_name: "Acme" }, { fileId: certified.file_id, submission: certified });
    expect(m).toMatchObject({ fileId: "EAA-2026-0042", version: 2, dataVersion: 17, certifiedAt: "2026-05-01T12:00:03Z" });
    expect(m.date).toBe("May 1, 2026");
    expect(m.documents).toEqual([{ name: "census.csv", category: "Employee census", status: "Read" }]);
  });

  it("has no version, date or document record for a packet that isn't certified, and no documents for an older one", () => {
    const m = buildManuscript(EMPTY_CHAMBER_DATA, { fileId: "EAA-1" });
    expect(m).toMatchObject({ version: null, dataVersion: null, certifiedAt: null, date: "Not certified", documents: null });
    const older = buildManuscript(EMPTY_CHAMBER_DATA, {
      fileId: "EAA-1",
      submission: { signer_name: "Jo", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-1" },
    });
    expect(older.documents).toBeNull();
    expect(older.date).toBe("May 1, 2026"); // the signing time, when the server never stamped a certification time
  });

  it("carries the consent wording's version, and whether it is a draft, with the signer", () => {
    const m = buildManuscript(EMPTY_CHAMBER_DATA, { fileId: certified.file_id, submission: { ...certified, consent_version: "2026-10-draft-1" } });
    expect(m.signer).toMatchObject({ consentVersion: "2026-10-draft-1", consentDraft: true });
    // An older submission kept the version under its first name only.
    const older = buildManuscript(EMPTY_CHAMBER_DATA, {
      fileId: certified.file_id,
      submission: { ...certified, consent_version: undefined, consent_text_version: "2026-10-draft-1" },
    });
    expect(older.signer).toMatchObject({ consentVersion: "2026-10-draft-1", consentDraft: true });
    // One that recorded neither shows the legacy wording, still marked as a draft.
    const legacy = buildManuscript(EMPTY_CHAMBER_DATA, {
      fileId: certified.file_id,
      submission: { ...certified, consent_version: undefined, consent_text: undefined },
    });
    expect(legacy.signer).toMatchObject({ consent: LEGACY_CONSENT_TEXT, consentVersion: null, consentDraft: true });
    expect(buildManuscript(EMPTY_CHAMBER_DATA, { fileId: "EAA-1" }).signer).toBeNull();
  });
});

describe("buildManuscript covers the whole intake", () => {
  const rowsOf = (m: ReturnType<typeof buildManuscript>) => ({
    company: m.companyRows,
    workforce: m.workforceRows,
    locations: m.locationRows,
    payroll: m.payrollRows,
    benefits: m.benefitsRows,
    workers_comp: m.workersCompRows,
    operations: m.operationsRows,
  });

  it("puts every intake field in a section, as the Review step does, or renders it another way", () => {
    // Review's sections (src/data/reviewFields.ts) hold every answer but the census, which is a table of its own.
    const reviewSectionOf: Record<string, string> = Object.fromEntries(Object.entries(REVIEW_FIELDS).flatMap(([section, fields]) => fields.map((f) => [f, section])));
    expect(Object.keys(reviewSectionOf).sort()).toEqual(Object.keys(EMPTY_CHAMBER_DATA).filter((f) => f !== "census").sort());
    const m = buildManuscript(DEMO_CHAMBER_DATA, opts);
    const rows = rowsOf(m);
    // The census is a table of its own, in the Workforce section.
    const renderedElsewhere: Record<string, string> = {
      census: "the census table and the state breakdown",
      // K-3.4: 24 questions and their explanations read as one table, in the form's own words.
      ...Object.fromEntries(Object.keys(EMPTY_CHAMBER_DATA).filter((f) => f.startsWith("wcq_")).map((f) => [f, "the ACORD 130 table in the workers' comp section"])),
    };
    const keyed = new Map<string, string>(Object.entries(rows).flatMap(([section, list]) => list.flatMap(([, , field]) => (field ? [[field, section] as [string, string]] : []))));
    for (const field of Object.keys(EMPTY_CHAMBER_DATA)) {
      if (field in renderedElsewhere) continue;
      expect(keyed.has(field), `${field} has no row in The Manuscript`).toBe(true);
      expect(keyed.get(field), `${field} is in the wrong section`).toBe(reviewSectionOf[field]);
    }
    expect(m.census.length).toBe(DEMO_CHAMBER_DATA.census.length);
  });

  // K-5.3: the same rule for what a census row holds (D30 covered the top-level answers only). v3 added seven
  // facts to a row; each is printed, or left out here with the reason.
  it("prints every fact a census row holds, or leaves it out for a stated reason", () => {
    const facts = Object.keys((INTAKE_SCHEMA.$defs as Record<string, { properties: object }>).censusRow.properties);
    const inTheCensusTable = ["first_name", "last_name", "dob", "age", "work_state", "job_title", "annual_salary", "compensation_type", "employment_type", "classification", "coverage_tier", "class_code"];
    const inTheDetailsTable = ["zip_code", "gender", "hire_date", "cobra", "home_state", "worksite", "remote", "travels"];
    const leftOut: Record<string, string> = {
      id: "an internal key, never shown",
      dependents: "counted in the dependent summary; the packet names no dependent",
      assumed: "shown on the fact it qualifies, as 'Not provided' or '(est.)'",
    };
    expect([...facts].sort()).toEqual([...inTheCensusTable, ...inTheDetailsTable, ...Object.keys(leftOut)].sort());

    const sarah = { ...DEMO_CHAMBER_DATA.census[0], gender: "F" as const, hire_date: "2019-04-01", cobra: false, home_state: "NV", worksite: "Harbor Street studio", remote: false, travels: true };
    const m = buildManuscript({ ...DEMO_CHAMBER_DATA, census: [sarah, DEMO_CHAMBER_DATA.census[3]] }, opts);
    const details = m.tables.find((t) => t.title === "Census Details")!;
    expect([details.section, details.field]).toEqual(["workforce", "census"]);
    expect(details.columns).toEqual(["Name", "ZIP", "Gender", "Hire date", "COBRA", "Home state", "Worksite", "Remote", "Travels"]);
    expect(details.rows).toEqual([
      ["Sarah Chen", "94107", "F", "2019-04-01", "No", "NV", "Harbor Street studio", "No", "Yes"],
      ["James O'Brien", "78701", "—", "—", "—", "—", "—", "—", "—"],
    ]);
    // Every fact of the row reaches the packet: the census table holds the rest.
    expect(m.census[0]).toMatchObject({ name: "Sarah Chen", dob: "1988-03-15", state: "CA", title: "Senior Designer", salary: "$105,000", classification: "W-2", tier: "Employee + Family", classCode: "8810" });
  });

  it("prints no census details table for a census that holds none of them", () => {
    const bare = DEMO_CHAMBER_DATA.census.map(({ zip_code: _zip, ...e }) => e);
    expect(buildManuscript({ ...DEMO_CHAMBER_DATA, census: bare }, opts).tables.map((t) => t.title)).not.toContain("Census Details");
    expect(buildManuscript({ ...DEMO_CHAMBER_DATA, census: [] }, opts).tables.map((t) => t.title)).not.toContain("Census Details");
  });

  // Every answer that is a table of rows is printed as a table (or, for the legal entities, as a line of the company profile).
  it("prints every table of rows the intake holds", () => {
    const m = buildManuscript({ ...DEMO_CHAMBER_DATA, entities: [{ legal_name: "Meridian Creative LLC" }] }, opts);
    const asALine: Record<string, string> = { entities: "one line of the company profile: each entity's name and FEIN" };
    const lists = Object.keys(ROW_LISTS).filter((field) => !(field in asALine));
    expect(lists.filter((field) => !m.tables.some((t) => t.field === field))).toEqual([]);
    for (const table of m.tables) expect(table.rows.length, table.title).toBeGreaterThan(0);
  });

  // K-1.1: a PEO's form needs all nine digits, so the packet prints the FEIN in full.
  it("shows who the employer is: the FEIN in full, entity type, year founded, address and website", () => {
    const m = buildManuscript(DEMO_CHAMBER_DATA, opts);
    const company = Object.fromEntries(m.companyRows.map(([label, value]) => [label, value]));
    expect(company).toMatchObject({
      FEIN: "84-1234567",
      "Entity Type": "LLC",
      "Year Founded": "2014",
      "Street Address": "500 Harbor Street, Suite 300, San Francisco, CA 94107",
      Website: "meridiancreative.example",
      "Legal Entities": "Not provided",
    });
    const several = buildManuscript({ ...DEMO_CHAMBER_DATA, multiple_entities: true, entities: [{ legal_name: "Meridian Creative LLC", fein: "841234567" }, { legal_name: "Meridian Studios Inc", fein: "841234568" }] }, opts);
    expect(Object.fromEntries(several.companyRows.map(([label, value]) => [label, value]))["Legal Entities"])
      .toBe("Meridian Creative LLC (FEIN 84-1234567); Meridian Studios Inc (FEIN 84-1234568)");
  });

  // K-1.2: the free-text industry stays, with the code and the description of operations beside it.
  it("shows the industry as the prospect put it, as a NAICS code with its title, and as a description of operations", () => {
    const m = buildManuscript({ ...DEMO_CHAMBER_DATA, naics_code: "541430", operations_description: "Brand and packaging design for consumer goods." }, opts);
    const labels = m.companyRows.map(([label]) => label);
    expect(labels.slice(labels.indexOf("Industry"), labels.indexOf("Industry") + 3)).toEqual(["Industry", "NAICS Code", "Description of Operations"]);
    expect(Object.fromEntries(m.companyRows.map(([label, value]) => [label, value]))).toMatchObject({
      Industry: "Creative Agency",
      "NAICS Code": "541430 · Graphic Design Services",
      "Description of Operations": "Brand and packaging design for consumer goods.",
    });
  });

  it("shows whether the employer is in a PEO now, which one, and when its agreement renews (K-1.3)", () => {
    const row = (data: typeof DEMO_CHAMBER_DATA, provenance = {}) => Object.fromEntries(buildManuscript(data, { ...opts, provenance }).companyRows.map(([label, value]) => [label, value]));
    expect(row({ ...DEMO_CHAMBER_DATA, in_peo: true, current_peo: "Summit PEO", peo_renewal_date: "January 2027" })).toMatchObject({
      "In a PEO Now": "Yes", "Current PEO": "Summit PEO", "PEO Agreement Renewal": "January 2027",
    });
    const na = { status: "not_applicable" as const, source: { kind: "prospect_edit" as const }, updated_at: AT };
    expect(row({ ...DEMO_CHAMBER_DATA, in_peo: false, current_peo: null, peo_renewal_date: null }, { current_peo: na, peo_renewal_date: na })).toMatchObject({
      "In a PEO Now": "No", "Current PEO": NOT_APPLICABLE, "PEO Agreement Renewal": NOT_APPLICABLE,
    });
  });

  // K-3.1: each owner and officer, so an underwriter can price who is included and who is excluded.
  it("lists each owner and officer in the workers' comp section, as a table", () => {
    const m = buildManuscript(DEMO_CHAMBER_DATA, opts);
    expect(m.workersCompRows.find(([, , field]) => field === "owners_officers")).toEqual(["Owners and Officers", "2 listed", "owners_officers"]);
    const owners = (built: typeof m) => built.tables.filter((t) => t.field === "owners_officers");
    expect(owners(m).map((t) => [t.section, t.title])).toEqual([["workers_comp", "Owners and Officers"]]);
    const [table] = owners(m);
    expect(table.columns).toEqual(["Name", "Title", "Ownership %", "Duties", "Covered by workers' comp"]);
    expect(table.rows).toEqual([
      ["Dana Reyes", "Chief Executive Officer", "60%", "Runs the studio and client accounts; office work only", "No"],
      ["Marcus Rivera", "Art Director", "40%", "Leads design; on the census as an employee", "Yes"],
    ]);
    const none = buildManuscript({ ...DEMO_CHAMBER_DATA, owners_officers: [] }, opts);
    expect(none.workersCompRows.find(([, , field]) => field === "owners_officers")?.[1]).toBe("Not provided");
    expect(owners(none)).toEqual([]);
    const one = buildManuscript({ ...DEMO_CHAMBER_DATA, owners_officers: [{ name: "Dana Reyes" }] }, opts);
    expect(owners(one)[0].rows).toEqual([["Dana Reyes", "—", "—", "—", "—"]]);
  });

  // K-3.2: worked out from the census; nobody types it.
  it("prints payroll and headcount by class code and state in the workers' comp section", () => {
    const m = buildManuscript(DEMO_CHAMBER_DATA, opts);
    const table = m.tables.find((t) => t.title === "Payroll by Class Code and State")!;
    expect(table.section).toBe("workers_comp");
    expect(table.columns).toEqual(["State", "Class code", "Full time", "Part time", "Annual payroll"]);
    // The demo census: four W-2 employees in California and one in Texas, all 8810; the contractor is left out.
    expect(table.rows).toEqual([["CA", "8810", "4", "0", "$438,000"], ["TX", "8810", "1", "0", "$78,000"]]);
    const uncoded = buildManuscript({ ...DEMO_CHAMBER_DATA, census: DEMO_CHAMBER_DATA.census.map((e) => ({ ...e, class_code: undefined })) }, opts);
    expect(uncoded.tables.find((t) => t.title === "Payroll by Class Code and State")!.rows).toEqual([
      ["CA", "No class code yet", "4", "0", "$438,000"], ["TX", "No class code yet", "1", "0", "$78,000"],
    ]);
    expect(buildManuscript({ ...DEMO_CHAMBER_DATA, census: [] }, opts).tables.map((t) => t.title)).not.toContain("Payroll by Class Code and State");
  });

  // K-3.3
  it("prints the loss history by year, newest first, with each year's valuation date", () => {
    const m = buildManuscript({ ...DEMO_CHAMBER_DATA, loss_history: [
      { policy_year: 2023, no_coverage: true },
      { policy_year: 2025, carrier: "Pinnacle Mutual", premium: 18400, experience_mod: 0.92, claims: 2, paid: 12500, reserved: 4000, valuation_date: "2026-09-30" },
      { policy_year: 2024, carrier: "Pinnacle Mutual", premium: 17100, claims: 0, paid: 0, reserved: 0 },
    ] }, opts);
    const table = m.tables.find((t) => t.field === "loss_history")!;
    expect([table.section, table.title]).toEqual(["workers_comp", "Loss History by Year"]);
    expect(table.columns).toEqual(["Policy year", "Carrier", "Premium", "Experience mod", "Claims", "Paid", "Reserved", "Valued as of", "No coverage"]);
    expect(table.rows).toEqual([
      ["2025", "Pinnacle Mutual", "$18,400", "0.92", "2", "$12,500", "$4,000", "2026-09-30", "—"],
      ["2024", "Pinnacle Mutual", "$17,100", "—", "0", "$0", "$0", "—", "—"],
      ["2023", "—", "—", "—", "—", "—", "—", "—", "Yes"],
    ]);
    expect(m.workersCompRows.find(([, , field]) => field === "loss_history")).toEqual(["Loss History", "3 listed", "loss_history"]);
    // With coverage every year, the "No coverage" column is left out, leaving room for the figures.
    const covered = buildManuscript({ ...DEMO_CHAMBER_DATA, loss_history: [{ policy_year: 2025, premium: 18400 }] }, opts).tables.find((t) => t.field === "loss_history")!;
    expect(covered.columns).toEqual(["Policy year", "Carrier", "Premium", "Experience mod", "Claims", "Paid", "Reserved", "Valued as of"]);
    expect(covered.rows).toEqual([["2025", "—", "$18,400", "—", "—", "—", "—", "—"]]);
  });

  // K-4.1: what the employer pays now, for a side-by-side; renewal rates beside current ones when it has them.
  it("prints the current medical plans in the benefits section, and their renewal rates when any is held", () => {
    const plans = [
      { name: "Gold PPO 500", carrier: "Blue Shield", rate_ee: 612.4, rate_ee_sp: 1286.04, rate_ee_ch: 1102.32, rate_fam: 1837.2, employer_contribution: "75% of employee-only", enrolled: 14 },
      { name: "Silver HMO", carrier: "Blue Shield", rate_ee: 498 },
    ];
    const m = buildManuscript({ ...DEMO_CHAMBER_DATA, medical_plans: plans }, opts);
    const tables = m.tables.filter((t) => t.field === "medical_plans");
    expect(tables.map((t) => [t.section, t.title])).toEqual([["benefits", "Current Medical Plans"]]);
    expect(tables[0].columns).toEqual(["Plan", "Carrier", "EE", "EE + spouse", "EE + child(ren)", "Family", "Employer contribution", "Enrolled"]);
    expect(tables[0].rows).toEqual([
      ["Gold PPO 500", "Blue Shield", "$612.40", "$1,286.04", "$1,102.32", "$1,837.20", "75% of employee-only", "14"],
      ["Silver HMO", "Blue Shield", "$498.00", "—", "—", "—", "—", "—"],
    ]);
    const renewing = buildManuscript({ ...DEMO_CHAMBER_DATA, medical_plans: [{ ...plans[0], renewal_rate_ee: 685.89, renewal_rate_fam: 2057.66 }, plans[1]] }, opts);
    const renewal = renewing.tables.find((t) => t.title === "Medical Renewal Rates")!;
    expect(renewal.columns).toEqual(["Plan", "EE", "EE + spouse", "EE + child(ren)", "Family"]);
    expect(renewal.rows).toEqual([["Gold PPO 500", "$685.89", "—", "—", "$2,057.66"], ["Silver HMO", "—", "—", "—", "—"]]);
    expect(m.benefitsRows.find(([, , field]) => field === "medical_plans")).toEqual(["Current Medical Plans", "2 listed", "medical_plans"]);
  });

  // K-4.2
  it("prints each state's unemployment tax rate and effective year in the payroll section", () => {
    const m = buildManuscript({ ...DEMO_CHAMBER_DATA, suta_rates: [{ state: "TX", rate: 2.7 }, { state: "CA", rate: 3.4, year: 2026 }] }, opts);
    const table = m.tables.find((t) => t.field === "suta_rates")!;
    expect([table.section, table.title]).toEqual(["payroll", "State Unemployment Tax Rates"]);
    expect(table.columns).toEqual(["State", "Rate", "Effective year"]);
    expect(table.rows).toEqual([["CA", "3.4%", "2026"], ["TX", "2.7%", "—"]]);
    expect(m.payrollRows.find(([, , field]) => field === "suta_rates")).toEqual(["State Unemployment Tax Rates", "2 listed", "suta_rates"]);
  });

  // K-3.4: every question of the form, in the form's words, so a PEO's supplemental form is already answered.
  it("prints the ACORD 130 questions with each answer and explanation, naming the form's edition", () => {
    const na = { status: "not_applicable" as const, source: { kind: "prospect_edit" as const }, updated_at: AT };
    const m = buildManuscript({ ...DEMO_CHAMBER_DATA, wcq_06: true, wcq_06_explain: "About 20% of the work", wcq_08: false }, { ...opts, provenance: { wcq_17: na } });
    const table = m.tables.find((t) => t.title === "ACORD 130 (2017/05): General Information")!;
    expect([table.section, table.columns]).toEqual(["workers_comp", ["No.", "Question", "Answer", "Explanation"]]);
    expect(table.rows).toHaveLength(24);
    expect(table.rows[5]).toEqual(["6", "ARE SUB-CONTRACTORS USED? (If \"YES\", give % of work subcontracted)", "Yes", "About 20% of the work"]);
    expect(table.rows[7]).toEqual(["8", "IS A WRITTEN SAFETY PROGRAM IN OPERATION?", "No", "—"]);
    expect(table.rows[16].slice(2)).toEqual(["Not applicable", "—"]);
    expect(table.rows[14].slice(2)).toEqual(["Not provided", "—"]);
    // An intake that never reached the questions (one certified before they existed) prints no table of blanks.
    const untouched = Object.fromEntries(Object.keys(DEMO_CHAMBER_DATA).filter((k) => k.startsWith("wcq_")).map((k) => [k, null]));
    expect(buildManuscript({ ...DEMO_CHAMBER_DATA, ...untouched }, opts).tables.map((t) => t.title)).not.toContain("ACORD 130 (2017/05): General Information");
  });

  it("shows the workers' comp block and the census class codes", () => {
    const m = buildManuscript(DEMO_CHAMBER_DATA, opts);
    expect(Object.fromEntries(m.workersCompRows.map(([label, value]) => [label, value]))).toMatchObject({
      "Current Carrier": "Pinnacle Mutual",
      "Renewal Date": "July 2026",
      "Experience Mod": "0.92",
      "Annual Premium": "$18,400",
      "Class Codes on Census": "8810 (5)",
    });
    expect(m.census[0].classCode).toBe("8810");
  });

  it("shows operations and HR answers in their own section", () => {
    const m = buildManuscript(DEMO_CHAMBER_DATA, opts);
    expect(m.operationsRows.map(([label, , field]) => [label, field])).toEqual([
      ["Employee Handbook", "has_handbook"],
      ["Handbook Last Updated", "handbook_last_updated"],
      ["In-house HR Staff", "hr_staff_count"],
      ["Physical Time Clocks", "uses_physical_clocks"],
      ["Mobile Timekeeping", "uses_mobile_app"],
      ["Computer Timekeeping", "uses_computer_timekeeping"],
      ["Shift Differentials", "shift_differentials"],
      ["HRIS", "hris_system"],
      ["Key Challenges", "key_challenges"],
      ["Business Goals", "business_goals"],
    ]);
    expect(m.operationsRows.find(([, , field]) => field === "key_challenges")?.[1]).toBe(DEMO_CHAMBER_DATA.key_challenges);
  });
});

describe("buildManuscript with missing data", () => {
  const sectionValues = (m: ReturnType<typeof buildManuscript>) =>
    [...m.companyRows, ...m.locationRows, ...m.payrollRows, ...m.workforceRows, ...m.benefitsRows, ...m.workersCompRows, ...m.operationsRows].map(([, v]) => v);

  it("says 'Not provided' for every field the prospect never gave, and makes nothing up", () => {
    const m = buildManuscript(EMPTY_CHAMBER_DATA, opts);
    const values = sectionValues(m);
    expect(values.filter((v) => v === "Not provided").length).toBeGreaterThan(30);
    expect(values).not.toContain("—");
    expect(values.filter((v) => v !== "Not provided" && v !== "0")).toEqual([]);
    expect(m.resolved).toEqual([]);
    expect(m.census).toEqual([]);
  });

  it("maps a partial intake without inventing the rest", () => {
    const m = buildManuscript({ ...EMPTY_CHAMBER_DATA, company_name: "Half Co", pay_frequency: "weekly", wc_carrier: "Acme Mutual" }, opts);
    const values = sectionValues(m);
    expect(values).toContain("Half Co");
    expect(values).toContain("weekly");
    expect(values).toContain("Acme Mutual");
    expect(values.filter((v) => !["Not provided", "0", "Half Co", "weekly", "Acme Mutual"].includes(v))).toEqual([]);
    expect(m.open).toContain("States of operation — not provided");
    expect(m.open).not.toContain("Company legal name — not provided");
  });

  it("shows an answer the prospect marked as not applying as such, not as missing", () => {
    const provenance: ProvenanceMap = {
      wc_carrier: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: AT },
      has_401k: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: AT },
    };
    const m = buildManuscript(EMPTY_CHAMBER_DATA, { ...opts, provenance });
    expect(m.workersCompRows.find(([label]) => label === "Current Carrier")?.[1]).toBe(NOT_APPLICABLE);
    expect(m.benefitsRows.find(([label]) => label === "Retirement Plan")?.[1]).toBe(NOT_APPLICABLE);
    expect(m.open.some((o) => o.startsWith("Workers' comp carrier"))).toBe(false);
  });
});

describe("buildManuscript is deterministic", () => {
  afterEach(() => vi.useRealTimers());

  it("gives the same packet for the same input, whenever it is built", () => {
    const data = { ...DEMO_CHAMBER_DATA };
    const provenance: ProvenanceMap = { company_name: confirmed, industry: { status: "inferred", source, updated_at: AT } };
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    const first = JSON.stringify(buildManuscript(data, { fileId: certified.file_id, submission: certified, provenance }));
    vi.setSystemTime(new Date("2031-12-31T23:59:59Z"));
    const second = JSON.stringify(buildManuscript(data, { fileId: certified.file_id, submission: certified, provenance }));
    expect(second).toBe(first);
  });
});

describe("buildManuscript census and state mix with gaps", () => {
  it("says 'Not provided' for blank census cells and unknown state counts", () => {
    const m = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, states: ["TX"], census: [emp({ dob: undefined, work_state: "", job_title: undefined, annual_salary: undefined })] },
      opts,
    );
    expect(m.census[0]).toMatchObject({ dob: "Not provided", state: "Not provided", title: "Not provided", salary: "Not provided", classCode: "Not provided" });
    expect(m.states).toEqual([{ state: "TX", count: "Not provided", system: "NCCI" }]);
  });

  it("shows an age when the census gave no date of birth, and marks hourly and part-time workers", () => {
    const m = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, census: [emp({ dob: undefined, age: 41, compensation_type: "hourly", employment_type: "part_time", annual_salary: 20800 })] },
      opts,
    );
    expect(m.census[0]).toMatchObject({ dob: "Age 41", salary: "$20,800 (hourly)", classification: "W-2 PT" });
    expect(maskDob(m.census[0].dob)).toBe("Age 41");
  });

  it("lists waived coverage only when the census records it", () => {
    expect(buildManuscript({ ...EMPTY_CHAMBER_DATA, census: [emp()] }, opts).dependentTiers.map((t) => t.tier)).not.toContain("Waived");
    const waived = buildManuscript({ ...EMPTY_CHAMBER_DATA, census: [emp(), emp({ id: "e2", coverage_tier: "WAIVE" })] }, opts);
    expect(waived.dependentTiers.find((t) => t.tier === "Waived")).toEqual({ tier: "Waived", count: 1, pct: "50%" });
  });

  it("shows no dependent percentages when there are no W-2 employees to divide by", () => {
    const m = buildManuscript(EMPTY_CHAMBER_DATA, opts);
    expect(m.dependentTiers.every((t) => t.pct === "Not provided")).toBe(true);
  });
});

describe("buildManuscript open items for missing core facts", () => {
  const opts = { fileId: "EAA-1", date: new Date("2026-05-01T00:00:00Z") };

  it("lists each missing core fact as an open item, with the census as a document needed", () => {
    const { open } = buildManuscript(EMPTY_CHAMBER_DATA, opts);
    for (const fact of ["Company legal name", "States of operation", "Pay frequency"]) {
      expect(open).toContain(`${fact} — not provided`);
    }
    expect(open).toContain("Employee census — document needed");
  });

  it("lists nothing for facts that were provided", () => {
    const { open } = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, company_name: "Acme", states: ["TX"], pay_frequency: "bi-weekly", census: [emp()] },
      opts,
    );
    expect(open.filter((o) => /not provided$/.test(o))).toEqual([]);
  });

  it("lists inferred, incomplete, conflicting and unknown fields as open items until resolved", () => {
    const { open } = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, industry: "Retail", states: ["CA"], employee_count: 40 },
      {
        fileId: "EAA-1",
        provenance: {
          industry: { status: "inferred", source, updated_at: AT },
          states: { status: "incomplete", source, updated_at: AT },
          employee_count: { status: "conflicting", source, updated_at: AT, candidates: [] },
          wc_experience_mod: { status: "unknown", source, updated_at: AT },
          company_name: confirmed,
        },
      },
    );
    expect(open).toEqual(expect.arrayContaining([
      "Employee count — conflicting answers",
      "States of operation — incomplete",
      "Experience mod — prospect to provide",
      "Industry — please confirm",
    ]));
    expect(open.some((o) => o.startsWith("Company legal name — please"))).toBe(false);
  });

  it("shows a verified unknown or not applicable field as it is, and a required answer in conflict still as in conflict", () => {
    const at = "2026-05-01T00:00:00Z";
    const source = { kind: "transcript" as const, message_id: "m1" };
    const { provenance, open } = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, company_name: "Acme", industry: "Retail", hq_state: "CA", employee_count: 40 },
      {
        ...opts,
        provenance: {
          start_month: { status: "unknown", source, updated_at: at },
          fein_count: { status: "not_applicable", source, updated_at: at },
          // Certification still blocks a required answer in conflict whoever verified it, so it stays one.
          company_name: { status: "conflicting", source, updated_at: at, candidates: [{ value: "Acme", source }, { value: "Acme Press", source }] },
          hq_state: { status: "conflicting", source, updated_at: at, candidates: [{ value: "CA", source }, { value: "NY", source }] },
          employee_count: { status: "inferred", source, updated_at: at },
        },
        verified: new Set(["start_month", "fein_count", "company_name", "hq_state", "employee_count"]),
      },
    );
    expect(provenance.start_month?.status).toBe("unknown");
    expect(provenance.fein_count?.status).toBe("not_applicable");
    expect(provenance.company_name?.status).toBe("conflicting");
    expect(provenance.company_name?.candidates).toHaveLength(2);
    // And it is listed as open, so nothing printed as unresolved points at an item that isn't there.
    expect(open).toContain("Company legal name — conflicting answers");
    expect(open).not.toContain("HQ state — conflicting answers");
    // An optional conflict and an inferred answer the advisor verified read as settled.
    expect(provenance.hq_state).toMatchObject({ status: "confirmed", candidates: undefined });
    expect(provenance.employee_count?.status).toBe("confirmed");
  });

  it("lists the missing required answers first, then the census, then fields by status", () => {
    const { open } = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, company_name: "Acme", industry: "Retail", states: ["CA"] },
      { fileId: "EAA-1", provenance: { industry: { status: "inferred", source, updated_at: AT }, states: { status: "incomplete", source, updated_at: AT } } },
    );
    expect(open.slice(0, 5)).toEqual([
      "Pay frequency — not provided",
      "Employee census — document needed",
      // A state of operation with no unemployment tax rate (K-4.2).
      "Unemployment tax rate, CA — rate needed",
      "States of operation — incomplete",
      "Industry — please confirm",
    ]);
  });

  it("resolves only what the prospect confirmed or applied from a document, never a check that merely passed", () => {
    const m = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, company_name: "Acme", hq_state: "NY", industry: "Retail", census: [emp()] },
      {
        fileId: "EAA-1",
        provenance: {
          company_name: confirmed,
          industry: { status: "inferred", source, updated_at: AT },
          census: { status: "confirmed", source: { kind: "document", document_id: "d1", document_name: "census.csv" }, updated_at: AT },
        },
      },
    );
    expect(m.resolved).toEqual(["Company legal name — confirmed by the prospect", "Employee census — confirmed from census.csv"]);
    // The checks that pass on unconfirmed answers are reported as checks, apart from the resolved facts.
    expect(m.checks.filter((c) => c.status === "pass").map((c) => c.label)).toEqual(["US headquarters", "Employee census captured (1 employees)"]);
    expect(m.resolved.some((r) => r.includes("headquarters"))).toBe(false);
  });

  it("shows a user-approved correction in its section, confirmed", () => {
    const m = buildManuscript({ ...EMPTY_CHAMBER_DATA, pay_frequency: "Weekly" }, { fileId: "EAA-1", provenance: { pay_frequency: confirmed } });
    expect(m.payrollRows.find(([label]) => label === "Pay Frequency")).toEqual(["Pay Frequency", "Weekly", "pay_frequency"]);
    expect(m.resolved).toContain("Pay frequency — confirmed by the prospect");
    expect(m.open.some((o) => o.startsWith("Pay frequency"))).toBe(false);
  });
});

describe("certification helpers", () => {
  it("reads a stored row into a certification state", () => {
    const sub = { signer_name: "Jo", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-1" };
    expect(certificationFromRow("in_progress", null)).toEqual({ status: "none" });
    expect(certificationFromRow("submitted", {})).toEqual({ status: "none" });
    expect(certificationFromRow("submitted", sub)).toEqual({ status: "certified", submission: sub });
    // The database withdraws a certification by flipping status; the signed record stays for the banner.
    expect(certificationFromRow("in_progress", sub)).toEqual({ status: "stale", submission: sub });
  });

  it("carries the signer's role, full signing time and consent into the manuscript", () => {
    const m = buildManuscript(EMPTY_CHAMBER_DATA, {
      fileId: "EAA-1",
      submission: { signer_name: "Jo", signer_title: "CEO", signed_at: "2026-05-01T12:34:00Z", file_id: "EAA-1", consent_text: "I agree." },
    });
    expect(m.signer).toMatchObject({ name: "Jo", title: "CEO", consent: "I agree." });
    expect(m.signer?.signedAtFull).toMatch(/May 1, 2026.*\d{1,2}:\d{2}/);
  });

  it("shows the original consent line for submissions certified before wording was stored", () => {
    const m = buildManuscript(EMPTY_CHAMBER_DATA, {
      fileId: "EAA-1",
      submission: { signer_name: "Jo", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-1" },
    });
    expect(m.signer?.consent).toBe(LEGACY_CONSENT_TEXT);
  });
});

describe("manuscriptFilename", () => {
  it("names the file after the File ID, the certification version, the company and the certified date", () => {
    expect(manuscriptFilename("EAA-2026-0042", "Meridian Creative Group", { version: 2, date: "2026-11-04T23:30:00Z" }))
      .toBe("Nevermore_Packet_EAA-2026-0042_v2_Meridian_Creative_Group_20261104.pdf");
  });

  it("is the same wherever it is generated, from the same submission", () => {
    const a = manuscriptFilename("EAA-2026-0042", "Acme", { version: 1, date: new Date("2026-11-04T23:30:00Z") });
    const b = manuscriptFilename("EAA-2026-0042", "Acme", { version: 1, date: "2026-11-04T23:30:00.000Z" });
    expect(a).toBe(b);
  });

  it("leaves the version and date out of a packet that isn't certified, and marks an advisor's version", () => {
    expect(manuscriptFilename("EAA-2026-AB12", "Meridian Creative Group")).toBe("Nevermore_Packet_EAA-2026-AB12_Meridian_Creative_Group.pdf");
    expect(manuscriptFilename("EAA-1", "Acme", { version: 1, date: AT, suffix: "advisor-v3" })).toBe("Nevermore_Packet_EAA-1_v1_Acme_20260501_advisor-v3.pdf");
  });

  it("strips characters that are unsafe in filenames and folds accents", () => {
    expect(manuscriptFilename("EAA-1", 'Acme / "Beta" <Co>: Ünïcode Søn?')).toBe("Nevermore_Packet_EAA-1_Acme_Beta_Co_Unicode_Son.pdf");
  });

  it("caps very long names and falls back when there is no usable company name", () => {
    expect(manuscriptFilename("EAA-1", "A".repeat(200)).length).toBeLessThan(80);
    expect(manuscriptFilename("EAA-1", null)).toBe("Nevermore_Packet_EAA-1_Company.pdf");
    expect(manuscriptFilename("EAA-1", "株式会社")).toBe("Nevermore_Packet_EAA-1_Company.pdf");
  });
});

describe("maskDob", () => {
  it("keeps only the year", () => {
    expect(maskDob("1990-05-17")).toBe("••/••/1990");
    expect(maskDob("unknown")).toBe("••/••/••••");
  });
});

describe("buildManuscript payroll", () => {
  const rows = (data: Parameters<typeof buildManuscript>[0]) => Object.fromEntries(buildManuscript(data, opts).payrollRows.map(([label, value]) => [label, value]));

  it("has its own section with every payroll answer captured", () => {
    const m = buildManuscript(
      {
        ...EMPTY_CHAMBER_DATA,
        payroll_vendor: "Gusto",
        pay_frequency: "bi-weekly",
        funding_days: 2,
        accrual_method: "Per pay period",
        pto_types: ["Vacation", "Sick"],
        uses_mobile_app: true,
        uses_physical_clocks: false,
        shift_differentials: false,
        hris_system: "BambooHR",
      },
      opts,
    );
    expect(Object.fromEntries(m.payrollRows.map(([label, value]) => [label, value]))).toEqual({
      "Current Payroll": "Gusto",
      "Pay Frequency": "bi-weekly",
      "Funding Lead Time": "2 days",
      "Accrual Method": "Per pay period",
      "PTO Types": "Vacation, Sick",
      "State Unemployment Tax Rates": "Not provided",
    });
    // Payroll is no longer folded into the company profile; timekeeping and the HRIS sit under Operations & HR,
    // where Review lists them.
    expect(m.companyRows.map(([label]) => label)).not.toContain("Pay Frequency");
    expect(Object.fromEntries(m.operationsRows.map(([label, value]) => [label, value]))).toMatchObject({
      "Computer Timekeeping": "Not provided",
      "Mobile Timekeeping": "Yes",
      "Physical Time Clocks": "No",
      "Shift Differentials": "No",
      HRIS: "BambooHR",
    });
  });

  it("says Not provided for each payroll answer never given", () => {
    expect(Object.values(rows(EMPTY_CHAMBER_DATA)).every((v) => v === "Not provided")).toBe(true);
    expect(rows({ ...EMPTY_CHAMBER_DATA, funding_days: 1 })["Funding Lead Time"]).toBe("1 day");
  });
});

describe("buildManuscript never passes a census default off as an answer", () => {
  const workforce = (m: ReturnType<typeof buildManuscript>) => Object.fromEntries(m.workforceRows.map(([label, value]) => [label, value]));

  it("shows a defaulted classification as Not provided, counts it apart, and lists it as open", () => {
    const m = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, census: [emp({ id: "a", assumed: ["classification"] }), emp({ id: "b" }), emp({ id: "c", classification: "1099" })] },
      opts,
    );
    expect(m.census.map((r) => r.classification)).toEqual(["Not provided", "W-2", "1099"]);
    expect(workforce(m)).toMatchObject({ "W-2 Employees on Census": "1", "1099 Contractors on Census": "1", "Classification Not Provided": "1" });
    expect(m.open).toContain("Worker classification (W-2 or 1099) — not provided for 1 of 3 people on the census");
  });

  it("has no classification row or open item when every classification was given", () => {
    const m = buildManuscript({ ...EMPTY_CHAMBER_DATA, census: [emp()] }, opts);
    expect(workforce(m)).not.toHaveProperty("Classification Not Provided");
    expect(m.open.some((o) => o.startsWith("Worker classification"))).toBe(false);
  });

  it("reports contractors from the census, and separately what the prospect said", () => {
    expect(workforce(buildManuscript({ ...EMPTY_CHAMBER_DATA, has_1099: true }, opts))).toMatchObject({ "1099 Contractors on Census": "Not provided", "1099 Contractors Reported": "Yes" });
  });

  it("lists a defaulted full-time status as open, and still shows a stated part-time one", () => {
    const m = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, census: [emp({ id: "a", assumed: ["employment_type"] }), emp({ id: "b", employment_type: "part_time" })] },
      opts,
    );
    expect(m.census.map((r) => r.classification)).toEqual(["W-2", "W-2 PT"]);
    expect(m.open).toContain("Full- or part-time status — not provided for 1 of 2 people on the census");
  });

  it("marks a year's pay estimated at full-time hours, and asks for the hours", () => {
    const m = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, census: [emp({ compensation_type: "hourly", annual_salary: 41600, assumed: ["annual_salary"] })] },
      opts,
    );
    expect(m.census[0].salary).toBe("$41,600 (hourly, est.)");
    expect(m.open).toContain("Annual pay — estimated at full-time hours for 1 of 1 people on the census; confirm their hours");
  });

  it("puts people with no tier under Not provided rather than Employee Only, and lists them as open", () => {
    const spouse = { first_name: "S", last_name: "", dob: "", relationship: "spouse" as const };
    const m = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, census: [emp({ id: "a" }), emp({ id: "b", dependents: [spouse] }), emp({ id: "c", coverage_tier: "EE" })] },
      opts,
    );
    expect(m.census.map((r) => r.tier)).toEqual(["Not provided", "Employee + Spouse", "Employee Only"]);
    expect(m.dependentTiers).toContainEqual({ tier: "Not provided", count: 1, pct: "33%" });
    expect(m.dependentTiers).toContainEqual({ tier: "Employee Only", count: 1, pct: "33%" });
    expect(m.open).toContain("Coverage tier — not provided for 1 of 3 employees");
  });

  it("only counts dependents it knows of, and says how many people that leaves out", () => {
    const spouse = { first_name: "S", last_name: "", dob: "", relationship: "spouse" as const };
    const total = (census: CensusEmployee[]) => buildManuscript({ ...EMPTY_CHAMBER_DATA, census }, opts).totalDependents;
    expect(total([])).toBe("Not provided");
    expect(total([emp({ id: "a" }), emp({ id: "b" })])).toBe("Not provided");
    expect(total([emp({ id: "a", dependents: [spouse] }), emp({ id: "b", coverage_tier: "EE" })])).toBe("1");
    expect(total([emp({ id: "a", dependents: [spouse] }), emp({ id: "b" })])).toBe("1 (not known for 1 of 2)");
    // A family tier from a census names nobody, so the count is unknown, not zero.
    expect(total([emp({ id: "a", coverage_tier: "FAM" })])).toBe("Not provided");
    expect(buildManuscript({ ...EMPTY_CHAMBER_DATA, census: [emp({ coverage_tier: "WAIVE" })] }, opts).dependentTiers.map((t) => t.tier)).not.toContain("Not provided");
  });
});

describe("rowProvenance on the census-derived rows", () => {
  const at = "2026-05-01T00:00:00Z";
  const said = { kind: "transcript" as const, message_id: "m1" };
  const conflicting = { status: "conflicting" as const, source: { kind: "document" as const, document_id: "d1" }, updated_at: at, candidates: [] };
  const row = (m: ReturnType<typeof buildManuscript>, label: string) => m.workforceRows.find((r) => r[0] === label)!;

  it("marks the counts taken from a census whose answers conflict, and nothing else, through finish()", () => {
    const data = { ...EMPTY_CHAMBER_DATA, employee_count: 40, census: [emp({ classification: "w2" }), emp({ id: "c", classification: "1099" })] };
    const m = buildManuscript(data, { fileId: "EAA-1", provenance: { census: conflicting, employee_count: { status: "inferred", source: said, updated_at: at } } });
    for (const label of ["W-2 Employees on Census", "1099 Contractors on Census"]) {
      expect(row(m, label)[3]).toEqual(["census"]);
      expect(rowProvenance(row(m, label), m.provenance)).toBe(m.provenance.census);
    }
    expect(rowProvenance(row(m, "Reported Headcount"), m.provenance)?.status).toBe("inferred");
    // Settled once an advisor verified the census: the row has no field of its own, and no conflict left to show.
    const settled = buildManuscript(data, { fileId: "EAA-1", provenance: { census: conflicting }, verified: new Set(["census"]) });
    expect(rowProvenance(row(settled, "W-2 Employees on Census"), settled.provenance)).toBeUndefined();
  });
});
