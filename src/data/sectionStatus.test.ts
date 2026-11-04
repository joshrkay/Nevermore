import { describe, expect, it } from "vitest";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "./chamberTypes";
import type { FieldProvenance, ProvenanceMap } from "./provenance";
import { REVIEW_FIELDS } from "./reviewFields";
import { sectionStatus } from "./sectionStatus";

const at = "2026-11-04T00:00:00Z";
const entry = (status: FieldProvenance["status"]): FieldProvenance => ({ status, source: { kind: "prospect_edit" }, updated_at: at });
const confirmed: ProvenanceMap = { company_name: entry("confirmed"), states: entry("confirmed"), pay_frequency: entry("confirmed") };
const complete = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", states: ["NY"], pay_frequency: "bi-weekly" };

describe("sectionStatus", () => {
  it("is incomplete while a required answer is missing, or any answer is still owed", () => {
    expect(sectionStatus("company", EMPTY_CHAMBER_DATA, {})).toBe("incomplete");
    expect(sectionStatus("payroll", { ...complete, pay_frequency: null }, {})).toBe("incomplete");
    expect(sectionStatus("company", complete, { ...confirmed, company_name: entry("conflicting") })).toBe("incomplete");
    expect(sectionStatus("benefits", complete, { ...confirmed, current_carrier: entry("unknown") })).toBe("incomplete");
    // The recommended census is owed in Workforce, and only there.
    expect(sectionStatus("workforce", complete, confirmed)).toBe("incomplete");
    expect(sectionStatus("company", complete, confirmed)).toBe("complete");
  });

  it("needs confirmation while the only thing left is an answer Lenore took from the conversation", () => {
    expect(sectionStatus("company", { ...complete, industry: "Retail" }, { ...confirmed, industry: entry("inferred") })).toBe("needs_confirmation");
    // Anything else owed in the section outranks it.
    expect(sectionStatus("company", { ...complete, industry: "Retail", start_month: "March" }, { ...confirmed, industry: entry("inferred"), start_month: entry("incomplete") })).toBe("incomplete");
  });

  it("is complete once everything in it is settled, an answered field or one marked as not applying", () => {
    expect(sectionStatus("workforce", { ...complete, census: DEMO_CHAMBER_DATA.census }, confirmed)).toBe("complete");
    expect(sectionStatus("company", { ...complete, industry: "Retail" }, { ...confirmed, industry: entry("confirmed") })).toBe("complete");
    expect(sectionStatus("benefits", complete, { ...confirmed, current_carrier: entry("not_applicable") })).toBe("complete");
  });

  it("is not applicable once every answer in the section is marked as not applying", () => {
    const allNotApplicable: ProvenanceMap = Object.fromEntries(REVIEW_FIELDS.workers_comp.map((field) => [field, entry("not_applicable")]));
    expect(sectionStatus("workers_comp", complete, allNotApplicable)).toBe("not_applicable");
    expect(sectionStatus("workers_comp", complete, { ...allNotApplicable, wc_carrier: entry("unknown") })).toBe("incomplete");
  });

  it("settles what an advisor verified, as the open-items list does", () => {
    const data = { ...complete, industry: "Retail" };
    const provenance = { ...confirmed, industry: entry("inferred") };
    expect(sectionStatus("company", data, provenance)).toBe("needs_confirmation");
    expect(sectionStatus("company", data, provenance, new Set(["industry"]))).toBe("complete");
  });
});
