import { beforeEach, describe, expect, it, vi } from "vitest";

// What a new sender's offer asks the database (story CRM-E1.3, slice 6.4; supabase/tests/conversation_replies.sql decides who is offered).

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { addSenderAsContact, getAccountMessages } = await import("./conversationApi");

beforeEach(() => {
  rpc.mockReset();
});

describe("getAccountMessages: a new sender", () => {
  const raw = {
    id: "m2", direction: "inbound", from_address: "aisha.khan@harborview.example", from_name: "Aisha Khan", to_addresses: [], subject: "Elena is out", body_text: "Hi",
    status: "received", recorded_at: "2026-11-12T09:00:00+00:00", contact_id: "c1", new_sender: true, offer_contact: true,
  };

  // Catches: the database's offer (offer_contact) and mark (new_sender) dropped on the way to the screen, so a new sender is never offered as a contact.
  it("carries who sent the message, whether they are new and whether they are offered as a contact", async () => {
    rpc.mockResolvedValue({ data: { messages: [raw, { ...raw, id: "m1", new_sender: false, offer_contact: false, from_name: null }] }, error: null });
    const [first, second] = await getAccountMessages("f1", { accountId: "a1" });
    expect(first).toMatchObject({ id: "m2", fromName: "Aisha Khan", newSender: true, offerContact: true, contactId: "c1" });
    expect(second).toMatchObject({ id: "m1", fromName: null, newSender: false, offerContact: false });
  });

  // Catches: a message the database sent with neither flag read as offered (an offer made on every message of an older answer).
  it("reads a message with no flags as no offer", async () => {
    const { new_sender: _n, offer_contact: _o, from_name: _f, ...bare } = raw;
    rpc.mockResolvedValue({ data: { messages: [bare] }, error: null });
    const [m] = await getAccountMessages("f1", { accountId: "a1" });
    expect(m).toMatchObject({ newSender: false, offerContact: false, fromName: null });
  });
});

describe("addSenderAsContact", () => {
  // Catches: the wrong message or firm sent (another sender added), or a field dropped (the title the agent typed lost).
  it("adds through add_sender_as_contact with the message, the firm and what was typed, and returns the new contact's id", async () => {
    rpc.mockResolvedValue({ data: { record: { id: "k9", first_name: "Aisha" }, previous_main: null }, error: null });
    const added = await addSenderAsContact("f1", "m2", { firstName: "Aisha", lastName: "Khan", title: "Office Manager", phone: "503-555-0142" });
    expect(rpc).toHaveBeenCalledWith("add_sender_as_contact", {
      p_message_id: "m2", p_first_name: "Aisha", p_last_name: "Khan", p_title: "Office Manager", p_phone: "503-555-0142", p_firm_id: "f1",
    });
    expect(added).toEqual({ id: "k9" });
  });

  // Catches: the database's refusal (here a sender already added, PT409) lost behind a generic failure, so the agent cannot tell they are already a contact.
  it("says a refusal in the database's words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "This sender isn't one to add: they are already a contact, or the message isn't from someone new." } });
    await expect(addSenderAsContact("f1", "m2", { firstName: "", lastName: "Khan", title: "", phone: "" })).rejects.toThrow("This sender isn't one to add");
  });

  // Catches: an answer with no contact in it taken as success (the page would say Contact added when nothing was).
  it("treats an answer with no contact as a failure", async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await expect(addSenderAsContact("f1", "m2", { firstName: "", lastName: "Khan", title: "", phone: "" })).rejects.toThrow("Couldn't add the contact. Check your connection and try again.");
  });
});
