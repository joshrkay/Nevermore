import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import {
  applyExtraction,
  applyFieldAction,
  fieldOpenItems,
  parseEvidence,
  parseExtractedStatuses,
  parseProvenance,
  transcriptExtraction,
  type FieldSource,
  type IntakeState,
} from "./provenance";

const NOW = new Date("2026-10-20T12:00:00Z");
const EMPTY: IntakeState = { data: EMPTY_CHAMBER_DATA, provenance: {} };
const msg = (id: string): FieldSource => ({ kind: "transcript", message_id: id });

describe("applyExtraction", () => {
  it("records the source message and defaults the status to inferred", () => {
    const next = applyExtraction(EMPTY, { employee_count: 40 }, { source: msg("m1"), now: NOW });
    expect(next.data.employee_count).toBe(40);
    expect(next.provenance.employee_count).toEqual({
      status: "inferred",
      source: { kind: "transcript", message_id: "m1" },
      updated_at: NOW.toISOString(),
    });
  });

  it("keeps the model's status and evidence quote per field", () => {
    const next = applyExtraction(
      EMPTY,
      { company_name: "Acme", industry: "Retail" },
      { source: msg("m1"), statuses: { company_name: "confirmed" }, evidence: { company_name: "We're Acme" } },
    );
    expect(next.provenance.company_name).toMatchObject({ status: "confirmed", source: { quote: "We're Acme" } });
    expect(next.provenance.industry?.status).toBe("inferred");
  });

  it("records a document source reference", () => {
    const source: FieldSource = { kind: "document", document_id: "d1", document_name: "census.csv", location: "row 4" };
    const next = applyExtraction(EMPTY, { employee_count: 12 }, { source });
    expect(next.provenance.employee_count?.source).toEqual(source);
  });

  it("drops invalid and empty values without recording provenance", () => {
    const next = applyExtraction(EMPTY, { hq_state: "California", states: [], company_name: null }, { source: msg("m1") });
    expect(next.provenance).toEqual({});
    expect(next.data).toEqual(EMPTY_CHAMBER_DATA);
  });

  it("never overwrites a value the prospect entered", () => {
    const edited = applyFieldAction(EMPTY, { type: "edit", field: "employee_count", value: 42 });
    const next = applyExtraction(edited, { employee_count: 45 }, { source: msg("m2"), corrections: ["employee_count"] });
    expect(next.data.employee_count).toBe(42);
    expect(next.provenance.employee_count).toMatchObject({ status: "confirmed", source: { kind: "prospect_edit" } });
  });

  it("captures two different AI values as a conflict instead of replacing", () => {
    const first = applyExtraction(EMPTY, { employee_count: 40 }, { source: msg("m1") });
    const next = applyExtraction(first, { employee_count: 45 }, { source: msg("m2") });
    expect(next.data.employee_count).toBe(40);
    expect(next.provenance.employee_count?.status).toBe("conflicting");
    expect(next.provenance.employee_count?.candidates).toEqual([
      { value: 40, source: msg("m1") },
      { value: 45, source: msg("m2") },
    ]);
  });

  it("conflicts between a document and the transcript", () => {
    const doc = applyExtraction(EMPTY, { employee_count: 30 }, { source: { kind: "document", document_id: "d1" } });
    const next = applyExtraction(doc, { employee_count: 32 }, { source: msg("m1") });
    expect(next.provenance.employee_count?.status).toBe("conflicting");
  });

  it("lets an explicit prospect correction in chat replace an earlier inference", () => {
    const first = applyExtraction(EMPTY, { employee_count: 40 }, { source: msg("m1") });
    const next = applyExtraction(first, { employee_count: 45 }, { source: msg("m2"), corrections: ["employee_count"] });
    expect(next.data.employee_count).toBe(45);
    expect(next.provenance.employee_count).toMatchObject({ status: "inferred", source: msg("m2") });
  });

  it("treats a list that only adds entries as an update, not a conflict", () => {
    const first = applyExtraction(EMPTY, { states: ["CA"] }, { source: msg("m1") });
    const next = applyExtraction(first, { states: ["CA", "TX"] }, { source: msg("m2") });
    expect(next.data.states).toEqual(["CA", "TX"]);
    expect(next.provenance.states?.status).toBe("inferred");
  });

  it("raises an inferred value to confirmed when stated again, but never lowers it", () => {
    const first = applyExtraction(EMPTY, { pay_frequency: "Bi-weekly" }, { source: msg("m1") });
    const up = applyExtraction(first, { pay_frequency: "Bi-weekly" }, { source: msg("m2"), statuses: { pay_frequency: "confirmed" } });
    expect(up.provenance.pay_frequency?.status).toBe("confirmed");
    const again = applyExtraction(up, { pay_frequency: "Bi-weekly" }, { source: msg("m3") });
    expect(again.provenance.pay_frequency?.status).toBe("confirmed");
  });

  it("overwrites values from sessions saved before provenance existed", () => {
    const legacy: IntakeState = { data: { ...EMPTY_CHAMBER_DATA, employee_count: 10 }, provenance: {} };
    const next = applyExtraction(legacy, { employee_count: 12 }, { source: msg("m1") });
    expect(next.data.employee_count).toBe(12);
  });
});

