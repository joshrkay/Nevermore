import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { convertLead, getConvertMatches } = await import("./leadConvertApi");

beforeEach(() => {
  rpc.mockReset();
});

describe("getConvertMatches", () => {
  // Catches: the dialog asking the database for the wrong lead or firm, or reading its answer wrongly (the accounts the lead may be).
  it("asks for the lead's possible matches and reads them", async () => {
    rpc.mockResolvedValue({ data: { matches: [{ id: "a9", name: "Reyes Bakery", city: "Portland", state: "OR", reasons: ["name"] }] }, error: null });
    const matches = await getConvertMatches("f1", "l1");
    expect(rpc).toHaveBeenCalledWith("lead_convert_context", { p_firm_id: "f1", p_lead_id: "l1" });
    expect(matches).toEqual([{ id: "a9", name: "Reyes Bakery", city: "Portland", state: "OR", reasons: ["name"] }]);
  });

  // Catches: a failed look for matches read as "no matches" (the agent would make a second account for a business already held).
  it("fails, in a plain sentence, when the database cannot answer", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom: internal detail" } });
    await expect(getConvertMatches("f1", "l1")).rejects.toThrow("Couldn't look for matching accounts. You can still convert the lead.");
  });

  // Catches: a lead that is not there (the database's PT404) said as a failure to look, when the person should be told to reload.
  it("says in the database's words when the lead is not there", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "" } });
    await expect(getConvertMatches("f1", "l1")).rejects.toThrow("That isn't available any more. Reload the page.");
  });

  // Catches: an answer of another shape drawn as if it were matches (a half-read answer offering an account with no id).
  it("treats an answer that is not the agreed shape as a failure", async () => {
    rpc.mockResolvedValue({ data: { matches: [{ name: "No id" }] }, error: null });
    await expect(getConvertMatches("f1", "l1")).rejects.toThrow("Couldn't look for matching accounts. You can still convert the lead.");
  });
});

const made = {
  account: { id: "a1", name: "Reyes Bakery", created: true },
  contact: { id: "c1", first_name: "Lucia", last_name: "Reyes" },
  opportunity: { id: "o1", name: "Reyes Bakery – PEO search" },
};
const input = {
  accountId: null, makeContact: true, firstName: "Lucia", lastName: "Reyes", email: "lucia@reyes.example", phone: "(503) 555-0142",
  makeOpportunity: true, opportunityName: "Reyes Bakery – PEO search", targetStart: "2027-01-01",
};

describe("convertLead", () => {
  // Catches: the wrong parameter names (a contact's phone read as the lead's), or a blank target start sent as '' where the database wants none.
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

  // Catches: a refusal shown as a generic failure (the agent cannot tell what to fix), or an unexpected failure leaking the database's internals.
  it("says what is wrong in the database's own words, and nothing of an unexpected failure but a plain sentence", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "Enter an email or a phone number." } });
    await expect(convertLead("f1", "l1", input)).rejects.toThrow("Enter an email or a phone number.");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "relation \"contacts\" exploded" } });
    await expect(convertLead("f1", "l1", input)).rejects.toThrow("Couldn't convert the lead. Check your connection and try again.");
  });

  // Catches: a contact or opportunity invented in the answer when none was made (the page would link to nothing).
  it("reads no contact and no opportunity when none were made", async () => {
    rpc.mockResolvedValue({ data: { account: { id: "a1", name: "Reyes Bakery", created: false }, contact: null, opportunity: null }, error: null });
    expect(await convertLead("f1", "l1", { ...input, makeContact: false, makeOpportunity: false })).toEqual({
      account: { id: "a1", name: "Reyes Bakery", created: false }, contact: null, opportunity: null,
    });
  });

  // Catches: an answer that is not the agreed shape treated as a conversion that worked (the page would announce one that made nothing it can name).
  it("treats an answer that is not the agreed shape as a failure", async () => {
    rpc.mockResolvedValue({ data: { account: { name: "No id" } }, error: null });
    await expect(convertLead("f1", "l1", input)).rejects.toThrow("Couldn't convert the lead. Check your connection and try again.");
  });
});
