import { describe, expect, it } from "vitest";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "./chamberTypes";
import type { ChamberEmployee } from "./chamberTypes";
import { buildManuscript, coverageTier, eligibilityChecks, employeeFlag, fileIdForSession, wcSystem } from "./manuscript";

const emp = (overrides: Partial<ChamberEmployee> = {}): ChamberEmployee => ({
  first_name: "A",
  last_name: "B",
  dob: "1990-01-01",
  state: "TX",
  title: "Designer",
  salary: 50000,
  classification: "W2",
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
    expect(employeeFlag(emp({ classification: "1099", state: "CA" }))).toMatch(/AB5/);
    expect(employeeFlag(emp({ title: "Account Executive" }))).toMatch(/outside sales/);
    expect(employeeFlag(emp())).toBeNull();
  });
});

describe("coverageTier", () => {
  it("derives the tier from dependents", () => {
    const spouse = { first_name: "S", last_name: "", dob: "", relationship: "spouse" as const };
    const child = { first_name: "C", last_name: "", dob: "", relationship: "child" as const };
    expect(coverageTier(emp())).toBe("Employee Only");
    expect(coverageTier(emp({ dependents: [spouse] }))).toBe("Employee + Spouse");
    expect(coverageTier(emp({ dependents: [child] }))).toBe("Employee + Child(ren)");
    expect(coverageTier(emp({ dependents: [spouse, child] }))).toBe("Employee + Family");
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
      { ...EMPTY_CHAMBER_DATA, company_name: "Acme Robotics", states: ["OH"], employees: [emp({ state: "OH" })] },
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
    expect(total).toBe(DEMO_CHAMBER_DATA.employees.filter((e) => e.classification === "W2").length);
    expect(m.totalDependents).toBe(6);
    expect(m.open.some((o) => o.includes("Workers' comp"))).toBe(true);
    expect(m.signer).toBeNull();
  });
});

describe("buildManuscript with missing data", () => {
  const sectionValues = (m: ReturnType<typeof buildManuscript>) =>
    [...m.companyRows, ...m.workforceRows, ...m.benefitsRows].map(([, v]) => v);

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
      { ...EMPTY_CHAMBER_DATA, states: ["TX"], employees: [emp({ dob: "", state: "", title: "", salary: null })] },
      { fileId: "EAA-1", date: new Date("2026-05-01T00:00:00Z") },
    );
    expect(m.census[0]).toMatchObject({ dob: "Not provided", state: "Not provided", title: "Not provided", salary: "Not provided" });
    expect(m.states).toEqual([{ state: "TX", count: "Not provided", system: "NCCI" }]);
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
      { ...EMPTY_CHAMBER_DATA, company_name: "Acme", states: ["TX"], pay_frequency: "bi-weekly", employees: [emp()] },
      opts,
    );
    expect(open.filter((o) => /not provided$/.test(o))).toEqual([]);
  });
});
