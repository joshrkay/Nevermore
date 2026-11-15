import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { createAccount } = await import("./accountCreateApi");
const { AccountError } = await import("./accountPageApi");
type NewAccount = import("./accountCreateApi").NewAccount;

const made = {
  id: "a9", version: 1, name: "Harborview Dental East", trade_name: null, website: "harborviewdental.example", web_domain: "harborviewdental.example", phone: null, street: null,
  city: "Gresham", state: "OR", postal_code: null, industry: "Dental practice", employees: 12, states_of_operation: ["OR"], current_provider: null, source: "added_by_hand",
  archived_at: null, created_at: "2026-11-15T10:00:00+00:00", updated_at: "2026-11-15T10:00:00+00:00",
};

const input: NewAccount = {
  name: "Harborview Dental East", tradeName: "", website: "harborviewdental.example", phone: "", street: "", city: "Gresham", state: "OR", postalCode: "", industry: "Dental practice",
  employees: 12, statesOfOperation: ["OR"], currentProvider: "", ownerId: "u2",
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

describe("createAccount", () => {
  it("sends every field with the firm and the owner chosen, and answers the made account", async () => {
    rpc.mockResolvedValue({ data: made, error: null });
    const account = await createAccount("f1", input);
    expect(rpc).toHaveBeenCalledWith("create_account", {
      p_name: "Harborview Dental East", p_trade_name: "", p_website: "harborviewdental.example", p_phone: "", p_street: "", p_city: "Gresham", p_state: "OR",
      p_postal_code: "", p_industry: "Dental practice", p_employees: 12, p_states_of_operation: ["OR"], p_current_provider: "", p_owner_id: "u2", p_firm_id: "f1",
    });
    expect(account).toMatchObject({ id: "a9", version: 1, name: "Harborview Dental East", source: "added_by_hand", employees: 12, statesOfOperation: ["OR"] });
  });

  it("names no owner when none is chosen, so the maker is the owner", async () => {
    rpc.mockResolvedValue({ data: made, error: null });
    await createAccount("f1", { ...input, ownerId: null });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_owner_id: null });
  });

  it("says what the database refused, in its own words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Give the account a name." } });
    const e = await caught(() => createAccount("f1", input));
    expect(e).toBeInstanceOf(AccountError);
    expect(e).toMatchObject({ kind: "invalid", message: "Give the account a name." });
  });

  it.each([
    ["42501", "notAllowed"],
    ["PT423", "readOnly"],
    ["XX000", "failed"],
  ])("a %s refusal is %s", async (code, kind) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "refused" } });
    expect(await caught(() => createAccount("f1", input))).toMatchObject({ kind });
  });

  it("is a failure, never a made account with something missing, when the answer is not the agreed shape", async () => {
    rpc.mockResolvedValue({ data: { ...made, id: undefined }, error: null });
    expect(await caught(() => createAccount("f1", input))).toMatchObject({ kind: "failed", message: "Couldn't save the account. Try again." });
  });
});
