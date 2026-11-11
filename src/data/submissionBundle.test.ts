import { describe, expect, it } from "vitest";
import type { ReviewedDocument } from "./advisor";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import type { ChamberSubmission } from "./manuscript";
import type { PeoRecord } from "./peoCatalog";
import type { CertifiedIntake } from "./peoCompleteness";
import type { RequirementProfile } from "./peoProfiles";
import { bundleContents, bundleFilename, bundleSummary, planBundle, type BundleSource } from "./submissionBundle";

// Made up for the tests: no real PEO's profile, and nobody real.
const by = { source: { kind: "prospect_edit" as const }, updated_at: "2026-05-01T00:00:00Z" };
const profile = (over: Partial<RequirementProfile> = {}): RequirementProfile => ({
  version: 2,
  neededToQuote: ["company_name", "hris_system"],
  neededBeforeSigning: [],
  censusLayout: { peo: "Sample PEO", format: "csv", template: null, columns: [{ header: "Last Name", from: "last_name" }, { header: "Hire Date", from: null }] },
  documents: [
    { category: "workers_comp_loss_runs", description: "Three years of loss runs" },
    { category: "payroll_report", description: "Last quarter's payroll register" },
  ],
  rules: { minHeadcount: null, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null },
  extraQuestions: [{ key: "fleet", text: "Do you run a fleet?", kind: "yes_no" }, { key: "vans", text: "How many vans?", kind: "number" }],
  sources: {},
  publishedAt: "2026-11-01T00:00:00Z",
  ...over,
});
const samplePeo: PeoRecord = { id: 7, name: "Sample PEO", listed: true, lastVerified: "2026-11-01", profile: profile() };
const otherPeo: PeoRecord = { id: 9, name: "Other PEO", listed: true, lastVerified: "2026-11-01", profile: profile({ extraQuestions: [{ key: "secret", text: "OTHER-PEO-QUESTION", kind: "text" }] }) };

const submission: ChamberSubmission = {
  signer_name: "Jo Sample", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", certified_at: "2026-05-01T12:00:03Z",
  file_id: "EAA-2026-0042", version: 3, data_sha256: "a".repeat(64), peo: "Other PEO",
};

const intake = (over: Partial<CertifiedIntake> = {}): CertifiedIntake => ({
  data: { ...EMPTY_CHAMBER_DATA, company_name: "Meridian Creative Group", pay_frequency: "Bi-weekly", states: ["CA"],
    census: [{ id: "1", first_name: "Sarah", last_name: "Chen", work_state: "CA", compensation_type: "salary", employment_type: "full_time", classification: "w2" }] },
  provenance: { company_name: { status: "confirmed", ...by } },
  verified: new Set(),
  extraAnswers: {
    "7": { fleet: { question: "Do you run a fleet?", kind: "yes_no", value: true, status: "confirmed", ...by } },
    "9": { secret: { question: "OTHER-PEO-QUESTION", kind: "text", value: "OTHER-PEO-ANSWER", status: "confirmed", ...by } },
  },
  ...over,
});

const doc = (over: Partial<ReviewedDocument> = {}): ReviewedDocument => ({
  id: "d1", file_name: "register.xlsx", file_size: "40 KB", category: "payroll_report", status: "uploaded",
  storage_path: "u/register.xlsx", created_at: "2026-04-30T00:00:00Z", scan_verdict: "clean", certification: "certified", ...over,
});

const source = (over: Partial<BundleSource> = {}): BundleSource => ({
  audience: "advisor",
  peo: samplePeo,
  catalog: [otherPeo, samplePeo],
  intake: intake(),
  documents: [doc(), doc({ id: "d2", file_name: "loss-runs.pdf", category: "workers_comp_loss_runs", scan_verdict: "infected" })],
  submission,
  fileId: "EAA-2026-0042",
  version: 3,
  changedSince: false,
  today: "2026-11-11",
  ...over,
});

