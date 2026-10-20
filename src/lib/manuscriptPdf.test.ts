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
  file_id: FILE_ID,
  peo: "Acme PEO",
  consent_version: "v1",
  consent_text: "I certify the answers are accurate.\nBy signing, I consent to this packet being prepared.",
};

// jsdom's Blob has no arrayBuffer(); read it the old way. latin1 keeps bytes 1:1 so text is greppable.
const readPdf = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
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
  employees: Array.from({ length: 60 }, (_, i) => ({
    ...DEMO_CHAMBER_DATA.employees[i % DEMO_CHAMBER_DATA.employees.length],
    first_name: `Person${i}`,
    last_name: "Featherstonehaugh-Cholmondeley",
    title: "Senior Account Executive, Strategic Enterprise Partnerships",
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

  it("puts the file id and page numbers in the header and footer of every page", async () => {
    const { text, pageCount } = await render(bigCensus);
    expect(pageCount).toBeGreaterThan(3);
    expect(occurrences(text, `(File ID ${FILE_ID})`)).toBe(pageCount);
    for (let p = 1; p <= pageCount; p++) expect(text).toContain(`(Page ${p} of ${pageCount})`);
    expect(occurrences(text, "Generated October 20, 2026")).toBe(pageCount);
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

  it("builds a PDF for an empty intake without throwing", async () => {
    const { text, pageCount } = await render(EMPTY_CHAMBER_DATA, {}, null);
    expect(pageCount).toBeGreaterThanOrEqual(1);
    expect(text).toContain("No employee census captured yet.");
    expect(text).toContain("Not provided");
  });

  it("names the file after the submission and the company", async () => {
    const { filename } = await render();
    expect(filename).toBe(`The_Manuscript_${FILE_ID}_Meridian_Creative_Group.pdf`);
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
});
