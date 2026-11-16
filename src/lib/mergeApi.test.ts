import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { previewMerge, mergeAccounts, mergeContacts, keepAccountSeparate, resolveMergedRecord, MergeError } = await import("./mergeApi");

const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};
const refused = (code: string, message = "refused") => ({ data: null, error: { code, message } });

const preview = {
  kind: "account", problem: null, differs: ["name", "phone"],
  kept: { id: "a1", version: 3, name: "Harborview Marine", phone: null }, removed: { id: "a2", version: 5, name: "Harborview Marine LLC", phone: "(503) 555-0100" },
  moves: { contacts: 2, opportunities: 1, intakes: 1, activities: 4, placements: 0, renewals: 0, labels: 1 },
};
const merged = {
  record: { id: "a1", version: 4, name: "Harborview Marine" }, removed: { id: "a2", name: "Harborview Marine LLC" },
  moved: { contacts: 2, contacts_merged: 1, opportunities: 1, activities: 4, placements: 0, renewals: 0, labels: 1 },
};

beforeEach(() => rpc.mockReset());

describe("mergeApi", () => {
  // Catches: the firm or the kind left off the call, or the two records swapped (the kept one is the first).
  it("asks for the two records in the firm named, kept first", async () => {
    rpc.mockResolvedValue({ data: preview, error: null });
    const p = await previewMerge("f1", "account", "a1", "a2");
    expect(rpc).toHaveBeenCalledWith("merge_preview", { p_firm_id: "f1", p_kind: "account", p_kept_id: "a1", p_removed_id: "a2" });
    expect(p.differs).toEqual(["name", "phone"]);
    expect(p.kept.version).toBe(3);
    expect(p.removed.version).toBe(5);
    expect(p.moves.contacts).toBe(2);
    expect(p.problem).toBeNull();
  });

  // Catches: a malformed preview shown as one (a record with no version, so the merge could not say which it chose from).
  it.each([
    ["a record with no version", { ...preview, kept: { id: "a1" } }],
    ["a kind nobody knows", { ...preview, kind: "lead" }],
    ["a count as text", { ...preview, moves: { contacts: "2" } }],
    ["nothing", null],
  ])("refuses %s", async (_label, data) => {
    rpc.mockResolvedValue({ data, error: null });
    const e = await caught(() => previewMerge("f1", "account", "a1", "a2"));
    expect(e).toBeInstanceOf(MergeError);
    expect((e as InstanceType<typeof MergeError>).kind).toBe("failed");
  });

  // Catches: the versions left off (a merge would overwrite a change nobody saw), the choices not sent, or the counts renamed wrongly.
  it("merges two accounts from the versions chosen from, with the choices", async () => {
    rpc.mockResolvedValue({ data: merged, error: null });
    const r = await mergeAccounts("f1", "a1", "a2", { phone: "removed", name: "kept" }, { kept: 3, removed: 5 });
    expect(rpc).toHaveBeenCalledWith("merge_accounts", {
      p_kept_id: "a1", p_removed_id: "a2", p_choices: { phone: "removed", name: "kept" }, p_kept_version: 3, p_removed_version: 5, p_firm_id: "f1",
    });
    expect(r.moved).toEqual({ contacts: 2, contactsMerged: 1, opportunities: 1, activities: 4, placements: 0, renewals: 0, labels: 1 });
    expect(r.removed.name).toBe("Harborview Marine LLC");
    expect(r.record.version).toBe(4);
  });

  it("merges two contacts and says what moved", async () => {
    rpc.mockResolvedValue({
      data: { record: { id: "c1", version: 2 }, removed: { id: "c2", name: "Sam Reyes" }, moved: { activities_moved: 3, opportunities_repointed: 1 } }, error: null,
    });
    const r = await mergeContacts("f1", "c1", "c2", {}, { kept: 1, removed: 1 });
    expect(rpc).toHaveBeenCalledWith("merge_contacts", { p_kept_id: "c1", p_removed_id: "c2", p_choices: {}, p_kept_version: 1, p_removed_version: 1, p_firm_id: "f1" });
    expect(r.moved).toEqual({ activities: 3, opportunities: 1 });
  });

  // Catches: keep separate reading the other account as present when the person may not see it.
  it("keeps two accounts separate, naming the other account when it may be seen", async () => {
    rpc.mockResolvedValue({ data: { record: { id: "a1", version: 4 }, was_duplicate_of: { id: "a0", name: "Harborview" } }, error: null });
    expect((await keepAccountSeparate("f1", "a1")).wasDuplicateOf).toEqual({ id: "a0", name: "Harborview" });
    expect(rpc).toHaveBeenLastCalledWith("account_keep_separate", { p_account_id: "a1", p_firm_id: "f1" });
    rpc.mockResolvedValue({ data: { record: { id: "a1", version: 4 }, was_duplicate_of: null }, error: null });
    expect((await keepAccountSeparate("f1", "a1")).wasDuplicateOf).toBeNull();
  });

  // Catches: an address that was never merged read as an error, a contact's account lost, or the answer trusted without its shape.
  it("leads an old address to the kept record, and says nothing for one never merged", async () => {
    rpc.mockResolvedValue({ data: { kind: "contact", id: "c1", name: "Sam Reyes", account_id: "a1" }, error: null });
    expect(await resolveMergedRecord("f1", "contact", "c2")).toEqual({ kind: "contact", id: "c1", name: "Sam Reyes", accountId: "a1" });
    expect(rpc).toHaveBeenLastCalledWith("resolve_merged_record", { p_firm_id: "f1", p_kind: "contact", p_id: "c2" });
    rpc.mockResolvedValue({ data: { kind: "account", id: "a1", name: "Harborview" }, error: null });
    expect((await resolveMergedRecord("f1", "account", "a2"))?.accountId).toBeNull();
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await resolveMergedRecord("f1", "account", "a9")).toBeNull();
    rpc.mockResolvedValue({ data: { kind: "lead", id: "x", name: "x" }, error: null });
    expect((await caught(() => resolveMergedRecord("f1", "account", "a9")) as InstanceType<typeof MergeError>).kind).toBe("failed");
  });

  // Catches: a refusal whose words are lost, or one kind read as another (a stale version told to the person as "not allowed").
  it.each([
    ["PT404", "notFound"], ["PT423", "readOnly"], ["22023", "invalid"], ["42501", "notAllowed"], ["55000", "archived"], ["40001", "changed"], ["XX000", "failed"],
  ])("reads %s as %s", async (code, kind) => {
    rpc.mockResolvedValue(refused(code, "In words."));
    const e = await caught(() => mergeAccounts("f1", "a1", "a2", {}, { kept: 1, removed: 1 }));
    expect(e).toBeInstanceOf(MergeError);
    expect((e as InstanceType<typeof MergeError>).kind).toBe(kind);
    if (code !== "XX000" && code !== "PT404") expect((e as Error).message).toBe("In words.");
  });
});
