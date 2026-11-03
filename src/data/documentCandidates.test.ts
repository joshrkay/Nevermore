import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA, type CensusEmployee } from "./chamberTypes";
import {
  applyDocumentCandidates,
  compareCensus,
  mergeCensus,
  parseExtraction,
  planCandidateMerge,
  resolutionFields,
  resolveCandidate,
} from "./documentCandidates";

const employee: CensusEmployee = {
  id: "e1",
  first_name: "Ann",
  last_name: "Lee",
  dob: "1990-01-01",
  work_state: "CA",
  job_title: "Dev",
  annual_salary: 100000,
  compensation_type: "salary",
  employment_type: "full_time",
  classification: "w2",
};

describe("document candidates", () => {
  it("keeps only valid candidates and their source location", () => {
    const ex = parseExtraction({
      message: null,
      candidates: [
        { field: "payroll_vendor", value: "ADP", location: "Page 2" },
        { field: "hq_state", value: "California", location: "Page 1" }, // not a state code
        { field: "not_a_field", value: "x" },
        { field: "employee_count", value: "1,200", location: null },
      ],
      applied: { payroll_vendor: "2026-10-20T00:00:00Z" },
    });
    expect(ex.candidates).toEqual([
      { field: "payroll_vendor", value: "ADP", location: "Page 2" },
      { field: "employee_count", value: 1200, location: null },
    ]);
    expect(ex.applied).toEqual({ payroll_vendor: "2026-10-20T00:00:00Z" });
    expect(ex.notes).toEqual([]);
    expect(parseExtraction(null).candidates).toEqual([]);
    expect(parseExtraction({ notes: ["The SSN column wasn't read.", 5, " "] }).notes).toEqual(["The SSN column wasn't read."]);
  });

  it("plans candidates against empty, matching, and existing values", () => {
    const data = { ...EMPTY_CHAMBER_DATA, payroll_vendor: "Gusto", states: ["TX", "CA"] };
    const plan = planCandidateMerge(data, [
      { field: "pay_frequency", value: "Bi-weekly", location: null },
      { field: "states", value: ["CA", "TX"], location: null },
      { field: "payroll_vendor", value: "ADP", location: null },
    ]);
    expect(plan.map((p) => p.kind)).toEqual(["new", "same", "conflict"]);
    expect(plan[2].current).toBe("Gusto");
  });

  it("plans a value from the conversation as replaced, and a prospect's or another document's as a conflict", () => {
    const data = { ...EMPTY_CHAMBER_DATA, payroll_vendor: "Gusto", employee_count: 40, current_carrier: "Aetna", pay_frequency: "Weekly" };
    const chat = { kind: "transcript" as const, message_id: "m1" };
    const provenance = {
      payroll_vendor: { status: "confirmed" as const, source: chat, updated_at: "x" },
      employee_count: { status: "conflicting" as const, source: chat, updated_at: "x", candidates: [{ value: 40, source: chat }, { value: 45, source: chat }] },
      current_carrier: { status: "confirmed" as const, source: { kind: "prospect_edit" as const }, updated_at: "x" },
      pay_frequency: { status: "confirmed" as const, source: { kind: "document" as const, document_id: "d0" }, updated_at: "x" },
    };
    const plan = planCandidateMerge(data, [
      { field: "payroll_vendor", value: "ADP", location: null },
      { field: "employee_count", value: 50, location: null },
      { field: "current_carrier", value: "Cigna", location: null },
      { field: "pay_frequency", value: "Bi-weekly", location: null },
    ], provenance);
    expect(plan.map((p) => [p.candidate.field, p.kind])).toEqual([
      ["payroll_vendor", "replace"],
      ["employee_count", "replace"],
      ["current_carrier", "conflict"],
      ["pay_frequency", "conflict"],
    ]);
    // A census from the conversation is still compared in the dialog, person by person.
    const census = { census: { status: "inferred" as const, source: chat, updated_at: "x" } };
    const withTeam = { ...EMPTY_CHAMBER_DATA, census: [{ ...employee, first_name: "Bo" }] };
    expect(planCandidateMerge(withTeam, [{ field: "census", value: [employee], location: null }], census)[0].kind).toBe("conflict");
  });

  it("treats a roster as a conflict when the intake already has a different census", () => {
    const roster = { field: "census" as const, value: [employee], location: "CSV, rows 2–2" };
    expect(planCandidateMerge(EMPTY_CHAMBER_DATA, [roster])[0].kind).toBe("new");
    const withTeam = { ...EMPTY_CHAMBER_DATA, census: [{ ...employee, first_name: "Bo" }] };
    expect(planCandidateMerge(withTeam, [roster])[0].kind).toBe("conflict");
    // The same people and facts under other generated ids are the same census.
    const sameTeam = { ...EMPTY_CHAMBER_DATA, census: [{ ...employee, id: "other-id" }] };
    expect(planCandidateMerge(sameTeam, [roster])[0].kind).toBe("same");
  });

  it("reads a roster a document proposed as `employees` before the census contract", () => {
    const ex = parseExtraction({
      candidates: [{ field: "employees", value: [{ first_name: "Ann", state: "ca", salary: 90000, classification: "W2" }], location: "CSV, rows 2–2" }],
      applied: { employees: "2026-10-20T00:00:00Z" },
    });
    expect(ex.candidates).toHaveLength(1);
    expect(ex.candidates[0].field).toBe("census");
    expect(ex.candidates[0].value).toEqual([expect.objectContaining({ first_name: "Ann", work_state: "CA", annual_salary: 90000, classification: "w2" })]);
    expect(ex.applied).toEqual({ census: "2026-10-20T00:00:00Z" });
  });

  const doc = { id: "d1", file_name: "census.xlsx" };
  const now = new Date("2026-10-20T00:00:00Z");

  it("records applied values as confirmed, sourced to the document and location", () => {
    const prev = { data: { ...EMPTY_CHAMBER_DATA, payroll_vendor: "Gusto" }, provenance: {} };
    const next = applyDocumentCandidates(prev, doc, [{ field: "employee_count", value: 12, location: "Sheet1, rows 2–13" }], { now });
    expect(next.data.employee_count).toBe(12);
    expect(next.data.payroll_vendor).toBe("Gusto");
    expect(next.provenance.employee_count).toEqual({
      status: "confirmed",
      source: { kind: "document", document_id: "d1", document_name: "census.xlsx", location: "Sheet1, rows 2–13" },
      updated_at: now.toISOString(),
    });
  });

  it("never overwrites a value the prospect entered unless they choose Replace", () => {
    const prev = {
      data: { ...EMPTY_CHAMBER_DATA, payroll_vendor: "Gusto" },
      provenance: { payroll_vendor: { status: "confirmed" as const, source: { kind: "prospect_edit" as const }, updated_at: "x" } },
    };
    const candidate = { field: "payroll_vendor" as const, value: "ADP", location: "Page 2" };
    expect(applyDocumentCandidates(prev, doc, [candidate], { now })).toEqual(prev);
    const replaced = applyDocumentCandidates(prev, doc, [candidate], { replace: true, now });
    expect(replaced.data.payroll_vendor).toBe("ADP");
    expect(replaced.provenance.payroll_vendor?.source).toMatchObject({ kind: "document", location: "Page 2" });
    // Their own answer came from another kind of source, so it is kept as also heard.
    expect(replaced.provenance.payroll_vendor?.also_heard).toEqual([{ value: "Gusto", source: { kind: "prospect_edit" } }]);
  });

  it("replaces a value from chat, which a document outranks, and keeps the chat value as also heard", () => {
    const chat = { kind: "transcript" as const, message_id: "m1", quote: "we use Gusto" };
    const prev = {
      data: { ...EMPTY_CHAMBER_DATA, payroll_vendor: "Gusto" },
      provenance: { payroll_vendor: { status: "inferred" as const, source: chat, updated_at: "x" } },
    };
    const next = applyDocumentCandidates(prev, doc, [{ field: "payroll_vendor", value: "ADP", location: "Page 2" }], { now });
    expect(next.data.payroll_vendor).toBe("ADP");
    expect(next.provenance.payroll_vendor).toEqual({
      status: "confirmed",
      source: { kind: "document", document_id: "d1", document_name: "census.xlsx", location: "Page 2" },
      updated_at: now.toISOString(),
      also_heard: [{ value: "Gusto", source: chat }],
    });
  });

  it("turns a different value from another document into a conflict instead of replacing it", () => {
    const other = { kind: "document" as const, document_id: "d0", document_name: "invoice.pdf" };
    const prev = {
      data: { ...EMPTY_CHAMBER_DATA, payroll_vendor: "Gusto" },
      provenance: { payroll_vendor: { status: "confirmed" as const, source: other, updated_at: "x" } },
    };
    const next = applyDocumentCandidates(prev, doc, [{ field: "payroll_vendor", value: "ADP", location: null }], { now });
    expect(next.data.payroll_vendor).toBe("Gusto");
    expect(next.provenance.payroll_vendor?.status).toBe("conflicting");
    expect(next.provenance.payroll_vendor?.candidates?.map((c) => c.value)).toEqual(["Gusto", "ADP"]);
  });
});

