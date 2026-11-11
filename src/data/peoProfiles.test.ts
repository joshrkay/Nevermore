import { describe, expect, it } from "vitest";
import { isProfileStale, parsePeoCatalog, staleProfileWarning } from "./peoProfiles";

// What public.peo_catalog() returns (20261111090000): each PEO alphabetically, with its newest published version.
const TRINET_ROW = {
  id: 5,
  name: "TriNet",
  listed: true,
  profile: {
    id: 12,
    version: 2,
    needed_to_quote: ["company_name", "states", "census"],
    needed_before_signing: ["payroll_vendor"],
    census_layout: {
      format: "xlsx",
      template_file: null,
      columns: [
        { header: "Last Name", from: "last_name" },
        { header: "SSN", from: null },
      ],
    },
    documents: [{ category: "workers_comp_loss_runs", description: "Three years of loss runs" }],
    min_headcount: 5,
    states_served: ["CA", "NY"],
    excluded_industries: ["Trucking"],
    excluded_class_codes: ["7219"],
    min_enrolment_percent: 75,
    extra_questions: [
      { key: "uses_drivers", text: "Do any employees drive for work?", kind: "yes_no" },
      { key: "union", text: "Which union?", kind: "choice", choices: ["None", "Teamsters"] },
    ],
    // Each part with its own source and date (the contacts' source never reaches the browser).
    sources: {
      min_headcount: { kind: "person", name: "Dana Reyes", role: "Broker desk manager", checked_on: "2026-11-02" },
      excluded_industries: { kind: "document", name: "Broker guide 2026", link: "https://trinet.example/guide.pdf", checked_on: "2026-09-01" },
      answers: { kind: "document", name: "Broker guide 2026", checked_on: "2026-10-20" },
    },
    published_at: "2026-11-03T10:00:00+00:00",
  },
};

describe("parsePeoCatalog", () => {
  it("reads a PEO with no published profile as one with no facts: nothing is guessed", () => {
    expect(parsePeoCatalog([{ id: 1, name: "ADP TotalSource", profile: null }])).toEqual([
      { id: 1, name: "ADP TotalSource", listed: true, minHeadcount: null, statesServed: null, excludedClassCodes: null, lastVerified: null, profile: null },
    ]);
  });

  it("reads the profile in use: its rules for the fit checks, the rest as the profile says", () => {
    const [trinet] = parsePeoCatalog([TRINET_ROW]);
    // Checked as long ago as its oldest sourced part.
    expect(trinet).toMatchObject({ id: 5, name: "TriNet", listed: true, minHeadcount: 5, statesServed: ["CA", "NY"], excludedClassCodes: ["7219"], lastVerified: "2026-09-01" });
    expect(trinet.profile).toEqual({
      version: 2,
      neededToQuote: ["company_name", "states", "census"],
      neededBeforeSigning: ["payroll_vendor"],
      censusLayout: { peo: "TriNet", format: "xlsx", templateFile: null, columns: [{ header: "Last Name", from: "last_name" }, { header: "SSN", from: null }] },
      documents: [{ category: "workers_comp_loss_runs", description: "Three years of loss runs" }],
      rules: { minHeadcount: 5, statesServed: ["CA", "NY"], excludedIndustries: ["Trucking"], excludedClassCodes: ["7219"], minEnrolmentPercent: 75 },
      extraQuestions: [
        { key: "uses_drivers", text: "Do any employees drive for work?", kind: "yes_no" },
        { key: "union", text: "Which union?", kind: "choice", choices: ["None", "Teamsters"] },
      ],
      sources: {
        min_headcount: { kind: "person", name: "Dana Reyes", role: "Broker desk manager", checkedOn: "2026-11-02" },
        excluded_industries: { kind: "document", name: "Broker guide 2026", link: "https://trinet.example/guide.pdf", checkedOn: "2026-09-01" },
        answers: { kind: "document", name: "Broker guide 2026", checkedOn: "2026-10-20" },
      },
      publishedAt: "2026-11-03T10:00:00+00:00",
    });
  });

  it("reads a person at the PEO whose name the catalog leaves out (anyone but an advisor) as their role and date only", () => {
    const [trinet] = parsePeoCatalog([{ ...TRINET_ROW, profile: { ...TRINET_ROW.profile, sources: {
      min_headcount: { kind: "person", role: "Broker desk manager", checked_on: "2026-11-02" },
      // A document is always named by its title: one with none isn't a source.
      states_served: { kind: "document", checked_on: "2026-01-01" },
    } } }]);
    expect(trinet.profile?.sources).toEqual({ min_headcount: { kind: "person", name: null, role: "Broker desk manager", checkedOn: "2026-11-02" } });
    expect(trinet.lastVerified).toBe("2026-11-02");
  });

  it("reads a PEO an admin stopped listing as not listed, with its profile still there", () => {
    const [trinet] = parsePeoCatalog([{ ...TRINET_ROW, listed: false }]);
    expect(trinet.listed).toBe(false);
    expect(trinet.minHeadcount).toBe(5);
  });

  it("keeps the database's order, which is alphabetical", () => {
    const names = parsePeoCatalog([{ id: 1, name: "Acme PEO", profile: null }, TRINET_ROW]).map((p) => p.name);
    expect(names).toEqual(["Acme PEO", "TriNet"]);
  });

  it("reads anything but a list of PEOs as no PEOs, and leaves out an entry with no name", () => {
    for (const raw of [null, undefined, "TriNet", { id: 1 }]) expect(parsePeoCatalog(raw)).toEqual([]);
    expect(parsePeoCatalog([{ id: 1, name: "" }, { id: 2 }, 7]).length).toBe(0);
  });
});

describe("profile staleness", () => {
  // 2026-05-14 is 180 days before 2026-11-10.
  it("is stale when its oldest sourced part was checked more than 180 days ago", () => {
    expect(isProfileStale("2026-05-14", "2026-11-10")).toBe(false);
    expect(isProfileStale("2026-05-13", "2026-11-10")).toBe(true);
    expect(isProfileStale("2026-11-10", "2026-11-10")).toBe(false);
  });

  it("is never stale with nothing checked: that is no profile, not an old one", () => {
    expect(isProfileStale(null, "2026-11-10")).toBe(false);
  });

  it("warns with the date the PEO's profile was last checked, only when it is stale", () => {
    const [trinet] = parsePeoCatalog([TRINET_ROW]);
    expect(staleProfileWarning(trinet, "2027-03-01")).toBe("TriNet's profile was last checked 1 Sep 2026 and may be out of date.");
    expect(staleProfileWarning(trinet, "2026-11-10")).toBeNull();
    expect(staleProfileWarning({ name: "TriNet", lastVerified: null }, "2030-01-01")).toBeNull();
  });
});
