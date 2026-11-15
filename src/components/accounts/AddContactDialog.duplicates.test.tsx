import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/accountCreateApi", () => ({ createAccount: vi.fn(), listAccountOwners: () => Promise.resolve([{ value: "u1", label: "Dana Reyes" }]) }));
const addContact = vi.fn();
vi.mock("@/lib/contactApi", async () => {
  const real = await vi.importActual<typeof import("@/lib/contactApi")>("@/lib/contactApi");
  return { ...real, addContact: (...a: unknown[]) => addContact(...a), getAddContactContext: () => Promise.resolve({ account: { id: "a1", name: "Harborview Dental Group", archived: false }, mainContact: null }) };
});
const checkContactDuplicates = vi.fn();
vi.mock("@/lib/duplicateApi", () => ({ checkContactDuplicates: (...a: unknown[]) => checkContactDuplicates(...a), checkAccountDuplicates: vi.fn() }));

const { AddContactDialog } = await import("./AddContactDialog");

const seen = { visible: true, kind: "contact", id: "c1", name: "Pat Harbor", archived: false, reasons: ["email"], account: { id: "a2", name: "Harbor Dental LLC" }, owner: { id: "u2", name: "Marcus Hale" } };
const mask = { visible: false, kind: "contact", ask: { kind: "owner", names: ["Ines Park"] } };

const onAdded = vi.fn();
const open = async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <AddContactDialog firmId="f1" accountId="a1" onClose={() => {}} onAdded={onAdded} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  const dialog = await screen.findByRole("dialog", { name: "Add a contact" });
  await within(dialog).findByLabelText("Last name");
  return { user, dialog };
};

beforeEach(() => {
  checkContactDuplicates.mockReset();
  addContact.mockReset().mockResolvedValue({ contact: { id: "c9", firstName: null, lastName: "Harbor", isMain: false }, previousMain: null });
  onAdded.mockReset();
});

describe("Add a contact: the duplicate warning (CRM-S4.2)", () => {
  // Catches: the warning not naming the contact, its account or its owner, or the links not opening them in a new tab.
  it("names a contact with the same email, its account and owner, with links that open them in a new tab", async () => {
    checkContactDuplicates.mockResolvedValue({ matches: [seen], more: 0 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Email"), "pat@harbor.example");
    const note = await screen.findByRole("status", { name: "Possible duplicate" });
    const contact = within(note).getByRole("link", { name: "Pat Harbor" });
    expect(contact).toHaveAttribute("href", "/contacts/c1");
    expect(contact).toHaveAttribute("target", "_blank");
    expect(within(note).getByRole("link", { name: "Harbor Dental LLC" })).toHaveAttribute("href", "/accounts/a2");
    expect(note).toHaveTextContent("same email");
    expect(note).toHaveTextContent("Owner: Marcus Hale");
    expect(checkContactDuplicates).toHaveBeenLastCalledWith("f1", "pat@harbor.example");
  });

  // Catches: asking about half an address on every keystroke.
  it("asks only for something that looks like an email address, once the person stops typing", async () => {
    checkContactDuplicates.mockResolvedValue({ matches: [], more: 0 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Email"), "pat@harbor");
    await new Promise((r) => setTimeout(r, 700));
    expect(checkContactDuplicates).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText("Email"), ".example");
    await waitFor(() => expect(checkContactDuplicates).toHaveBeenCalledTimes(1));
  });

  // Catches: a masked contact naming the person, its account or a link.
  it("says only that one exists and who to ask for a contact on an account the person may not see", async () => {
    checkContactDuplicates.mockResolvedValue({ matches: [mask], more: 0 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Email"), "pat@harbor.example");
    const note = await screen.findByRole("status", { name: "Possible duplicate" });
    expect(note).toHaveTextContent("A contact with this email exists on an account you can't see. Ask Ines Park.");
    expect(within(note).queryByRole("link")).not.toBeInTheDocument();
  });

  // Catches: the warning blocking the save, or offering a merge (CRM-S4.3, a later story).
  it("still saves with the warning showing, and offers no merge", async () => {
    checkContactDuplicates.mockResolvedValue({ matches: [seen, mask], more: 0 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Last name"), "Harbor");
    await user.type(within(dialog).getByLabelText("Email"), "pat@harbor.example");
    const note = await screen.findByRole("status", { name: "Possible duplicate" });
    expect(within(note).queryByText(/merge/i)).not.toBeInTheDocument();
    expect(note).toHaveTextContent("You can still save.");
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    await waitFor(() => expect(addContact).toHaveBeenCalledTimes(1));
    expect(addContact.mock.calls[0][2]).toMatchObject({ lastName: "Harbor", email: "pat@harbor.example" });
  });

  // Catches: a failed check shown as a warning or a failure, or a warning left after the email is cleared.
  it("shows nothing when the check fails or the email is cleared, and never stops the save", async () => {
    checkContactDuplicates.mockResolvedValueOnce({ matches: [seen], more: 0 });
    const { user, dialog } = await open();
    const email = within(dialog).getByLabelText("Email");
    await user.type(email, "pat@harbor.example");
    await screen.findByRole("status", { name: "Possible duplicate" });
    await user.clear(email);
    await waitFor(() => expect(screen.queryByRole("status", { name: "Possible duplicate" })).not.toBeInTheDocument());
    checkContactDuplicates.mockRejectedValue(new Error("Couldn't check for a duplicate."));
    await user.type(email, "other@harbor.example");
    await waitFor(() => expect(checkContactDuplicates).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("status", { name: "Possible duplicate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Last name"), "Harbor");
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    await waitFor(() => expect(addContact).toHaveBeenCalledTimes(1));
  });
});
