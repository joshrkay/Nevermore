import { describe, expect, it } from "vitest";
import { ACORD_130_EDITION, ACORD_130_QUESTIONS, acordAnswerKey, acordExplainKey, acordField } from "./acord130";

// K-3.4: the list is the form's, checked against ACORD 130 (2017/05) itself, not written from memory.
describe("the ACORD 130 general information questions", () => {
  it("are the form's 24, numbered as the form numbers them", () => {
    expect(ACORD_130_EDITION).toBe("ACORD 130 (2017/05)");
    expect(ACORD_130_QUESTIONS.map((q) => q.number)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it("carry the form's own wording", () => {
    const text = (n: number) => ACORD_130_QUESTIONS[n - 1].text;
    expect(text(1)).toBe("DOES APPLICANT OWN, OPERATE OR LEASE AIRCRAFT / WATERCRAFT?");
    expect(text(3)).toBe("ANY WORK PERFORMED UNDERGROUND OR ABOVE 15 FEET?");
    expect(text(13)).toBe("ANY EMPLOYEES WITH PHYSICAL HANDICAPS?");
    expect(text(18)).toBe("ANY PRIOR COVERAGE DECLINED / CANCELLED / NON-RENEWED IN THE LAST THREE (3) YEARS? (Missouri Applicants - Do not answer this question)");
    expect(text(22)).toBe("DO ANY EMPLOYEES PREDOMINANTLY WORK AT HOME? If \"YES\", # of Employees:");
    expect(text(24)).toMatch(/^ANY UNDISPUTED AND UNPAID WORKERS COMPENSATION PREMIUM DUE .* POLICY NUMBER\(S\)\.$/);
    // The form prints in capitals; ours are the labels and Lenore's questions.
    for (const q of ACORD_130_QUESTIONS) {
      expect(q.text.slice(0, 20), `No. ${q.number}`).toBe(q.text.slice(0, 20).toUpperCase());
      expect(q.ask, `No. ${q.number}`).toMatch(/\?$/);
      expect(q.label.trim(), `No. ${q.number}`).not.toBe("");
    }
    expect(new Set(ACORD_130_QUESTIONS.map((q) => q.label)).size).toBe(24);
  });

  it("each have a field for the answer and one for the explanation a yes needs", () => {
    expect([acordAnswerKey(1), acordExplainKey(1), acordAnswerKey(24), acordExplainKey(24)]).toEqual(["wcq_01", "wcq_01_explain", "wcq_24", "wcq_24_explain"]);
    expect(acordField("wcq_06")).toMatchObject({ part: "answer", question: { number: 6 } });
    expect(acordField("wcq_06_explain")).toMatchObject({ part: "explain", question: { number: 6 } });
    for (const other of ["wcq_25", "wcq_00", "wcq_6", "wc_carrier", "wcq_06_explained"]) expect(acordField(other), other).toBeUndefined();
  });
});
