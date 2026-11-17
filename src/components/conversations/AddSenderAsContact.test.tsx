import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactError } from "@/lib/contactApi";

// A new sender's message offered as a contact on the account (story CRM-E1.3, slice 6.4: "a sender not seen before is marked new and offered as a contact on
// that account"; add_sender_as_contact, supabase/tests/conversation_replies.sql). The database decides who is offered and every rule of the contact it makes;
// here a faked client answers and the offer draws it.

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const addSenderAsContact = vi.fn();
vi.mock("@/lib/conversationApi", async () => ({ ...(await vi.importActual<object>("@/lib/conversationApi")), addSenderAsContact: (...a: unknown[]) => addSenderAsContact(...a) }));

const { AddSenderAsContact } = await import("./AddSenderAsContact");

const sender = { id: "m1", from: "aisha.khan@harborview.example", fromName: "Aisha Khan" };

const renderOffer = (message: { id: string; from: string; fromName: string | null } = sender, onAdded = vi.fn()) => {
  render(<AddSenderAsContact firmId="f1" message={message} onAdded={onAdded} />);
  return onAdded;
};

beforeEach(() => {
  addSenderAsContact.mockReset();
  addSenderAsContact.mockResolvedValue({ id: "k9" });
});

describe("AddSenderAsContact", () => {
  // Catches: a sender the database marked new reading like any other message, so nobody is told they could add them.
  it("says the sender is new and offers to add them as a contact", () => {
    renderOffer();
    expect(screen.getByText("New sender")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add as a contact" })).toBeInTheDocument();
  });

  // Catches: a form that starts empty (the agent retypes what the message already says), or one that lets the address be changed (the database adds the
  // message's own From address, so an editable field would show a value it ignores).
  it("opens with the name taken from the message and the address shown but not editable", async () => {
    const user = userEvent.setup();
    renderOffer();
    await user.click(screen.getByRole("button", { name: "Add as a contact" }));
    const dialog = await screen.findByRole("dialog", { name: "Add Aisha Khan as a contact" });
    expect(within(dialog).getByLabelText("First name")).toHaveValue("Aisha");
    expect(within(dialog).getByLabelText("Last name")).toHaveValue("Khan");
    expect(within(dialog).getByText("aisha.khan@harborview.example")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Email")).toBeNull();
  });

  // Catches: the fields typed in the form not reaching the database (a title or phone dropped), or the message's id lost so another sender is added.
  it("adds the contact with what was typed and tells the page", async () => {
    const user = userEvent.setup();
    const onAdded = renderOffer();
    await user.click(screen.getByRole("button", { name: "Add as a contact" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Title"), "Office Manager");
    await user.type(within(dialog).getByLabelText("Phone"), "503-555-0142");
    await user.click(within(dialog).getByRole("button", { name: "Add contact" }));
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(addSenderAsContact).toHaveBeenCalledWith("f1", "m1", { firstName: "Aisha", lastName: "Khan", title: "Office Manager", phone: "503-555-0142" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Catches: a refusal (a last name the database wants, an account archived since) swallowed or shown as a generic failure, and the dialog closing with nothing added.
  it("shows the database's own words when it refuses, and stays open", async () => {
    const user = userEvent.setup();
    const onAdded = renderOffer({ ...sender, fromName: null });
    addSenderAsContact.mockRejectedValue(new ContactError("invalid", "Enter the contact's last name.", "22023"));
    await user.click(screen.getByRole("button", { name: "Add as a contact" }));
    const dialog = await screen.findByRole("dialog", { name: "Add aisha.khan@harborview.example as a contact" });
    await user.click(within(dialog).getByRole("button", { name: "Add contact" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Enter the contact's last name.");
    expect(onAdded).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // Catches: a network failure shown as a refusal with a raw message, so the person is told nothing they can act on.
  it("says to check the connection when the call itself fails", async () => {
    const user = userEvent.setup();
    renderOffer();
    addSenderAsContact.mockRejectedValue(new Error("fetch failed"));
    await user.click(screen.getByRole("button", { name: "Add as a contact" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Add contact" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't add the contact. Check your connection and try again.");
  });
});
