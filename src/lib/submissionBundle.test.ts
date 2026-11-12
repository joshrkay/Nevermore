import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import type { ReviewedDocument } from "@/data/advisor";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { ChamberSubmission } from "@/data/manuscript";
import type { PeoRecord } from "@/data/peoCatalog";
import type { CertifiedIntake } from "@/data/peoCompleteness";
import type { RequirementProfile } from "@/data/peoProfiles";
import { certifiedAnswersDocument } from "@/data/certifiedAnswersDocument";
import { bundleSummary, planBundle, type BundleSource } from "@/data/submissionBundle";
import { blobBytes, inflatedPdf } from "@/test/blob";
import { unzip } from "@/test/zip";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBundle, safeFileName } from "./submissionBundle";

// Made up for the tests: no real PEO's profile, and nobody real.
const by = { source: { kind: "prospect_edit" as const }, updated_at: "2026-05-01T00:00:00Z" };
const profile = (over: Partial<RequirementProfile> = {}): RequirementProfile => ({
  version: 2,
  neededToQuote: ["company_name"],
  neededBeforeSigning: [],
  censusLayout: { peo: "Sample PEO", format: "csv", template: null, columns: [{ header: "Last Name", from: "last_name" }, { header: "Hire Date", from: null }] },
  documents: [
    { category: "workers_comp_loss_runs", description: "Three years of loss runs" },
    { category: "payroll_report", description: "Last quarter's payroll register" },
  ],
  rules: { minHeadcount: null, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null },
  extraQuestions: [{ key: "fleet", text: "Do you run a fleet?", kind: "yes_no" }],
  sources: {},
  publishedAt: "2026-11-01T00:00:00Z",
  ...over,
});
const samplePeo: PeoRecord = { id: 7, name: "Sample PEO", listed: true, lastVerified: "2026-11-01", profile: profile() };
// Another PEO whose own question the prospect answered too (an advisor's request asked it).
const otherPeo: PeoRecord = { id: 9, name: "Other PEO", listed: true, lastVerified: "2026-11-01", profile: profile({ extraQuestions: [{ key: "secret", text: "OTHERPEOQUESTION", kind: "text" }] }) };

const submission: ChamberSubmission = {
  signer_name: "Jo Sample", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", certified_at: "2026-05-01T12:00:03Z",
  file_id: "EAA-2026-0042", version: 3, data_sha256: "a".repeat(64), peo: "Other PEO",
};
const intake: CertifiedIntake = {
  data: { ...EMPTY_CHAMBER_DATA, company_name: "Meridian Creative Group", pay_frequency: "Bi-weekly", states: ["CA"],
    census: [{ id: "1", first_name: "Sarah", last_name: "Chen", work_state: "CA", compensation_type: "salary", employment_type: "full_time", classification: "w2" }] },
  provenance: { company_name: { status: "confirmed", ...by } },
  verified: new Set(),
  extraAnswers: {
    "7": { fleet: { question: "Do you run a fleet?", kind: "yes_no", value: true, status: "confirmed", ...by } },
    "9": { secret: { question: "OTHERPEOQUESTION", kind: "text", value: "OTHERPEOANSWER", status: "confirmed", ...by } },
  },
};
const doc = (over: Partial<ReviewedDocument> = {}): ReviewedDocument => ({
  id: "d1", file_name: "register.xlsx", file_size: "40 KB", category: "payroll_report", status: "uploaded",
  storage_path: "u/register.xlsx", created_at: "2026-04-30T00:00:00Z", scan_verdict: "clean", certification: "certified", ...over,
});
const source = (over: Partial<BundleSource> = {}): BundleSource => ({
  audience: "advisor", peo: samplePeo, catalog: [otherPeo, samplePeo], intake,
  documents: [doc(), doc({ id: "d2", file_name: "loss-runs.pdf", storage_path: "u/loss-runs.pdf", category: "workers_comp_loss_runs" })],
  submission, fileId: "EAA-2026-0042", version: 3, changedSince: false, today: "2026-11-11", ...over,
});

