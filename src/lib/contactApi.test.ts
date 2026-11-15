import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { addContact, getAddContactContext, listMoveChoices, moveContact, ContactError } = await import("./contactApi");

const record = {
  id: "c1", version: 1, account_id: "a1", first_name: "Owen", last_name: "Park", title: "Owner", email: "owen@harborview.example", phone: "(503) 555-0140", mobile: null,
  is_main: true, do_not_email: false, owner: { id: "u1", name: "Dana Reyes" }, created_at: "2026-11-15T10:00:00+00:00", updated_at: "2026-11-15T10:00:00+00:00",
};

const input = { firstName: "Owen", lastName: "Park", title: "Owner", email: "owen@harborview.example", phone: "(503) 555-0140", mobile: "", ownerId: "u1", isMain: true, doNotEmail: false };

const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};

beforeEach(() => rpc.mockReset());

describe("getAddContactContext", () => {
  it("asks for the account's name, whether it takes more, and who is its main contact", async () => {
    rpc.mockResolvedValue({ data: { account: { id: "a1", name: "Harborview Dental", archived: false }, main_contact: { id: "c0", name: "Ada Main" } }, error: null });
    expect(await getAddContactContext("f1", "a1")).toEqual({ account: { id: "a1", name: "Harborview Dental", archived: false }, mainContact: { id: "c0", name: "Ada Main" } });
    expect(rpc).toHaveBeenCalledWith("add_contact_context", { p_firm_id: "f1", p_account_id: "a1" });
  });
  it("is a failed load for an answer of another shape, and 'not available' for an account the person may not see", async () => {
    rpc.mockResolvedValue({ data: { account: { name: 3 } }, error: null });
    await expect(getAddContactContext("f1", "a1")).rejects.toThrow("Couldn't load the account.");
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "That account isn't available" } });
    expect(await caught(() => getAddContactContext("f1", "a1"))).toMatchObject({ kind: "notFound" });
  });
});

describe("addContact", () => {
  it("sends every field with the account, the firm and the owner chosen, and answers the contact and who was displaced as main", async () => {
    rpc.mockResolvedValue({ data: { record, previous_main: { id: "c0", name: "Ada Main" } }, error: null });
    const made = await addContact("f1", "a1", input);
    expect(rpc).toHaveBeenCalledWith("add_contact", {
      p_account_id: "a1", p_first_name: "Owen", p_last_name: "Park", p_title: "Owner", p_email: "owen@harborview.example", p_phone: "(503) 555-0140", p_mobile: "",
      p_owner_id: "u1", p_is_main: true, p_do_not_email: false, p_firm_id: "f1",
    });
    expect(made).toEqual({ contact: { id: "c1", firstName: "Owen", lastName: "Park", isMain: true }, previousMain: { id: "c0", name: "Ada Main" } });
  });
  it("names no owner when none is chosen, so the maker is the owner", async () => {
    rpc.mockResolvedValue({ data: { record, previous_main: null }, error: null });
    const made = await addContact("f1", "a1", { ...input, ownerId: null });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_owner_id: null });
    expect(made.previousMain).toBeNull();
  });
  it.each([
    ["22023", "Enter an email or a phone number.", "invalid"],
    ["42501", "You can add a contact only for yourself and, as a lead, for people on your teams.", "notAllowed"],
    ["55000", "This account is archived. Nothing can be added to it.", "archived"],
    ["PT423", "This firm is closing. It can't be changed.", "readOnly"],
    ["PT404", "That account isn't available", "notFound"],
  ])("puts the database's refusal %s into words and a kind", async (code, message, kind) => {
    rpc.mockResolvedValue({ data: null, error: { code, message } });
    const e = (await caught(() => addContact("f1", "a1", input))) as InstanceType<typeof ContactError>;
    expect(e).toBeInstanceOf(ContactError);
    expect(e.kind).toBe(kind);
    if (kind === "invalid" || kind === "notAllowed" || kind === "archived" || kind === "readOnly") expect(e.message).toBe(message);
  });
  it("is a failure to try again for anything else, and for an answer of another shape", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    expect(await caught(() => addContact("f1", "a1", input))).toMatchObject({ kind: "failed", message: "Couldn't save the contact. Check your connection and try again." });
    rpc.mockResolvedValue({ data: { record: { id: 1 } }, error: null });
    expect(await caught(() => addContact("f1", "a1", input))).toMatchObject({ kind: "failed" });
  });
});

