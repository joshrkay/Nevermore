import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "./chamberTypes";
import type { CensusEmployee } from "./census";
import type { ProvenanceMap } from "./provenance";
import {
  BLOCKING_STATUSES,
  blockingItems,
  describeMissingKeys,
  isRequiredField,
  missingRecommendedItems,
  missingRequired,
  openItems,
  readyToCertify,
  REQUIRED_ITEMS,
  REVIEW_SECTIONS,
  SECTION_OF,
  sectionFields,
  sectionStatus,
} from "./readiness";

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

const AT = "2026-11-04T00:00:00Z";
const source = { kind: "transcript" as const, message_id: "m1" };
const status = (s: ProvenanceMap[keyof ProvenanceMap] extends infer P ? (P extends { status: infer S } ? S : never) : never) => ({ status: s, source, updated_at: AT });

describe("sections", () => {
  it("place every intake field in exactly one section, each section in the Review's order", () => {
    expect(Object.keys(SECTION_OF).sort()).toEqual(Object.keys(EMPTY_CHAMBER_DATA).sort());
    const listed = REVIEW_SECTIONS.flatMap((s) => sectionFields(s.key));
    expect(listed.sort()).toEqual(Object.keys(EMPTY_CHAMBER_DATA).sort());
    expect(REVIEW_SECTIONS.map((s) => s.key)).toEqual(["company", "workforce", "locations", "payroll", "benefits", "workers_comp", "operations"]);
    expect(sectionFields("workers_comp")).toEqual(["wc_carrier", "wc_renewal_date", "wc_experience_mod", "wc_annual_premium"]);
    expect(sectionFields("workforce")).toContain("census");
  });
});

describe("openItems", () => {
  it("lists what blocks certification first: required answers missing, then ones given but not settled", () => {
    const items = openItems(intake({ company_name: "Acme", states: ["NY"], industry: "Retail" }), {
      company_name: status("conflicting"),
      states: status("incomplete"),
      industry: status("inferred"),
    });
    expect(items.map((i) => [i.key, i.reason, i.blocking])).toEqual([
      ["pay_frequency", "missing", true],
      ["company_name", "conflicting", true],
      ["states", "incomplete", true],
      ["industry", "inferred", false],
      ["census", "recommended", false],
    ]);
    expect(items[1].action).toMatch(/Choose the right one/);
    expect(items[2].action).toMatch(/Complete it/);
    expect(items[3].action).toMatch(/Confirm it/);
    expect(BLOCKING_STATUSES).toEqual(["conflicting", "incomplete"]);
  });

  it("lists each answer once, with its section and a plain-words action", () => {
    const items = openItems(intake(), { company_name: status("unknown") });
    const company = items.filter((i) => i.key === "company_name");
    expect(company).toHaveLength(1);
    expect(company[0]).toMatchObject({ section: "company", reason: "missing", blocking: true, label: "Company legal name" });
    expect(items.find((i) => i.key === "census")).toMatchObject({ section: "workforce", reason: "recommended", blocking: false });
  });

  it("never blocks on a recommended answer, whatever its status, and never lists a closed one", () => {
    const items = openItems(complete, {
      wc_carrier: status("conflicting"),
      industry: status("unknown"),
      has_401k: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: AT },
    });
    expect(items.filter((i) => i.blocking)).toEqual([]);
    expect(items.map((i) => i.key)).toEqual(["wc_carrier", "industry", "census"]);
    expect(items.find((i) => i.key === "industry")?.action).toMatch(/mark it as not applicable/);
  });

  it("is empty, and the intake ready to certify, when every answer is settled", () => {
    const provenance: ProvenanceMap = { company_name: status("confirmed"), states: status("inferred"), pay_frequency: status("confirmed") };
    expect(blockingItems(complete, provenance)).toEqual([]);
    expect(readyToCertify(complete, provenance)).toBe(true);
    expect(readyToCertify(intake({ ...complete, company_name: null }), provenance)).toBe(false);
    expect(readyToCertify(complete, { ...provenance, pay_frequency: status("incomplete") })).toBe(false);
    expect(openItems({ ...complete, census: [employee({ work_state: "NY" })] }, { ...provenance, states: status("confirmed") })).toEqual([]);
  });
});

describe("sectionStatus", () => {
  const settled: ProvenanceMap = { company_name: status("confirmed"), states: status("confirmed"), pay_frequency: status("confirmed") };

  it("is incomplete while a required answer is missing or unsettled, or any answer is still owed", () => {
    expect(sectionStatus("company", intake(), {})).toBe("incomplete");
    expect(sectionStatus("company", complete, { company_name: status("conflicting") })).toBe("incomplete");
    expect(sectionStatus("benefits", complete, { ...settled, current_carrier: status("unknown") })).toBe("incomplete");
    expect(sectionStatus("workforce", complete, settled)).toBe("incomplete"); // the recommended census
  });

  it("needs confirmation while an answer is only inferred, and is complete once everything is settled", () => {
    expect(sectionStatus("company", complete, { ...settled, industry: status("inferred") })).toBe("needs_confirmation");
    expect(sectionStatus("company", complete, settled)).toBe("complete");
    expect(sectionStatus("workers_comp", complete, settled)).toBe("complete"); // nothing owed on recommended answers
    expect(sectionStatus("workforce", { ...complete, census: [employee({ work_state: "NY" })] }, settled)).toBe("complete");
  });

  it("is not applicable once the prospect marked every answer in the section as not applying", () => {
    const na = { status: "not_applicable" as const, source: { kind: "prospect_edit" as const }, updated_at: AT };
    const provenance: ProvenanceMap = { wc_carrier: na, wc_renewal_date: na, wc_experience_mod: na, wc_annual_premium: na };
    expect(sectionStatus("workers_comp", complete, provenance)).toBe("not_applicable");
    expect(sectionStatus("workers_comp", complete, { ...provenance, wc_carrier: status("unknown") })).toBe("incomplete");
  });
});
