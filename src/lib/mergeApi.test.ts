import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { previewMergeAccounts, mergeAccounts, previewMergeContacts, mergeContacts, keepAccountsSeparate, getDuplicateMark, followMergedRecord, MergeError } = await import("./mergeApi");

const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};
const refused = (code: string, message = "refused") => ({ data: null, error: { code, message } });

const account = (id: string, name: string, version = 3) => ({
  id, version, name, trade_name: null, website: null, phone: null, street: null, city: null, state: null, postal_code: null, industry: null, employees: null,
  states_of_operation: [], current_provider: null, archived_at: null, owner: { id: "u1", name: "Ana" },
});
const moves = { contacts: 2, opportunities: 1, quotes: 1, calls: 1, notes: 0, tasks: 0, labels: 1, history: 4 };
const contact = (id: string, version = 2) => ({
  id, version, account_id: "a1", first_name: "Ada", last_name: "Main", title: null, email: "ada@e.example", phone: null, mobile: null, is_main: true, do_not_email: false, owner: null,
});

beforeEach(() => rpc.mockReset());

describe("mergeApi", () => {
  // Catches: the wrong function, the firm left off (one firm at a time, ADR 0016), or the kept and removed accounts the wrong way round.
  it("asks for an account preview naming the firm, the account kept and the one removed", async () => {
    rpc.mockResolvedValue({ data: { keep: account("a1", "Kept"), remove: account("a2", "Removed"), fields: [{ field: "name", keep: "Kept", remove: "Removed" }], moves }, error: null });
    const p = await previewMergeAccounts("f1", "a1", "a2");
    expect(rpc).toHaveBeenCalledWith("merge_accounts_preview", { p_firm_id: "f1", p_keep_id: "a1", p_remove_id: "a2" });
    expect(p.fields).toEqual([{ field: "name", keep: "Kept", remove: "Removed" }]);
    expect(p.moves.contacts).toBe(2);
    expect(p.keep.version).toBe(3);
  });

  // Catches: the versions or the picks not sent (a merge that cannot say what it started from is refused, and one that sends no picks takes none of the removed account's values).
  it("sends the picks and both versions, and reads what was moved", async () => {
    rpc.mockResolvedValue({ data: { record: account("a1", "Removed"), merged_from: { id: "a2", name: "Removed" }, moved: moves }, error: null });
    const m = await mergeAccounts("f1", "a1", "a2", { take: ["name", "employees"], keepVersion: 3, removeVersion: 5 });
    expect(rpc).toHaveBeenCalledWith("merge_accounts", { p_firm_id: "f1", p_keep_id: "a1", p_remove_id: "a2", p_take: ["name", "employees"], p_keep_version: 3, p_remove_version: 5 });
    expect(m.mergedFrom).toEqual({ id: "a2", name: "Removed" });
    expect(m.moved.history).toBe(4);
  });

  it("asks about two contacts and reads their preview, the main place and the request not to be emailed", async () => {
    rpc.mockResolvedValue({
      data: { account: { id: "a1", name: "Acme" }, keep: contact("c1"), remove: contact("c2"), fields: [], moves: { activities: 2, opportunities: 1, history: 3 }, do_not_email: true, main: true },
      error: null,
    });
    const p = await previewMergeContacts("f1", "c1", "c2");
    expect(rpc).toHaveBeenCalledWith("merge_contacts_preview", { p_firm_id: "f1", p_keep_id: "c1", p_remove_id: "c2" });
    expect(p.doNotEmail).toBe(true);
    expect(p.main).toBe(true);
    expect(p.moves.activities).toBe(2);
    rpc.mockResolvedValue({ data: { record: contact("c1"), merged_from: { id: "c2", name: "Ada Main" }, moved: { activities: 2, opportunities: 1 } }, error: null });
    const m = await mergeContacts("f1", "c1", "c2", { take: ["phone"], keepVersion: 2, removeVersion: 2 });
    expect(rpc).toHaveBeenLastCalledWith("merge_contacts", { p_firm_id: "f1", p_keep_id: "c1", p_remove_id: "c2", p_take: ["phone"], p_keep_version: 2, p_remove_version: 2 });
    expect(m.moved).toEqual({ activities: 2, opportunities: 1 });
  });

  it("keeps two accounts separate", async () => {
    rpc.mockResolvedValue({ data: { changed: true, record: account("a1", "Kept") }, error: null });
    expect(await keepAccountsSeparate("f1", "a1")).toEqual({ changed: true });
    expect(rpc).toHaveBeenCalledWith("keep_accounts_separate", { p_firm_id: "f1", p_account_id: "a1" });
  });

  // Catches: a banner shown for an account with no mark, or one that offers a merge the person was not given.
  it("reads the possible-duplicate banner, and nothing when there is none", async () => {
    rpc.mockResolvedValue({ data: { other: { id: "a2", name: "Earlier", archived: false }, can_merge: false, can_keep_separate: true }, error: null });
    expect(await getDuplicateMark("f1", "a1")).toEqual({ other: { id: "a2", name: "Earlier", archived: false }, canMerge: false, canKeepSeparate: true });
    rpc.mockResolvedValue({ data: { other: null, can_merge: false, can_keep_separate: true }, error: null });
    expect((await getDuplicateMark("f1", "a1"))?.other).toBeNull();
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getDuplicateMark("f1", "a1")).toBeNull();
  });

  // Catches: an old link that does not lead to the record kept, or that loses what the record was called.
  it("follows an old address to the record kept", async () => {
    rpc.mockResolvedValue({ data: { merged: true, kind: "account", id: "a1", account_id: "a1", name: "Kept", from_name: "Removed", merged_at: "2026-11-15T10:00:00Z" }, error: null });
    expect(await followMergedRecord("f1", "account", "a2")).toEqual({ merged: true, kind: "account", id: "a1", accountId: "a1", name: "Kept", fromName: "Removed", mergedAt: "2026-11-15T10:00:00Z" });
    expect(rpc).toHaveBeenCalledWith("follow_merged_record", { p_firm_id: "f1", p_kind: "account", p_id: "a2" });
  });

  // Catches: a refusal whose words are lost, or one told as another (the screen offers Restore for an archived account and Look again for a version that moved).
  it.each([
    ["PT404", "notFound"], ["PT423", "readOnly"], ["42501", "notAllowed"], ["22023", "invalid"], ["55000", "archived"], ["PT409", "changed"], ["40001", "retry"], ["XX000", "failed"],
  ])("reads %s as %s", async (code, kind) => {
    rpc.mockResolvedValue(refused(code, "In words."));
    const e = await caught(() => mergeAccounts("f1", "a1", "a2", { take: [], keepVersion: 1, removeVersion: 1 }));
    expect(e).toBeInstanceOf(MergeError);
    expect((e as InstanceType<typeof MergeError>).kind).toBe(kind);
    if (!["XX000", "PT404"].includes(code)) expect((e as Error).message).toBe("In words.");
  });

  // Catches: an answer in another shape taken as a merge that happened.
  it("treats an answer that is not the agreed shape as a failure", async () => {
    rpc.mockResolvedValue({ data: { nothing: true }, error: null });
    for (const call of [
      () => previewMergeAccounts("f1", "a1", "a2"), () => mergeAccounts("f1", "a1", "a2", { take: [], keepVersion: 1, removeVersion: 1 }),
      () => previewMergeContacts("f1", "c1", "c2"), () => mergeContacts("f1", "c1", "c2", { take: [], keepVersion: 1, removeVersion: 1 }),
      () => keepAccountsSeparate("f1", "a1"), () => getDuplicateMark("f1", "a1"), () => followMergedRecord("f1", "account", "a2"),
    ]) {
      expect(((await caught(call)) as InstanceType<typeof MergeError>).kind).toBe("failed");
    }
  });
});
