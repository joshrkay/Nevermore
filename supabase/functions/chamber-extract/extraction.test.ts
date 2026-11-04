import { describe, expect, it } from "vitest";
import { emptyExtraction, shapeExtraction } from "./extraction";
import { EXTRACT_TOOL, FIELD_GUIDE, FIELDS, MAX_EVIDENCE_CHARS, SYSTEM_PROMPT } from "./schema";
import { INTAKE_SCHEMA } from "../_shared/intakeSchema";

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
      rejected: [],
    });
  });

  // Strict: a value the intake schema refuses is not repaired and not passed on. The browser would
  // otherwise have to guess, and the database would refuse the save.
  it("refuses a value the intake schema doesn't accept as sent, and says which and why", () => {
    const shaped = shapeExtraction({
      company_name: "Acme",
      hq_state: "ca",
      states: ["CA", "XX"],
      employee_count: 12.5,
      has_401k: "yes",
      key_challenges: "x".repeat(1001),
      field_status: { company_name: "confirmed", hq_state: "confirmed", states: "confirmed" },
      evidence: { hq_state: "in california" },
      corrected_fields: ["hq_state"],
    });
    expect(shaped.extracted).toEqual({ company_name: "Acme" });
    expect(shaped.field_status).toEqual({ company_name: "confirmed" });
    expect(shaped.evidence).toEqual({});
    expect(shaped.corrected_fields).toEqual([]);
    expect(shaped.rejected.map((issue) => issue.path)).toEqual(["hq_state", "states[1]", "employee_count", "has_401k", "key_challenges"]);
    expect(shaped.rejected.find((issue) => issue.path === "key_challenges")?.reason).toBe("must be at most 1000 characters");
  });

  it("never echoes a refused value in its reasons", () => {
    const { rejected } = shapeExtraction({ hq_state: "Secret Street 12", employee_count: "forty" });
    expect(JSON.stringify(rejected)).not.toMatch(/Secret|forty/);
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
    expect(emptyExtraction()).toEqual({ extracted: {}, field_status: {}, evidence: {}, corrected_fields: [], reply: null, rejected: [] });
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

// US-2.1b: the contract covers every top-level field of the intake schema but the census.
describe("the extraction contract", () => {
  const PROPERTIES = INTAKE_SCHEMA.properties as Record<string, { type: unknown; enum?: unknown[] }>;
  // A value the schema accepts for each kind of field, as the model would send it.
  const sample = (key: string): unknown => {
    if (key === "hq_state") return "NY";
    if (key === "states") return ["NY", "NJ"];
    const types = Array.isArray(PROPERTIES[key].type) ? (PROPERTIES[key].type as string[]) : [PROPERTIES[key].type as string];
    if (types.includes("array")) return ["Dental"];
    if (types.includes("boolean")) return false;
    if (types.includes("integer")) return 0;
    if (types.includes("number")) return 0.92;
    return "Acme";
  };

  it("asks for every field of the intake schema but the census, each with a guide for the model and a type", () => {
    expect([...FIELDS].sort()).toEqual(Object.keys(PROPERTIES).filter((k) => k !== "census").sort());
    for (const key of FIELDS) {
      expect(FIELD_GUIDE[key], key).toBeTruthy();
      expect(SYSTEM_PROMPT).toContain(`- ${key} (`);
      expect((EXTRACT_TOOL.parameters.properties as Record<string, unknown>)[key], key).toBeTruthy();
    }
    expect(Object.keys(FIELD_GUIDE).sort()).toEqual([...FIELDS].sort());
    expect(EXTRACT_TOOL.parameters.properties).not.toHaveProperty("census");
  });

  it.each(Object.keys(PROPERTIES).filter((k) => k !== "census"))("takes an answer for %s, with its status and evidence", (key) => {
    const value = sample(key);
    const shaped = shapeExtraction({ [key]: value, field_status: { [key]: "confirmed" }, evidence: { [key]: "as they said" } });
    expect(shaped.extracted).toEqual({ [key]: value });
    expect(shaped.field_status).toEqual({ [key]: "confirmed" });
    expect(shaped.evidence).toEqual({ [key]: "as they said" });
    expect(shaped.rejected).toEqual([]);
  });

  it("never takes the census from chat", () => {
    const shaped = shapeExtraction({ census: [{ id: "1", first_name: "Ada" }], field_status: { census: "unknown" } });
    expect(shaped.extracted).toEqual({});
    expect(shaped.field_status).toEqual({});
  });

  it("records a field the prospect doesn't know as unknown, with its evidence and no answer", () => {
    const shaped = shapeExtraction({
      field_status: { wc_experience_mod: "unknown", renewal_date: "unknown" },
      evidence: { wc_experience_mod: "no idea what our mod is", renewal_date: "not sure when it renews" },
      reply: "No matter.",
    });
    expect(shaped.extracted).toEqual({});
    expect(shaped.field_status).toEqual({ wc_experience_mod: "unknown", renewal_date: "unknown" });
    expect(shaped.evidence).toEqual({ wc_experience_mod: "no idea what our mod is", renewal_date: "not sure when it renews" });
  });

  it("doesn't call an answer unknown, or a refused answer unknown", () => {
    const shaped = shapeExtraction({
      employee_count: 12,
      hq_state: "new york",
      field_status: { employee_count: "unknown", hq_state: "unknown", made_up_field: "unknown" },
    });
    // An answer marked unknown keeps the answer, without the contradictory status.
    expect(shaped.extracted).toEqual({ employee_count: 12 });
    expect(shaped.field_status).toEqual({});
    expect(shaped.rejected.map((r) => r.path)).toEqual(["hq_state"]);
  });

  it("never takes conflicting or not applicable from the model: only a disagreement or the prospect sets those", () => {
    const shaped = shapeExtraction({
      industry: "Print",
      field_status: { industry: "conflicting", hq_state: "not_applicable" },
    });
    expect(shaped.extracted).toEqual({ industry: "Print" });
    expect(shaped.field_status).toEqual({});
  });
});
