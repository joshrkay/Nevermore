import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseChamberData } from "./chamberValidation";
import { describeOpenItem, openItems, type OpenItem } from "./openItems";
import { parseProvenance } from "./provenance";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "./chamberTypes";
import { missingRequired } from "./readiness";

// The same intakes supabase/tests/open_items.sql gives the advisor queue, with what it must count.
const FIXTURE = JSON.parse(readFileSync("supabase/tests/fixtures/open_items.json", "utf8")) as {
  name: string;
  chamber_data: Record<string, unknown>;
  field_provenance: Record<string, unknown>;
  missing: string[];
  open_fields: number;
}[];

// What the advisor queue shows of the list: the required answers still missing (never the recommended census, which
// Review and The Manuscript list as a document needed), and how many other fields are open by status.
const asQueue = (data: ChamberData, items: OpenItem[]) => {
  const required = new Set(missingRequired(data).map((i) => i.key));
  const missing = items.filter((i) => required.has(i.key));
  // Nor does the queue count a column the census lacks (K-2.1): like the census itself, it is something to upload.
  // Nor a state with no unemployment tax rate (K-4.2), which the prospect adds on the Payroll tab or from a notice.
  const uploads = new Set(["Document needed", "Missing from the census", "Rate needed"]);
  return { missing: missing.map((i) => i.label), open_fields: items.filter((i) => !required.has(i.key) && !uploads.has(i.reason)).length };
};