describe("census comparison and merge", () => {
  const row = (id: string, first: string, over: Partial<CensusEmployee> = {}): CensusEmployee => ({ ...employee, id, first_name: first, last_name: "Lee", ...over });

  it("lines people up by name and birth date, and reports only the facts the document stated", () => {
    const current = [row("a", "Ann", { job_title: "Designer", dob: "1990-01-01" }), row("b", "Bo"), row("z", "Zed")];
    const incoming = [row("n1", "ann", { job_title: "Dev", dob: "1990-01-01", annual_salary: 120000 }), row("n2", "Bo"), row("n3", "Cy")];
    const cmp = compareCensus(current, incoming, ["job_title"]);
    expect(cmp.matched.map((m) => [m.current.id, m.changes.map((c) => c.fact)])).toEqual([["a", ["job_title"]], ["b", []]]);
    expect(cmp.added.map((r) => r.first_name)).toEqual(["Cy"]);
    expect(cmp.missing.map((r) => r.first_name)).toEqual(["Zed"]);
    // With every fact in play the new salary counts too.
    expect(compareCensus(current, incoming).matched[0].changes.map((c) => c.fact)).toEqual(["job_title", "annual_salary"]);
  });

  it("treats two people with the same name but different birth dates as different people", () => {
    const cmp = compareCensus([row("a", "Ann", { dob: "1990-01-01" })], [row("n", "Ann", { dob: "1975-05-05" })]);
    expect(cmp.matched).toEqual([]);
    expect(cmp.added).toHaveLength(1);
    expect(cmp.missing).toHaveLength(1);
  });

  it("merges: stated facts update, new people are added, everyone else stays with their id and dependents", () => {
    const spouse = { first_name: "S", last_name: "Lee", dob: "", relationship: "spouse" as const };
    const current = [row("a", "Ann", { job_title: "Designer", dependents: [spouse] }), row("z", "Zed")];
    const incoming = [row("n1", "Ann", { job_title: "Dev", annual_salary: 1 }), row("n2", "Cy")];
    // The document only has a title column, so its default salary doesn't overwrite the stated one.
    const merged = mergeCensus(current, incoming, ["job_title"]);
    expect(merged.map((r) => r.id)).toEqual(["a", "z", "n2"]);
    expect(merged[0]).toMatchObject({ job_title: "Dev", annual_salary: 100000, dependents: [spouse] });
  });

  it("never lets a document's blank overwrite a stated fact", () => {
    const merged = mergeCensus([row("a", "Ann", { job_title: "Designer" })], [row("n", "Ann", { job_title: undefined })]);
    expect(merged[0].job_title).toBe("Designer");
  });

  it("reads a document's stated facts from its extraction, and no others", () => {
    const ex = parseExtraction({
      candidates: [
        { field: "census", value: [{ first_name: "Ann" }], location: "CSV", facts: ["job_title", "nonsense"] },
        { field: "employee_count", value: 1, facts: ["job_title"] },
      ],
    });
    expect(ex.candidates[0].facts).toEqual(["job_title"]);
    expect(ex.candidates[1]).not.toHaveProperty("facts");
  });
});

