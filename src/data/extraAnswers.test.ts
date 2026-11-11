import { describe, expect, it } from "vitest";
import { answerFor, parseExtraAnswers, type ExtraAnswer } from "./extraAnswers";
import type { ExtraQuestion } from "./peoProfiles";

const drives: ExtraQuestion = { key: "vehicles", text: "Do employees drive for work?", kind: "yes_no" };
const union: ExtraQuestion = { key: "union", text: "Which union, if any?", kind: "choice", choices: ["None", "Teamsters"] };
const edited = { status: "confirmed" as const, source: { kind: "prospect_edit" as const }, updated_at: "2026-11-13T10:00:00Z" };
const answer = (over: Partial<ExtraAnswer> = {}): ExtraAnswer => ({ question: drives.text, kind: "yes_no", value: true, ...edited, ...over });

describe("parseExtraAnswers: the extra answers as stored, keeping only what the database would", () => {
  it("keeps well-formed answers by PEO id and question key", () => {
    const stored = { "3": { vehicles: answer(), notes: { question: "Anything else?", kind: "text", status: "unknown", source: { kind: "prospect_edit" }, updated_at: "2026-11-13T10:00:00Z" } } };
    expect(parseExtraAnswers(stored)).toEqual(stored);
  });

  it("drops what the database refuses: an unnamed PEO, a bad key, no wording, a value of the wrong kind or for an unknown", () => {
    expect(parseExtraAnswers([])).toEqual({});
    expect(parseExtraAnswers({ TriNet: { vehicles: answer() } })).toEqual({});
    expect(parseExtraAnswers({ "3": { "Vehicles!": answer() } })).toEqual({});
    expect(parseExtraAnswers({ "3": { vehicles: answer({ question: " " }) } })).toEqual({});
    expect(parseExtraAnswers({ "3": { vehicles: answer({ value: "yes" }) } })).toEqual({});
    expect(parseExtraAnswers({ "3": { vehicles: answer({ status: "unknown" }) } })).toEqual({});
    expect(parseExtraAnswers({ "3": { vehicles: answer({ value: undefined }) } })).toEqual({});
    expect(parseExtraAnswers({ "3": { n: answer({ kind: "number", question: "How many?", value: 1e12 + 1 }) } })).toEqual({});
    expect(parseExtraAnswers({ "3": { t: answer({ kind: "text", question: "Why?", value: "x".repeat(1001) }) } })).toEqual({});
    expect(parseExtraAnswers({ "3": { c: answer({ kind: "choice", question: "Which?", value: "x".repeat(101) }) } })).toEqual({});
  });
});

describe("answerFor: an answer belongs to the question with its key and its wording", () => {
  const answers = { "3": { vehicles: answer(), union: answer({ question: union.text, kind: "choice", value: "Teamsters" }) } };

  it("finds the answer to the question as worded", () => {
    expect(answerFor(answers, 3, drives)).toEqual(answer());
    expect(answerFor(answers, 3, union)?.value).toBe("Teamsters");
  });

  it("is no answer for another PEO's question with the same key", () => {
    expect(answerFor(answers, 4, drives)).toBeNull();
  });

  it("never reads an answer against different wording, or a different way of answering: a reworded question is a new one", () => {
    expect(answerFor(answers, 3, { ...drives, text: "Do any employees drive a vehicle for work?" })).toBeNull();
    expect(answerFor(answers, 3, { ...drives, kind: "text" })).toBeNull();
    // A choice no longer offered isn't an answer to it.
    expect(answerFor(answers, 3, { ...union, choices: ["None", "SEIU"] })).toBeNull();
  });
});

