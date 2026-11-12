import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_CHAMBER_DATA } from "./chamberTypes";
import { parseChamberData } from "./chamberValidation";
import type { ChamberSubmission } from "./manuscript";
import type { ProvenanceMap } from "./provenance";
import { assertSupportedSchema, validateAgainst, type JsonSchema } from "../../supabase/functions/_shared/intakeSchema";
import { certifiedAnswersDocument, certifiedAnswersFilename, certifiedAnswersSource, type CertifiedAnswersSource } from "./certifiedAnswersDocument";

// The published schema, read from the file consumers get, not from the code that generates it.
const published = JSON.parse(readFileSync("docs/intake-schema.v3.json", "utf8")) as JsonSchema;

const by = { source: { kind: "prospect_edit" as const }, updated_at: "2026-05-01T00:00:00Z" };

// Made up for the tests: nobody real. As the database stamps a certification.
const submission: ChamberSubmission = {
  signer_name: "Jo Sample",
  signer_title: "CEO",
  signed_at: "2026-05-01T12:00:00Z",
  certified_at: "2026-05-01T12:00:03Z",
  file_id: "EAA-2026-0042",
  version: 3,
  data_version: 17,
  consent_version: "2026-04-01",
  data_sha256: "9f2c0b6e4a1d8c3f5e7a9b2d4c6e8f0a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e",
  peo: "Sample PEO",
};

const source = (over: Partial<CertifiedAnswersSource> = {}, provenance: ProvenanceMap = {}): CertifiedAnswersSource => ({
  data: parseChamberData(DEMO_CHAMBER_DATA),
  provenance,
  submission,
  fileId: "EAA-2026-0042",
  ...over,
});