describe("moveContact", () => {
  const moved = {
    record: { ...record, account_id: "a2", is_main: false }, from: { id: "a1", name: "Harborview Dental" }, to: { id: "a2", name: "Harborview East" },
    was_main: true, activities_moved: 3, opportunity_links_dropped: 0, main_contact_cleared: 0,
  };
  it("sends the contact, where it goes and whether the person has agreed to what it takes off an opportunity, and answers what was done", async () => {
    rpc.mockResolvedValue({ data: moved, error: null });
    const done = await moveContact("f1", "c1", "a2", false);
    expect(rpc).toHaveBeenCalledWith("move_contact", { p_contact_id: "c1", p_to_account_id: "a2", p_confirm: false, p_firm_id: "f1" });
    expect(done).toEqual({ from: { id: "a1", name: "Harborview Dental" }, to: { id: "a2", name: "Harborview East" }, wasMain: true, activitiesMoved: 3, opportunityLinksDropped: 0, mainContactCleared: 0 });
  });
  it("answers PT409 as a question to be agreed to, in the database's words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "Moving Owen Park takes 2 calls, notes and tasks off an opportunity on Harborview Dental. Move anyway?" } });
    const e = (await caught(() => moveContact("f1", "c1", "a2", false))) as InstanceType<typeof ContactError>;
    expect(e.kind).toBe("confirm");
    expect(e.message).toBe("Moving Owen Park takes 2 calls, notes and tasks off an opportunity on Harborview Dental. Move anyway?");
  });
  it("tells an account that is gone, a refusal of the level rule and an archived account apart, in the database's words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "This account is archived. Nothing can be moved onto it." } });
    expect(await caught(() => moveContact("f1", "c1", "a2", false))).toMatchObject({ kind: "archived", message: "This account is archived. Nothing can be moved onto it." });
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "You can't change Zenith two, so you can't move a contact onto it." } });
    expect(await caught(() => moveContact("f1", "c1", "a2", false))).toMatchObject({ kind: "notAllowed", message: "You can't change Zenith two, so you can't move a contact onto it." });
    rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "That contact was moved while you were working. Try again." } });
    expect(await caught(() => moveContact("f1", "c1", "a2", false))).toMatchObject({ kind: "invalid", message: "That contact was moved while you were working. Try again." });
  });
});

describe("listMoveChoices: a person who may not move the contact", () => {
  // Catches: the database's refusal (the contact or its account is not the person's to change) shown as "couldn't load", so the dialog never says why it offers nothing.
  it("gives the database's words and a notAllowed kind", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only the contact's owner, a lead of the owner's team or an owner of the firm can move this contact." } });
    expect(await caught(() => listMoveChoices("f1", "c1", ""))).toMatchObject({ kind: "notAllowed", message: "Only the contact's owner, a lead of the owner's team or an owner of the firm can move this contact." });
  });
});

describe("listMoveChoices", () => {
  it("asks for the accounts the contact may go to, narrowed by what was typed", async () => {
    rpc.mockResolvedValue({ data: [{ id: "a2", name: "Harborview East" }], error: null });
    expect(await listMoveChoices("f1", "c1", " east ")).toEqual([{ id: "a2", name: "Harborview East" }]);
    expect(rpc).toHaveBeenCalledWith("contact_move_choices", { p_firm_id: "f1", p_contact_id: "c1", p_search: "east" });
  });
  it("fails in words when the database refuses or answers another shape", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(listMoveChoices("f1", "c1", "")).rejects.toThrow("Couldn't load the accounts.");
    rpc.mockResolvedValue({ data: [{ id: 3 }], error: null });
    await expect(listMoveChoices("f1", "c1", "")).rejects.toThrow("Couldn't load the accounts.");
  });
});
