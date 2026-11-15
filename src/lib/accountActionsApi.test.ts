import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { archiveAccount, restoreAccount, deleteAccount, changeAccountOwner } = await import("./accountActionsApi");
const { AccountError } = await import("./accountPageApi");

const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};
const refused = (code: string, message = "refused") => ({ data: null, error: { code, message } });

beforeEach(() => rpc.mockReset());

describe("accountActionsApi", () => {
  // Catches: the wrong function or the firm left off (one firm at a time, ADR 0016).
  it("names the firm and the account in each call", async () => {
    rpc.mockResolvedValue({ data: { changed: true, record: {} }, error: null });
    await archiveAccount("f1", "a1");
    await restoreAccount("f1", "a1");
    expect(rpc).toHaveBeenNthCalledWith(1, "archive_account", { p_account_id: "a1", p_firm_id: "f1" });
    expect(rpc).toHaveBeenNthCalledWith(2, "restore_account", { p_account_id: "a1", p_firm_id: "f1" });
    rpc.mockResolvedValue({ data: { deleted: true, name: "X" }, error: null });
    expect(await deleteAccount("f1", "a1")).toEqual({ name: "X" });
    expect(rpc).toHaveBeenLastCalledWith("delete_account", { p_account_id: "a1", p_firm_id: "f1" });
  });

  it("sends the owner and whether the open opportunities go with it, and reads the counts", async () => {
    rpc.mockResolvedValue({ data: { record: {}, owner: { id: "u2", name: "Marcus Hale" }, opportunities_changed: 2, opportunities_skipped: 1 }, error: null });
    expect(await changeAccountOwner("f1", "a1", "u2", true)).toEqual({ ownerName: "Marcus Hale", opportunitiesChanged: 2, opportunitiesSkipped: 1 });
    expect(rpc).toHaveBeenCalledWith("change_account_owner", { p_account_id: "a1", p_owner_id: "u2", p_change_open_opportunities: true, p_firm_id: "f1" });
  });

  // Catches: a refusal whose words are lost, or an intake refusal that is not told apart from a failure (the screen offers Archive instead).
  it.each([
    ["PT404", "notFound"], ["PT423", "readOnly"], ["42501", "notAllowed"], ["22023", "invalid"], ["PT409", "holdsIntake"], ["XX000", "failed"],
  ])("reads %s as %s", async (code, kind) => {
    rpc.mockResolvedValue(refused(code, "In words."));
    const e = await caught(() => deleteAccount("f1", "a1"));
    expect(e).toBeInstanceOf(AccountError);
    expect((e as InstanceType<typeof AccountError>).kind).toBe(kind);
    if (code !== "XX000" && code !== "PT404") expect((e as Error).message).toBe("In words.");
  });

  // Catches: an answer in another shape taken as success.
  it("treats an answer that is not the agreed shape as a failure", async () => {
    rpc.mockResolvedValue({ data: { nothing: true }, error: null });
    for (const call of [() => archiveAccount("f1", "a1"), () => restoreAccount("f1", "a1"), () => deleteAccount("f1", "a1"), () => changeAccountOwner("f1", "a1", "u2", false)]) {
      expect(((await caught(call)) as InstanceType<typeof AccountError>).kind).toBe("failed");
    }
  });
});
