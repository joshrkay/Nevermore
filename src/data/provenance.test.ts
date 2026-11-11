import { describe, expect, it } from "vitest";
import { PROMPT_VERSION } from "../../supabase/functions/chamber-extract/schema.ts";
import { ACORD_DERIVED } from "./acordRules";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "./chamberTypes";
import {
  applyChosenValue,
  applyExtraction,
  applyFieldAction,
  FIELD_LABELS,
  fieldOpenItems,
  parseEvidence,
  parseExtractedStatuses,
  parseProvenance,
  transcriptExtraction,
  type ExtractionOptions,
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

  it("lets an explicit prospect correction in chat replace an earlier inference, noting nothing", () => {
    const first = applyExtraction(EMPTY, { employee_count: 40 }, { source: msg("m1") });
    const next = applyExtraction(first, { employee_count: 45 }, { source: msg("m2"), corrections: ["employee_count"] });
    expect(next.data.employee_count).toBe(45);
    expect(next.provenance.employee_count).toEqual({ status: "inferred", source: msg("m2"), updated_at: expect.any(String) });
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

describe("applyExtraction's precedence ladder", () => {
  const T0 = new Date("2026-11-01T00:00:00Z");
  const doc = (id: string): FieldSource => ({ kind: "document", document_id: id, document_name: `${id}.pdf` });
  // A document's values reach applyExtraction confirmed, as applyDocumentCandidates applies them.
  const fromDoc = (state: IntakeState, id: string, patch: Record<string, unknown>, now = NOW) =>
    applyExtraction(state, patch, {
      source: doc(id),
      statuses: Object.fromEntries(Object.keys(patch).map((k) => [k, "confirmed"])),
      now,
    });
  const fromChat = (state: IntakeState, id: string, patch: Record<string, unknown>, opts: Partial<ExtractionOptions> = {}) =>
    applyExtraction(state, patch, { source: msg(id), now: NOW, ...opts });
  const edited = (field: "employee_count" | "states", value: unknown) => applyFieldAction(EMPTY, { type: "edit", field, value }, T0);

  describe("between different ranks", () => {
    it("a document replaces a chat value, which is kept as also heard", () => {
      const chat = applyExtraction(EMPTY, { employee_count: 40 }, { source: msg("m1"), now: T0 });
      const next = fromDoc(chat, "d1", { employee_count: 30 });
      expect(next.data.employee_count).toBe(30);
      expect(next.provenance.employee_count).toEqual({
        status: "confirmed",
        source: doc("d1"),
        updated_at: NOW.toISOString(),
        also_heard: [{ value: 40, source: msg("m1") }],
      });
    });

    it("chat never replaces a document value: the chat value is only noted", () => {
      const fromFile = fromDoc(EMPTY, "d1", { employee_count: 30 }, T0);
      const next = fromChat(fromFile, "m1", { employee_count: 32 }, { statuses: { employee_count: "confirmed" }, evidence: { employee_count: "32 now" } });
      expect(next.data.employee_count).toBe(30);
      expect(next.provenance.employee_count).toEqual({
        status: "confirmed",
        source: doc("d1"),
        updated_at: NOW.toISOString(),
        also_heard: [{ value: 32, source: { ...msg("m1"), quote: "32 now" } }],
      });
    });

    it("neither a document nor chat touches the prospect's own answer, or notes anything on it", () => {
      const own = edited("employee_count", 42);
      expect(fromDoc(own, "d1", { employee_count: 30 })).toEqual(own);
      expect(fromChat(own, "m1", { employee_count: 32 })).toEqual(own);
      expect(fromChat(own, "m1", { employee_count: 32 }, { corrections: ["employee_count"] })).toEqual(own);
      const ownList = edited("states", ["CA"]);
      expect(fromChat(ownList, "m1", { states: ["CA", "TX"] })).toEqual(ownList);
    });

    it("a document settles a conflict between chat answers, noting every one it replaced", () => {
      const conflict = fromChat(fromChat(EMPTY, "m1", { employee_count: 40 }), "m2", { employee_count: 45 });
      expect(conflict.provenance.employee_count?.status).toBe("conflicting");
      const next = fromDoc(conflict, "d1", { employee_count: 50 });
      expect(next.data.employee_count).toBe(50);
      expect(next.provenance.employee_count).toEqual({
        status: "confirmed",
        source: doc("d1"),
        updated_at: NOW.toISOString(),
        also_heard: [{ value: 40, source: msg("m1") }, { value: 45, source: msg("m2") }],
      });
    });

    it("a document that agrees with one of the conflicting chat answers settles on it", () => {
      const conflict = fromChat(fromChat(EMPTY, "m1", { employee_count: 40 }), "m2", { employee_count: 45 });
      for (const [value, other] of [[45, 40], [40, 45]]) {
        const next = fromDoc(conflict, "d1", { employee_count: value });
        expect(next.data.employee_count).toBe(value);
        expect(next.provenance.employee_count).toMatchObject({ status: "confirmed", source: doc("d1"), also_heard: [{ value: other }] });
        expect(next.provenance.employee_count).not.toHaveProperty("candidates");
      }
    });

    it("chat against conflicting documents is noted, and the field stays conflicting", () => {
      const conflict = fromDoc(fromDoc(EMPTY, "d1", { employee_count: 30 }), "d2", { employee_count: 32 });
      const next = fromChat(conflict, "m1", { employee_count: 35 });
      expect(next.data.employee_count).toBe(30);
      expect(next.provenance.employee_count).toEqual({
        ...conflict.provenance.employee_count,
        also_heard: [{ value: 35, source: msg("m1") }],
      });
      // Chat repeating one of the documents' values adds nothing.
      expect(fromChat(conflict, "m1", { employee_count: 32 })).toEqual(conflict);
    });
  });

  describe("within one rank", () => {
    it("conflicts between two documents, as between two chat answers", () => {
      const next = fromDoc(fromDoc(EMPTY, "d1", { employee_count: 30 }), "d2", { employee_count: 32 });
      expect(next.data.employee_count).toBe(30);
      expect(next.provenance.employee_count).toMatchObject({
        status: "conflicting",
        source: doc("d1"),
        candidates: [{ value: 30, source: doc("d1") }, { value: 32, source: doc("d2") }],
      });
      expect(next.provenance.employee_count).not.toHaveProperty("also_heard");
    });

    it("keeps what was heard earlier when a field becomes conflicting", () => {
      const noted = fromChat(fromDoc(EMPTY, "d1", { employee_count: 30 }), "m1", { employee_count: 35 });
      const next = fromDoc(noted, "d2", { employee_count: 32 });
      expect(next.provenance.employee_count).toMatchObject({ status: "conflicting", also_heard: [{ value: 35, source: msg("m1") }] });
    });
  });

  describe("explicit corrections", () => {
    const corrected = { corrections: ["employee_count" as const] };

    it("replace a document value, which is noted because it came from another kind of source", () => {
      const fromFile = fromDoc(EMPTY, "d1", { employee_count: 30 });
      const next = fromChat(fromFile, "m1", { employee_count: 35 }, corrected);
      expect(next.data.employee_count).toBe(35);
      expect(next.provenance.employee_count).toEqual({
        status: "inferred",
        source: msg("m1"),
        updated_at: NOW.toISOString(),
        also_heard: [{ value: 30, source: doc("d1") }],
      });
    });

    it("settle a conflict, noting only the candidates from another kind of source", () => {
      const docs = fromDoc(fromDoc(EMPTY, "d1", { employee_count: 30 }), "d2", { employee_count: 32 });
      const overDocs = fromChat(docs, "m1", { employee_count: 35 }, corrected);
      expect(overDocs.data.employee_count).toBe(35);
      expect(overDocs.provenance.employee_count?.also_heard?.map((h) => h.value)).toEqual([30, 32]);
      expect(overDocs.provenance.employee_count).not.toHaveProperty("candidates");

      const chats = fromChat(fromChat(EMPTY, "m1", { employee_count: 40 }), "m2", { employee_count: 45 });
      const overChats = fromChat(chats, "m3", { employee_count: 45 }, corrected);
      expect(overChats.data.employee_count).toBe(45);
      expect(overChats.provenance.employee_count).toEqual({ status: "inferred", source: msg("m3"), updated_at: NOW.toISOString() });
    });

    it("drop a noted value once it becomes the field's value", () => {
      const noted = fromChat(fromDoc(EMPTY, "d1", { employee_count: 30 }), "m1", { employee_count: 32 });
      const next = fromChat(noted, "m2", { employee_count: 32 }, corrected);
      expect(next.data.employee_count).toBe(32);
      expect(next.provenance.employee_count?.also_heard).toEqual([{ value: 30, source: doc("d1") }]);
    });
  });

  describe("lists that only add entries", () => {
    it("chat extending a document's list keeps every entry, takes the chat source and asks the prospect to confirm", () => {
      const fromFile = fromDoc(EMPTY, "d1", { states: ["CA", "NY"] });
      const next = fromChat(fromFile, "m1", { states: ["CA", "NY", "TX"] }, {
        statuses: { states: "confirmed" },
        evidence: { states: "also Texas" },
      });
      expect(next.data.states).toEqual(["CA", "NY", "TX"]);
      expect(next.provenance.states).toEqual({
        status: "inferred",
        source: { ...msg("m1"), quote: "also Texas" },
        updated_at: NOW.toISOString(),
      });
    });

    it("a document extending a chat list takes the document's source and status", () => {
      const chat = fromChat(EMPTY, "m1", { states: ["CA"] });
      const next = fromDoc(chat, "d1", { states: ["CA", "NY"] });
      expect(next.data.states).toEqual(["CA", "NY"]);
      expect(next.provenance.states).toEqual({ status: "confirmed", source: doc("d1"), updated_at: NOW.toISOString() });
    });

    it("an extension from the same rank keeps the model's status", () => {
      const chat = fromChat(EMPTY, "m1", { states: ["CA"] });
      const next = fromChat(chat, "m2", { states: ["CA", "TX"] }, { statuses: { states: "confirmed" } });
      expect(next.provenance.states).toMatchObject({ status: "confirmed", source: msg("m2") });
    });

    it("once chat has extended it, a different document list outranks it", () => {
      const extended = fromChat(fromDoc(EMPTY, "d1", { states: ["CA", "NY"] }), "m1", { states: ["CA", "NY", "TX"] });
      const next = fromDoc(extended, "d2", { states: ["CA"] });
      expect(next.data.states).toEqual(["CA"]);
      expect(next.provenance.states).toMatchObject({
        status: "confirmed",
        source: doc("d2"),
        also_heard: [{ value: ["CA", "NY", "TX"], source: msg("m1") }],
      });
    });

    it("an extension that settles a conflict notes the competing list it didn't include", () => {
      const conflict = fromChat(fromChat(EMPTY, "m1", { states: ["CA"] }), "m2", { states: ["NY"] });
      const next = fromChat(conflict, "m3", { states: ["CA", "TX"] });
      expect(next.data.states).toEqual(["CA", "TX"]);
      expect(next.provenance.states).toMatchObject({ status: "inferred", source: msg("m3"), also_heard: [{ value: ["NY"], source: msg("m2") }] });
      expect(next.provenance.states).not.toHaveProperty("candidates");
    });
  });

  describe("the same value heard again", () => {
    it("from chat keeps the document as the source, though it can still raise the status", () => {
      const inferredDoc = applyExtraction(EMPTY, { employee_count: 30 }, { source: doc("d1"), now: T0 });
      const up = fromChat(inferredDoc, "m1", { employee_count: 30 }, { statuses: { employee_count: "confirmed" } });
      expect(up.provenance.employee_count).toEqual({ status: "confirmed", source: doc("d1"), updated_at: NOW.toISOString() });
      const confirmedDoc = fromDoc(EMPTY, "d1", { employee_count: 30 });
      expect(fromChat(confirmedDoc, "m1", { employee_count: 30 }).provenance.employee_count).toMatchObject({ status: "confirmed", source: doc("d1") });
    });

    it("from a document takes over as the source", () => {
      const chat = fromChat(EMPTY, "m1", { employee_count: 30 });
      const next = fromDoc(chat, "d1", { employee_count: 30 });
      expect(next.provenance.employee_count).toEqual({ status: "confirmed", source: doc("d1"), updated_at: NOW.toISOString() });
    });

    it("never lowers a list's status", () => {
      const chat = fromChat(EMPTY, "m1", { states: ["CA"] }, { statuses: { states: "confirmed" } });
      expect(fromChat(chat, "m2", { states: ["CA"] }).provenance.states).toMatchObject({ status: "confirmed", source: msg("m2") });
    });

    it("is a list with the same entries in another order: a document's list keeps its source, status and order", () => {
      const fromFile = fromDoc(EMPTY, "d1", { states: ["CA", "NY"] });
      const next = fromChat(fromFile, "m1", { states: ["NY", "CA"] }, { statuses: { states: "confirmed" } });
      expect(next.data.states).toEqual(["CA", "NY"]);
      expect(next.provenance.states).toEqual({ status: "confirmed", source: doc("d1"), updated_at: NOW.toISOString() });
      expect(fromChat(fromFile, "m1", { states: ["NY", "CA"] }).provenance.states).toMatchObject({ status: "confirmed", source: doc("d1") });
      // Nor does a reordered list settle a conflict as though it had added an entry.
      const conflict = fromChat(fromChat(EMPTY, "m1", { states: ["CA", "NY"] }), "m2", { states: ["TX"] });
      expect(fromChat(conflict, "m3", { states: ["NY", "CA"] })).toEqual(conflict);
    });

    it("keeps what was heard", () => {
      const noted = fromChat(fromDoc(EMPTY, "d1", { employee_count: 30 }), "m1", { employee_count: 32 });
      expect(fromDoc(noted, "d2", { employee_count: 30 }).provenance.employee_count).toMatchObject({
        source: doc("d2"),
        also_heard: [{ value: 32, source: msg("m1") }],
      });
    });
  });

  it("leaves the census out of the ladder: the roster is rebuilt as it grows, and nothing is noted", () => {
    const ann = { first_name: "Ann", last_name: "Lee", work_state: "CA" };
    const fromFile = fromDoc(EMPTY, "d1", { census: [ann] });
    const next = fromChat(fromFile, "m1", { census: [ann, { ...ann, first_name: "Bo" }] });
    expect(next.data.census.map((r) => r.first_name)).toEqual(["Ann", "Bo"]);
    expect(next.provenance.census).toEqual({ status: "inferred", source: msg("m1"), updated_at: NOW.toISOString() });
  });

  describe("also heard", () => {
    const fromFile = fromDoc(EMPTY, "d1", { employee_count: 30 });

    it("keeps the five newest, one per value, with the latest source for a value heard again from the same rank", () => {
      let state = fromFile;
      for (const [i, n] of [31, 32, 33, 34, 35, 36].entries()) state = fromChat(state, `m${i + 1}`, { employee_count: n });
      expect(state.provenance.employee_count?.also_heard?.map((h) => h.value)).toEqual([32, 33, 34, 35, 36]);
      state = fromChat(state, "m9", { employee_count: 33 });
      expect(state.provenance.employee_count?.also_heard).toEqual([
        { value: 32, source: msg("m2") },
        { value: 34, source: msg("m4") },
        { value: 35, source: msg("m5") },
        { value: 36, source: msg("m6") },
        { value: 33, source: msg("m9") },
      ]);
      expect(state.data.employee_count).toBe(30);
      expect(state.provenance.employee_count?.status).toBe("confirmed");
    });

    it("keeps a document as the source of a noted value that chat repeats", () => {
      const corrected = fromChat(fromFile, "m1", { employee_count: 35 }, { corrections: ["employee_count"] });
      const outranked = fromDoc(corrected, "d2", { employee_count: 32 });
      expect(outranked.provenance.employee_count?.also_heard).toEqual([{ value: 30, source: doc("d1") }, { value: 35, source: msg("m1") }]);
      const repeated = fromChat(outranked, "m2", { employee_count: 30 });
      expect(repeated.provenance.employee_count?.also_heard).toEqual([{ value: 35, source: msg("m1") }, { value: 30, source: doc("d1") }]);
    });

    it("never holds the field's own value", () => {
      const chat = fromChat(EMPTY, "m1", { employee_count: 40 });
      const replaced = fromDoc(chat, "d1", { employee_count: 30 });
      const back = fromDoc(replaced, "d2", { employee_count: 40 });
      expect(back.provenance.employee_count?.status).toBe("conflicting");
      const settled = fromChat(back, "m2", { employee_count: 40 }, { corrections: ["employee_count"] });
      expect(settled.data.employee_count).toBe(40);
      expect(settled.provenance.employee_count?.also_heard?.map((h) => h.value)).toEqual([30]);
    });

    it("is cleared when the prospect confirms, edits or resolves the field", () => {
      const noted = fromChat(fromFile, "m1", { employee_count: 32 });
      expect(noted.provenance.employee_count?.also_heard).toHaveLength(1);
      expect(applyFieldAction(noted, { type: "confirm", field: "employee_count" }, NOW).provenance.employee_count).toEqual({
        status: "confirmed",
        source: { kind: "prospect_edit" },
        updated_at: NOW.toISOString(),
      });
      expect(applyFieldAction(noted, { type: "edit", field: "employee_count", value: 33 }).provenance.employee_count).not.toHaveProperty("also_heard");
      const conflict = fromDoc(noted, "d2", { employee_count: 31 });
      expect(conflict.provenance.employee_count?.also_heard).toHaveLength(1);
      expect(applyFieldAction(conflict, { type: "resolve", field: "employee_count", candidate: 1 }).provenance.employee_count).not.toHaveProperty("also_heard");
    });
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

describe("applyChosenValue", () => {
  const doc: FieldSource = { kind: "document", document_id: "d1" };
  const own = applyFieldAction(EMPTY, { type: "edit", field: "employee_count", value: 40 }, NOW);

  it("replaces even the prospect's own answer, confirmed with the chosen source, keeping the answer as also heard", () => {
    const next = applyChosenValue(own, "employee_count", 30, doc, NOW);
    expect(next.data.employee_count).toBe(30);
    expect(next.provenance.employee_count).toEqual({
      status: "confirmed",
      source: doc,
      updated_at: NOW.toISOString(),
      also_heard: [{ value: 40, source: { kind: "prospect_edit" } }],
    });
  });

  it("notes nothing replaced from the same kind of source, and keeps what was already noted", () => {
    const noted = applyExtraction(applyExtraction(EMPTY, { employee_count: 40 }, { source: { kind: "document", document_id: "d0" }, now: NOW }), { employee_count: 45 }, { source: msg("m1"), now: NOW });
    expect(noted.provenance.employee_count?.also_heard).toEqual([{ value: 45, source: msg("m1") }]);
    expect(applyChosenValue(noted, "employee_count", 30, doc, NOW).provenance.employee_count?.also_heard).toEqual([{ value: 45, source: msg("m1") }]);
  });

  it("rejects an invalid value without changing anything", () => {
    expect(applyChosenValue(own, "hq_state", "Nowhere", doc, NOW)).toBe(own);
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

  it("leaves out fields an advisor verified, in any status", () => {
    let state = applyExtraction(EMPTY, { employee_count: 40, industry: "Retail" }, { source: msg("m1") });
    state = applyExtraction(state, { employee_count: 45 }, { source: msg("m2") });
    expect(fieldOpenItems(state.provenance, new Set(["employee_count"]))).toEqual([
      { field: "industry", label: "Industry", reason: "Please confirm" },
    ]);
    expect(fieldOpenItems(state.provenance, new Set(["employee_count", "industry"]))).toEqual([]);
  });
});

// D23 and D31: neither status holds an answer; only the prospect marks a field not applicable.
describe("unknown and not applicable", () => {
  const unknown = (field: "wc_experience_mod" | "pay_frequency"): IntakeState => ({
    data: EMPTY_CHAMBER_DATA,
    provenance: { [field]: { status: "unknown", source: msg("m1"), updated_at: NOW.toISOString() } },
  });
  const notApplicable: IntakeState = {
    data: EMPTY_CHAMBER_DATA,
    provenance: { wc_experience_mod: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: NOW.toISOString() } },
  };

  it("survives being stored and loaded", () => {
    const stored = JSON.parse(JSON.stringify({ ...unknown("pay_frequency").provenance, ...notApplicable.provenance }));
    expect(parseProvenance(stored)).toEqual(stored);
  });

  it("lists unknown as an open item the prospect owes, and not applicable as closed", () => {
    expect(fieldOpenItems(unknown("pay_frequency").provenance)).toEqual([
      { field: "pay_frequency", label: "Pay frequency", reason: "Prospect to provide" },
    ]);
    expect(fieldOpenItems(notApplicable.provenance)).toEqual([]);
  });

  it("lists open items with unknown after incomplete and before inferred", () => {
    let state = applyExtraction(EMPTY, { states: ["CA"], industry: "Retail" }, { source: msg("m1"), statuses: { states: "incomplete" } });
    state = { ...state, provenance: { ...state.provenance, ...unknown("pay_frequency").provenance } };
    expect(fieldOpenItems(state.provenance).map((i) => i.reason)).toEqual(["Incomplete", "Prospect to provide", "Please confirm"]);
  });

  it("lets an answer replace unknown", () => {
    const next = applyExtraction(unknown("wc_experience_mod"), { wc_experience_mod: 0.92 }, { source: msg("m2"), now: NOW });
    expect(next.data.wc_experience_mod).toBe(0.92);
    expect(next.provenance.wc_experience_mod).toEqual({ status: "inferred", source: msg("m2"), updated_at: NOW.toISOString() });
  });

  it("never lets an extraction or a document candidate change a field marked not applicable", () => {
    const fromChat = applyExtraction(notApplicable, { wc_experience_mod: 0.92 }, { source: msg("m2"), statuses: { wc_experience_mod: "confirmed" } });
    const fromDocument = applyExtraction(notApplicable, { wc_experience_mod: 0.92 }, {
      source: { kind: "document", document_id: "d1", document_name: "dec-page.pdf" },
      statuses: { wc_experience_mod: "confirmed" },
      corrections: ["wc_experience_mod"],
    });
    expect(fromChat).toEqual(notApplicable);
    expect(fromDocument).toEqual(notApplicable);
    // The database doesn't check provenance, so the status alone must hold, whatever source it records.
    const misrecorded: IntakeState = {
      data: EMPTY_CHAMBER_DATA,
      provenance: { wc_experience_mod: { status: "not_applicable", source: msg("m1"), updated_at: NOW.toISOString() } },
    };
    expect(applyExtraction(misrecorded, { wc_experience_mod: 0.92 }, { source: msg("m2") })).toEqual(misrecorded);
  });

  it("holds nothing to confirm, but lets the prospect give an answer after all", () => {
    expect(applyFieldAction(unknown("pay_frequency"), { type: "confirm", field: "pay_frequency" })).toEqual(unknown("pay_frequency"));
    expect(applyFieldAction(notApplicable, { type: "confirm", field: "wc_experience_mod" })).toEqual(notApplicable);
    const answered = applyFieldAction(notApplicable, { type: "edit", field: "wc_experience_mod", value: "0.85" }, NOW);
    expect(answered.data.wc_experience_mod).toBe(0.85);
    expect(answered.provenance.wc_experience_mod).toEqual({ status: "confirmed", source: { kind: "prospect_edit" }, updated_at: NOW.toISOString() });
  });
});

describe("FIELD_LABELS", () => {
  it("labels every field as the schema does, in the schema's order rather than rank order", () => {
    expect(Object.keys(FIELD_LABELS)).toEqual(Object.keys(EMPTY_CHAMBER_DATA));
    expect(FIELD_LABELS.company_name).toBe("Company legal name");
    expect(FIELD_LABELS.wc_experience_mod).toBe("Experience mod");
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
    expect(parseEvidence({ key_challenges: "my SSN 123-45-6789" })).toEqual({ key_challenges: "my SSN [redacted]" });
  });

  it("keeps a transcript source's prompt version, and still reads entries saved without one", () => {
    const versioned = { status: "confirmed", source: { kind: "transcript", message_id: "m1", quote: "40 of us", prompt_version: 3 }, updated_at: "x" };
    const unversioned = { status: "inferred", source: { kind: "transcript", message_id: "m2" }, updated_at: "x" };
    expect(parseProvenance({ employee_count: versioned, industry: unversioned })).toEqual({ employee_count: versioned, industry: unversioned });
  });

  it("drops a malformed prompt version but keeps the rest of the entry", () => {
    for (const prompt_version of ["2026-11-03.1", "", 0, -1, 1.5, 40_000, null]) {
      const parsed = parseProvenance({
        employee_count: { status: "confirmed", source: { kind: "transcript", message_id: "m1", prompt_version }, updated_at: "x" },
      });
      expect(parsed.employee_count?.source).toEqual({ kind: "transcript", message_id: "m1" });
    }
  });

  it("round-trips what else was heard, and still reads entries saved before it existed", () => {
    const doc: FieldSource = { kind: "document", document_id: "d1" };
    let state = applyExtraction(EMPTY, { employee_count: 30 }, { source: doc, statuses: { employee_count: "confirmed" } });
    state = applyExtraction(state, { employee_count: 32 }, { source: { kind: "transcript", message_id: "m1", quote: "32 of us", prompt_version: PROMPT_VERSION } });
    const stored = JSON.parse(JSON.stringify(state.provenance));
    expect(stored.employee_count.also_heard).toHaveLength(1);
    expect(parseProvenance(stored)).toEqual(state.provenance);
    const legacy = { status: "confirmed", source: doc, updated_at: "x" };
    expect(parseProvenance({ employee_count: legacy })).toEqual({ employee_count: legacy });
  });

  it("drops malformed also_heard entries but keeps the rest of the field's provenance", () => {
    const entry = { status: "confirmed", source: { kind: "document", document_id: "d1" }, updated_at: "x" };
    const good = { value: 32, source: msg("m1") };
    const parsed = parseProvenance({
      employee_count: {
        ...entry,
        also_heard: [good, { value: 33, source: { kind: "hearsay" } }, { source: msg("m2") }, { value: "", source: msg("m3") }, "x", null, { value: 34, source: msg("m4") }],
      },
    });
    expect(parsed.employee_count).toEqual({ ...entry, also_heard: [good, { value: 34, source: msg("m4") }] });
    for (const also_heard of ["32", { value: 32 }, 7, null, [], [null]]) {
      const kept = parseProvenance({ employee_count: { ...entry, also_heard } });
      expect(kept.employee_count).toEqual(entry);
      expect(kept.employee_count?.also_heard).toBeUndefined();
    }
  });

  it("keeps only the five newest also_heard entries from storage", () => {
    const also_heard = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, source: msg(`m${n}`) }));
    const parsed = parseProvenance({ employee_count: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "x", also_heard } });
    expect(parsed.employee_count?.also_heard?.map((h) => h.value)).toEqual([3, 4, 5, 6, 7]);
  });

  it("reads the census entry saved under the roster's old name", () => {
    const entry = { status: "confirmed", source: { kind: "document", document_id: "d1" }, updated_at: "x" };
    expect(parseProvenance({ employees: entry })).toEqual({ census: entry });
    const current = { ...entry, updated_at: "y" };
    expect(parseProvenance({ employees: entry, census: current })).toEqual({ census: current });
  });
});

describe("a field the prospect doesn't know (unknown, D23)", () => {
  const source = { kind: "transcript" as const, message_id: "m9" };
  const state = (over: Partial<IntakeState> = {}): IntakeState => ({ data: { ...EMPTY_CHAMBER_DATA }, provenance: {}, ...over });

  // QA F11: a field with no answer has nothing to quote. Neither the model's quote nor the message (the fallback quote,
  // which in EAA-2026-0001 put one unrelated message beside some 35 unanswered fields) is kept; the message id is.
  it("records it as unknown, with the message it was said in, no quote and no answer", () => {
    const quoted = { ...source, quote: "Bi-weekly. We have 12 employees, all paid hourly." };
    const next = applyExtraction(state(), {}, { source: quoted, unknown: ["wc_experience_mod", "fein_count"], evidence: { wc_experience_mod: "no idea" } });
    expect(next.data.wc_experience_mod).toBeNull();
    expect(next.provenance.wc_experience_mod).toEqual({ status: "unknown", source: { kind: "transcript", message_id: "m9" }, updated_at: expect.any(String) });
    expect(next.provenance.fein_count?.source).toEqual({ kind: "transcript", message_id: "m9" });
    expect(fieldOpenItems(next.provenance)).toContainEqual({ field: "wc_experience_mod", label: FIELD_LABELS.wc_experience_mod, reason: "Prospect to provide" });
  });

  it("leaves an answer already given, the prospect's own edit and \"Doesn't apply\" alone", () => {
    const given = applyExtraction(state({ data: { ...EMPTY_CHAMBER_DATA, renewal_date: "July" }, provenance: { renewal_date: { status: "inferred", source, updated_at: "2026-11-01T00:00:00Z" } } }), {}, { source, unknown: ["renewal_date"] });
    expect(given.provenance.renewal_date?.status).toBe("inferred");
    expect(given.data.renewal_date).toBe("July");
    const edited = applyExtraction(state({ provenance: { renewal_date: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-11-01T00:00:00Z" } } }), {}, { source, unknown: ["renewal_date"] });
    expect(edited.provenance.renewal_date?.status).toBe("confirmed");
    const na = applyExtraction(state({ provenance: { renewal_date: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: "2026-11-01T00:00:00Z" } } }), {}, { source, unknown: ["renewal_date"] });
    expect(na.provenance.renewal_date?.status).toBe("not_applicable");
  });

  it("comes from the model's field statuses for fields it gave no answer, and an answer later replaces it", () => {
    const opts = transcriptExtraction({ id: "m9", text: "not sure, but we have about 12 people" }, {
      field_status: { employee_count: "inferred", renewal_date: "unknown", census: "unknown" },
      evidence: { renewal_date: "not sure" },
    });
    expect(opts.unknown).toEqual(["renewal_date"]);
    const marked = applyExtraction(state(), { employee_count: 12 }, opts);
    expect(marked.provenance.renewal_date?.status).toBe("unknown");
    const answered = applyExtraction(marked, { renewal_date: "March" }, { source: { kind: "transcript", message_id: "m10" } });
    expect(answered.data.renewal_date).toBe("March");
    expect(answered.provenance.renewal_date?.status).toBe("inferred");
  });
});

describe("transcriptExtraction", () => {
  it("stamps chamber-extract's prompt version on the source, so each value records the prompt behind it", () => {
    const opts = transcriptExtraction({ id: "m1", text: "We have 40 people" }, { prompt_version: PROMPT_VERSION, evidence: { employee_count: "40 people" } });
    expect(opts.source).toEqual({ kind: "transcript", message_id: "m1", quote: "We have 40 people", prompt_version: PROMPT_VERSION });
    const next = applyExtraction(EMPTY, { employee_count: 40 }, { ...opts, now: NOW });
    expect(next.provenance.employee_count?.source).toEqual({ kind: "transcript", message_id: "m1", quote: "40 people", prompt_version: PROMPT_VERSION });
  });

  it("leaves the source unversioned when the reply carries no valid version", () => {
    for (const meta of [{ employee_count: 40 }, { prompt_version: "7" }, { prompt_version: 0 }, { prompt_version: 2.5 }, null]) {
      expect(transcriptExtraction({ id: "m1", text: "hi" }, meta).source).not.toHaveProperty("prompt_version");
    }
  });

  it("stamps a spoken message's answers with chamber-extract's version too, since they come through it (US-2.3b)", () => {
    const opts = transcriptExtraction({ id: "v1", text: "We have 40 people", spoken: true }, { prompt_version: PROMPT_VERSION });
    expect(opts.source).toEqual({ kind: "transcript", message_id: "v1", quote: "We have 40 people", prompt_version: PROMPT_VERSION });
  });

  it("never leaves half an emoji in the quote, which Postgres jsonb refuses", () => {
    const text = `${"a".repeat(198)}😀${"b".repeat(20)}`;
    const { source } = transcriptExtraction({ id: "m1", text }, {});
    const quote = (source as { quote: string }).quote;
    expect(quote).toBe(`${"a".repeat(198)}…`);
    expect(JSON.stringify(quote)).not.toMatch(/\\ud[89ab]/i);
  });

  it("never records a spoken answer as confirmed: it stays for the prospect to confirm (D33)", () => {
    const meta = { field_status: { employee_count: "confirmed", company_name: "inferred", states: "incomplete" } };
    expect(transcriptExtraction({ id: "m1", text: "fifteen people", spoken: true }, meta).statuses).toEqual({
      employee_count: "inferred", company_name: "inferred", states: "incomplete",
    });
    // Typed, the model's status stands.
    expect(transcriptExtraction({ id: "m1", text: "15 people" }, meta).statuses?.employee_count).toBe("confirmed");
  });
});

// A spoken answer through the merge (US-2.3b, D33): what the Chamber stores from a voice call's extraction.
describe("merging a spoken answer", () => {
  const spoken = (id: string, text: string) => ({ id, text, spoken: true });
  const confirmedBy = (field: string, value: unknown) => ({ field_status: { [field]: "confirmed" }, evidence: { [field]: String(value) } });

  it("stores what the model called confirmed as inferred, citing the spoken message, so it waits as 'Please confirm'", () => {
    const next = applyExtraction(EMPTY, { employee_count: 15 }, { ...transcriptExtraction(spoken("v1", "fifteen people"), confirmedBy("employee_count", "fifteen people")), now: NOW });
    expect(next.data.employee_count).toBe(15);
    expect(next.provenance.employee_count).toEqual({
      status: "inferred",
      source: { kind: "transcript", message_id: "v1", quote: "fifteen people" },
      updated_at: NOW.toISOString(),
    });
    expect(fieldOpenItems(next.provenance)).toEqual([{ field: "employee_count", label: FIELD_LABELS.employee_count, reason: "Please confirm" }]);
  });

  it("isn't confirmed by being said again, but is when the prospect types it or confirms it", () => {
    const heard = applyExtraction(EMPTY, { employee_count: 15 }, transcriptExtraction(spoken("v1", "fifteen"), confirmedBy("employee_count", "fifteen")));
    const again = applyExtraction(heard, { employee_count: 15 }, transcriptExtraction(spoken("v2", "yes, fifteen"), confirmedBy("employee_count", "yes, fifteen")));
    expect(again.provenance.employee_count?.status).toBe("inferred");
    const typed = applyExtraction(again, { employee_count: 15 }, transcriptExtraction({ id: "m3", text: "15" }, confirmedBy("employee_count", "15")));
    expect(typed.provenance.employee_count?.status).toBe("confirmed");
    expect(applyFieldAction(again, { type: "confirm", field: "employee_count" }).provenance.employee_count?.status).toBe("confirmed");
  });

  it("never lowers an answer the prospect already typed and confirmed when they say it again", () => {
    const typed = applyExtraction(EMPTY, { pay_frequency: "weekly" }, transcriptExtraction({ id: "m1", text: "weekly" }, confirmedBy("pay_frequency", "weekly")));
    const said = applyExtraction(typed, { pay_frequency: "weekly" }, transcriptExtraction(spoken("v2", "weekly"), confirmedBy("pay_frequency", "weekly")));
    expect(said.provenance.pay_frequency?.status).toBe("confirmed");
  });

  it("puts a typed answer and a different spoken one in conflict, for the prospect to choose (GLOSSARY.md, Field source)", () => {
    const typed = applyExtraction(EMPTY, { company_name: "Quill & Ink Bindery LLC" }, transcriptExtraction({ id: "m1", text: "Quill & Ink Bindery LLC" }, confirmedBy("company_name", "Quill & Ink Bindery LLC")));
    const said = applyExtraction(typed, { company_name: "Quill and Ink Bindery" }, transcriptExtraction(spoken("v2", "Quill and Ink Bindery"), confirmedBy("company_name", "Quill and Ink Bindery")));
    expect(said.data.company_name).toBe("Quill & Ink Bindery LLC");
    expect(said.provenance.company_name?.status).toBe("conflicting");
    expect(said.provenance.company_name?.candidates?.map((c) => c.value)).toEqual(["Quill & Ink Bindery LLC", "Quill and Ink Bindery"]);
  });
});

describe("fieldOpenItems and advisor verification", () => {
  const at = "2026-11-04T00:00:00Z";
  const said = { kind: "transcript" as const, message_id: "m1" };
  const conflicting = { status: "conflicting" as const, source: said, updated_at: at, candidates: [] };

  it("leaves a verified answer off the list, except a required one in conflict, which still has to be chosen", () => {
    const provenance = {
      industry: { status: "inferred" as const, source: said, updated_at: at },
      hq_state: conflicting,
      company_name: conflicting,
    };
    const verified = new Set(["industry", "hq_state", "company_name"]);
    expect(fieldOpenItems(provenance, verified).map((i) => i.field)).toEqual(["company_name"]);
    expect(fieldOpenItems(provenance).map((i) => i.field)).toEqual(["company_name", "hq_state", "industry"]);
  });
});

// K-1.3: an employer in no PEO has no current PEO and no agreement to renew, so that answer closes both.
describe("answers that close other answers", () => {
  const spoken = { kind: "transcript" as const, message_id: "m9" };
  const empty: IntakeState = { data: EMPTY_CHAMBER_DATA, provenance: {} };
  const closed = (s: IntakeState) => [s.provenance.current_peo?.status, s.provenance.peo_renewal_date?.status];

  it("closes which PEO and when it renews once Lenore hears the employer is in no PEO", () => {
    const next = applyExtraction(empty, { in_peo: false }, { source: spoken, statuses: { in_peo: "confirmed" } });
    expect(next.data.in_peo).toBe(false);
    expect(closed(next)).toEqual(["not_applicable", "not_applicable"]);
    // Each says where it was closed: the message that said so, with no quote of its own.
    const said = applyExtraction(empty, { in_peo: false }, { source: spoken, evidence: { in_peo: "we're not in a PEO" } });
    expect(said.provenance.current_peo?.source).toEqual({ kind: "transcript", message_id: "m9" });
    expect(fieldOpenItems(next.provenance).map((i) => i.field)).not.toContain("current_peo");
  });

  it("closes them when the prospect says so in the workspace, and when a document does", () => {
    expect(closed(applyFieldAction(empty, { type: "edit", field: "in_peo", value: false }))).toEqual(["not_applicable", "not_applicable"]);
    expect(closed(applyChosenValue(empty, "in_peo", false, { kind: "document", document_id: "d1" }))).toEqual(["not_applicable", "not_applicable"]);
  });

  it("leaves them open while the employer is in a PEO, or hasn't said", () => {
    expect(closed(applyExtraction(empty, { in_peo: true }, { source: spoken }))).toEqual([undefined, undefined]);
    expect(closed(applyExtraction(empty, { company_name: "Acme" }, { source: spoken }))).toEqual([undefined, undefined]);
  });

  it("opens them again when the answer changes to being in a PEO", () => {
    const out = applyFieldAction(empty, { type: "edit", field: "in_peo", value: false });
    const back = applyFieldAction(out, { type: "edit", field: "in_peo", value: true });
    expect(closed(back)).toEqual([undefined, undefined]);
  });

  it("never closes an answer that is already given: the prospect settles what doesn't fit", () => {
    const held: IntakeState = { data: { ...EMPTY_CHAMBER_DATA, current_peo: "Summit PEO" }, provenance: { current_peo: { status: "confirmed", source: spoken, updated_at: "2026-11-11T00:00:00Z" } } };
    const next = applyFieldAction(held, { type: "edit", field: "in_peo", value: false });
    expect(next.data.current_peo).toBe("Summit PEO");
    expect(closed(next)).toEqual(["confirmed", "not_applicable"]);
  });

  it("changes nothing about them when another answer changes", () => {
    const out = applyFieldAction(empty, { type: "edit", field: "in_peo", value: false });
    const later = applyExtraction(out, { company_name: "Acme" }, { source: spoken });
    expect(closed(later)).toEqual(["not_applicable", "not_applicable"]);
    // In a PEO, and the prospect then says the renewal doesn't apply: a later answer elsewhere leaves that alone.
    const inPeo = applyFieldAction(applyFieldAction(empty, { type: "edit", field: "in_peo", value: true }), { type: "not_applicable", field: "peo_renewal_date" });
    expect(applyExtraction(inPeo, { company_name: "Acme" }, { source: spoken }).provenance.peo_renewal_date?.status).toBe("not_applicable");
  });
});

// K-3.1 on: what Lenore hears of a table of rows is added to the table, never traded for it.
describe("rows heard in conversation or read from a document", () => {
  const heard = { kind: "transcript" as const, message_id: "m3" };
  const empty: IntakeState = { data: EMPTY_CHAMBER_DATA, provenance: {} };
  const owners = (s: IntakeState) => s.data.owners_officers;

  it("starts the table from the first rows heard, with their status", () => {
    const next = applyExtraction(empty, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 60 }] }, { source: heard, statuses: { owners_officers: "confirmed" } });
    expect(owners(next)).toEqual([{ name: "Dana Reyes", ownership_percent: 60 }]);
    expect(next.provenance.owners_officers?.status).toBe("confirmed");
  });

  it("adds a row for someone new and keeps everyone already listed, for the prospect to confirm again", () => {
    const one = applyExtraction(empty, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 60 }] }, { source: heard, statuses: { owners_officers: "confirmed" } });
    const two = applyExtraction(one, { owners_officers: [{ name: "Sam Okafor", title: "Secretary" }] }, { source: { ...heard, message_id: "m4" }, statuses: { owners_officers: "confirmed" } });
    expect(owners(two)).toEqual([{ name: "Dana Reyes", ownership_percent: 60 }, { name: "Sam Okafor", title: "Secretary" }]);
    expect(two.provenance.owners_officers?.status).toBe("inferred");
  });

  it("fills in what a listed person's row was missing, matching the name whatever its case, and never changes what the row held", () => {
    const one = applyExtraction(empty, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 60 }] }, { source: heard });
    const more = applyExtraction(one, { owners_officers: [{ name: "dana reyes", title: "President", ownership_percent: 55 }] }, { source: { ...heard, message_id: "m4" } });
    expect(owners(more)).toEqual([{ name: "Dana Reyes", ownership_percent: 60, title: "President" }]);
  });

  it("adds to a table the prospect typed, without touching their rows", () => {
    const typed = applyFieldAction(empty, { type: "edit", field: "owners_officers", value: [{ name: "Dana Reyes", ownership_percent: 60 }] });
    const next = applyExtraction(typed, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 10 }, { name: "Sam Okafor" }] }, { source: heard });
    expect(owners(next)).toEqual([{ name: "Dana Reyes", ownership_percent: 60 }, { name: "Sam Okafor" }]);
  });

  it("changes nothing when what was heard is already in the table, or the prospect said the table doesn't apply", () => {
    const one = applyExtraction(empty, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 60 }] }, { source: heard, statuses: { owners_officers: "confirmed" } });
    expect(applyExtraction(one, { owners_officers: [{ name: "Dana Reyes" }] }, { source: { ...heard, message_id: "m4" } })).toEqual(one);
    const closed = applyFieldAction(empty, { type: "not_applicable", field: "owners_officers" });
    expect(owners(applyExtraction(closed, { owners_officers: [{ name: "Dana Reyes" }] }, { source: heard }))).toEqual([]);
  });

  // ADR 0007: the prospect correcting a row in conversation changes it, unless they typed that row themselves.
  it("changes a row's value when the prospect corrects it in conversation", () => {
    const one = applyExtraction(empty, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 60, title: "President" }] }, { source: heard, statuses: { owners_officers: "confirmed" } });
    const fixed = applyExtraction(one, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 55 }] }, { source: { ...heard, message_id: "m5" }, corrections: ["owners_officers"] });
    expect(owners(fixed)).toEqual([{ name: "Dana Reyes", ownership_percent: 55, title: "President" }]);
    expect(fixed.provenance.owners_officers).toMatchObject({ status: "inferred", source: { message_id: "m5" } });
  });

  it("never changes a row the prospect typed, even when the conversation corrects it", () => {
    const typed = applyFieldAction(empty, { type: "edit", field: "owners_officers", value: [{ name: "Dana Reyes", ownership_percent: 60 }] });
    const next = applyExtraction(typed, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 55 }] }, { source: heard, corrections: ["owners_officers"] });
    expect(owners(next)).toEqual([{ name: "Dana Reyes", ownership_percent: 60 }]);
  });

  // Review finding: a table has one source, so adding a heard row must not make the typed rows fair game.
  it("keeps a typed table the prospect's own after the conversation adds a row to it", () => {
    const typed = applyFieldAction(empty, { type: "edit", field: "owners_officers", value: [{ name: "Dana Reyes", ownership_percent: 60 }] });
    const added = applyExtraction(typed, { owners_officers: [{ name: "Sam Okafor" }] }, { source: heard });
    expect(added.provenance.owners_officers?.status).toBe("inferred");
    const doc = applyExtraction(added, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 55 }] }, { source: { kind: "document", document_id: "d1" }, statuses: { owners_officers: "confirmed" } });
    expect(owners(doc)[0]).toEqual({ name: "Dana Reyes", ownership_percent: 60 });
    const corrected = applyExtraction(added, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 55 }] }, { source: { ...heard, message_id: "m6" }, corrections: ["owners_officers"] });
    expect(owners(corrected)[0]).toEqual({ name: "Dana Reyes", ownership_percent: 60 });
  });

  // Review finding: a row with no key column can't be matched, so the same row heard twice must not be listed twice.
  it("lists a row that has no name once, however often it is heard", () => {
    const one = applyExtraction(empty, { owners_officers: [{ title: "Treasurer" }] }, { source: heard });
    const again = applyExtraction(one, { owners_officers: [{ title: "Treasurer" }, { title: "Secretary" }] }, { source: { ...heard, message_id: "m4" } });
    expect(owners(again)).toEqual([{ title: "Treasurer" }, { title: "Secretary" }]);
  });

  // Review finding: saving a table with nothing in it must not shut out what Lenore hears or a document says later.
  it("takes rows heard after the prospect saved the table empty", () => {
    const saved = applyFieldAction(empty, { type: "edit", field: "owners_officers", value: [] });
    expect(owners(applyExtraction(saved, { owners_officers: [{ name: "Dana Reyes" }] }, { source: heard }))).toEqual([{ name: "Dana Reyes" }]);
  });

  it("stops adding people once the table is full", () => {
    const full = applyFieldAction(empty, { type: "edit", field: "owners_officers", value: Array.from({ length: 20 }, (_, i) => ({ name: `Owner ${i + 1}` })) });
    const next = applyExtraction(full, { owners_officers: [{ name: "One Too Many" }, { name: "Owner 3", title: "Treasurer" }] }, { source: heard });
    expect(owners(next)).toHaveLength(20);
    expect(owners(next)[2]).toEqual({ name: "Owner 3", title: "Treasurer" });
  });

  it("lets a document's figures replace what was only heard in conversation, and never what the prospect typed", () => {
    const doc = { kind: "document" as const, document_id: "d1" };
    const one = applyExtraction(empty, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 60 }] }, { source: heard });
    expect(owners(applyExtraction(one, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 55 }] }, { source: doc, statuses: { owners_officers: "confirmed" } }))).toEqual([{ name: "Dana Reyes", ownership_percent: 55 }]);
    const typed = applyFieldAction(empty, { type: "edit", field: "owners_officers", value: [{ name: "Dana Reyes", ownership_percent: 60 }] });
    expect(owners(applyExtraction(typed, { owners_officers: [{ name: "Dana Reyes", ownership_percent: 55 }] }, { source: doc }))).toEqual([{ name: "Dana Reyes", ownership_percent: 60 }]);
  });
});

