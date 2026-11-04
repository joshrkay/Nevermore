import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseChamberData } from "./chamberValidation";
import { describeOpenItem, openItems, type OpenItem } from "./openItems";
import { parseProvenance } from "./provenance";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";

// The same intakes supabase/tests/open_items.sql gives the advisor queue, with what it must count.
const FIXTURE = JSON.parse(readFileSync("supabase/tests/fixtures/open_items.json", "utf8")) as {
  name: string;
  chamber_data: Record<string, unknown>;
  field_provenance: Record<string, unknown>;
  missing: string[];
  open_fields: number;
}[];

// What the advisor queue shows of the list: the missing answers (and the census), and how many others are open.
const QUEUE_MISSING = new Set(["company_name", "states", "pay_frequency", "census"]);
const asQueue = (items: OpenItem[]) => {
  const missing = items.filter((i) => QUEUE_MISSING.has(i.key) && (i.reason === "Not provided" || i.reason === "Document needed" || i.reason === "Prospect to provide"));
  return { missing: missing.map((i) => i.label), open_fields: items.length - missing.length };
};

describe("openItems", () => {
  it.each(FIXTURE.map((c) => [c.name, c] as const))("%s: lists what the advisor queue counts", (_name, c) => {
    const items = openItems(parseChamberData(c.chamber_data), parseProvenance(c.field_provenance));
    expect(asQueue(items)).toEqual({ missing: c.missing, open_fields: c.open_fields });
  });

  it("says why each item is open, required answers first, then the census, then fields by status", () => {
    const c = FIXTURE.find((f) => f.name.startsWith("fields open by status"))!;
    const items = openItems(parseChamberData(c.chamber_data), parseProvenance(c.field_provenance));
    expect(items.map((i) => [i.key, i.reason])).toEqual([
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
    const items = openItems({ ...EMPTY_CHAMBER_DATA, company_name: "Acme", states: ["NY"], pay_frequency: "weekly" }, {
      wc_carrier: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: "2026-11-04T00:00:00Z" },
    });
    expect(items.map((i) => i.key)).toEqual(["census"]);
  });
});
