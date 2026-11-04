import { describe, expect, it } from "vitest";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { buildManuscript, type ChamberSubmission } from "@/data/manuscript";
import { buildManuscriptPdf, pdfSafe } from "./manuscriptPdf";

const FILE_ID = "EAA-2026-ABC12345";
const GENERATED = new Date(2026, 9, 20);

const submission: ChamberSubmission = {
  signer_name: "Jo Doe",
  signer_title: "CEO",
  signed_at: "2026-05-01T12:00:00Z",
  certified_at: "2026-05-01T12:00:03Z",
  file_id: FILE_ID,
  version: 1,
  data_version: 4,
  peo: "Acme PEO",
  consent_version: "v1",
  consent_text: "I certify the answers are accurate.\nBy signing, I consent to this packet being prepared.",
  documents: [{ id: "d1", file_name: "census.csv", category: "employee_census", status: "extracted" }],
};

// jsdom's Blob has no arrayBuffer(); read it the old way. latin1 keeps bytes 1:1 so text is greppable. The
// built-in fonts write an em dash and an ellipsis as the Windows-1252 bytes 0x97 and 0x85; read them back as
// the characters, so expectations can be written as the page shows them.
const readPdf = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).replace(/\x97/g, "—").replace(/\x85/g, "…"));
    reader.onerror = reject;
    reader.readAsBinaryString(blob);
  });

const render = async (data = DEMO_CHAMBER_DATA, opts: Parameters<typeof buildManuscriptPdf>[1] = {}, sub: ChamberSubmission | null = submission) => {
  const m = buildManuscript(data, { fileId: FILE_ID, submission: sub });
  const pdf = buildManuscriptPdf(m, { generatedOn: GENERATED, compress: false, ...opts });
  return { ...pdf, text: await readPdf(pdf.blob) };
};

