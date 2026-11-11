import { describe, expect, it } from "vitest";
import { formatCensusFact } from "./census";
import { applyExtraction, applyFieldAction } from "./provenance";
import { EMPTY_CHAMBER_DATA, type CensusEmployee } from "./chamberTypes";
import {
  applyDocumentCandidates,
  censusAgrees,
  compareCensus,
  mergeCensus,
  parseExtraction,
  formatValue,
  fieldLabel,
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

  it("never lets a default the document filled in for a blank cell replace the intake's answer", () => {
    // The file has a classification column, but this row's cell was blank: W-2 is only the default.
    const current = [row("a", "Ann", { classification: "1099" })];
    const incoming = [row("n", "Ann", { classification: "w2", assumed: ["classification"] })];
    expect(compareCensus(current, incoming, ["classification"]).matched[0].changes).toEqual([]);
    expect(mergeCensus(current, incoming, ["classification"])[0].classification).toBe("1099");
  });

  it("turns a defaulted fact into an answer once a document states it, even when the value is the same", () => {
    const current = [row("a", "Ann", { classification: "w2", employment_type: "full_time", assumed: ["classification", "employment_type"] })];
    const incoming = [row("n", "Ann", { classification: "w2", job_title: "Dev" })];
    const [merged] = mergeCensus(current, incoming, ["classification", "job_title"]);
    expect(merged).toMatchObject({ classification: "w2", job_title: "Dev", assumed: ["employment_type"] });

    const [allStated] = mergeCensus(current, [row("n", "Ann", { classification: "1099", employment_type: "part_time", job_title: "Dev" })], ["classification", "employment_type", "job_title"]);
    expect(allStated).toMatchObject({ classification: "1099", employment_type: "part_time" });
    expect(allStated).not.toHaveProperty("assumed");
  });

  it("keeps a row's defaults when the document doesn't state those facts", () => {
    const current = [row("a", "Ann", { assumed: ["classification"] })];
    const [merged] = mergeCensus(current, [row("n", "Ann", { job_title: "Dev" })], ["job_title"]);
    expect(merged.assumed).toEqual(["classification"]);
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

// K-1.1: what a document says of who the employer is, as the Upload tab offers it.
describe("company identity candidates", () => {
  it("keeps a document's entity type and year founded as the intake holds them, and shows them as written", () => {
    const parsed = parseExtraction({ candidates: [
      { field: "entity_type", value: "LLC", location: "Page 1" },
      { field: "year_founded", value: "2014", location: "Page 1" },
      // A FEIN is typed into the workspace by the prospect: a document never proposes one.
      { field: "fein", value: "84-1234567", location: "Page 1" },
    ] });
    expect(parsed.candidates.map((c) => [c.field, c.value])).toEqual([["entity_type", "llc"], ["year_founded", 2014]]);
    expect(formatValue("entity_type", "llc")).toBe("LLC");
    expect(formatValue("fein", "841234567")).toBe("84-1234567");
    expect(fieldLabel("entity_type")).toBe("Entity type");
    expect(fieldLabel("street_address")).toBe("Street address");
  });
});

// K-3.3: an uploaded loss run proposes a year's figures; the prospect applies them into the table.
describe("a table's rows from a document", () => {
  const doc = { id: "d7", file_name: "loss-run-2025.pdf" };
  const now = new Date("2026-11-11T00:00:00Z");
  const year2025 = { policy_year: 2025, carrier: "Pinnacle Mutual", premium: 18400, claims: 2, paid: 12500, reserved: 4000, valuation_date: "09/30/2026" };
  const stored = { candidates: [{ field: "loss_history", location: "Page 2", value: [{ ...year2025, premium: "18,400", policy_number: "x" }] }] };

  it("keeps the rows a stored extraction holds as the intake would, with the valuation date", () => {
    expect(parseExtraction(stored).candidates).toEqual([{ field: "loss_history", location: "Page 2", value: [year2025] }]);
    expect(formatValue("loss_history", [year2025])).toBe("1 listed");
  });

  it("is new for an empty table, the same once its rows are in, and an update when it adds to or changes what the table holds", () => {
    const [candidate] = parseExtraction(stored).candidates;
    const kind = (loss_history: object[], provenance = {}) => planCandidateMerge({ ...EMPTY_CHAMBER_DATA, loss_history }, [candidate], provenance)[0].kind;
    expect(kind([])).toBe("new");
    expect(kind([year2025, { policy_year: 2024, claims: 0 }])).toBe("same");
    expect(kind([{ policy_year: 2024, claims: 0 }])).toBe("replace");
    expect(kind([{ policy_year: 2025, premium: 17000 }])).toBe("replace");
  });

  it("adds the year to the table, keeping the other years, and records the document as the source", () => {
    const [candidate] = parseExtraction(stored).candidates;
    const prev = applyExtraction({ data: EMPTY_CHAMBER_DATA, provenance: {} }, { loss_history: [{ policy_year: 2024, claims: 0 }, { policy_year: 2025, premium: 17000 }] }, { source: { kind: "transcript", message_id: "m1" } });
    const next = applyDocumentCandidates(prev, doc, [candidate], { now, replace: true });
    expect(next.data.loss_history).toEqual([{ policy_year: 2024, claims: 0 }, year2025]);
    expect(next.provenance.loss_history).toMatchObject({ status: "confirmed", source: { kind: "document", document_id: "d7", location: "Page 2" } });
  });

  it("never changes a figure the prospect typed for that year, and still fills in what they left out", () => {
    const [candidate] = parseExtraction(stored).candidates;
    const typed = applyFieldAction({ data: EMPTY_CHAMBER_DATA, provenance: {} }, { type: "edit", field: "loss_history", value: [{ policy_year: 2025, premium: 17000 }] });
    const next = applyDocumentCandidates(typed, doc, [candidate], { now });
    expect(next.data.loss_history).toEqual([{ ...year2025, premium: 17000 }]);
  });
});

// K-2.3: a census file that lists dependents supplies them; one that doesn't leaves them alone.
describe("dependents from a census file", () => {
  const person = (over: Partial<CensusEmployee> = {}): CensusEmployee => ({ id: "e1", first_name: "Ann", last_name: "Lee", dob: "1990-01-01", work_state: "CA", compensation_type: "salary", employment_type: "full_time", classification: "w2", ...over });
  const raj = { first_name: "Raj", last_name: "Lee", dob: "1989-05-05", relationship: "spouse" as const };
  const mia = { first_name: "Mia", last_name: "Lee", dob: "2019-03-02", relationship: "child" as const };

  it("gives a person already in the intake the dependents the file lists for them", () => {
    const merged = mergeCensus([person()], [person({ id: "x", dependents: [raj, mia] })], ["dependents"]);
    expect(merged[0]).toMatchObject({ id: "e1", dependents: [raj, mia] });
  });

  it("sees no change when the file lists the same dependents", () => {
    const same = compareCensus([person({ dependents: [raj] })], [person({ id: "x", dependents: [{ ...raj }] })], ["dependents"]);
    expect(same.matched[0].changes).toEqual([]);
    expect(censusAgrees(same)).toBe(true);
  });

  it("keeps the dependents a person has when the file has no relationship column, or lists none for them", () => {
    expect(mergeCensus([person({ dependents: [raj] })], [person({ id: "x" })], ["dob"])[0].dependents).toEqual([raj]);
    expect(mergeCensus([person({ dependents: [raj] })], [person({ id: "x" })], ["dependents"])[0].dependents).toEqual([raj]);
    // The file lists someone else's dependents, and an empty list for this person: that is not "they have none".
    const listedNone = compareCensus([person({ dependents: [raj] })], [person({ id: "x", dependents: [] })], ["dependents"]);
    expect(listedNone.matched[0].changes).toEqual([]);
    expect(mergeCensus([person({ dependents: [raj] })], [person({ id: "x", dependents: [] })], ["dependents"])[0].dependents).toEqual([raj]);
  });

  it("sees no change when the intake's copy holds the same dependents with their keys in another order", () => {
    // Postgres hands jsonb back with its own key order.
    const stored = { dob: raj.dob, last_name: raj.last_name, first_name: raj.first_name, relationship: raj.relationship };
    const same = compareCensus([person({ dependents: [stored] })], [person({ id: "x", dependents: [raj] })], ["dependents"]);
    expect(same.matched[0].changes).toEqual([]);
    const other = compareCensus([person({ dependents: [stored] })], [person({ id: "x", dependents: [mia] })], ["dependents"]);
    expect(other.matched[0].changes.map((c) => c.fact)).toEqual(["dependents"]);
  });

  it("says how many dependents a change is about", () => {
    expect(formatCensusFact("dependents", [raj, mia])).toBe("2 dependents");
    expect(formatCensusFact("dependents", [raj])).toBe("1 dependent");
  });
});
