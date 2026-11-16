import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { convertLead, getConvertMatches } = await import("./leadConvertApi");

const made = {
  account: { id: "a1", name: "Reyes Bakery", created: true },
  contact: { id: "c1", first_name: "Lucia", last_name: "Reyes" },
  opportunity: { id: "o1", name: "Reyes Bakery – PEO search" },
};
const input = {
  accountId: null, makeContact: true, firstName: "Lucia", lastName: "Reyes", email: "lucia@reyes.example", phone: "(503) 555-0142",
  makeOpportunity: true, opportunityName: "Reyes Bakery – PEO search", targetStart: "2027-01-01",
};

beforeEach(() => {
  rpc.mockReset();
});

describe("convertLead", () => {
  // Break caught: the dialog sends the wrong parameter names (a contact's phone read as the lead's), or a blank target start as an empty string the database cannot take as a date.
  it("sends what the agent chose with the database's parameter names, a blank target start as none, and reads the three records made", async () => {
    rpc.mockResolvedValue({ data: made, error: null });
    const answer = await convertLead("f1", "l1", { ...input, targetStart: "" });
    expect(rpc).toHaveBeenCalledWith("convert_lead", {
      p_lead_id: "l1", p_account_id: null, p_make_contact: true, p_first_name: "Lucia", p_last_name: "Reyes", p_contact_email: "lucia@reyes.example",
      p_contact_phone: "(503) 555-0142", p_make_opportunity: true, p_opportunity_name: "Reyes Bakery – PEO search", p_target_start: null, p_firm_id: "f1",
    });
    expect(answer).toEqual({
      account: { id: "a1", name: "Reyes Bakery", created: true }, contact: { id: "c1", name: "Lucia Reyes" }, opportunity: { id: "o1", name: "Reyes Bakery – PEO search" },
    });
  });
});

describe("convertLead refusals", () => {
  // Break caught: the agent sees "Couldn't convert" for a contact with no email or phone and retypes the same thing, or sees a raw database error.
  it("says what is wrong in the database's own words, and nothing of an unexpected failure but a plain sentence", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Enter an email or a phone number." } });
    await expect(convertLead("f1", "l1", input)).rejects.toMatchObject({ kind: "invalid", message: "Enter an email or a phone number." });
    rpc.mockResolvedValue({ data: null, error: { code: "42P01", message: 'relation "leads" does not exist' } });
    await expect(convertLead("f1", "l1", input)).rejects.toMatchObject({ kind: "failed", message: "Couldn't convert the lead. Check your connection and try again." });
  });

  // Break caught: a lead already converted or Not a fit reads as "failed", so the agent retries something that can never work (55000 is the database's "read, not changed").
  it("keeps the words that say a lead is Converted, Not a fit or binned", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "This lead is Not a fit. Reopen it before converting it." } });
    await expect(convertLead("f1", "l1", input)).rejects.toMatchObject({ message: "This lead is Not a fit. Reopen it before converting it." });
  });

  // Break caught: an answer with a record missing is drawn as a success and the page links to nothing.
  it("treats an answer that is not the agreed shape as a failure", async () => {
    rpc.mockResolvedValue({ data: { account: { id: "a1", name: "X" } }, error: null });
    await expect(convertLead("f1", "l1", input)).rejects.toMatchObject({ kind: "failed" });
  });
});

describe("getConvertMatches", () => {
  // Break caught: the dialog asks for the wrong lead or firm, or reads a match's reasons as free text.
  it("asks for the lead's possible matches and reads them", async () => {
    rpc.mockResolvedValue({ data: { matches: [{ id: "a9", name: "Reyes Bakery Inc", city: "Portland", state: "OR", reasons: ["name", "email"] }] }, error: null });
    expect(await getConvertMatches("f1", "l1")).toEqual([{ id: "a9", name: "Reyes Bakery Inc", city: "Portland", state: "OR", reasons: ["name", "email"] }]);
    expect(rpc).toHaveBeenCalledWith("lead_convert_context", { p_firm_id: "f1", p_lead_id: "l1" });
  });
});
