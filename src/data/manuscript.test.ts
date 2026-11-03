import { describe, expect, it } from "vitest";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "./chamberTypes";
import type { CensusEmployee } from "./chamberTypes";
import {
  buildManuscript,
  CERTIFICATION_CONSENT_VERSION,
  certificationConsent,
  certificationFromRow,
  coverageTier,
  eligibilityChecks,
  employeeFlag,
  fileIdForSession,
  LEGACY_CONSENT_TEXT,
  manuscriptFilename,
  maskDob,
  wcSystem,
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

describe("fileIdForSession", () => {
  it("is stable for a session", () => {
    const id = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
    const date = new Date("2026-05-01T00:00:00Z");
    expect(fileIdForSession(id, date)).toBe("EAA-2026-0F1E2D3C");
    expect(fileIdForSession(id, date)).toBe(fileIdForSession(id, date));
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
    const peo = { name: "Example PEO", minHeadcount: 10, statesServed: null, lastVerified: "2026-10-01" };
    const [headcount] = eligibilityChecks({ ...EMPTY_CHAMBER_DATA, employee_count: 3 }, peo);
    expect(headcount.status).toBe("fail");
    expect(headcount.label).toBe("Headcount meets Example PEO minimum (3 of 10 employees)");
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
    const m = buildManuscript(DEMO_CHAMBER_DATA, { fileId: "EAA-SAMPLE" });
    const total = m.dependentTiers.reduce((sum, t) => sum + t.count, 0);
    expect(total).toBe(DEMO_CHAMBER_DATA.census.filter((e) => e.classification === "w2").length);
    expect(m.totalDependents).toBe("6");
    expect(m.open.some((o) => o.includes("Workers' comp"))).toBe(true);
    expect(m.signer).toBeNull();
  });
});

describe("buildManuscript with missing data", () => {
  const sectionValues = (m: ReturnType<typeof buildManuscript>) =>
    [...m.companyRows, ...m.payrollRows, ...m.workforceRows, ...m.benefitsRows].map(([, v]) => v);

  it("says 'Not provided' for every field the prospect never gave", () => {
    const m = buildManuscript(EMPTY_CHAMBER_DATA, { fileId: "EAA-1", date: new Date("2026-05-01T00:00:00Z") });
    const values = sectionValues(m);
    expect(values).toContain("Not provided");
    expect(values).not.toContain("—");
  });
});

describe("buildManuscript census and state mix with gaps", () => {
  it("says 'Not provided' for blank census cells and unknown state counts", () => {
    const m = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, states: ["TX"], census: [emp({ dob: undefined, work_state: "", job_title: undefined, annual_salary: undefined })] },
      { fileId: "EAA-1", date: new Date("2026-05-01T00:00:00Z") },
    );
    expect(m.census[0]).toMatchObject({ dob: "Not provided", state: "Not provided", title: "Not provided", salary: "Not provided" });
    expect(m.states).toEqual([{ state: "TX", count: "Not provided", system: "NCCI" }]);
  });

  it("shows an age when the census gave no date of birth, and marks hourly and part-time workers", () => {
    const m = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, census: [emp({ dob: undefined, age: 41, compensation_type: "hourly", employment_type: "part_time", annual_salary: 20800 })] },
      { fileId: "EAA-1", date: new Date("2026-05-01T00:00:00Z") },
    );
    expect(m.census[0]).toMatchObject({ dob: "Age 41", salary: "$20,800 (hourly)", classification: "W-2 PT" });
    expect(maskDob(m.census[0].dob)).toBe("Age 41");
  });

  it("lists waived coverage only when the census records it", () => {
    const opts = { fileId: "EAA-1", date: new Date("2026-05-01T00:00:00Z") };
    expect(buildManuscript({ ...EMPTY_CHAMBER_DATA, census: [emp()] }, opts).dependentTiers.map((t) => t.tier)).not.toContain("Waived");
    const waived = buildManuscript({ ...EMPTY_CHAMBER_DATA, census: [emp(), emp({ id: "e2", coverage_tier: "WAIVE" })] }, opts);
    expect(waived.dependentTiers.find((t) => t.tier === "Waived")).toEqual({ tier: "Waived", count: 1, pct: "50%" });
  });

  it("shows no dependent percentages when there are no W-2 employees to divide by", () => {
    const m = buildManuscript(EMPTY_CHAMBER_DATA, { fileId: "EAA-1", date: new Date("2026-05-01T00:00:00Z") });
    expect(m.dependentTiers.every((t) => t.pct === "Not provided")).toBe(true);
  });
});