const bigCensus = {
  ...DEMO_CHAMBER_DATA,
  census: Array.from({ length: 60 }, (_, i) => ({
    ...DEMO_CHAMBER_DATA.census[i % DEMO_CHAMBER_DATA.census.length],
    id: `person-${i}`,
    first_name: `Person${i}`,
    last_name: "Featherstonehaugh-Cholmondeley",
    job_title: "Senior Account Executive, Strategic Enterprise Partnerships",
  })),
};

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("buildManuscriptPdf", () => {
  it("produces a real PDF carrying the session's reviewed information as text", async () => {
    const { text, blob } = await render();
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(blob.type).toBe("application/pdf");
    for (const expected of ["Meridian Creative Group", "Sarah Chen", "Senior Designer", "$105,000", "Blue Shield", "Acme PEO", "Jo Doe", "CEO"]) {
      expect(text).toContain(expected);
    }
  });

  it("prints payroll in its own section, and a census default as not provided", async () => {
    const data = {
      ...DEMO_CHAMBER_DATA,
      funding_days: 3,
      hris_system: "BambooHR",
      census: [{ ...DEMO_CHAMBER_DATA.census[0], assumed: ["classification" as const] }],
    };
    const { text } = await render(data);
    for (const expected of ["Payroll & Time", "Funding Lead Time", "3 days", "BambooHR", "Classification Not Provided"]) {
      expect(text).toContain(expected);
    }
    // jsPDF escapes parentheses inside text, so look for the part of the open item without them.
    expect(text).toContain("not provided for 1 of 1 people on the census");
  });

  it("puts the file id, version, company and page numbers in the header and footer of every page", async () => {
    const { text, pageCount } = await render(bigCensus);
    expect(pageCount).toBeGreaterThan(3);
    expect(occurrences(text, `(File ID ${FILE_ID} · v1 · data version 4)`)).toBe(pageCount);
    expect(occurrences(text, "(Meridian Creative Group)")).toBeGreaterThanOrEqual(pageCount);
    for (let p = 1; p <= pageCount; p++) expect(text).toContain(`(Page ${p} of ${pageCount})`);
    expect(occurrences(text, "Generated October 20, 2026")).toBe(pageCount);
  });

  it("shortens a very long company name in the running header instead of letting it collide", async () => {
    const { text, pageCount } = await render({ ...bigCensus, company_name: "The Extraordinarily Long Company Name Of Meridian Creative Group Holdings International LLC" });
    expect(pageCount).toBeGreaterThan(3);
    // The header's copy of the name is cut with an ellipsis, on every page; the reference beside it is whole.
    expect(occurrences(text, "(The Extraordinarily Long Company Name Of Meridian Creative Group Holdings International LLC)")).toBeLessThan(pageCount);
    expect(text).toMatch(/\(The Extraordinarily Long Company[^)\n]*…\)/);
    expect(occurrences(text, `(File ID ${FILE_ID} · v1 · data version 4)`)).toBe(pageCount);
  });

  it("prints every section of the packet, numbered, in the page's order", async () => {
    const { text } = await render();
    for (const heading of [
      "1 — Company Profile", "2 — Workforce Summary", "3 — Employee Census", "4 — Dependent Summary", "5 — Locations",
      "6 — Payroll & Time", "7 — Current Benefits", "8 — Workers' Compensation", "9 — Operations & HR", "10 — Documents",
      "11 — Underwriting Readiness", "12 — Submission Certification",
    ]) {
      expect(text).toContain(heading);
    }
    expect(text).toContain("Pinnacle Mutual"); // the workers' comp carrier
    expect(text).toContain("census.csv"); // the document snapshot
    expect(text).toContain("8810"); // the class code column
  });

  it("prints a multi-state submission's state breakdown, and an incomplete one without clipping", async () => {
    const states = ["CA", "TX", "NY", "OH", "WA", "FL", "IL", "PA", "GA", "NC", "AZ", "MA"];
    const { text } = await render({ ...DEMO_CHAMBER_DATA, states });
    for (const state of states) expect(text).toContain(`(${state})`);
    const { text: thin, pageCount } = await render({ ...EMPTY_CHAMBER_DATA, company_name: "Thin Co" }, {}, submission);
    expect(pageCount).toBeGreaterThanOrEqual(2);
    expect(thin).toContain("Not provided");
    expect(thin).toContain("Pay frequency — not provided");
  });

  it("sets the file's title, subject and creation date", async () => {
    const { text } = await render();
    expect(text).toMatch(/\/Title /);
    expect(text).toMatch(/\/Author \(Edgar Allan Advisory\)/);
    expect(text).toMatch(/\/CreationDate \(D:20261020/);
  });

  it("repeats the census table header after each page break and keeps every row", async () => {
    const { text, pageCount } = await render(bigCensus);
    expect(occurrences(text, "(Coverage Tier)")).toBeGreaterThan(1);
    expect(occurrences(text, "(Coverage Tier)")).toBeLessThan(pageCount);
    for (let i = 0; i < 60; i++) expect(text).toContain(`(Person${i} `);
  });

  it("wraps long cell text instead of clipping it", async () => {
    const { text } = await render(bigCensus);
    // The title is too long for one line in its column; every word must still be drawn.
    for (const word of ["Senior", "Account", "Executive,", "Strategic", "Enterprise", "Partnerships"]) {
      expect(text).toContain(word);
    }
  });

  it("masks dates of birth by default", async () => {
    const { text } = await render();
    expect(text).not.toContain("1988-03-15");
    expect(text).not.toContain("1985-07-22");
    expect(text).toContain("/1988");
    expect(text).toContain("Masked");
  });

  it("shows dates of birth only when explicitly revealed", async () => {
    const { text } = await render(DEMO_CHAMBER_DATA, { revealSensitive: true });
    expect(text).toContain("1988-03-15");
    expect(text).toContain("Shown in full");
  });

  it("includes the signer's role, signing time and the consent wording they agreed to", async () => {
    const { text } = await render();
    expect(text).toContain("(Role)");
    expect(text).toContain("I certify the answers are accurate.");
    expect(text).toContain("By signing, I consent to this packet being prepared.");
    expect(text).toContain("Signed electronically by Jo Doe on");
  });

  it("marks consent wording counsel hasn't approved as a draft, with a watermark on the certification", async () => {
    const { text } = await render();
    expect(text).toContain("Consent wording v1 · DRAFT: NOT LEGALLY REVIEWED");
    // One watermark, drawn first on the certification's page, under the block it marks: no page ends in between
    // (each page's stream ends with its footer).
    expect(occurrences(text, "(DRAFT) Tj")).toBe(1);
    const between = text.slice(text.indexOf("(DRAFT) Tj"), text.indexOf("12 — Submission Certification"));
    expect(between.length).toBeGreaterThan(0);
    expect(between).not.toMatch(/Page \d+ of \d+/);
  });

  it("says when a certification didn't record which wording was signed, and marks it as a draft", async () => {
    const { text } = await render(DEMO_CHAMBER_DATA, {}, { ...submission, consent_version: undefined, consent_text: undefined });
    expect(text).toContain("Consent wording not recorded · DRAFT: NOT LEGALLY REVIEWED");
    expect(occurrences(text, "(DRAFT) Tj")).toBe(1);
  });

  it("prints approved consent wording with no draft mark or watermark", async () => {
    const m = buildManuscript(DEMO_CHAMBER_DATA, { fileId: FILE_ID, submission });
    const approved = { ...m, signer: { ...m.signer!, consentDraft: false } };
    const text = await readPdf(buildManuscriptPdf(approved, { generatedOn: GENERATED, compress: false }).blob);
    expect(text).toContain("I certify the answers are accurate.");
    expect(text).not.toContain("DRAFT");
  });

  it("puts no draft mark on a packet nobody signed", async () => {
    const { text } = await render(DEMO_CHAMBER_DATA, { sample: true }, null);
    expect(text).not.toContain("DRAFT");
  });

  it("builds a PDF for an empty intake without throwing", async () => {
    const { text, pageCount } = await render(EMPTY_CHAMBER_DATA, {}, null);
    expect(pageCount).toBeGreaterThanOrEqual(1);
    expect(text).toContain("No employee census captured yet.");
    expect(text).toContain("Not provided");
  });

  it("names the file after the submission, its version, the company and the certified date", async () => {
    const { filename } = await render();
    expect(filename).toBe(`The_Manuscript_${FILE_ID}_v1_Meridian_Creative_Group_20260501.pdf`);
  });

  it("names a packet from the same submission the same way wherever it is generated", async () => {
    const a = await render(DEMO_CHAMBER_DATA, { generatedOn: new Date(2026, 9, 20) });
    const b = await render(DEMO_CHAMBER_DATA, { generatedOn: new Date(2030, 0, 1) });
    expect(a.filename).toBe(b.filename);
    expect(a.filename).not.toContain("2030");
  });

  it("marks every value whose answers conflict as unresolved, as the web Manuscript's chip does, unless an advisor verified it", async () => {
    const at = "2026-05-01T00:00:00Z";
    const said = { kind: "transcript" as const, message_id: "m1" };
    const conflict = { status: "conflicting" as const, source: said, updated_at: at, candidates: [] };
    const m = buildManuscript(
      { ...DEMO_CHAMBER_DATA, pay_frequency: "Bi-weekly", exempt_count: 4, nonexempt_count: 9, start_month: null },
      {
        fileId: FILE_ID,
        submission,
        provenance: {
          pay_frequency: conflict,
          industry: conflict,
          current_carrier: conflict,
          hq_state: { ...conflict, status: "inferred" },
          // Part of a combined value, and a value never given.
          nonexempt_count: conflict,
          start_month: conflict,
        },
        // Verified by an advisor: settled, so no marker though its stored answers conflict.
        verified: new Set(["industry"]),
      },
    );
    // Text-drawing operators escape parentheses; the reader here drops the dash.
    const text = (await readPdf(buildManuscriptPdf(m, { generatedOn: GENERATED, compress: false }).blob)).replace(/\\([()])/g, "$1");
    const unresolved = (value: string) => new RegExp(`\\(${value} \\(unresolved \\W*see open items\\)\\)`);
    expect(text).toMatch(unresolved("Bi-weekly"));
    expect(text).toMatch(unresolved(DEMO_CHAMBER_DATA.current_carrier!));
    expect(text).not.toMatch(unresolved(DEMO_CHAMBER_DATA.industry!));
    expect(text).toContain(`(${DEMO_CHAMBER_DATA.industry})`);
    // The nonexempt count is its own row here, so only it carries the marker.
    expect(text).toMatch(unresolved("9"));
    expect(text).not.toMatch(unresolved("4"));
    expect(text).toMatch(unresolved("Not provided"));
    // Only inferred: the bare value.
    expect(text).toContain(`(${DEMO_CHAMBER_DATA.hq_state})`);
    expect(text.match(/unresolved/g)).toHaveLength(4);
  });

  it("labels a sample packet as fictional", async () => {
    const { text } = await render(DEMO_CHAMBER_DATA, { sample: true }, null);
    expect(text).toContain("sample manuscript built from fictional data");
    expect(text).toContain("Sample");
  });
});