describe("applyFieldAction", () => {
  const inferred = applyExtraction(EMPTY, { employee_count: 40 }, { source: msg("m1") });

  it("confirming marks the value confirmed by the prospect", () => {
    const next = applyFieldAction(inferred, { type: "confirm", field: "employee_count" }, NOW);
    expect(next.data.employee_count).toBe(40);
    expect(next.provenance.employee_count).toEqual({ status: "confirmed", source: { kind: "prospect_edit" }, updated_at: NOW.toISOString() });
  });

  it("editing saves the validated value and supersedes the AI value", () => {
    const next = applyFieldAction(inferred, { type: "edit", field: "employee_count", value: "42" });
    expect(next.data.employee_count).toBe(42);
    expect(next.provenance.employee_count?.source).toEqual({ kind: "prospect_edit" });
  });

  it("rejects an invalid edit without changing anything", () => {
    const next = applyFieldAction(inferred, { type: "edit", field: "hq_state", value: "Nowhere" });
    expect(next).toBe(inferred);
  });

  it("resolves a conflict with the chosen candidate", () => {
    const conflict = applyExtraction(inferred, { employee_count: 45 }, { source: msg("m2") });
    expect(applyFieldAction(conflict, { type: "confirm", field: "employee_count" })).toBe(conflict);
    const next = applyFieldAction(conflict, { type: "resolve", field: "employee_count", candidate: 1 });
    expect(next.data.employee_count).toBe(45);
    expect(next.provenance.employee_count).toMatchObject({ status: "confirmed" });
    expect(next.provenance.employee_count?.candidates).toBeUndefined();
  });
});

describe("fieldOpenItems", () => {
  it("lists conflicting, incomplete and inferred fields with a reason, and clears them once confirmed", () => {
    let state = applyExtraction(EMPTY, { employee_count: 40, company_name: "Acme", states: ["CA"] }, {
      source: msg("m1"),
      statuses: { company_name: "confirmed", states: "incomplete" },
    });
    state = applyExtraction(state, { employee_count: 45 }, { source: msg("m2") });
    expect(fieldOpenItems(state.provenance)).toEqual([
      { field: "employee_count", label: "Employee count", reason: "Conflicting answers" },
      { field: "states", label: "States of operation", reason: "Incomplete" },
    ]);

    state = applyFieldAction(state, { type: "resolve", field: "employee_count", candidate: 0 });
    state = applyFieldAction(state, { type: "edit", field: "states", value: "CA, TX" });
    expect(fieldOpenItems(state.provenance)).toEqual([]);

    state = applyExtraction(state, { industry: "Retail" }, { source: msg("m3") });
    expect(fieldOpenItems(state.provenance)).toEqual([{ field: "industry", label: "Industry", reason: "Please confirm" }]);
  });
});

describe("parsing", () => {
  it("round-trips stored provenance and drops malformed entries", () => {
    const state = applyExtraction(EMPTY, { employee_count: 40 }, { source: msg("m1") });
    const stored = JSON.parse(JSON.stringify(state.provenance));
    expect(parseProvenance(stored)).toEqual(state.provenance);
    expect(
      parseProvenance({
        ...stored,
        unknown_field: stored.employee_count,
        industry: { status: "guessed", source: { kind: "transcript", message_id: "m1" }, updated_at: "x" },
        hq_state: { status: "inferred", source: { kind: "hearsay" }, updated_at: "x" },
      }),
    ).toEqual(state.provenance);
    expect(parseProvenance(null)).toEqual({});
    expect(parseProvenance([])).toEqual({});
  });

  it("keeps only known fields and statuses from the model", () => {
    expect(parseExtractedStatuses({ employee_count: "confirmed", industry: "conflicting", nope: "inferred" })).toEqual({
      employee_count: "confirmed",
    });
    expect(parseEvidence({ employee_count: "  about 40  ", industry: 3 })).toEqual({ employee_count: "about 40" });
  });
});

describe("transcriptExtraction", () => {
  it("never leaves half an emoji in the quote, which Postgres jsonb refuses", () => {
    const text = `${"a".repeat(198)}😀${"b".repeat(20)}`;
    const { source } = transcriptExtraction({ id: "m1", text }, {});
    const quote = (source as { quote: string }).quote;
    expect(quote).toBe(`${"a".repeat(198)}…`);
    expect(JSON.stringify(quote)).not.toMatch(/\\ud[89ab]/i);
  });
});