describe("planBundle: what one PEO's bundle holds, from one certified version", () => {
  it("is named for the File ID, the PEO and the certified version", () => {
    expect(bundleFilename("EAA-2026-0042", "Sample PEO", 3)).toBe("EAA-2026-0042-sample-peo-v3.zip");
    expect(bundleFilename("EAA-2026-0042", "Sample PEO", null)).toBe("EAA-2026-0042-sample-peo.zip");
    // A name with no letters or digits the slug keeps still names a file.
    expect(bundleFilename("EAA-2026-0042", "株式会社", 3)).toBe("EAA-2026-0042-peo-v3.zip");
    expect(planBundle(source()).filename).toBe("EAA-2026-0042-sample-peo-v3.zip");
  });

  it("carries only the documents the profile lists that are on file: never one blocked or still being checked", () => {
    const plan = planBundle(source({ documents: [
      doc(),
      doc({ id: "d2", file_name: "loss-runs.pdf", category: "workers_comp_loss_runs", scan_verdict: "infected" }),
      doc({ id: "d3", file_name: "loss-runs-2024.pdf", category: "workers_comp_loss_runs", scan_verdict: "pending" }),
      doc({ id: "d4", file_name: "census.xlsx", category: "employee_census" }),
    ] }));
    expect(plan.documents.map((d) => d.id)).toEqual(["d1"]);
    // The kind it requires that isn't on file is missing, with why.
    expect(plan.missing.filter((m) => m.kind === "document")).toEqual([
      { kind: "document", category: "workers_comp_loss_runs", label: "Workers' comp loss runs", description: "Three years of loss runs", reason: "Still being checked for viruses" },
    ]);
  });

  it("builds the packet for this PEO from the certified answers, and its supplement from its own answers alone", () => {
    const plan = planBundle(source());
    expect(plan.manuscript.companyName).toBe("Meridian Creative Group");
    expect(plan.manuscript.submittedTo).toBe("Sample PEO");
    expect(plan.manuscript.fileId).toBe("EAA-2026-0042");
    expect(plan.supplement?.rows).toEqual([{ question: "Do you run a fleet?", answer: "Yes" }, { question: "How many vans?", answer: null }]);
    expect(JSON.stringify(plan.supplement)).not.toMatch(/OTHER-PEO/);
    expect(JSON.stringify(plan.manuscript)).not.toMatch(/OTHER-PEO/);
    expect(plan.application.version).toBe(3);
    expect(plan.census?.blanks).toEqual(["Hire Date"]);
  });

  it("says what it holds and what is missing before the click", () => {
    expect(bundleSummary(planBundle(source()))).toBe(
      "Includes: packet, census in Sample PEO's layout, workers' comp application, Additional questions from Sample PEO, 1 document. Missing: Workers' comp loss runs, 1 answer and 1 of its own questions.",
    );
    const complete = planBundle(source({
      intake: intake({ data: { ...intake().data, hris_system: "Rippling" }, provenance: { company_name: { status: "confirmed", ...by }, hris_system: { status: "confirmed", ...by } },
        extraAnswers: { "7": { ...intake().extraAnswers!["7"], vans: { question: "How many vans?", kind: "number", value: 4, status: "confirmed", ...by } } } }),
      documents: [doc(), doc({ id: "d2", file_name: "loss-runs.pdf", category: "workers_comp_loss_runs" })],
    }));
    expect(bundleSummary(complete)).toBe("Includes: packet, census in Sample PEO's layout, workers' comp application, Additional questions from Sample PEO, 2 documents. Nothing it requires is missing.");
    const noCensus = planBundle(source({ peo: { ...samplePeo, profile: profile({ censusLayout: null, extraQuestions: [], documents: [] }) }, intake: intake({ data: { ...intake().data, census: [] } }) }));
    expect(bundleSummary(noCensus)).toBe("Includes: packet, workers' comp application. No census file: the certified version holds none. Missing: 1 answer.");
    expect(bundleContents(noCensus, { files: [], notIncluded: [] })).toContain("- CONTENTS.txt: this page\r\nNo census file: the certified version holds none.\r\n");
  });

  it("reads no profile of a PEO taken off the list: nothing it requires can be said, and it has no supplement", () => {
    const plan = planBundle(source({ peo: { ...samplePeo, listed: false } }));
    expect(plan.hasProfile).toBe(false);
    expect(plan.supplement).toBeNull();
    expect(plan.documents).toEqual([]);
    expect(plan.missing).toEqual([]);
  });

  it("leaves out a supplement it can't tell from a version certified before extra answers were kept", () => {
    const plan = planBundle(source({ intake: intake({ extraAnswers: null }) }));
    expect(plan.supplement?.cantTell).toBe(true);
    expect(bundleSummary(plan)).toMatch(/^Includes: packet, census in Sample PEO's layout, workers' comp application, 1 document\. /);
  });

  it("names the PEO's own census workbook, and ours for a PEO with no layout", () => {
    const template = profile({ censusLayout: { ...profile().censusLayout!, format: "xlsx", template: { id: 12, sheet: "Census", headerRow: 1, firstRow: 2 } } });
    expect(bundleSummary(planBundle(source({ peo: { ...samplePeo, profile: template } })))).toMatch(/^Includes: packet, Sample PEO's own census workbook, filled in, /);
    expect(bundleSummary(planBundle(source({ peo: { ...samplePeo, profile: profile({ censusLayout: null }) } })))).toMatch(/^Includes: packet, census in our layout, /);
  });
});

describe("bundleContents: the contents page, leading with what is missing", () => {
  const files = [
    { name: "Nevermore_Packet_EAA-2026-0042.pdf", what: "the packet (The Manuscript), as certified" },
    { name: "EAA-2026-0042-census-sample-peo-v3.csv", what: "the census in Sample PEO's layout" },
    { name: "documents/register.xlsx", what: "Payroll report" },
  ];

  it("names the bundle's PEO and the certified version, then what is missing, then every file, then the blanks", () => {
    const text = bundleContents(planBundle(source()), { files, notIncluded: [{ what: "register-2.xlsx (Payroll report)", why: "It couldn't be downloaded. Download it from the submission page and send it with this bundle." }] });
    const lines = text.split("\r\n");
    expect(lines.slice(0, 4)).toEqual([
      "Bundle for Sample PEO",
      "Meridian Creative Group · File ID EAA-2026-0042 · certified version 3, certified on May 1, 2026",
      "Everything in it is from certified version 3. Nothing comes from answers given since.",
      "",
    ]);
    const missing = text.slice(text.indexOf("MISSING"), text.indexOf("IN THIS BUNDLE"));
    expect(missing).toBe([
      "MISSING",
      "Documents Sample PEO requires that aren't in this bundle:",
      "- Workers' comp loss runs (Three years of loss runs): blocked by the virus check",
      "Files that could not be included:",
      "- register-2.xlsx (Payroll report): It couldn't be downloaded. Download it from the submission page and send it with this bundle.",
      "Answers Sample PEO needs to quote that the certified version doesn't hold:",
      "- HRIS system: not provided",
      "- How many vans?: not answered",
      "",
      "",
    ].join("\r\n"));
    const inBundle = text.slice(text.indexOf("IN THIS BUNDLE"), text.indexOf("LEFT BLANK"));
    expect(inBundle).toBe([
      "IN THIS BUNDLE (4 files)",
      "- CONTENTS.txt: this page",
      "- Nevermore_Packet_EAA-2026-0042.pdf: the packet (The Manuscript), as certified",
      "- EAA-2026-0042-census-sample-peo-v3.csv: the census in Sample PEO's layout",
      "- documents/register.xlsx: Payroll report",
      "",
      "",
    ].join("\r\n"));
    const blank = text.slice(text.indexOf("LEFT BLANK"));
    expect(blank).toMatch(/^LEFT BLANK\r\nCensus file, columns the intake doesn't collect: Hire Date\r\nWorkers' comp application, \d+ items not in the certified answers:\r\n- Applicant: /);
    expect(blank).toContain("\r\nAdditional questions from Sample PEO, not answered: How many vans?\r\n");
    expect(text).not.toMatch(/OTHER-PEO|Other PEO/);
  });

  it("says when the prospect has changed answers since, and that the files are still the certified version", () => {
    const text = bundleContents(planBundle(source({ changedSince: true })), { files, notIncluded: [] });
    expect(text.split("\r\n")[2]).toBe("The prospect has changed answers since certifying. These files are from version 3.");
  });

  it("says plainly when nothing it requires is missing", () => {
    const plan = planBundle(source({ peo: { ...samplePeo, profile: profile({ neededToQuote: [], documents: [], extraQuestions: [] }) } }));
    expect(bundleContents(plan, { files, notIncluded: [] })).toContain("MISSING\r\nNothing Sample PEO requires is missing.\r\n");
  });

  it("can't say what a PEO without a profile requires, and says so", () => {
    const plan = planBundle(source({ peo: { name: "Typed In PEO" }, catalog: [] }));
    expect(plan.documents).toEqual([]);
    expect(bundleContents(plan, { files, notIncluded: [] })).toContain("MISSING\r\nTyped In PEO has no profile yet, so we can't say what it requires.\r\n");
  });
});

describe("the prospect's bundle: only what they could already download", () => {
  it("never says nothing is missing while the PEO asks for documents they must add themselves", () => {
    const complete = intake({ data: { ...intake().data, hris_system: "Rippling" }, provenance: { company_name: { status: "confirmed", ...by }, hris_system: { status: "confirmed", ...by } },
      extraAnswers: { "7": { ...intake().extraAnswers!["7"], vans: { question: "How many vans?", kind: "number", value: 4, status: "confirmed", ...by } } } });
    expect(bundleSummary(planBundle(source({ audience: "prospect", intake: complete })))).toBe(
      "Includes: packet, census in Sample PEO's layout, workers' comp application, Additional questions from Sample PEO. Not included: the documents Sample PEO asks for (Workers' comp loss runs, Payroll report). Add your own copies when you send it.",
    );
    expect(bundleSummary(planBundle(source({ audience: "prospect", intake: complete, peo: { ...samplePeo, profile: profile({ documents: [] }) } })))).toMatch(/Nothing it requires is missing\.$/);
  });

  it("holds no documents, and names those the PEO asks for, for them to add", () => {
    const plan = planBundle(source({ audience: "prospect" }));
    expect(plan.documents).toEqual([]);
    expect(bundleSummary(plan)).toBe(
      "Includes: packet, census in Sample PEO's layout, workers' comp application, Additional questions from Sample PEO. Not included: the documents Sample PEO asks for (Workers' comp loss runs, Payroll report). Add your own copies when you send it. Missing: 1 answer and 1 of its own questions.",
    );
    const text = bundleContents(plan, { files: [], notIncluded: [] });
    expect(text).toContain([
      "MISSING",
      "Documents Sample PEO asks for, not in this bundle. Add the copies you have when you send it:",
      "- Workers' comp loss runs (Three years of loss runs)",
      "- Payroll report (Last quarter's payroll register)",
      "Answers Sample PEO needs to quote that the certified version doesn't hold:",
      "- HRIS system: not provided",
      "- How many vans?: not answered",
    ].join("\r\n"));
  });
});
