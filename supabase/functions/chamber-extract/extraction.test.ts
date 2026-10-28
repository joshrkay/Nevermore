import { describe, expect, it } from "vitest";
import { emptyExtraction, shapeExtraction } from "./extraction";
import { EXTRACT_TOOL, FIELDS, MAX_EVIDENCE_CHARS, SYSTEM_PROMPT } from "./schema";

describe("shapeExtraction", () => {
  it("keeps the fields the model extracted, with their status, evidence and corrections", () => {
    const shaped = shapeExtraction({
      employee_count: 45,
      states: ["CA", "TX"],
      field_status: { employee_count: "confirmed", states: "incomplete" },
      evidence: { employee_count: "actually it's 45", states: "mainly CA and TX" },
      corrected_fields: ["employee_count"],
      reply: "Thank you.",
    });
    expect(shaped).toEqual({
      extracted: { employee_count: 45, states: ["CA", "TX"] },
      field_status: { employee_count: "confirmed", states: "incomplete" },
      evidence: { employee_count: "actually it's 45", states: "mainly CA and TX" },
      corrected_fields: ["employee_count"],
      reply: "Thank you.",
    });
  });

  it("drops fields we don't collect, and null or empty values", () => {
    const { extracted } = shapeExtraction({ company_name: "Acme", ssn: "123-45-6789", industry: "", hq_state: null, key_challenges: undefined });
    expect(extracted).toEqual({ company_name: "Acme" });
  });

  it("keeps a false or zero answer: those are answers, not blanks", () => {
    const { extracted } = shapeExtraction({ virgin_medical: false, employee_count: 0, has_401k: false });
    expect(extracted).toEqual({ virgin_medical: false, employee_count: 0, has_401k: false });
  });

  it("keeps a status, evidence or correction only for a field that was extracted", () => {
    const shaped = shapeExtraction({
      company_name: "Acme",
      field_status: { company_name: "confirmed", industry: "confirmed" },
      evidence: { company_name: "we are Acme", industry: "retail" },
      corrected_fields: ["company_name", "industry"],
    });
    expect(shaped.field_status).toEqual({ company_name: "confirmed" });
    expect(shaped.evidence).toEqual({ company_name: "we are Acme" });
    expect(shaped.corrected_fields).toEqual(["company_name"]);
  });

  it("refuses a status the client doesn't know", () => {
    const { field_status } = shapeExtraction({ company_name: "Acme", field_status: { company_name: "certain" } });
    expect(field_status).toEqual({});
  });

  it("trims evidence, caps its length, and drops a blank quote", () => {
    const long = "x".repeat(MAX_EVIDENCE_CHARS + 50);
    const { evidence } = shapeExtraction({
      company_name: "Acme",
      industry: "Retail",
      hq_state: "CA",
      evidence: { company_name: `  ${long}  `, industry: "   ", hq_state: " in California " },
    });
    expect(evidence.company_name).toHaveLength(MAX_EVIDENCE_CHARS);
    expect(evidence).not.toHaveProperty("industry");
    expect(evidence.hq_state).toBe("in California");
  });

  it("ignores status, evidence and corrections that aren't the shape we asked for", () => {
    const shaped = shapeExtraction({ company_name: "Acme", field_status: "confirmed", evidence: ["a quote"], corrected_fields: "company_name" });
    expect(shaped).toMatchObject({ field_status: {}, evidence: {}, corrected_fields: [] });
  });

  it("returns no reply when the model sent none or a blank or non-text one", () => {
    expect(shapeExtraction({ company_name: "Acme" }).reply).toBeNull();
    expect(shapeExtraction({ reply: "   " }).reply).toBeNull();
    expect(shapeExtraction({ reply: 42 }).reply).toBeNull();
  });
});

describe("emptyExtraction", () => {
  it("is nothing extracted and no reply, so the browser falls back to its own line", () => {
    expect(emptyExtraction()).toEqual({ extracted: {}, field_status: {}, evidence: {}, corrected_fields: [], reply: null });
  });

  it("hands out a fresh object each time", () => {
    const first = emptyExtraction();
    first.extracted.company_name = "Acme";
    expect(emptyExtraction().extracted).toEqual({});
  });
});

// The prompt and the tool schema once existed in two diverged copies (one in the handler, one
// here) and the function shipped with the thinner one. These keep the contract in one place.
describe("extraction tool schema", () => {
  const properties = EXTRACT_TOOL.parameters.properties as Record<string, { properties?: Record<string, unknown> }>;

  it("asks for every field, plus a status and an evidence quote for each, the corrections and a reply", () => {
    for (const field of FIELDS) expect(properties).toHaveProperty(field);
    expect(Object.keys(properties.field_status.properties ?? {})).toEqual(FIELDS);
    expect(Object.keys(properties.evidence.properties ?? {})).toEqual(FIELDS);
    expect(properties).toHaveProperty("corrected_fields");
    expect(properties).toHaveProperty("reply");
  });

  it("tells the model how to report status, evidence and corrections", () => {
    for (const word of ["field_status", "evidence", "corrected_fields"]) expect(SYSTEM_PROMPT).toContain(word);
    expect(SYSTEM_PROMPT).toContain(`at most ${MAX_EVIDENCE_CHARS} characters`);
  });
});
