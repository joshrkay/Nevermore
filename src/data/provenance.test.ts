import { describe, expect, it } from "vitest";
import { PROMPT_VERSION } from "../../supabase/functions/chamber-extract/schema.ts";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
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
  voiceExtraction,
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

  it("records it as unknown, with the prospect's words and no answer", () => {
    const next = applyExtraction(state(), {}, { source, unknown: ["wc_experience_mod"], evidence: { wc_experience_mod: "no idea" } });
    expect(next.data.wc_experience_mod).toBeNull();
    expect(next.provenance.wc_experience_mod).toMatchObject({ status: "unknown", source: { kind: "transcript", message_id: "m9", quote: "no idea" } });
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

  it("leaves the source unversioned when the reply carries no valid version, as a voice extraction doesn't", () => {
    for (const meta of [{ employee_count: 40 }, { prompt_version: "7" }, { prompt_version: 0 }, { prompt_version: 2.5 }, null]) {
      expect(transcriptExtraction({ id: "m1", text: "hi" }, meta).source).not.toHaveProperty("prompt_version");
    }
  });

  it("never stamps a voice extraction, even when the agent's <extract> names a prompt version", () => {
    const data = { employee_count: 40, prompt_version: PROMPT_VERSION, evidence: { employee_count: "40 people" } };
    const opts = voiceExtraction({ id: "m1", text: "We have 40 people" }, data);
    expect(opts.source).toEqual({ kind: "transcript", message_id: "m1", quote: "We have 40 people" });
    expect(opts.evidence).toEqual({ employee_count: "40 people" });
    const next = applyExtraction(EMPTY, { employee_count: 40 }, { ...opts, now: NOW });
    expect(next.provenance.employee_count?.source).not.toHaveProperty("prompt_version");
    expect(voiceExtraction({ id: "m1", text: "hi" }, null).source).toEqual({ kind: "transcript", message_id: "m1", quote: "hi" });
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
