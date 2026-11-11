import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_CHAMBER_DATA } from "./chamberTypes";
import { parseChamberData } from "./chamberValidation";
import type { ChamberSubmission } from "./manuscript";
import type { CertifiedIntake } from "./peoCompleteness";
import type { ProvenanceMap } from "./provenance";
import { assertSupportedSchema, validateAgainst, type JsonSchema } from "../../supabase/functions/_shared/intakeSchema";
import { certifiedAnswersExport, certifiedAnswersFilename, type CertifiedAnswersSource } from "./certifiedAnswersExport";

// The published schema, read from the file consumers get, not from the code that generates it.
const published = JSON.parse(readFileSync("docs/intake-schema.v2.json", "utf8")) as JsonSchema;

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
  intake: { data: parseChamberData(DEMO_CHAMBER_DATA), provenance, verified: new Set(), extraAnswers: null },
  submission,
  fileId: "EAA-2026-0042",
  ...over,
});

describe("certifiedAnswersExport: the certified answers as JSON against the published schema", () => {
  it("holds answers, census included, that validate against the published intake schema file", () => {
    assertSupportedSchema(published);
    const doc = certifiedAnswersExport(source());
    expect(doc.answers.census.length).toBeGreaterThan(0);
    expect(validateAgainst(published, doc.answers)).toEqual([]);
    expect(doc.answers_schema).toEqual({ id: "urn:edgar-allan-advisory:intake:chamber-data:v2", version: 2 });
  });

  it("names the File ID, the certified version and the certification as the database stamped it", () => {
    const doc = certifiedAnswersExport(source());
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
      data_sha256: "9f2c0b6e4a1d8c3f5e7a9b2d4c6e8f0a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e",
    });
  });

  it("gives each answer its status as certified, in the schema's words, and null where none was recorded", () => {
    const doc = certifiedAnswersExport(source({}, {
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
    const from = source({}, { industry: { status: "inferred", ...by } });
    const doc = certifiedAnswersExport({ ...from, intake: { ...from.intake, verified: new Set(["industry"]) } });
    expect(doc.answer_status.industry).toBe("inferred");
  });

  it("never carries a PEO's own questions or answers, nor anything an advisor wrote, whatever the source holds beside the answers", () => {
    const extra = { "7": { fleet: { question: "SENTINEL-QUESTION Do you run a fleet?", kind: "yes_no" as const, value: true, status: "confirmed" as const, ...by } } };
    const base = source({ submission: { ...submission, extra_answers: extra, transcript: [{ id: "m1", text: "SENTINEL-TRANSCRIPT" }] } as ChamberSubmission });
    const intake: CertifiedIntake = { ...base.intake, extraAnswers: extra, verified: new Set(["industry"]) };
    // An advisor's notes and reviews, and a stray key, riding along at runtime as a careless caller might pass them.
    const leaky = {
      ...base,
      intake: { ...intake, data: { ...intake.data, advisor_correction: "SENTINEL-CORRECTION" } },
      notes: [{ body: "SENTINEL-NOTE" }],
      reviews: { industry: { review_state: "verified", advisor_value: "SENTINEL-REVIEW", reason: "SENTINEL-REASON" } },
    } as unknown as CertifiedAnswersSource;
    const doc = certifiedAnswersExport(leaky);
    const text = JSON.stringify(doc);
    expect(text).not.toMatch(/SENTINEL|fleet|extra_answers|verified|transcript/);
    expect(Object.keys(doc)).toEqual(["kind", "kind_version", "file_id", "version", "certification", "answers_schema", "answers", "answer_status"]);
    expect(validateAgainst(published, doc.answers)).toEqual([]);
  });

  it("says null for what a certification from before it was recorded doesn't hold, and reads the statement's older name", () => {
    const older: ChamberSubmission = { signer_name: "Jo Sample", signer_title: "CEO", signed_at: "2026-03-01T09:00:00Z", file_id: "EAA-2026-0042", consent_text_version: "2026-01-15" };
    const doc = certifiedAnswersExport(source({ submission: older }));
    expect(doc.version).toBeNull();
    expect(doc.certification).toEqual({
      signer_name: "Jo Sample", signer_title: "CEO", signed_at: "2026-03-01T09:00:00Z", certified_at: null, statement_version: "2026-01-15", data_version: null, data_sha256: null,
    });
  });

  it("is named for the File ID and the certified version", () => {
    expect(certifiedAnswersFilename(certifiedAnswersExport(source()))).toBe("EAA-2026-0042-answers-v3.json");
    const older = certifiedAnswersExport(source({ submission: { ...submission, version: undefined } }));
    expect(certifiedAnswersFilename(older)).toBe("EAA-2026-0042-answers.json");
  });
});