describe("certifiedAnswersDocument: the certified answers as JSON against the published schema", () => {
  it("holds answers, census included, that validate against the published intake schema file", () => {
    assertSupportedSchema(published);
    const doc = certifiedAnswersDocument(source());
    expect(doc.answers.census.length).toBeGreaterThan(0);
    expect(validateAgainst(published, doc.answers)).toEqual([]);
    expect(doc.answers_schema).toEqual({ id: "urn:edgar-allan-advisory:intake:chamber-data:v3", version: 3 });
  });

  it("carries the answers schema v3 added as certified, the FEIN in full as the packet prints it (ADR 0006)", () => {
    const data = parseChamberData({
      ...DEMO_CHAMBER_DATA,
      fein: "123456789",
      naics_code: "541430",
      owners_officers: [{ name: "Dana Sample", title: "President", ownership_percent: 60, duties: "Runs the studio", covered: true }],
      loss_history: [{ policy_year: 2025, carrier: "Sample Mutual", claims: 0 }],
      suta_rates: [{ state: "CA", rate: 3.4, year: 2026 }],
    });
    const doc = certifiedAnswersDocument(source({ data }, { fein: { status: "confirmed", ...by }, owners_officers: { status: "confirmed", ...by } }));
    expect(validateAgainst(published, doc.answers)).toEqual([]);
    expect(doc.answers.fein).toBe("123456789");
    expect(doc.answers.naics_code).toBe("541430");
    expect(doc.answers.owners_officers).toEqual([{ name: "Dana Sample", title: "President", ownership_percent: 60, duties: "Runs the studio", covered: true }]);
    expect(doc.answers.loss_history).toEqual([{ policy_year: 2025, carrier: "Sample Mutual", claims: 0 }]);
    expect(doc.answers.suta_rates).toEqual([{ state: "CA", rate: 3.4, year: 2026 }]);
    expect(doc.answer_status).toMatchObject({ fein: "confirmed", owners_officers: "confirmed", loss_history: null });
  });

  it("names the File ID, the certified version and the certification as the database stamped it", () => {
    const doc = certifiedAnswersDocument(source());
    expect(doc.kind).toBe("certified_intake_answers");
    expect(doc.kind_version).toBe(1);
    expect(doc.file_id).toBe("EAA-2026-0042");
    expect(doc.version).toBe(3);
    expect(doc.certification).toEqual({
      signer_name: "Jo Sample",
      signer_title: "CEO",
      signed_at: "2026-05-01T12:00:00Z",
      certified_at: "2026-05-01T12:00:03Z",
      statement_version: "2026-04-01",
      data_version: 17,
      stored_data_sha256: "9f2c0b6e4a1d8c3f5e7a9b2d4c6e8f0a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e",
    });
  });

  it("gives each answer its status as certified, in the schema's words, and null where none was recorded", () => {
    const doc = certifiedAnswersDocument(source({}, {
      company_name: { status: "confirmed", ...by },
      industry: { status: "inferred", ...by },
      hq_state: { status: "unknown", ...by },
      wc_carrier: { status: "not_applicable", ...by },
      employee_count: { status: "incomplete", ...by },
      payroll_vendor: { status: "conflicting", ...by, candidates: [{ value: "Sample Payroll", source: { kind: "prospect_edit" } }] },
    }));
    expect(Object.keys(doc.answer_status)).toEqual(Object.keys(doc.answers));
    expect(doc.answer_status).toMatchObject({
      company_name: "confirmed", industry: "inferred", hq_state: "unknown", wc_carrier: "not_applicable", employee_count: "incomplete", payroll_vendor: "conflicting", states: null,
    });
  });

  it("keeps an answer the prospect didn't confirm marked inferred, even when an advisor has verified it since", () => {
    // A caller holding an advisor's verifications beside the answers: the document reads none of them.
    const from = { ...source({}, { industry: { status: "inferred", ...by } }), verified: new Set(["industry"]) };
    const doc = certifiedAnswersDocument(from);
    expect(doc.answer_status.industry).toBe("inferred");
  });

  it("never pairs an answer it couldn't read with the status the certification gave it: a dropped value reads unreadable", () => {
    // Hand-built: the database stored an hq_state and an employee_count the browser's parser drops, as a later
    // stricter rule would, so `answers` holds null where the certification recorded a confirmed or inferred answer.
    const stored = { ...DEMO_CHAMBER_DATA, hq_state: "Atlantis", employee_count: -3, states: ["Narnia"] };
    const doc = certifiedAnswersDocument(source({ data: parseChamberData(stored) }, {
      hq_state: { status: "confirmed", ...by },
      employee_count: { status: "inferred", ...by },
      states: { status: "incomplete", ...by },
      wc_carrier: { status: "unknown", ...by },
      payroll_vendor: { status: "not_applicable", ...by },
      company_name: { status: "confirmed", ...by },
    }));
    expect(doc.answers.hq_state).toBeNull();
    expect(doc.answers.employee_count).toBeNull();
    expect(doc.answers.states).toEqual([]);
    expect(doc.answer_status).toMatchObject({
      hq_state: "unreadable", employee_count: "unreadable", states: "unreadable",
      // Statuses that hold no answer on purpose, and an answer that was read, stay as certified.
      wc_carrier: "unknown", payroll_vendor: "not_applicable", company_name: "confirmed",
    });
    expect(validateAgainst(published, doc.answers)).toEqual([]);
  });

  it("never carries a PEO's own questions or answers, nor anything an advisor wrote, whatever the source holds beside the answers", () => {
    const extra = { "7": { fleet: { question: "SENTINEL-QUESTION Do you run a fleet?", kind: "yes_no" as const, value: true, status: "confirmed" as const, ...by } } };
    const base = source({ submission: { ...submission, extra_answers: extra, transcript: [{ id: "m1", text: "SENTINEL-TRANSCRIPT" }] } as ChamberSubmission });
    // An advisor's notes and reviews, and a stray key, riding along at runtime as a careless caller might pass them.
    const leaky = {
      ...base,
      extraAnswers: extra,
      verified: new Set(["industry"]),
      data: { ...base.data, advisor_correction: "SENTINEL-CORRECTION" },
      notes: [{ body: "SENTINEL-NOTE" }],
      reviews: { industry: { review_state: "verified", advisor_value: "SENTINEL-REVIEW", reason: "SENTINEL-REASON" } },
    } as unknown as CertifiedAnswersSource;
    const doc = certifiedAnswersDocument(leaky);
    const text = JSON.stringify(doc);
    expect(text).not.toMatch(/SENTINEL|fleet|extra_answers|verified|transcript/);
    expect(Object.keys(doc)).toEqual(["kind", "kind_version", "file_id", "version", "certification", "answers_schema", "answers", "answer_status"]);
    expect(validateAgainst(published, doc.answers)).toEqual([]);
  });

  it("says null for what a certification from before it was recorded doesn't hold, and reads the statement's older name", () => {
    const older: ChamberSubmission = { signer_name: "Jo Sample", signer_title: "CEO", signed_at: "2026-03-01T09:00:00Z", file_id: "EAA-2026-0042", consent_text_version: "2026-01-15" };
    const doc = certifiedAnswersDocument(source({ submission: older }));
    expect(doc.version).toBeNull();
    expect(doc.certification).toEqual({
      signer_name: "Jo Sample", signer_title: "CEO", signed_at: "2026-03-01T09:00:00Z", certified_at: null, statement_version: "2026-01-15", data_version: null, stored_data_sha256: null,
    });
  });

  it("is named for the File ID and the certified version", () => {
    expect(certifiedAnswersFilename(certifiedAnswersDocument(source()))).toBe("EAA-2026-0042-answers-v3.json");
    const older = certifiedAnswersDocument(source({ submission: { ...submission, version: undefined } }));
    expect(certifiedAnswersFilename(older)).toBe("EAA-2026-0042-answers.json");
  });

  it("is made from a page's certified answers by one helper, and not at all without a certification or a File ID", () => {
    const data = parseChamberData(DEMO_CHAMBER_DATA);
    const page = { data, provenance: {}, submission, fileId: "EAA-2026-0042", notes: ["kept out"] };
    expect(certifiedAnswersSource(page)).toEqual({ data, provenance: {}, submission, fileId: "EAA-2026-0042" });
    expect(certifiedAnswersSource({ ...page, submission: null })).toBeNull();
    expect(certifiedAnswersSource({ ...page, fileId: null })).toBeNull();
  });
});