describe("openItems", () => {
  it.each(FIXTURE.map((c) => [c.name, c] as const))("%s: lists what the advisor queue counts", (_name, c) => {
    const data = parseChamberData(c.chamber_data);
    const items = openItems(data, parseProvenance(c.field_provenance));
    expect(asQueue(data, items)).toEqual({ missing: c.missing, open_fields: c.open_fields });
  });

  it("says why each item is open, required answers first, then the census, then fields by status", () => {
    const c = FIXTURE.find((f) => f.name.startsWith("fields open by status"))!;
    const items = openItems(parseChamberData(c.chamber_data), parseProvenance(c.field_provenance));
    expect(items.map((i) => [i.key, i.reason])).toEqual([
      // The fixture's census has none of the columns PEOs ask for (K-2.1): one item each, after the required answers.
      ["census.gender", "Missing from the census"],
      ["census.hire_date", "Missing from the census"],
      ["census.cobra", "Missing from the census"],
      ["census.home_state", "Missing from the census"],
      ["census.class_code", "Missing from the census"],
      // The fixture's state of operation has no unemployment tax rate (K-4.2).
      ["suta_rates.NY", "Rate needed"],
      ["current_carrier", "Conflicting answers"],
      ["hq_state", "Incomplete"],
      ["renewal_date", "Prospect to provide"],
      ["industry", "Please confirm"],
    ]);
    const empty = openItems(EMPTY_CHAMBER_DATA, {});
    expect(empty.map(describeOpenItem)).toEqual([
      "Company legal name — not provided",
      "States of operation — not provided",
      "Pay frequency — not provided",
      "Employee census — document needed",
    ]);
  });

  it("names a required answer the prospect doesn't know once, as theirs to provide", () => {
    const items = openItems({ ...EMPTY_CHAMBER_DATA, states: ["CA"], pay_frequency: "weekly" }, {
      company_name: { status: "unknown", source: { kind: "transcript", message_id: "m1" }, updated_at: "2026-11-04T00:00:00Z" },
    });
    expect(items.filter((i) => i.key === "company_name")).toEqual([{ key: "company_name", field: "company_name", label: "Company legal name", reason: "Prospect to provide" }]);
  });

  it("never lists a recommended field with no answer, or one marked doesn't apply", () => {
    const items = openItems({ ...EMPTY_CHAMBER_DATA, company_name: "Acme", states: ["NY"], pay_frequency: "weekly", suta_rates: [{ state: "NY", rate: 4.1 }] }, {
      wc_carrier: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: "2026-11-04T00:00:00Z" },
    });
    expect(items.map((i) => i.key)).toEqual(["census"]);
  });

  // K-2.1: a census without the columns PEOs ask for is accepted; each missing column is one item, not one per person.
  describe("columns the census lacks", () => {
    const person = (extra: Record<string, unknown> = {}) => ({ id: "e", first_name: "Ada", last_name: "L", work_state: "NY", compensation_type: "salary", employment_type: "full_time", classification: "w2", class_code: "8810", ...extra });
    const withCensus = (census: Record<string, unknown>[]) => parseChamberData({ company_name: "Acme", states: ["NY"], pay_frequency: "weekly", census: census.map((e, i) => ({ ...e, id: `e${i}` })) });
    const columns = (data: ChamberData) => openItems(data, {}).filter((i) => i.reason === "Missing from the census");

    it("lists each missing column once, however many people lack it", () => {
      const items = columns(withCensus([person(), person({ first_name: "Bo" }), person({ first_name: "Cy" })]));
      expect(items.map((i) => [i.key, i.label])).toEqual([
        ["census.gender", "Gender"], ["census.hire_date", "Hire date"], ["census.cobra", "COBRA status"], ["census.home_state", "Home state"],
      ]);
      expect(items.map(describeOpenItem)).toEqual([
        "Gender — missing from the census for 3 of 3 people",
        "Hire date — missing from the census for 3 of 3 people",
        "COBRA status — missing from the census for 3 of 3 people",
        "Home state — missing from the census for 3 of 3 people",
      ]);
    });

    it("says how many people lack a column that only some have", () => {
      const full = { gender: "F", hire_date: "2019-04-01", cobra: false, home_state: "NY" };
      const items = columns(withCensus([person(full), person({ ...full, first_name: "Bo", gender: undefined }), person({ ...full, first_name: "Cy" })]));
      expect(items.map(describeOpenItem)).toEqual(["Gender — missing from the census for 1 of 3 people"]);
    });

    it("counts one person as a person", () => {
      expect(columns(withCensus([person({ hire_date: "2019-04-01", cobra: false, home_state: "NY" })])).map(describeOpenItem)).toEqual(["Gender — missing from the census for 1 of 1 person"]);
    });

    it("lists none for a census that has them all, and none when there is no census (the census itself is the item)", () => {
      const full = { gender: "F", hire_date: "2019-04-01", cobra: false, home_state: "NY" };
      expect(columns(withCensus([person(full)]))).toEqual([]);
      expect(openItems(parseChamberData({ company_name: "Acme", states: ["NY"], pay_frequency: "weekly", suta_rates: [{ state: "NY", rate: 4.1 }] }), {}).map((i) => i.key)).toEqual(["census"]);
    });

    // K-3.2: people with no class code are one open item, however many there are; contractors need none.
    it("lists the class code once when employees lack it, counting employees only", () => {
      const full = { gender: "F", hire_date: "2019-04-01", cobra: false, home_state: "NY" };
      const items = columns(withCensus([person(full), person({ ...full, first_name: "Bo", class_code: undefined }), person({ ...full, first_name: "Cy", classification: "1099", class_code: undefined })]));
      expect(items.map(describeOpenItem)).toEqual(["Workers' comp class code — missing from the census for 1 of 2 employees"]);
      expect(columns(withCensus([person(full), person({ ...full, first_name: "Cy", classification: "1099", class_code: undefined })]))).toEqual([]);
    });

    it("never holds an intake back from certifying", () => {
      expect(missingRequired(withCensus([person()]))).toEqual([]);
    });
  });

  // K-4.2: one rate per state of operation; a state with none is one open item.
  describe("states with no unemployment tax rate", () => {
    const rates = (data: Partial<ChamberData>) => openItems({ ...EMPTY_CHAMBER_DATA, company_name: "Acme", pay_frequency: "weekly", ...data }, {}).filter((i) => i.reason === "Rate needed");
    const person = (work_state: string) => ({ id: work_state, first_name: "Ada", last_name: "L", work_state, compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const });

    it("lists each state of operation that has no rate, once", () => {
      const items = rates({ states: ["CA", "TX", "NY"], suta_rates: [{ state: "TX", rate: 2.7 }] });
      expect(items.map((i) => [i.key, describeOpenItem(i)])).toEqual([
        ["suta_rates.CA", "Unemployment tax rate, CA — rate needed"],
        ["suta_rates.NY", "Unemployment tax rate, NY — rate needed"],
      ]);
    });

    it("counts the states the census names as states of operation, and a state listed with no rate as having none", () => {
      expect(rates({ states: ["CA"], census: [person("TX"), person("CA")], suta_rates: [{ state: "CA", year: 2026 }] }).map((i) => i.key)).toEqual(["suta_rates.CA", "suta_rates.TX"]);
    });

    it("lists none once every state has a rate, or while no state is known", () => {
      expect(rates({ states: ["CA"], suta_rates: [{ state: "CA", rate: 3.4 }] })).toEqual([]);
      expect(rates({ states: [] })).toEqual([]);
    });
  });
});
