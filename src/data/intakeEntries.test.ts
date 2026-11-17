import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import { entrySummary } from "./intakeEntries";

describe("how many answers an intake holds (CRM-Q2.2, D-1871)", () => {
  // Catches: an empty intake showing every field it has as answered (the empty string, null, empty list and empty object are not answers), so the step claims progress nobody made.
  it("counts a field only when it holds something, as the database's own count does", () => {
    const data = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", industry: "  ", employee_count: 0, states: ["CA"], in_peo: false };
    expect(entrySummary(data, {}).answered).toBe(4);
  });
});

describe("who entered the answers (CRM-Q2.2, D-1871)", () => {
  const entry = (kind: "broker_entry" | "prospect_edit" | "transcript") => ({
    status: "inferred" as const,
    source: kind === "broker_entry" ? { kind, member_id: "11111111-1111-4111-8111-111111111111" } : kind === "transcript" ? { kind, message_id: "m1" } : { kind },
    updated_at: "2026-11-17T10:00:00.000Z",
  });

  // Catches: every answer credited to the firm (or to the contact), so "who entered them" says nothing: an answer is the firm's only while a broker entry stands on it; the employer's own typing, Lenore's hearing of them, and an answer with no record are the contact's.
  it("counts the answers a member of the firm entered apart from the contact's own", () => {
    const data = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", industry: "Retail", website: "acme.example", hq_state: "CA" };
    const provenance = { company_name: entry("broker_entry"), industry: entry("broker_entry"), website: entry("prospect_edit"), hq_state: entry("transcript") };
    expect(entrySummary(data, provenance)).toMatchObject({ answered: 4, byFirm: 2, byContact: 2 });
  });
});

describe("what is still needed before it can be certified (CRM-Q2.2, D-1871)", () => {
  // Catches: the step saying nothing is needed for an intake that is missing required answers (the database refuses to certify them), or naming the recommended census as holding it back.
  it("names each required answer that is missing, and never the recommended census", () => {
    const data = { ...EMPTY_CHAMBER_DATA, company_name: "Acme" };
    expect(entrySummary(data, {}).stillNeeded).toEqual(["States of operation", "Pay frequency"]);
  });
});
