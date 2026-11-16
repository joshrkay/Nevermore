import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { createOpportunity, getNewOpportunityContext, OpportunityError } = await import("./opportunityCreateApi");

const input = {
  name: "January 2028 PEO search", targetStart: "2028-01-01", employees: 45, mainContactId: "c1", expectedClose: "2027-12-10", value: 7100, source: "Referral",
  referralPartnerCode: "acme-cfo", nextStep: "Ask Elena.", ownerId: "u1",
};
const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};

beforeEach(() => rpc.mockReset());

describe("getNewOpportunityContext", () => {
  // Catches: the form's context asked of the wrong call or with the wrong arguments, or an answer read into the wrong names.
  it("asks for the account, its contacts, the partners and the owners, and answers them in the form's names", async () => {
    rpc.mockResolvedValue({
      data: {
        account: { id: "a1", name: "Harborview", archived: false, employees: 45 }, main_contact: { id: "c1", name: "Elena Marsh" },
        contacts: [{ id: "c1", name: "Elena Marsh", title: "Practice Manager", is_main: true }], partners: [{ code: "acme-cfo", name: "Acme CFO" }], owners: [{ id: "u1", name: "Dana Reyes" }],
      },
      error: null,
    });
    expect(await getNewOpportunityContext("f1", "a1")).toEqual({
      account: { id: "a1", name: "Harborview", archived: false, employees: 45 }, mainContact: { id: "c1", name: "Elena Marsh" },
      contacts: [{ id: "c1", name: "Elena Marsh", title: "Practice Manager", isMain: true }], partners: [{ code: "acme-cfo", name: "Acme CFO" }], owners: [{ id: "u1", name: "Dana Reyes" }],
    });
    expect(rpc).toHaveBeenCalledWith("opportunity_create_context", { p_firm_id: "f1", p_account_id: "a1" });
  });
  // Catches: an answer of another shape drawn as if it were the account, or an account the person may not see told as a connection failure.
  it("is a failed load for an answer of another shape, and 'not found' for an account the person may not see", async () => {
    rpc.mockResolvedValue({ data: { account: { name: 3 } }, error: null });
    await expect(getNewOpportunityContext("f1", "a1")).rejects.toThrow("Couldn't load the account.");
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "That account isn't available" } });
    expect(await caught(() => getNewOpportunityContext("f1", "a1"))).toMatchObject({ kind: "notFound" });
  });
});

describe("createOpportunity", () => {
  // Catches: a field dropped or sent under another name; a blank date sent as an empty string (the database reads it as a bad date); the stage sent (it is not
  // a parameter, D-409); the answer's id not given back, so the page cannot be opened (D-442).
  it("sends every field with the account, the firm and the owner, and answers the new opportunity's id", async () => {
    rpc.mockResolvedValue({ data: { record: { id: "o1", version: 1, stage: "qualifying" } }, error: null });
    expect(await createOpportunity("f1", "a1", input)).toEqual({ id: "o1", version: 1, stage: "qualifying" });
    expect(rpc).toHaveBeenCalledWith("opportunity_create", {
      p_account_id: "a1", p_name: "January 2028 PEO search", p_target_start: "2028-01-01", p_employees: 45, p_main_contact_id: "c1", p_expected_close: "2027-12-10",
      p_value: 7100, p_source: "Referral", p_referral_partner_code: "acme-cfo", p_next_step: "Ask Elena.", p_owner_id: "u1", p_firm_id: "f1",
    });
  });
  it("sends nothing for what was left blank", async () => {
    rpc.mockResolvedValue({ data: { record: { id: "o1", version: 1, stage: "qualifying" } }, error: null });
    await createOpportunity("f1", "a1", { ...input, targetStart: "", expectedClose: "", employees: null, value: null, source: "", mainContactId: null, referralPartnerCode: null, ownerId: null });
    expect(rpc).toHaveBeenCalledWith("opportunity_create", expect.objectContaining({
      p_target_start: null, p_expected_close: null, p_employees: null, p_value: null, p_source: null, p_main_contact_id: null, p_referral_partner_code: null, p_owner_id: null,
    }));
  });
  // Catches: a refusal shown as "couldn't save, try again" so the person retries what will never work, or the database's words lost.
  it("keeps the database's words for each refusal and names its kind", async () => {
    const kinds: [string, string][] = [["22023", "invalid"], ["42501", "notAllowed"], ["55000", "archived"], ["PT423", "readOnly"], ["PT404", "notFound"]];
    for (const [code, kind] of kinds) {
      rpc.mockResolvedValue({ data: null, error: { code, message: `words for ${code}` } });
      const e = await caught(() => createOpportunity("f1", "a1", input));
      expect(e).toBeInstanceOf(OpportunityError);
      expect(e).toMatchObject({ kind, code });
    }
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Choose a source from the list." } });
    expect(await caught(() => createOpportunity("f1", "a1", input))).toMatchObject({ message: "Choose a source from the list." });
  });
  // Catches: any other failure (a dropped connection) said in the database's raw words, or taken as a refusal.
  it("says any other failure in words of its own", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "connection reset" } });
    expect(await caught(() => createOpportunity("f1", "a1", input))).toMatchObject({ kind: "failed", message: "Couldn't save the opportunity. Check your connection and try again." });
    rpc.mockResolvedValue({ data: { record: { nope: true } }, error: null });
    expect(await caught(() => createOpportunity("f1", "a1", input))).toMatchObject({ kind: "failed" });
  });
});
