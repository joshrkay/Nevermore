import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { getContactPage, listContactActivity, updateContact } = await import("./contactPageApi");

const fields = {
  id: "c1", version: 3, account_id: "a1", first_name: "Elena", last_name: "Marsh", title: "Practice Manager", email: "elena@harborview.example", phone: "(503) 555-0142", mobile: null,
  is_main: true, do_not_email: false, owner: { id: "u1", name: "Dana Reyes" }, created_at: "2026-09-03T10:00:00+00:00", updated_at: "2026-11-01T10:00:00+00:00",
};
const pageAnswer = {
  contact: { ...fields, account: { id: "a1", name: "Harborview Dental Group", archived: false } }, can_change: true, can_move: false, can_add: true,
  opportunities: { count: 1, rows: [{ id: "o1", name: "Search", stage: "in_market", target_start: "2027-01-01", submission_id: "i1" }] },
};
const edit = { firstName: "Elena", lastName: "Marsh", title: "", email: "elena@harborview.example", phone: "", mobile: "", ownerId: null, isMain: true, doNotEmail: true };
const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};

beforeEach(() => rpc.mockReset());

describe("getContactPage", () => {
  // Catches: a field of the page dropped or renamed on the way to the screen, or the wrong function asked.
  it("asks contact_page and gives the contact, what the person may do, and its opportunities", async () => {
    rpc.mockResolvedValue({ data: pageAnswer, error: null });
    const page = await getContactPage("f1", "c1");
    expect(rpc).toHaveBeenCalledWith("contact_page", { p_firm_id: "f1", p_contact_id: "c1" });
    expect(page).toMatchObject({
      contact: { id: "c1", version: 3, accountId: "a1", firstName: "Elena", isMain: true, owner: { id: "u1", name: "Dana Reyes" }, account: { name: "Harborview Dental Group", archived: false } },
      canChange: true, canMove: false, canAdd: true,
      opportunities: { count: 1, rows: [{ id: "o1", stage: "in_market", targetStart: "2027-01-01", submissionId: "i1" }] },
    });
  });
  // Catches: nothing read as a page, an answer of another shape shown with something missing, or an ended session not said.
  it("is null for a contact that is not there or not theirs, and a failure for an answer of another shape", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getContactPage("f1", "c1")).toBeNull();
    rpc.mockResolvedValue({ data: { ...pageAnswer, can_move: "yes" }, error: null });
    expect(await caught(() => getContactPage("f1", "c1"))).toMatchObject({ kind: "failed", message: "Couldn't load the contact. Try again." });
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    expect(await caught(() => getContactPage("f1", "c1"))).toMatchObject({ kind: "failed" });
  });
});

describe("listContactActivity", () => {
  const row = { type: "note", id: "n1", entry_key: "n1", at: "2026-11-13T18:30:00+00:00", who: "Dana", author_id: "u1", contact: { id: "c1", name: "Elena Marsh" }, opportunity: null, outcome: null, title: null,
    body: "Hello", additions: [], assignee: null, due_on: null, done_at: null, done_by: null, can_edit: true, editable_until: "2026-11-14T18:30:00+00:00" };
  it("asks for a page of the contact's rows, narrowed, from a place", async () => {
    rpc.mockResolvedValue({ data: { count: 1, rows: [row] }, error: null });
    const list = await listContactActivity("f1", "c1", { filter: "notes", limit: 50, offset: 100 });
    expect(rpc).toHaveBeenCalledWith("contact_activity", { p_firm_id: "f1", p_contact_id: "c1", p_filter: "notes", p_limit: 50, p_offset: 100 });
    expect(list).toMatchObject({ count: 1, rows: [{ type: "note", id: "n1", entryKey: "n1", body: "Hello", canEdit: true }] });
  });
  it("asks for all, fifty from the first row, when not told", async () => {
    rpc.mockResolvedValue({ data: { count: 0, rows: [] }, error: null });
    await listContactActivity("f1", "c1");
    expect(rpc).toHaveBeenCalledWith("contact_activity", { p_firm_id: "f1", p_contact_id: "c1", p_filter: "all", p_limit: 50, p_offset: 0 });
  });
  it("is null when the person may not see the contact, and a failure for rows of another shape", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await listContactActivity("f1", "c1")).toBeNull();
    rpc.mockResolvedValue({ data: { count: 1, rows: [{ type: "note" }] }, error: null });
    expect(await caught(() => listContactActivity("f1", "c1"))).toMatchObject({ kind: "failed" });
  });
});

describe("updateContact", () => {
  // Catches: a field sent under the wrong name, or the version not sent.
  it("sends every field and the version the edit started from", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { ...fields, version: 4 }, previous_main: { id: "c2", name: "Sam Park" } }, error: null });
    const answer = await updateContact("f1", "c1", edit, 3);
    expect(rpc).toHaveBeenCalledWith("update_contact", {
      p_contact_id: "c1", p_first_name: "Elena", p_last_name: "Marsh", p_title: "", p_email: "elena@harborview.example", p_phone: "", p_mobile: "", p_owner_id: null,
      p_is_main: true, p_do_not_email: true, p_firm_id: "f1", p_version: 3,
    });
    expect(answer).toMatchObject({ conflict: false, contact: { version: 4 }, previousMain: { id: "c2", name: "Sam Park" } });
  });
  it("answers no previous main contact when none was displaced", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { ...fields, version: 4 }, previous_main: null }, error: null });
    expect(await updateContact("f1", "c1", edit, 3)).toMatchObject({ previousMain: null });
  });
  // Catches: a conflict taken for a save, or its values and who changed them lost.
  it("answers a conflict with what is there now and who changed it, which is not a failure", async () => {
    const changed = [{ field: "title", value: "Director", who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" }];
    rpc.mockResolvedValue({
      data: { conflict: true, currentVersion: 5, current: { first_name: "Elena", last_name: "Marsh", title: "Director", email: null, phone: null, mobile: "(503) 555-0199", owner_id: "u2", is_main: false, do_not_email: true }, changed },
      error: null,
    });
    expect(await updateContact("f1", "c1", edit, 3)).toEqual({
      conflict: true, currentVersion: 5, changed,
      current: { firstName: "Elena", lastName: "Marsh", title: "Director", email: null, phone: null, mobile: "(503) 555-0199", ownerId: "u2", isMain: false, doNotEmail: true },
    });
  });
  // Catches: a refusal shown as a failure to try again, losing the database's words.
  it("keeps the database's words for a refusal, and says a failure to save plainly", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only the contact's owner can change it." } });
    expect(await caught(() => updateContact("f1", "c1", edit, 3))).toMatchObject({ kind: "notAllowed", message: "Only the contact's owner can change it." });
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Enter an email or a phone number." } });
    expect(await caught(() => updateContact("f1", "c1", edit, 3))).toMatchObject({ kind: "invalid", message: "Enter an email or a phone number." });
    rpc.mockResolvedValue({ data: null, error: { code: "PT423", message: "This firm is closing, so it can't be changed." } });
    expect(await caught(() => updateContact("f1", "c1", edit, 3))).toMatchObject({ kind: "readOnly" });
    rpc.mockResolvedValue({ data: { conflict: false }, error: null });
    expect(await caught(() => updateContact("f1", "c1", edit, 3))).toMatchObject({ kind: "failed", message: "Couldn't save the contact. Check your connection and try again." });
  });
});
