import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "./chamberTypes";
import type { CensusEmployee } from "./census";
import type { FieldProvenance, FieldStatus, ProvenanceMap } from "./provenance";
import { conflictingRequired, describeRequiredKeys, isRequiredField, missingRecommendedItems, missingRequired, REQUIRED_ITEMS } from "./readiness";

const intake = (over: Partial<ChamberData> = {}): ChamberData => ({ ...EMPTY_CHAMBER_DATA, ...over });
const complete = intake({ company_name: "Acme", states: ["NY"], pay_frequency: "bi-weekly" });
const employee = (over: Partial<CensusEmployee> = {}): CensusEmployee => ({
  id: "e1",
  first_name: "Ada",
  last_name: "Lovelace",
  work_state: "",
  compensation_type: "salary",
  employment_type: "full_time",
  classification: "w2",
  ...over,
});
const keys = (data: ChamberData) => missingRequired(data).map((item) => item.key);

describe("missingRequired", () => {
  it("lists every required answer an empty intake lacks, in order", () => {
    expect(keys(intake())).toEqual(["company_name", "states", "pay_frequency"]);
    expect(missingRequired(intake()).map((item) => item.label)).toEqual(["Company legal name", "States of operation", "Pay frequency"]);
  });

  it("is empty once the three answers are there", () => {
    expect(keys(complete)).toEqual([]);
  });

  it("doesn't count blank text as an answer", () => {
    expect(keys({ ...complete, company_name: "   " })).toEqual(["company_name"]);
    expect(keys({ ...complete, pay_frequency: " " })).toEqual(["pay_frequency"]);
    expect(keys({ ...complete, states: [" "] })).toEqual(["states"]);
  });

  it("takes a work state on the census as a state of operation", () => {
    expect(keys({ ...complete, states: [], census: [employee({ work_state: "CA" })] })).toEqual([]);
    expect(keys({ ...complete, states: [], census: [employee()] })).toEqual(["states"]);
  });

  it("never requires the census", () => {
    expect(keys({ ...complete, census: [] })).toEqual([]);
    expect(missingRecommendedItems({ ...complete, census: [] }).map((item) => item.key)).toEqual(["census"]);
    expect(missingRecommendedItems({ ...complete, census: [employee({ work_state: "NY" })] })).toEqual([]);
  });
});

describe("isRequiredField", () => {
  it("marks exactly the required answers' fields", () => {
    expect(REQUIRED_ITEMS.map((item) => item.field)).toEqual(["company_name", "states", "pay_frequency"]);
    expect(isRequiredField("company_name")).toBe(true);
    expect(isRequiredField("states")).toBe(true);
    expect(isRequiredField("pay_frequency")).toBe(true);
    expect(isRequiredField("industry")).toBe(false);
    expect(isRequiredField("employee_count")).toBe(false);
  });
});

const prov = (status: FieldStatus): FieldProvenance => ({ status, source: { kind: "prospect_edit" }, updated_at: "2026-11-01T12:00:00Z" });

describe("conflictingRequired", () => {
  it("lists the required answers in conflict, in the order they are shown", () => {
    const provenance: ProvenanceMap = { pay_frequency: prov("conflicting"), company_name: prov("conflicting"), states: prov("confirmed") };
    expect(conflictingRequired(provenance).map((item) => item.key)).toEqual(["company_name", "pay_frequency"]);
  });

  it("ignores a conflict on a recommended field, and every other status", () => {
    expect(conflictingRequired({ industry: prov("conflicting"), employee_count: prov("conflicting") })).toEqual([]);
    for (const status of ["confirmed", "inferred", "incomplete", "unknown", "not_applicable"] as FieldStatus[]) {
      expect(conflictingRequired({ company_name: prov(status), states: prov(status), pay_frequency: prov(status) })).toEqual([]);
    }
    expect(conflictingRequired({})).toEqual([]);
  });

  it("covers exactly the required fields", () => {
    const all = Object.fromEntries(REQUIRED_ITEMS.flatMap((item) => (item.field ? [[item.field, prov("conflicting")]] : [])));
    expect(conflictingRequired(all).map((item) => item.key)).toEqual(REQUIRED_ITEMS.map((item) => item.key));
  });
});

describe("describeRequiredKeys", () => {
  it("names what the database said is missing or in conflict", () => {
    expect(describeRequiredKeys("company_name,pay_frequency")).toEqual(["Company legal name", "Pay frequency"]);
    expect(describeRequiredKeys("states")).toEqual(["States of operation"]);
  });

  it("keeps a key it doesn't know rather than dropping it, and reads nothing as nothing", () => {
    expect(describeRequiredKeys("ein")).toEqual(["ein"]);
    expect(describeRequiredKeys(null)).toEqual([]);
    expect(describeRequiredKeys("")).toEqual([]);
  });
});