const bytesOf = (text: string) => new TextEncoder().encode(text);
const files: Record<string, Uint8Array> = { "u/register.xlsx": bytesOf("REGISTER-BYTES"), "u/loss-runs.pdf": bytesOf("%PDF-LOSS-RUNS") };
const fetchDocument = vi.fn(async (d: ReviewedDocument) => {
  if (!files[d.storage_path]) throw new Error("Couldn't open that file.");
  return new Blob([files[d.storage_path] as Uint8Array<ArrayBuffer>]);
});
const deps = { readTemplate: async () => null, fetchDocument };
const latin1 = (b: Uint8Array) => new TextDecoder("latin1").decode(b);
// Any file of the zip as text: a PDF with its compressed streams opened.
const readable = (b: Uint8Array) => (latin1(b).startsWith("%PDF-1") ? inflatedPdf(b) : latin1(b));
const partsOf = async (blob: Blob) => unzip(await blobBytes(blob)).map((p) => ({ name: p.name, data: p.data as Uint8Array }));

describe("buildBundle: one zip of a PEO's files from one certified version", () => {
  it("holds the contents page first, then the packet, census, application, supplement and documents, each named for version 3", async () => {
    const built = await buildBundle(planBundle(source()), deps);
    expect(built.filename).toBe("EAA-2026-0042-sample-peo-v3.zip");
    expect(built.blob.type).toBe("application/zip");
    const parts = await partsOf(built.blob);
    expect(parts.map((p) => p.name)).toEqual([
      "CONTENTS.txt",
      "Nevermore_Packet_EAA-2026-0042_v3_Meridian_Creative_Group_20260501.pdf",
      "EAA-2026-0042-census-sample-peo-v3.csv",
      "EAA-2026-0042-workers-comp-application-v3.pdf",
      "EAA-2026-0042-additional-questions-sample-peo-v3.pdf",
      "documents/register.xlsx",
      "documents/loss-runs.pdf",
    ]);
    expect(new TextDecoder().decode(parts[2].data)).toBe("Last Name,Hire Date\r\nChen,\r\n");
    expect(latin1(parts[5].data)).toBe("REGISTER-BYTES");
    expect(latin1(parts[6].data)).toBe("%PDF-LOSS-RUNS");
    // The contents page names every file, and is the zip's comment too, so a listing shows it first.
    // UTF-8 with a byte order mark, so an editor that guesses reads "·" and accented names right.
    expect([...parts[0].data.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const contents = new TextDecoder().decode(parts[0].data);
    expect(contents).toBe(built.contents);
    for (const p of parts) expect(contents).toContain(`- ${p.name}: `);
    expect(contents).toContain("- documents/register.xlsx: Payroll report");
    expect(contents).toContain("certified version 3, certified on May 1, 2026");
    expect(built.notIncluded).toEqual([]);
    const zip = await blobBytes(built.blob);
    expect(new TextDecoder().decode(zip.subarray(zip.length - bytesOf(contents).length))).toBe(contents);
  });

  it("never carries another PEO's own questions or answers in any file", async () => {
    const parts = await partsOf((await buildBundle(planBundle(source()), deps)).blob);
    for (const p of parts) expect(readable(p.data)).not.toMatch(/OTHERPEO|Other PEO/);
    // Its own answer is there, in its supplement, and the packet is prepared for it.
    expect(readable(parts[4].data)).toContain("Do you run a fleet?");
    expect(readable(parts[1].data)).toContain("Sample PEO");
  });

  it("still builds when a document can't be fetched, and lists it as not included in the contents", async () => {
    const plan = planBundle(source({ documents: [doc(), doc({ id: "d2", file_name: "loss-runs.pdf", storage_path: "u/gone.pdf", category: "workers_comp_loss_runs" })] }));
    const progress: string[] = [];
    const built = await buildBundle(plan, { ...deps, onProgress: (p) => progress.push(`${p.done}/${p.total}`) });
    expect(built.notIncluded).toEqual([{ what: "loss-runs.pdf (Workers' comp loss runs)", why: "It couldn't be downloaded. Download it from the submission page and send it with this bundle." }]);
    const parts = await partsOf(built.blob);
    expect(parts.map((p) => p.name)).not.toContain("documents/loss-runs.pdf");
    expect(built.contents).toContain("Files that could not be included:\r\n- loss-runs.pdf (Workers' comp loss runs): It couldn't be downloaded.");
    expect(progress).toEqual(["0/2", "1/2", "2/2"]);
  });

  it("leaves out a document that would take the bundle past its size cap, and says so", async () => {
    const built = await buildBundle(planBundle(source()), { ...deps, maxBytes: 0 });
    expect(built.notIncluded.map((n) => n.what)).toEqual(["register.xlsx (Payroll report)", "loss-runs.pdf (Workers' comp loss runs)"]);
    expect(built.notIncluded[0].why).toBe("It would take the bundle over 100 MB. Download it from the submission page and send it with this bundle.");
  });

  it("counts each document it takes towards the cap: one that fits goes in, the next past it is left out", async () => {
    const all = await buildBundle(planBundle(source({ documents: [] })), deps);
    const made = (await partsOf(all.blob)).filter((p) => p.name !== "CONTENTS.txt").reduce((n, p) => n + p.data.length, 0);
    const built = await buildBundle(planBundle(source()), { ...deps, maxBytes: made + "REGISTER-BYTES".length + 5 });
    expect(built.notIncluded.map((n) => n.what)).toEqual(["loss-runs.pdf (Workers' comp loss runs)"]);
    expect((await partsOf(built.blob)).map((p) => p.name)).toContain("documents/register.xlsx");
  });

  it("says which supplement it can't tell, from a version certified before extra answers were kept", async () => {
    const built = await buildBundle(planBundle(source({ intake: { ...intake, extraAnswers: null } })), deps);
    expect(built.notIncluded).toEqual([{ what: "Additional questions from Sample PEO", why: "Version 3 was certified before we kept the answers to Sample PEO's own questions. Certifying again adds them." }]);
    expect((await partsOf(built.blob)).map((p) => p.name)).not.toContain("EAA-2026-0042-additional-questions-sample-peo-v3.pdf");
  });

  it("names two documents with the same file name apart", async () => {
    const plan = planBundle(source({ documents: [doc(), doc({ id: "d3", storage_path: "u/loss-runs.pdf", file_name: "register.xlsx" })] }));
    const parts = await partsOf((await buildBundle(plan, deps)).blob);
    expect(parts.slice(-2).map((p) => p.name)).toEqual(["documents/register.xlsx", "documents/register (2).xlsx"]);
  });

  it("fills the PEO's own census workbook, and says so when it can't be read", async () => {
    const template = profile({ censusLayout: { peo: "Sample PEO", format: "xlsx", template: { id: 12, sheet: "Census", headerRow: 1, firstRow: 2 }, columns: [{ header: "Last Name", from: "last_name" }] } });
    const plan = planBundle(source({ peo: { ...samplePeo, profile: template } }));
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Census").getRow(1).values = ["Last Name"];
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
    const readTemplate = vi.fn(async () => bytes);
    const parts = await partsOf((await buildBundle(plan, { ...deps, readTemplate })).blob);
    expect(readTemplate).toHaveBeenCalledWith(7, 12);
    expect(parts.map((p) => p.name)).toContain("EAA-2026-0042-census-sample-peo-v3.xlsx");

    // A template workbook whose headers don't match the layout: the census file's own refusal, said.
    const other = new ExcelJS.Workbook();
    other.addWorksheet("Census").getRow(1).values = ["Surname"];
    const mismatched = new Uint8Array(await other.xlsx.writeBuffer());
    const refused = await buildBundle(plan, { ...deps, readTemplate: async () => mismatched });
    expect(refused.notIncluded).toHaveLength(1);
    expect(refused.notIncluded[0].what).toBe("Census file");
    expect(refused.notIncluded[0].why).toMatch(/Last Name/);
    // A read that fails outright is no different from one that finds nothing.
    const thrown = await buildBundle(plan, { ...deps, readTemplate: async () => { throw new Error("network down"); } });
    expect(thrown.notIncluded.map((n) => n.what)).toEqual(["Census file"]);

    const unread = await buildBundle(plan, deps);
    expect(unread.notIncluded).toEqual([{ what: "Census file", why: "We couldn't get Sample PEO's template workbook. Download the census on its own and send it with this bundle." }]);
    expect((await partsOf(unread.blob)).map((p) => p.name)).not.toContain("EAA-2026-0042-census-sample-peo-v3.xlsx");
  });

  it("gives the prospect's bundle no documents and fetches none", async () => {
    fetchDocument.mockClear();
    const parts = await partsOf((await buildBundle(planBundle(source({ audience: "prospect" })), deps)).blob);
    expect(parts.map((p) => p.name).filter((n) => n.startsWith("documents/"))).toEqual([]);
    expect(fetchDocument).not.toHaveBeenCalled();
  });
});

describe("safeFileName: a name every unzip tool and operating system takes as one file", () => {
  it.each([
    ["an empty name", "", "document"],
    ["a dot", ".", "document"],
    ["two dots", "..", "document"],
    ["an extension with no name", ".pdf", "document.pdf"],
    ["a path up and out", "../../etc/passwd", ".._.._etc_passwd"],
    ["Windows' forbidden characters", 'a:b*c?"d<e>f|g.pdf', "a_b_c__d_e_f_g.pdf"],
    ["control characters", "line\nbreak\u0000\u0007\u007f\u0085.pdf", "line_break____.pdf"],
    ["either slash", "2025\\Q1/register.xlsx", "2025_Q1_register.xlsx"],
    ["trailing dots and spaces", "report.pdf. . ", "report.pdf"],
    ["a name Windows keeps for a device", "CON.txt", "_CON.txt"],
    ["a name in any language", "Nómina año 2025.pdf", "Nómina año 2025.pdf"],
    // macOS writes accents as separate marks: one way of writing it, so two spellings of one name are one name.
    ["a name with its accents written apart", "Nómina año 2025.pdf".normalize("NFD"), "Nómina año 2025.pdf"],
  ])("makes %s safe", (_label, name, expected) => {
    expect(safeFileName(name)).toBe(expected);
  });

  it("caps a long name at 100 characters, keeping its extension and never cutting a character in two", () => {
    expect(safeFileName(`${"x".repeat(300)}.pdf`)).toBe(`${"x".repeat(96)}.pdf`);
    expect(safeFileName(`${"😀".repeat(200)}.pdf`)).toBe(`${"😀".repeat(96)}.pdf`);
    // Cut so it ends in a space: still trimmed.
    expect(safeFileName(`${"x".repeat(95)} ${"y".repeat(10)}.pdf`)).toBe(`${"x".repeat(95)}.pdf`);
  });
});

describe("buildBundle: every entry's name is safe, and the contents page lists each as the zip holds it", () => {
  const names = ["", "..", ".", "register.xlsx", "Register.xlsx", 'loss:runs*"2025"?.pdf', "notes\r\n.txt", "../../escape.pdf", "Nómina año 2025.pdf"];
  const awkward = names.map((file_name, i) => doc({ id: `n${i}`, file_name, storage_path: "u/register.xlsx" }));

  it("names every awkward document as one safe file, case-insensitively apart", async () => {
    const built = await buildBundle(planBundle(source({ documents: awkward })), deps);
    const parts = await partsOf(built.blob);
    expect(parts.map((p) => p.name).filter((n) => n.startsWith("documents/"))).toEqual([
      "documents/document",
      "documents/document (2)",
      "documents/document (3)",
      "documents/register.xlsx",
      "documents/Register (2).xlsx",
      "documents/loss_runs__2025__.pdf",
      "documents/notes__.txt",
      "documents/.._.._escape.pdf",
      "documents/Nómina año 2025.pdf",
    ]);
    // No entry is a folder, and none climbs out.
    for (const p of parts) {
      expect(p.name.endsWith("/")).toBe(false);
      expect(p.name.split("/")).not.toContain("..");
      expect(p.name).not.toMatch(/[\p{Cc}<>:"|?*\\]/u);
    }
    // The contents page lists exactly the files the zip holds, under the names they have there.
    const listed = built.contents.slice(built.contents.indexOf("IN THIS BUNDLE"), built.contents.indexOf("LEFT BLANK"))
      .split("\r\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2, l.indexOf(": ")));
    expect(listed).toEqual(parts.map((p) => p.name));
    expect(built.contents).toContain("IN THIS BUNDLE (14 files)");
  });

  it("names apart any file whose name matches another's in any case, however they arrived", async () => {
    const named = ["register.xlsx", "Register.xlsx", "REGISTER (2).xlsx", ".x y", ".x y"].map((file_name, i) => doc({ id: `c${i}`, file_name, storage_path: "u/register.xlsx" }));
    const parts = await partsOf((await buildBundle(planBundle(source({ documents: named })), deps)).blob);
    expect(parts.map((p) => p.name).filter((n) => n.startsWith("documents/"))).toEqual([
      "documents/register.xlsx",
      "documents/Register (2).xlsx",
      "documents/REGISTER (2) (2).xlsx",
      "documents/.x y",
      "documents/.x y (2)",
    ]);
  });

  it("makes the files it makes safe too, and never breaks a contents line with a name it couldn't include", async () => {
    const plan = planBundle(source({ fileId: "EAA/2026:0042", documents: [doc({ file_name: "loss\nruns.pdf", storage_path: "u/gone.pdf" })] }));
    const built = await buildBundle(plan, deps);
    const names = (await partsOf(built.blob)).map((p) => p.name);
    expect(names.slice(2, 4)).toEqual(["EAA_2026_0042-census-sample-peo-v3.csv", "EAA_2026_0042-workers-comp-application-v3.pdf"]);
    expect(built.contents).toContain("\r\n- loss_runs.pdf (Payroll report): It couldn't be downloaded.");
  });

  it.runIf(spawnSync("unzip", ["-v"]).status === 0)("passes the real unzip's own test, every entry a file the contents page names", async () => {
    const built = await buildBundle(planBundle(source({ documents: awkward })), deps);
    const dir = mkdtempSync(join(tmpdir(), "bundle-"));
    const path = join(dir, built.filename);
    writeFileSync(path, await blobBytes(built.blob));
    try {
      const test = spawnSync("unzip", ["-t", path], { encoding: "utf8" });
      expect(test.status, test.stdout + test.stderr).toBe(0);
      expect(test.stdout).toContain("No errors detected");
      const listing = spawnSync("unzip", ["-Z1", path], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
      expect(listing).toHaveLength(14);
      for (const name of listing) expect(built.contents).toContain(`- ${name}: `);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("what the prospect reads in their files uses their words, never ours", () => {
  // GLOSSARY.md's Avoid words for anything a prospect reads. A ZIP code is a postal code, not the file.
  const AVOID = /\b(manuscript|chamber|reckoning|package|PEO requirements|ready)\b|\bzip\b(?!\s+codes?\b|\s+given\b)/i;

  it("in every file of their bundle, its contents page and comment, and what is said before the click", async () => {
    const plan = planBundle(source({ audience: "prospect" }));
    const built = await buildBundle(plan, deps);
    const zip = await blobBytes(built.blob);
    const texts = [bundleSummary(plan), built.contents, latin1(zip.subarray(zip.length - 200)), ...(await partsOf(built.blob)).map((p) => readable(p.data))];
    for (const text of texts) expect(text).not.toMatch(AVOID);
    // Each word is caught where it would be written.
    for (const word of ["The Manuscript", "the Chamber", "The Reckoning", "a package", "the zip", "one .zip", "PEO requirements", "ready"]) expect(word).toMatch(AVOID);
    expect("Work states and ZIP codes in the census, no ZIP given").not.toMatch(AVOID);
  });

  it("in the answers as JSON, outside the answers themselves (named by the published schema)", () => {
    const json = certifiedAnswersDocument({ data: intake.data, provenance: intake.provenance, submission, fileId: "EAA-2026-0042" });
    const { answers: _answers, answer_status: _status, answers_schema: _schema, ...envelope } = json;
    expect(JSON.stringify(envelope)).not.toMatch(AVOID);
  });
});
