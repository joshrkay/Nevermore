// issueBundleLink (slice 6.6b; ADR 0003): the advisor's bundle as separate files behind a link, the storage and the database faked.
import { describe, expect, it, vi } from "vitest";
import type { ReviewedDocument } from "@/data/advisor";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { certifiedAnswersDocument } from "@/data/certifiedAnswersDocument";
import type { ChamberSubmission } from "@/data/manuscript";
import type { PeoRecord } from "@/data/peoCatalog";
import type { CertifiedIntake } from "@/data/peoCompleteness";
import type { RequirementProfile } from "@/data/peoProfiles";
import { planBundle, type BundleSource } from "@/data/submissionBundle";
import { blobBytes } from "@/test/blob";
import { issueBundleLink, type IssueBundleLinkDeps } from "./bundleLink";

// Made up for the tests: no real PEO's profile, and nobody real.
const by = { source: { kind: "prospect_edit" as const }, updated_at: "2026-05-01T00:00:00Z" };
const profile: RequirementProfile = {
  version: 2,
  neededToQuote: ["company_name", "fein"],
  neededBeforeSigning: [],
  censusLayout: { peo: "Sample PEO", format: "csv", template: null, columns: [{ header: "Last Name", from: "last_name" }] },
  documents: [{ category: "payroll_report", description: "Last quarter's payroll register" }, { category: "workers_comp_loss_runs", description: "Three years of loss runs" }],
  rules: { minHeadcount: null, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null },
  extraQuestions: [],
  sources: {},
  publishedAt: "2026-11-01T00:00:00Z",
};
const samplePeo: PeoRecord = { id: 7, name: "Sample PEO", listed: true, lastVerified: "2026-11-01", profile };
const submission: ChamberSubmission = {
  signer_name: "Jo Sample", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", certified_at: "2026-05-01T12:00:03Z",
  file_id: "EAA-2026-0042", version: 3, data_sha256: "a".repeat(64), peo: "Sample PEO",
};
const intake: CertifiedIntake = {
  data: { ...EMPTY_CHAMBER_DATA, company_name: "Meridian Creative Group", states: ["CA"],
    census: [{ id: "1", first_name: "Sarah", last_name: "Chen", work_state: "CA", compensation_type: "salary", employment_type: "full_time", classification: "w2" }] },
  provenance: { company_name: { status: "confirmed", ...by } },
  verified: new Set(),
  extraAnswers: {},
};
const doc: ReviewedDocument = {
  id: "d1", file_name: "register.xlsx", file_size: "40 KB", category: "payroll_report", status: "uploaded",
  storage_path: "u/s/register.xlsx", created_at: "2026-04-30T00:00:00Z", scan_verdict: "clean", certification: "certified",
};
const source: BundleSource = {
  audience: "advisor", peo: samplePeo, catalog: [samplePeo], intake, documents: [doc],
  submission, fileId: "EAA-2026-0042", version: 3, changedSince: false, today: "2026-11-11",
};
const answers = certifiedAnswersDocument({ data: intake.data, provenance: intake.provenance, submission, fileId: "EAA-2026-0042" });

function fakes(o: { uploadFails?: (path: string) => boolean } = {}) {
  const uploads = new Map<string, Blob>();
  const issued: Record<string, unknown>[] = [];
  const deps: IssueBundleLinkDeps = {
    readTemplate: async () => null,
    upload: vi.fn(async (path: string, blob: Blob) => {
      if (o.uploadFails?.(path)) throw new Error("storage said no");
      uploads.set(path, blob);
    }),
    issue: vi.fn(async (args: Record<string, unknown>) => {
      issued.push(args);
      return { id: 5, token: "T".repeat(43), expires_at: "2026-12-11T00:00:00Z", version: 3 };
    }),
    newFolder: () => "6f1c2d3e-0000-4000-8000-000000000001",
    origin: "https://app.example.test",
  };
  return { deps, uploads, issued };
}

describe("issueBundleLink", () => {
  // Catches: a link whose files are not where the database looks for them (<quote request>/<folder>/<n>-<name>, n its place in the list), a
  // document copied when it should be named, the answers left out, or the open items not stored with the link.
  it("stores each made file under the link's folder, names the documents, and issues the link with the open items", async () => {
    const f = fakes();
    const link = await issueBundleLink({ quoteRequestId: 11, plan: planBundle(source), answers }, f.deps);
    const folder = "11/6f1c2d3e-0000-4000-8000-000000000001";
    expect([...f.uploads.keys()]).toEqual([
      `${folder}/1-Nevermore_Packet_EAA-2026-0042_v3_Meridian_Creative_Group_20260501.pdf`,
      `${folder}/2-EAA-2026-0042-census-sample-peo-v3.csv`,
      `${folder}/3-EAA-2026-0042-workers-comp-application-v3.pdf`,
      `${folder}/4-EAA-2026-0042-answers-v3.json`,
    ]);
    expect(JSON.parse(new TextDecoder().decode(await blobBytes(f.uploads.get(`${folder}/4-EAA-2026-0042-answers-v3.json`)!)))).toEqual(answers);
    expect(f.issued).toEqual([{
      p_quote_request_id: 11,
      p_version: 3,
      p_folder: "6f1c2d3e-0000-4000-8000-000000000001",
      p_files: [
        { name: "Nevermore_Packet_EAA-2026-0042_v3_Meridian_Creative_Group_20260501.pdf", what: "The packet, as certified, dates of birth masked" },
        { name: "EAA-2026-0042-census-sample-peo-v3.csv", what: "The census in Sample PEO's layout" },
        { name: "EAA-2026-0042-workers-comp-application-v3.pdf", what: "Workers' comp application data, our own summary in the standard application's order" },
        { name: "EAA-2026-0042-answers-v3.json", what: "The certified answers as JSON" },
        { name: "register.xlsx", what: "Payroll report", document_id: "d1" },
      ],
      p_open_items: ["FEIN", "Workers' comp loss runs"],
    }]);
    expect(link).toEqual({ url: `https://app.example.test/b/${"T".repeat(43)}`, expiresAt: "2026-12-11T00:00:00Z", version: 3, notIncluded: [] });
  });

  // Catches: a link issued while one of its files never reached storage, so the PEO opens a page whose Download fails.
  it("issues no link when a file can't be stored, and says so", async () => {
    const f = fakes({ uploadFails: (path) => path.includes("/3-") });
    await expect(issueBundleLink({ quoteRequestId: 11, plan: planBundle(source), answers }, f.deps)).rejects.toThrow("We couldn't store the bundle's files. Try again.");
    expect(f.issued).toEqual([]);
  });
});
