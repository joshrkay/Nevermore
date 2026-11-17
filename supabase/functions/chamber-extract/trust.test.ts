import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "../../../src/data/chamberTypes";
import { applyExtraction, applyFieldAction, transcriptExtraction } from "../../../src/data/provenance";
import { shapeExtraction } from "./extraction";
import { shapeExtraAnswers } from "./extraQuestions";
import { prepareTurn } from "./prepare";
import { shapeResponse } from "./response";
import { FIELD_QUESTION } from "./schema";

const empty = { data: EMPTY_CHAMBER_DATA, provenance: {} };
const message = { id: "m1", text: "Actually, we have 999 employees." };
const proposed = { employee_count: 999, field_status: { employee_count: "confirmed" },
  corrected_fields: ["employee_count"], evidence: { employee_count: "999 employees" } };

describe("AI answers need evidence and a prospect's review", () => {
  it("rejects the Hello -> 999 regression, including its confirmed status and correction flag", () => {
    const shaped = shapeExtraction(proposed, "Hello");
    expect(shaped.extracted).toEqual({});
    expect(shaped.field_status).toEqual({});
    expect(shaped.corrected_fields).toEqual([]);
    expect(shaped.rejected).toEqual([{ path: "employee_count", reason: "requires evidence from the current message" }]);
  });

  it("keeps a supported answer inferred until the prospect explicitly confirms it", () => {
    const shaped = shapeExtraction(proposed, message.text);
    const state = applyExtraction(empty, shaped.extracted, transcriptExtraction(message, shaped));
    expect(state.data.employee_count).toBe(999);
    expect(state.provenance.employee_count?.status).toBe("inferred");
    expect(applyFieldAction(state, { type: "confirm", field: "employee_count" }).provenance.employee_count?.status).toBe("confirmed");
  });

  it("a correction cannot replace a confirmed document; either candidate needs the prospect's choice", () => {
    const prior = applyExtraction(empty, { employee_count: 12 }, {
      source: { kind: "document", document_id: "d1" }, statuses: { employee_count: "confirmed" },
    });
    // Also covers replies from an older server that still returns confirmed and corrected_fields.
    const state = applyExtraction(prior, { employee_count: 999 }, transcriptExtraction(message, proposed));
    expect(state.data.employee_count).toBe(12);
    expect(state.provenance.employee_count?.status).toBe("conflicting");
    expect(state.provenance.employee_count?.candidates?.map((c) => [c.value, c.source.kind])).toEqual([[12, "document"], [999, "transcript"]]);
    expect(applyFieldAction(state, { type: "resolve", field: "employee_count", candidate: 0 }).data.employee_count).toBe(12);
    const accepted = applyFieldAction(state, { type: "resolve", field: "employee_count", candidate: 1 });
    expect(accepted.data.employee_count).toBe(999);
    expect(accepted.provenance.employee_count?.source.kind).toBe("prospect_edit");
    expect(accepted.provenance.employee_count?.also_heard).toEqual([{ value: 12, source: { kind: "document", document_id: "d1" } }]);
    expect(prior.provenance.employee_count?.source).toEqual({ kind: "document", document_id: "d1" });
  });

  it("never replaces the prospect's manual answer", () => {
    const prior = applyFieldAction(empty, { type: "edit", field: "employee_count", value: 12 });
    expect(applyExtraction(prior, { employee_count: 999 }, transcriptExtraction(message, proposed))).toEqual(prior);
  });

  it("proposes a conflicting table cell without erasing the document table or other rows", () => {
    const rows = [{ name: "Gold", rate_ee: 100 }, { name: "Silver", rate_ee: 50 }];
    const prior = applyExtraction(empty, { medical_plans: rows }, { source: { kind: "document", document_id: "d1" } });
    const state = applyExtraction(prior, { medical_plans: [{ name: "Gold", rate_ee: 999 }] },
      transcriptExtraction(message, { corrected_fields: ["medical_plans"] }));
    expect(state.data.medical_plans).toEqual(rows);
    expect(state.provenance.medical_plans?.status).toBe("conflicting");
    expect(state.provenance.medical_plans?.candidates?.[1].value).toEqual([{ name: "Gold", rate_ee: 999 }, rows[1]]);
  });

  it("rejects missing evidence for extra answers and downgrades supported ones", () => {
    const q = { id: "1.fleet", peo: "Example", text: "How many vehicles?", kind: "number" as const, answered: false };
    expect(shapeExtraAnswers([{ id: q.id, value: 999, field_status: "confirmed" }], [q], "Hello").answers).toEqual([]);
    expect(shapeExtraAnswers([{ id: q.id, value: 2, field_status: "confirmed", evidence: "two vans" }], [q], "We have two vans.").answers)
      .toEqual([{ id: q.id, value: 2, field_status: "inferred", evidence: "two vans" }]);
  });

  it("attributes a bare yes only to an identifiable preceding question", () => {
    const args = { has_401k: true, has_1099: true, evidence: { has_401k: "Yes", has_1099: "Yes" } };
    const turn = { message: "Yes", requested: ["has_401k"], recent: [{ sender: "lenore" as const, text: FIELD_QUESTION.has_401k }] };
    expect(shapeResponse(args, turn).response.extracted).toEqual({ has_401k: true });
    expect(shapeResponse(args, { ...turn, recent: [] }).response.extracted).toEqual({});
  });

  it("removes identifiers and unsupported context at the shared model boundary", () => {
    const turn = prepareTurn({ message: "SSN 123-45-6789, EIN 12-3456789", context: {
      fein: "12-3456789", census: [{ name: "Private employee" }], entities: [{ fein: "12-3456789" }],
      company_name: "Account 123456789", unsupported: "private", industry: { nested: "private" },
      medical_plans: [{ name: "Gold", rate_ee: 123456789 }],
    }, recent: [{ sender: "user", text: "123-45-6789" }],
    extraQuestions: [{ id: "1.q", peo: "EIN 12-3456789", text: "SSN 123-45-6789?", kind: "choice", choices: ["12-3456789"], answered: false }] });
    expect(JSON.stringify(turn)).not.toMatch(/123-45-6789|12-3456789|123456789|Private employee|unsupported/);
    expect(turn.context).toMatchObject({ fein: "[masked]6789", entities: [{}], industry: null, medical_plans: [{ name: "Gold" }] });
    expect(prepareTurn(turn)).toEqual(turn);
  });
});
