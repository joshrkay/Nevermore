import { describe, expect, it } from "vitest";
import { pdfText } from "@/test/blob";
import { DEMO_CHAMBER_DATA } from "@/data/chamberTypes";
import type { ExtraAnswers } from "@/data/extraAnswers";
import { buildManuscript, type ChamberSubmission } from "@/data/manuscript";
import { buildSupplement } from "@/data/peoSupplement";
import type { ExtraQuestion } from "@/data/peoProfiles";
import { buildManuscriptPdf } from "./manuscriptPdf";
import { buildSupplementPdf } from "./supplementPdf";


const by = { status: "confirmed" as const, source: { kind: "prospect_edit" as const }, updated_at: "2026-11-13T10:00:00Z" };
const TRINET: ExtraQuestion[] = [
  { key: "vehicles", text: "Do employees drive for work?", kind: "yes_no" },
  { key: "hazmat", text: "Which hazardous materials do you handle?", kind: "text" },
  { key: "abroad", text: "Does anyone work abroad?", kind: "yes_no" },
];
const OASIS: ExtraQuestion[] = [{ key: "pets", text: "Do you allow pets at work?", kind: "yes_no" }];
const certified: ExtraAnswers = {
  "5": {
    vehicles: { question: TRINET[0].text, kind: "yes_no", value: true, ...by },
    hazmat: { question: TRINET[1].text, kind: "text", value: "Paint thinner in the Riverside shop", ...by },
    union: { question: "Are any employees in a union?", kind: "yes_no", value: false, ...by },
  },
  "9": { pets: { question: OASIS[0].text, kind: "yes_no", value: false, ...by } },
};
const GENERATED = new Date(2026, 10, 13);
const supplement = (peo: { id: number; name: string }, questions: ExtraQuestion[]) =>
  buildSupplement({ peo, questions, certified, fileId: "EAA-2026-0007", version: 3, companyName: "Meridian Creative Group" });
const text = async (peo: { id: number; name: string }, questions: ExtraQuestion[]) =>
  pdfText(buildSupplementPdf(supplement(peo, questions), { generatedOn: GENERATED, compress: false }).blob);

describe("buildSupplementPdf: Additional questions from <PEO>", () => {
  it("is a PDF of that PEO's questions and the certified answers, saying which version, with what wasn't answered listed", async () => {
    const pdf = buildSupplementPdf(supplement({ id: 5, name: "TriNet" }, TRINET), { generatedOn: GENERATED, compress: false });
    expect(pdf.filename).toBe("EAA-2026-0007-additional-questions-trinet-v3.pdf");
    const t = await pdfText(pdf.blob);
    expect(t.startsWith("%PDF-")).toBe(true);
    for (const expected of [
      "Additional questions from TriNet", "Meridian Creative Group", "EAA-2026-0007", "From certified version 3",
      "Do employees drive for work?", "Yes", "Paint thinner in the Riverside shop", "Does anyone work abroad?", "Not answered",
      "Not answered: 1 of 3", "Answered to earlier wording", "Are any employees in a union?", "For TriNet only.",
    ]) expect(t).toContain(expected);
  });

  it("never carries another PEO's questions or answers", async () => {
    const t = await text({ id: 9, name: "Oasis" }, OASIS);
    expect(t).toContain("Do you allow pets at work?");
    expect(t).not.toMatch(/Paint thinner|Do employees drive|hazardous|union/);
  });
});

describe("the packet never carries extra answers", () => {
  it("prints none of them, even from a certification that holds them", async () => {
    const submission = {
      signer_name: "Jo Doe", signer_title: "CEO", signed_at: "2026-11-13T12:00:00Z", certified_at: "2026-11-13T12:00:03Z",
      file_id: "EAA-2026-0007", version: 3, peo: "TriNet", consent_version: "v1", consent_text: "I certify.", documents: [],
      extra_answers: certified,
    } as ChamberSubmission;
    const m = buildManuscript(DEMO_CHAMBER_DATA, { fileId: "EAA-2026-0007", submission });
    expect(JSON.stringify(m)).not.toMatch(/Paint thinner|drive for work|pets at work/);
    const t = await pdfText(buildManuscriptPdf(m, { generatedOn: GENERATED, compress: false }).blob);
    expect(t).toContain("Meridian Creative Group");
    expect(t).not.toMatch(/Paint thinner|drive for work|pets at work|Additional questions/);
  });
});