// K-3.4: the ACORD 130 questions. The rules below run whenever an answer changes; none of them asks the prospect
// anything, and each leaves alone a question the prospect has answered or reopened.
describe("the ACORD 130 questions: what closes them and what answers them", () => {
  const heard = { kind: "transcript" as const, message_id: "m7" };
  const empty: IntakeState = { data: EMPTY_CHAMBER_DATA, provenance: {} };
  const emp = (over: Record<string, unknown> = {}) => ({ id: Math.random().toString(36).slice(2), first_name: "A", last_name: "B", work_state: "CA", compensation_type: "salary", employment_type: "full_time", classification: "w2", ...over });
  const withCensus = (state: IntakeState, rows: Record<string, unknown>[]) => applyExtraction(state, { census: rows }, { source: { kind: "document", document_id: "d1" }, statuses: { census: "confirmed" } });
  const status = (s: IntakeState, field: string) => (s.provenance as Record<string, { status?: string } | undefined>)[field]?.status;
  const value = (s: IntakeState, field: string) => (s.data as unknown as Record<string, unknown>)[field];
  const hazards = ["wcq_01", "wcq_02", "wcq_03", "wcq_04"];

  it("marks 'other insurance with this insurer' as not applying once the intake has begun: there is no insurer yet", () => {
    const begun = applyExtraction(empty, { company_name: "Acme" }, { source: heard });
    expect(status(begun, "wcq_17")).toBe("not_applicable");
    // The prospect can reopen it, and it then stays open.
    const reopened = applyFieldAction(begun, { type: "reopen", field: "wcq_17" });
    expect(status(applyExtraction(reopened, { industry: "Print" }, { source: heard }), "wcq_17")).toBeUndefined();
  });

  it("closes the four hazard questions for an employer whose every class code is an office code", () => {
    const office = withCensus(empty, [emp({ class_code: "8810" }), emp({ class_code: "8742" })]);
    expect(hazards.map((f) => status(office, f))).toEqual(Array(4).fill("not_applicable"));
    expect(status(office, "wcq_05")).toBeUndefined();
  });

  it("leaves them open when anyone has another class code, or a class code is missing", () => {
    expect(hazards.map((f) => status(withCensus(empty, [emp({ class_code: "8810" }), emp({ class_code: "5551" })]), f))).toEqual(Array(4).fill(undefined));
    expect(hazards.map((f) => status(withCensus(empty, [emp({ class_code: "8810" }), emp()]), f))).toEqual(Array(4).fill(undefined));
  });

  it("goes by the industry when the census has no class codes: finance, management, and the desk-bound parts of information and professional services", () => {
    for (const naics_code of ["541110", "541211", "541511", "541611", "541810", "513210", "518210", "522110", "551112"]) {
      expect(hazards.map((f) => status(applyFieldAction(empty, { type: "edit", field: "naics_code", value: naics_code }), f)), naics_code).toEqual(Array(4).fill("not_applicable"));
    }
    expect(hazards.map((f) => status(applyFieldAction(empty, { type: "edit", field: "naics_code", value: "238160" }), f))).toEqual(Array(4).fill(undefined));
    // Class codes outrank the industry: a design firm whose census has a roofer is not office-only.
    // A sector is not enough: surveyors, vets, environmental consultants, film crews and telecom installers
    // share a sector with office work and do none of it.
    for (const naics_code of ["541370", "541940", "541620", "512110", "517111"]) {
      expect(hazards.map((f) => status(applyFieldAction(empty, { type: "edit", field: "naics_code", value: naics_code }), f)), naics_code).toEqual(Array(4).fill(undefined));
    }
    const mixed = withCensus(applyFieldAction(empty, { type: "edit", field: "naics_code", value: "541511" }), [emp({ class_code: "5551" })]);
    expect(hazards.map((f) => status(mixed, f))).toEqual(Array(4).fill(undefined));
  });

  it("lets the prospect reopen a hazard question and answer it, and never closes one already answered", () => {
    const office = withCensus(empty, [emp({ class_code: "8810" })]);
    const reopened = applyFieldAction(office, { type: "reopen", field: "wcq_03" });
    const later = applyExtraction(reopened, { company_name: "Acme" }, { source: heard });
    expect(status(later, "wcq_03")).toBeUndefined();
    const answered = applyFieldAction(empty, { type: "edit", field: "wcq_01", value: true });
    expect(status(withCensus(answered, [emp({ class_code: "8810" })]), "wcq_01")).toBe("confirmed");
  });

  it("does not ask a Missouri applicant about declined or cancelled coverage, as the form says", () => {
    expect(status(applyFieldAction(empty, { type: "edit", field: "hq_state", value: "MO" }), "wcq_18")).toBe("not_applicable");
    expect(status(applyFieldAction(empty, { type: "edit", field: "hq_state", value: "KS" }), "wcq_18")).toBeUndefined();
  });

  it("answers 'employees under 16 or over 60' from the census's ages, for the prospect to confirm", () => {
    const old = withCensus(empty, [emp({ class_code: "5551", dob: "1950-01-01" }), emp({ class_code: "5551", dob: "1990-01-01" })]);
    expect([value(old, "wcq_10"), status(old, "wcq_10")]).toEqual([true, "inferred"]);
    const none = withCensus(empty, [emp({ class_code: "5551", dob: "1990-01-01" }), emp({ class_code: "5551", age: 40 })]);
    expect([value(none, "wcq_10"), status(none, "wcq_10")]).toEqual([false, "inferred"]);
    // The form says under 16 or over 60: someone who is 16 or 60 is neither.
    expect(value(withCensus(empty, [emp({ class_code: "5551", age: 16 }), emp({ class_code: "5551", age: 60 })]), "wcq_10")).toBe(false);
    expect(value(withCensus(empty, [emp({ class_code: "5551", age: 61 })]), "wcq_10")).toBe(true);
    expect(value(withCensus(empty, [emp({ class_code: "5551", age: 15 })]), "wcq_10")).toBe(true);
    // The question is about employees: a 1099 contractor's age doesn't answer it.
    expect(value(withCensus(empty, [emp({ class_code: "5551", age: 40 }), emp({ class_code: "5551", age: 67, classification: "1099" })]), "wcq_10")).toBe(false);
    expect(value(withCensus(empty, [emp({ class_code: "5551", age: 67, classification: "1099" })]), "wcq_10")).toBeNull();
    // A date of birth that can't be read is an unknown age, not one inside the range.
    const q10 = ACORD_DERIVED.find((r) => r.field === "wcq_10")!;
    const unread = { ...EMPTY_CHAMBER_DATA, census: [emp({ dob: "not a date" })] } as unknown as ChamberData;
    expect(q10.answer(unread, new Date("2026-11-11T00:00:00Z"))).toBeUndefined();
    // With someone's age unknown and nobody known to be under 16 or over 60, the census can't say.
    expect(value(withCensus(empty, [emp({ class_code: "5551", dob: "1990-01-01" }), emp({ class_code: "5551" })]), "wcq_10")).toBeNull();
  });

  it("answers travel and working at home from the census, with how many work at home", () => {
    const s = withCensus(empty, [emp({ class_code: "5551", remote: true, travels: false }), emp({ class_code: "5551", remote: true, travels: true }), emp({ class_code: "5551", remote: false, travels: false })]);
    // The census says who travels for work, not whether they leave the state: a yes there leaves the question
    // to be asked. Nobody travelling does answer it.
    expect([value(s, "wcq_14"), status(s, "wcq_14"), value(s, "wcq_22"), value(s, "wcq_22_explain")]).toEqual([null, undefined, true, "2 employees"]);
    const no = withCensus(empty, [emp({ class_code: "5551", remote: false, travels: false })]);
    expect([value(no, "wcq_14"), value(no, "wcq_22"), value(no, "wcq_22_explain")]).toEqual([false, false, null]);
    expect(value(withCensus(empty, [emp({ class_code: "5551" })]), "wcq_22")).toBeNull();
  });

  it("keeps the count of people working at home in step with the census while the answer stays yes", () => {
    const two = withCensus(empty, [emp({ class_code: "5551", remote: true }), emp({ class_code: "5551", remote: true }), emp({ class_code: "5551", remote: false })]);
    const three = withCensus(two, [emp({ class_code: "5551", remote: true }), emp({ class_code: "5551", remote: true }), emp({ class_code: "5551", remote: true })]);
    expect([value(three, "wcq_22"), value(three, "wcq_22_explain")]).toEqual([true, "3 employees"]);
    // An explanation the prospect wrote is theirs.
    const own = applyFieldAction(two, { type: "edit", field: "wcq_22_explain", value: "Two engineers, full time" });
    expect(value(withCensus(own, [emp({ class_code: "5551", remote: true })]), "wcq_22_explain")).toBe("Two engineers, full time");
  });

  it("takes back an answer it worked out when what it came from no longer says anything", () => {
    const answered = withCensus(empty, [emp({ class_code: "5551", remote: true, travels: false })]);
    expect([value(answered, "wcq_14"), value(answered, "wcq_22"), value(answered, "wcq_22_explain")]).toEqual([false, true, "1 employee"]);
    const silent = withCensus(answered, [emp({ class_code: "5551" })]);
    expect([value(silent, "wcq_14"), status(silent, "wcq_14"), value(silent, "wcq_22"), status(silent, "wcq_22"), value(silent, "wcq_22_explain"), status(silent, "wcq_22_explain")]).toEqual([null, undefined, null, undefined, null, undefined]);
    // One the prospect confirmed is theirs, and stays.
    const confirmed = applyFieldAction(answered, { type: "confirm", field: "wcq_14" });
    expect(value(withCensus(confirmed, [emp({ class_code: "5551" })]), "wcq_14")).toBe(false);
  });

  it("answers 'health plans provided' and 'employees leased' from the answers already given", () => {
    expect(value(applyExtraction(empty, { virgin_medical: false }, { source: heard }), "wcq_19")).toBe(true);
    expect(value(applyExtraction(empty, { virgin_medical: true }, { source: heard }), "wcq_19")).toBe(false);
    expect(value(applyFieldAction(empty, { type: "edit", field: "medical_plans", value: [{ name: "Gold PPO" }] }), "wcq_19")).toBe(true);
    expect(value(applyExtraction(empty, { in_peo: true }, { source: heard }), "wcq_21")).toBe(true);
    expect(value(applyExtraction(empty, { in_peo: false }, { source: heard }), "wcq_21")).toBe(false);
  });

  it("follows what it was worked out from until the prospect confirms or changes it, and never after", () => {
    const yes = applyExtraction(empty, { in_peo: true }, { source: heard });
    expect(value(applyExtraction(yes, { in_peo: false }, { source: { ...heard, message_id: "m8" }, corrections: ["in_peo"] }), "wcq_21")).toBe(false);
    const confirmed = applyFieldAction(yes, { type: "confirm", field: "wcq_21" });
    expect(value(applyExtraction(confirmed, { in_peo: false }, { source: { ...heard, message_id: "m8" }, corrections: ["in_peo"] }), "wcq_21")).toBe(true);
    const own = applyFieldAction(empty, { type: "edit", field: "wcq_19", value: false });
    expect(value(applyExtraction(own, { virgin_medical: false }, { source: heard }), "wcq_19")).toBe(false);
  });
});