describe("buildManuscript open items for missing core facts", () => {
  const opts = { fileId: "EAA-1", date: new Date("2026-05-01T00:00:00Z") };

  it("lists each missing core fact as an open item", () => {
    const { open } = buildManuscript(EMPTY_CHAMBER_DATA, opts);
    for (const fact of ["Company legal name", "States of operation", "Pay frequency", "Employee census"]) {
      expect(open).toContain(`${fact} — not provided`);
    }
  });

  it("lists nothing for facts that were provided", () => {
    const { open } = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, company_name: "Acme", states: ["TX"], pay_frequency: "bi-weekly", census: [emp()] },
      opts,
    );
    expect(open.filter((o) => /not provided$/.test(o))).toEqual([]);
  });

  it("lists inferred, incomplete and conflicting fields as open items until resolved", () => {
    const at = "2026-05-01T00:00:00Z";
    const source = { kind: "transcript" as const, message_id: "m1" };
    const { open } = buildManuscript(
      { ...EMPTY_CHAMBER_DATA, industry: "Retail", states: ["CA"], employee_count: 40 },
      {
        fileId: "EAA-1",
        provenance: {
          industry: { status: "inferred", source, updated_at: at },
          states: { status: "incomplete", source, updated_at: at },
          employee_count: { status: "conflicting", source, updated_at: at, candidates: [] },
          company_name: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: at },
        },
      },
    );
    expect(open).toEqual(expect.arrayContaining([
      "Employee count — conflicting answers",
      "States of operation — incomplete",
      "Industry — please confirm",
    ]));
    expect(open.some((o) => o.startsWith("Company legal name — please"))).toBe(false);
  });
});

describe("certification helpers", () => {
  it("states the consent wording, including the re-certification rule", () => {
    const c = certificationConsent({ companyName: "Acme", peo: "Some PEO" });
    expect(c.statements).toHaveLength(3);
    expect(c.statements[2]).toContain("Some PEO");
    expect(c.signing).toContain("authorized representative of Acme");
    expect(c.signing).toContain("requires me to certify again");
    expect(c.text).toBe([...c.statements, c.signing].join("\n"));
    expect(c.version).toBe(CERTIFICATION_CONSENT_VERSION);
  });

  it("falls back to neutral wording when the company or PEO isn't known yet", () => {
    const c = certificationConsent({ companyName: " ", peo: null });
    expect(c.statements[2]).toContain("the PEO I choose");
    expect(c.signing).toContain("representative of my company");
  });

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
  it("includes the submission id and the company name", () => {
    expect(manuscriptFilename("EAA-2026-AB12", "Meridian Creative Group")).toBe("The_Manuscript_EAA-2026-AB12_Meridian_Creative_Group.pdf");
  });

  it("strips characters that are unsafe in filenames and folds accents", () => {
    expect(manuscriptFilename("EAA-1", 'Acme / "Beta" <Co>: Ünïcode Søn?')).toBe("The_Manuscript_EAA-1_Acme_Beta_Co_Unicode_Son.pdf");
  });

  it("caps very long names and falls back when there is no usable company name", () => {
    expect(manuscriptFilename("EAA-1", "A".repeat(200)).length).toBeLessThan(80);
    expect(manuscriptFilename("EAA-1", null)).toBe("The_Manuscript_EAA-1_Company.pdf");
    expect(manuscriptFilename("EAA-1", "株式会社")).toBe("The_Manuscript_EAA-1_Company.pdf");
  });
});

describe("maskDob", () => {
  it("keeps only the year", () => {
    expect(maskDob("1990-05-17")).toBe("••/••/1990");
    expect(maskDob("unknown")).toBe("••/••/••••");
  });
});

describe("buildManuscript payroll", () => {
  const opts = { fileId: "EAA-1", date: new Date("2026-05-01T00:00:00Z") };
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
      Timekeeping: "Mobile app",
      "Shift Differentials": "No",
      HRIS: "BambooHR",
    });
    // Payroll is no longer folded into the company profile.
    expect(m.companyRows.map(([label]) => label)).not.toContain("Pay Frequency");
  });

  it("says Not provided for each payroll answer never given, and for timekeeping it can't tell", () => {
    expect(Object.values(rows(EMPTY_CHAMBER_DATA)).every((v) => v === "Not provided")).toBe(true);
    expect(rows({ ...EMPTY_CHAMBER_DATA, uses_computer_timekeeping: false }).Timekeeping).toBe("Not provided");
    expect(rows({ ...EMPTY_CHAMBER_DATA, uses_computer_timekeeping: false, uses_mobile_app: false, uses_physical_clocks: false }).Timekeeping)
      .toBe("None of computer, mobile app or time clock");
    expect(rows({ ...EMPTY_CHAMBER_DATA, funding_days: 1 })["Funding Lead Time"]).toBe("1 day");
  });
});

describe("buildManuscript never passes a census default off as an answer", () => {
  const opts = { fileId: "EAA-1", date: new Date("2026-05-01T00:00:00Z") };
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
