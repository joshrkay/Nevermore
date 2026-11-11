import { describe, expect, it } from "vitest";
import type { ExtraAnswers } from "./extraAnswers";
import { buildSupplement, supplementFilename, supplementPeos } from "./peoSupplement";
import type { ExtraQuestion } from "./peoProfiles";
import type { PeoRecord } from "./peoCatalog";

const QUESTIONS: ExtraQuestion[] = [
  { key: "vehicles", text: "Do employees drive for work?", kind: "yes_no" },
  { key: "fleet", text: "How many company vehicles?", kind: "number" },
  { key: "union", text: "Which union, if any?", kind: "choice", choices: ["None", "Teamsters"] },
  { key: "notes", text: "Anything else we should know?", kind: "text" },
  { key: "abroad", text: "Does anyone work abroad?", kind: "yes_no" },
];
const by = { source: { kind: "prospect_edit" as const }, updated_at: "2026-11-13T10:00:00Z" };
const certified: ExtraAnswers = {
  "5": {
    vehicles: { question: QUESTIONS[0].text, kind: "yes_no", value: true, status: "confirmed", ...by },
    fleet: { question: QUESTIONS[1].text, kind: "number", value: 4, status: "inferred", ...by },
    notes: { question: QUESTIONS[3].text, kind: "text", status: "not_applicable", ...by },
    abroad: { question: QUESTIONS[4].text, kind: "yes_no", status: "unknown", ...by },
    // Certified to wording the profile has since changed, and to a question it no longer asks.
    union: { question: "Are any employees in a union?", kind: "choice", value: "None", status: "confirmed", ...by },
    hazmat: { question: "Do you handle hazardous materials?", kind: "yes_no", value: false, status: "confirmed", ...by },
  },
  "9": { secret: { question: "Another PEO's question?", kind: "text", value: "Only for them", status: "confirmed", ...by } },
};

describe("buildSupplement: a PEO's own questions and the certified answers to them", () => {
  const s = buildSupplement({ peo: { id: 5, name: "TriNet" }, questions: QUESTIONS, certified, fileId: "EAA-2026-0007", version: 3, companyName: "Acme" });

  it("lists every question the profile asks as worded, with its certified answer or that it wasn't answered", () => {
    expect(s.title).toBe("Additional questions from TriNet");
    expect(s.rows).toEqual([
      { question: "Do employees drive for work?", answer: "Yes" },
      { question: "How many company vehicles?", answer: "4 (not confirmed by the prospect)" },
      { question: "Which union, if any?", answer: null },
      { question: "Anything else we should know?", answer: "Doesn't apply" },
      { question: "Does anyone work abroad?", answer: null },
    ]);
    expect(s.notAnswered).toEqual(["Which union, if any?", "Does anyone work abroad?"]);
  });

  it("keeps an answer certified to wording the PEO no longer asks, under that wording, apart", () => {
    expect(s.earlier).toEqual([
      { question: "Are any employees in a union?", answer: "None" },
      { question: "Do you handle hazardous materials?", answer: "No" },
    ]);
  });

  it("holds nothing of another PEO's answers", () => {
    expect(JSON.stringify(s)).not.toMatch(/Only for them|Another PEO/);
  });

  it("is named for the PEO, the File ID and the certified version", () => {
    expect(supplementFilename(s)).toBe("EAA-2026-0007-additional-questions-trinet-v3.pdf");
  });
});

describe("supplementPeos: whose supplement is offered", () => {
  const peo = (id: number, name: string, questions = QUESTIONS, listed = true): PeoRecord => ({ id, name, listed, lastVerified: null, profile: {
    version: 1, neededToQuote: [], neededBeforeSigning: [], censusLayout: null, documents: [], extraQuestions: questions, sources: {}, publishedAt: null,
    rules: { minHeadcount: null, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null },
  } });
  const catalog = [peo(3, "Justworks"), peo(5, "TriNet"), peo(9, "Oasis"), peo(11, "ADP TotalSource", [])];

  it("is the chosen PEO, then each PEO whose questions the certified version answers, alphabetically; never one with no questions", () => {
    expect(supplementPeos(catalog, "trinet", certified).map((p) => p.name)).toEqual(["TriNet", "Oasis"]);
    expect(supplementPeos(catalog, null, { "3": certified["5"] }).map((p) => p.name)).toEqual(["Justworks"]);
    expect(supplementPeos(catalog, "ADP TotalSource", {})).toEqual([]);
  });
});