describe("resolveCandidate", () => {
  const doc = { id: "d1", file_name: "roster.xlsx" };
  const now = new Date("2026-10-20T00:00:00Z");
  const candidate = (over: object) => ({ field: "payroll_vendor" as const, value: "ADP", location: "Page 2", ...over });
  const prospect = {
    data: { ...EMPTY_CHAMBER_DATA, payroll_vendor: "Gusto" },
    provenance: { payroll_vendor: { status: "inferred" as const, source: { kind: "transcript" as const, message_id: "m1" }, updated_at: "x" } },
  };

  it("uses the document's value, recorded as confirmed from the document, and keeps the replaced value as also heard", () => {
    const next = resolveCandidate(prospect, doc, { type: "use_document", candidate: candidate({}) }, now);
    expect(next.data.payroll_vendor).toBe("ADP");
    expect(next.provenance.payroll_vendor).toEqual({
      status: "confirmed",
      source: { kind: "document", document_id: "d1", document_name: "roster.xlsx", location: "Page 2" },
      updated_at: now.toISOString(),
      also_heard: [{ value: "Gusto", source: prospect.provenance.payroll_vendor.source }],
    });
  });

  it("notes nothing when the document's value replaces another document's", () => {
    const other = { kind: "document" as const, document_id: "d0", document_name: "invoice.pdf" };
    const fromFile = { data: prospect.data, provenance: { payroll_vendor: { status: "confirmed" as const, source: other, updated_at: "x" } } };
    const next = resolveCandidate(fromFile, doc, { type: "use_document", candidate: candidate({}) }, now);
    expect(next.data.payroll_vendor).toBe("ADP");
    expect(next.provenance.payroll_vendor).not.toHaveProperty("also_heard");
  });

  it("keeps the intake's value and records that the prospect confirmed it", () => {
    const next = resolveCandidate(prospect, doc, { type: "keep_current", candidate: candidate({}) }, now);
    expect(next.data.payroll_vendor).toBe("Gusto");
    expect(next.provenance.payroll_vendor).toEqual({ status: "confirmed", source: { kind: "prospect_edit" }, updated_at: now.toISOString() });
  });

  describe("with values already noted as also heard", () => {
    const paychex = { value: "Paychex", source: { kind: "transcript" as const, message_id: "m0" } };
    const noted = { data: prospect.data, provenance: { payroll_vendor: { ...prospect.provenance.payroll_vendor, also_heard: [paychex] } } };

    it("keeps them, and adds the replaced value, when the prospect picks the document's value", () => {
      expect(resolveCandidate(noted, doc, { type: "use_document", candidate: candidate({}) }, now).provenance.payroll_vendor?.also_heard).toEqual([
        paychex,
        { value: "Gusto", source: prospect.provenance.payroll_vendor.source },
      ]);
    });

    it("clears them when the prospect keeps their own answer", () => {
      expect(resolveCandidate(noted, doc, { type: "keep_current", candidate: candidate({}) }, now).provenance.payroll_vendor).not.toHaveProperty("also_heard");
    });
  });

  it("settles a conflict that was already recorded when the prospect picks a side", () => {
    const conflicting = {
      data: prospect.data,
      provenance: {
        payroll_vendor: {
          status: "conflicting" as const,
          source: prospect.provenance.payroll_vendor.source,
          updated_at: "x",
          candidates: [{ value: "Gusto", source: prospect.provenance.payroll_vendor.source }, { value: "ADP", source: { kind: "prospect_edit" as const } }],
        },
      },
    };
    const next = resolveCandidate(conflicting, doc, { type: "use_document", candidate: candidate({}) }, now);
    expect(next.provenance.payroll_vendor?.status).toBe("confirmed");
    expect(next.provenance.payroll_vendor).not.toHaveProperty("candidates");
    // The candidate it settled on is the field's value now, so only the other is kept.
    expect(next.provenance.payroll_vendor?.also_heard).toEqual([{ value: "Gusto", source: prospect.provenance.payroll_vendor.source }]);
  });

  it("leaves a census the prospect keeps exactly as it is", () => {
    const withTeam = { data: { ...EMPTY_CHAMBER_DATA, census: [employee] }, provenance: {} };
    expect(resolveCandidate(withTeam, doc, { type: "keep_current", candidate: { field: "census", value: [], location: null } }, now)).toBe(withTeam);
  });

  it("merges a census into the existing one under the document's source", () => {
    const withTeam = { data: { ...EMPTY_CHAMBER_DATA, census: [employee] }, provenance: {} };
    const incoming = [{ ...employee, id: "n1", job_title: "Lead" }, { ...employee, id: "n2", first_name: "Bo" }];
    const next = resolveCandidate(withTeam, doc, { type: "merge_census", candidate: { field: "census", value: incoming, location: "CSV, rows 2–3" } }, now);
    expect(next.data.census.map((r) => [r.id, r.first_name, r.job_title])).toEqual([["e1", "Ann", "Lead"], ["n2", "Bo", "Dev"]]);
    expect(next.provenance.census).toEqual({
      status: "confirmed",
      source: { kind: "document", document_id: "d1", document_name: "roster.xlsx", location: "CSV, rows 2–3" },
      updated_at: now.toISOString(),
    });
  });

  it("replaces the census with the document's when the prospect chooses it", () => {
    const withTeam = { data: { ...EMPTY_CHAMBER_DATA, census: [employee] }, provenance: {} };
    const incoming = [{ ...employee, id: "n2", first_name: "Bo" }];
    const next = resolveCandidate(withTeam, doc, { type: "use_document", candidate: { field: "census", value: incoming, location: null } }, now);
    expect(next.data.census.map((r) => r.first_name)).toEqual(["Bo"]);
    // The census isn't ranked, so the replaced roster isn't kept as also heard.
    const fromChat = { ...withTeam, provenance: { census: { status: "inferred" as const, source: { kind: "transcript" as const, message_id: "m1" }, updated_at: "x" } } };
    expect(resolveCandidate(fromChat, doc, { type: "use_document", candidate: { field: "census", value: incoming, location: null } }, now).provenance.census).not.toHaveProperty("also_heard");
  });

  it("names the fields a resolution settles", () => {
    expect(resolutionFields({ type: "apply", candidates: [candidate({}), candidate({ field: "current_carrier" })] })).toEqual({ fields: ["payroll_vendor", "current_carrier"], kept: false });
    expect(resolutionFields({ type: "keep_current", candidate: candidate({}) })).toEqual({ fields: ["payroll_vendor"], kept: true });
    expect(resolutionFields({ type: "merge_census", candidate: candidate({ field: "census" }) })).toEqual({ fields: ["census"], kept: false });
  });
});