describe("what Lenore is asked, and what she hears", () => {
  const asked = [{ peo: { id: 3, name: "TriNet" }, questions: [drives, union], requested: new Set<string>() }];
  const heard = (id: string, message: string) => ({ kind: "transcript" as const, message_id: id, quote: message });

  it("sends the asked PEOs' questions by PEO and key, saying which hold an answer as worded", async () => {
    const { extraQuestionsForLenore } = await import("./extraAnswers");
    expect(extraQuestionsForLenore(asked, { "3": { vehicles: answer() } })).toEqual([
      { id: "3.vehicles", peo: "TriNet", text: "Do employees drive for work?", kind: "yes_no", answered: true },
      { id: "3.union", peo: "TriNet", text: "Which union, if any?", kind: "choice", choices: ["None", "Teamsters"], answered: false },
    ]);
  });

  it("takes what she heard as a field takes it: inferred unless stated, spoken never confirmed, a prospect's own answer never overwritten", async () => {
    const { applyExtraExtraction } = await import("./extraAnswers");
    const now = new Date("2026-11-13T11:00:00Z");
    const typed = { id: "m1", text: "Yes they drive. Teamsters." };
    const out = applyExtraExtraction({}, asked, { prompt_version: 9, extra_answers: [
      { id: "3.vehicles", value: true, field_status: "confirmed", evidence: "Yes they drive" },
      { id: "3.union", value: "Teamsters" },
      { id: "9.other", value: true },
    ] }, typed, now);
    expect(out).toEqual({ "3": {
      vehicles: { question: drives.text, kind: "yes_no", value: true, status: "confirmed", source: { ...heard("m1", "Yes they drive"), prompt_version: 9 }, updated_at: now.toISOString() },
      union: { question: union.text, kind: "choice", value: "Teamsters", status: "inferred", source: { ...heard("m1", "Yes they drive. Teamsters."), prompt_version: 9 }, updated_at: now.toISOString() },
    } });
    // Spoken: at most inferred.
    expect(applyExtraExtraction({}, asked, { extra_answers: [{ id: "3.vehicles", value: true, field_status: "confirmed" }] }, { ...typed, spoken: true }, now)["3"].vehicles.status).toBe("inferred");
    // The prospect's own answer stands; one from the conversation that disagrees with another is a conflict.
    const own = { "3": { vehicles: answer({ value: false }) } };
    expect(applyExtraExtraction(own, asked, { extra_answers: [{ id: "3.vehicles", value: true }] }, typed, now)).toEqual(own);
    const conflict = applyExtraExtraction(out, asked, { extra_answers: [{ id: "3.union", value: "None" }] }, { id: "m2", text: "Actually none" }, now)["3"].union;
    expect(conflict.status).toBe("conflicting");
    expect(conflict.candidates?.map((c) => c.value)).toEqual(["Teamsters", "None"]);
    // "I don't know", with nothing held, is unknown; an answer to other wording is not this question's.
    const reworded = { "3": { vehicles: answer({ question: "Do any staff drive?", value: false }) } };
    expect(applyExtraExtraction(reworded, asked, { extra_answers: [{ id: "3.vehicles", field_status: "unknown", evidence: "not sure" }] }, { id: "m3", text: "not sure" }, now)["3"].vehicles)
      .toEqual({ question: drives.text, kind: "yes_no", status: "unknown", source: { kind: "transcript", message_id: "m3" }, updated_at: now.toISOString() });
  });
});

describe("askedPeos: whose extra questions the intake asks", () => {
  const peo = (id: number, name: string, questions: ExtraQuestion[], listed = true) => ({ id, name, listed, lastVerified: null, profile: {
    version: 1, neededToQuote: [], neededBeforeSigning: [], censusLayout: null, documents: [], extraQuestions: questions, sources: {}, publishedAt: null,
    rules: { minHeadcount: null, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null },
  } });
  const catalog = [peo(3, "Justworks", [union]), peo(4, "Oasis", [union], false), peo(5, "TriNet", [drives, union])];

  it("is the chosen PEO, then each one a request names; marking only the questions it names, of that PEO, as worded", async () => {
    const { askedPeos } = await import("./extraAnswers");
    const asked = askedPeos(catalog, "trinet", [
      { peo_id: 3, key: "union", question: union.text },
      { peo_id: 5, key: "vehicles", question: "Old wording?" },
      // A PEO no longer listed isn't asked.
      { peo_id: 4, key: "union", question: union.text },
    ]);
    expect(asked.map((a) => [a.peo.name, [...a.requested]])).toEqual([["TriNet", []], ["Justworks", ["union"]]]);
    expect(askedPeos(catalog, null)).toEqual([]);
  });
});
