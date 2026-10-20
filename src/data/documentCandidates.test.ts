import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA, type ChamberEmployee } from "./chamberTypes";
import { applyDocumentCandidates, parseExtraction, planCandidateMerge } from "./documentCandidates";

const employee: ChamberEmployee = { first_name: "Ann", last_name: "Lee", dob: "1990-01-01", state: "CA", title: "Dev", salary: 100000, classification: "W2", dependents: [] };

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
    expect(parseExtraction(null).candidates).toEqual([]);
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

  it("treats a roster as a conflict when the intake already has employees", () => {
    const roster = { field: "employees" as const, value: [employee], location: "CSV, rows 2–2" };
    expect(planCandidateMerge(EMPTY_CHAMBER_DATA, [roster])[0].kind).toBe("new");
    const withTeam = { ...EMPTY_CHAMBER_DATA, employees: [{ ...employee, first_name: "Bo" }] };
    expect(planCandidateMerge(withTeam, [roster])[0].kind).toBe("conflict");
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
  });

  it("turns a different AI-sourced value into a conflict instead of replacing it", () => {
    const prev = {
      data: { ...EMPTY_CHAMBER_DATA, payroll_vendor: "Gusto" },
      provenance: {
        payroll_vendor: { status: "inferred" as const, source: { kind: "transcript" as const, message_id: "m1" }, updated_at: "x" },
      },
    };
    const next = applyDocumentCandidates(prev, doc, [{ field: "payroll_vendor", value: "ADP", location: null }], { now });
    expect(next.data.payroll_vendor).toBe("Gusto");
    expect(next.provenance.payroll_vendor?.status).toBe("conflicting");
    expect(next.provenance.payroll_vendor?.candidates?.map((c) => c.value)).toEqual(["Gusto", "ADP"]);
  });
});