describe("pdfSafe", () => {
  it("keeps Latin text and common typographic marks", () => {
    expect(pdfSafe("Café — “Ünïcode” • 100%")).toBe("Café — “Ünïcode” • 100%");
  });

  it("replaces characters the built-in fonts can't draw rather than printing garbage", () => {
    expect(pdfSafe("Acme 株式会社")).toBe("Acme ????");
    expect(pdfSafe("Łódź")).toBe("Lódz"); // ó is Latin-1 and stays; Ł and ź fold
  });

  it("lists confirmed facts, the eligibility checks and the open items apart", async () => {
    const provenance = { company_name: { status: "confirmed" as const, source: { kind: "prospect_edit" as const }, updated_at: "2026-05-01T00:00:00Z" } };
    const m = buildManuscript(DEMO_CHAMBER_DATA, { fileId: FILE_ID, submission, provenance });
    const pdf = buildManuscriptPdf(m, { generatedOn: GENERATED, compress: false });
    const text = await readPdf(pdf.blob);
    expect(text).toContain("Company legal name — confirmed by the prospect");
    expect(text).toContain("ELIGIBILITY CHECKS");
    expect(text).toContain("US headquarters — Passes");
    expect(text).toContain("OPEN ITEMS");
  });

  it("prints an advisor version and its corrections beside the values the prospect certified", async () => {
    const m = buildManuscript(DEMO_CHAMBER_DATA, {
      fileId: FILE_ID,
      submission,
      advisor: {
        version: 3,
        corrections: [{ label: "Company legal name", prospectValue: "Meridian Creative", advisorValue: "Meridian LLC", reason: "Per W-9" }],
        followUps: ["Employee count — advisor follow-up needed"],
      },
    });
    const pdf = buildManuscriptPdf(m, { generatedOn: GENERATED, compress: false });
    const text = await readPdf(pdf.blob);
    expect(text).toContain("v3");
    expect(text).toContain("ADVISOR CORRECTIONS");
    expect(text).toContain("Meridian LLC");
    expect(text).toContain("Per W-9");
    expect(text).toContain("corrected and verified by Edgar Allan Advisory");
    expect(text).toContain("Employee count");
  });

  it("leaves the advisor section out of the prospect's own packet", async () => {
    const { text } = await render();
    expect(text).not.toContain("ADVISOR CORRECTIONS");
  });

  it("labels the prospect's own packet as certified, before advisor review, and only that one", async () => {
    const { text } = await render();
    expect(text).toContain("As certified, before advisor review");
    expect((await render(DEMO_CHAMBER_DATA, { sample: true }, null)).text).not.toContain("before advisor review");
    const advisor = buildManuscript(DEMO_CHAMBER_DATA, { fileId: FILE_ID, submission, advisor: { version: 1, corrections: [], followUps: [] } });
    const advisorText = await readPdf(buildManuscriptPdf(advisor, { generatedOn: GENERATED, compress: false }).blob);
    expect(advisorText).not.toContain("before advisor review");
    expect(advisorText).toContain("reviewed by Edgar Allan Advisory");
  });
});
