import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toast.success(...a), error: (...a: unknown[]) => toast.error(...a) } }));
const listAccountOwners = vi.fn();
vi.mock("@/lib/accountCreateApi", () => ({ createAccount: vi.fn(), listAccountOwners: (...a: unknown[]) => listAccountOwners(...a) }));
const addContact = vi.fn();
const getAddContactContext = vi.fn();
vi.mock("@/lib/contactApi", async () => {
  const real = await vi.importActual<typeof import("@/lib/contactApi")>("@/lib/contactApi");
  return { ...real, addContact: (...a: unknown[]) => addContact(...a), getAddContactContext: (...a: unknown[]) => getAddContactContext(...a) };
});

const { AddContactDialog } = await import("./AddContactDialog");
const { ContactError } = await import("@/lib/contactApi");

const context = (over: Record<string, unknown> = {}) => ({ account: { id: "a1", name: "Harborview Dental Group", archived: false }, mainContact: null, ...over });

const onClose = vi.fn();
const onAdded = vi.fn();

const open = async () => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AddContactDialog firmId="f1" accountId="a1" onClose={onClose} onAdded={onAdded} />
    </QueryClientProvider>,
  );
  const dialog = await screen.findByRole("dialog", { name: "Add a contact" });
  await within(dialog).findByLabelText("First name");
  return { user, dialog };
};
const field = (dialog: HTMLElement, label: string | RegExp) => within(dialog).getByLabelText(label);

beforeEach(() => {
  for (const m of [addContact, getAddContactContext, listAccountOwners, onClose, onAdded, toast.success, toast.error]) m.mockReset();
  getAddContactContext.mockResolvedValue(context());
  listAccountOwners.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
  addContact.mockResolvedValue({ contact: { id: "c1", firstName: "Owen", lastName: "Park", isMain: false }, previousMain: null });
});

describe("the Add a contact form (screen 24)", () => {
  // Catches: a form missing a field of the story, the account not filled in (the story: "with the account filled in"), or the owner not the person by default.
  it("opens with the story's fields, the account filled in and the person as the owner", async () => {
    const { dialog } = await open();
    expect(within(dialog).getByText("On Harborview Dental Group")).toBeInTheDocument();
    for (const label of ["First name", "Last name", "Title", "Email", "Phone", "Mobile", "Owner", "Main contact for this account", "Do not email"]) {
      expect(field(dialog, label)).toBeInTheDocument();
    }
    expect(field(dialog, "Account")).toHaveValue("Harborview Dental Group");
    expect(field(dialog, "Account")).toBeDisabled();
    expect(within(dialog).getByText("Required")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Email or phone required")).toHaveLength(2);
    await waitFor(() => expect(field(dialog, "Owner")).toHaveValue("u1"));
    for (const name of ["Cancel", "Save and add another", "Save contact"]) expect(within(dialog).getByRole("button", { name })).toBeInTheDocument();
    expect(field(dialog, "Main contact for this account")).not.toBeChecked();
  });

  // Catches: a contact saved with no last name, or with neither an email nor a phone (the story), or a request sent for a form that is not right.
  it("will not save without a last name, or without an email or a phone, and says why in words", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    expect(await within(dialog).findByText("Enter the contact's last name.")).toBeInTheDocument();
    await user.type(field(dialog, "Last name"), "Park");
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    expect(await within(dialog).findByText("Enter an email or a phone number.")).toBeInTheDocument();
    expect(addContact).not.toHaveBeenCalled();
    await user.type(field(dialog, "Mobile"), "call me");
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    expect(await within(dialog).findByText("Enter a phone number like (503) 555-0142. An extension can follow, like x12.")).toBeInTheDocument();
    expect(addContact).not.toHaveBeenCalled();
  });

  // Catches: what is typed not sent (or sent untrimmed), the owner or a tick dropped, the form left open after a save, or the page not told.
  it("saves what was typed on the account, with the owner and the ticks, then closes and tells the page", async () => {
    const { user, dialog } = await open();
    await user.type(field(dialog, "First name"), "  Owen ");
    await user.type(field(dialog, "Last name"), "Park");
    await user.type(field(dialog, "Title"), "Owner");
    await user.type(field(dialog, "Email"), "owen@harborviewdental.example");
    await user.type(field(dialog, "Phone"), "(503) 555-0140");
    await waitFor(() => expect(field(dialog, "Owner")).toHaveValue("u1"));
    await user.selectOptions(field(dialog, "Owner"), "u2");
    await user.click(field(dialog, "Main contact for this account"));
    await user.click(field(dialog, "Do not email"));
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(addContact).toHaveBeenCalledWith("f1", "a1", {
      firstName: "Owen", lastName: "Park", title: "Owner", email: "owen@harborviewdental.example", phone: "(503) 555-0140", mobile: "", ownerId: "u2", isMain: true, doNotEmail: true,
    });
    expect(toast.success).toHaveBeenCalledWith("Contact added");
    expect(onAdded).toHaveBeenCalledTimes(1);
  });

  // Catches: the story's "ticking it on one unticks the other, and says so" not said: neither before saving nor after.
  it("says before and after saving that the new main contact takes over from the old one", async () => {
    getAddContactContext.mockResolvedValue(context({ mainContact: { id: "c0", name: "Ada Main" } }));
    addContact.mockResolvedValue({ contact: { id: "c1", firstName: "Owen", lastName: "Park", isMain: true }, previousMain: { id: "c0", name: "Ada Main" } });
    const { user, dialog } = await open();
    expect(within(dialog).queryByText(/is the main contact now/)).not.toBeInTheDocument();
    await user.click(field(dialog, "Main contact for this account"));
    expect(within(dialog).getByText("Ada Main is the main contact now. Saving makes this contact the main contact instead.")).toBeInTheDocument();
    await user.type(field(dialog, "Last name"), "Park");
    await user.type(field(dialog, "Email"), "owen@harborviewdental.example");
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Contact added. Owen Park is now the main contact, and Ada Main isn't any more.");
  });

  // Catches: the form that stays open for "Save and add another" going on naming the main contact it had when it opened, so the next one is said to take over from
  // someone who is not the main contact any more (found in the browser: the first one saved as main was not named).
  it("asks who is the main contact again after saving one, so the next to be ticked names them", async () => {
    addContact.mockResolvedValue({ contact: { id: "c1", firstName: "Owen", lastName: "Park", isMain: true }, previousMain: null });
    const { user, dialog } = await open();
    await user.click(field(dialog, "Main contact for this account"));
    await user.type(field(dialog, "Last name"), "Park");
    await user.type(field(dialog, "Email"), "owen@harborviewdental.example");
    getAddContactContext.mockResolvedValue(context({ mainContact: { id: "c1", name: "Owen Park" } }));
    await user.click(within(dialog).getByRole("button", { name: "Save and add another" }));
    await waitFor(() => expect(getAddContactContext).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(field(dialog, "Last name")).toHaveValue(""));
    await user.click(field(dialog, "Main contact for this account"));
    expect(await within(dialog).findByText("Owen Park is the main contact now. Saving makes this contact the main contact instead.")).toBeInTheDocument();
  });

  // Catches: no say when the account has no main contact to displace (a false claim), or the note shown without the tick.
  it("says nothing of a main contact being replaced when there is none", async () => {
    const { user, dialog } = await open();
    await user.click(field(dialog, "Main contact for this account"));
    expect(within(dialog).queryByText(/is the main contact now/)).not.toBeInTheDocument();
  });

  // Catches: "Save and add another" closing the form, keeping what was typed for the last person, or losing the owner.
  it("saves and starts another with the form emptied, the owner kept and focus on the first name", async () => {
    const { user, dialog } = await open();
    await waitFor(() => expect(field(dialog, "Owner")).toHaveValue("u1"));
    await user.selectOptions(field(dialog, "Owner"), "u2");
    await user.type(field(dialog, "First name"), "Owen");
    await user.type(field(dialog, "Last name"), "Park");
    await user.type(field(dialog, "Email"), "owen@harborviewdental.example");
    await user.click(within(dialog).getByRole("button", { name: "Save and add another" }));
    await waitFor(() => expect(addContact).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(field(dialog, "Last name")).toHaveValue(""));
    expect(onClose).not.toHaveBeenCalled();
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(field(dialog, "First name")).toHaveValue("");
    expect(field(dialog, "Email")).toHaveValue("");
    expect(field(dialog, "Owner")).toHaveValue("u2");
    expect(field(dialog, "Main contact for this account")).not.toBeChecked();
    await waitFor(() => expect(field(dialog, "First name")).toHaveFocus());
    expect(toast.success).toHaveBeenCalledWith("Contact added");
    // The next one is saved as itself, and closes the form.
    await user.type(field(dialog, "Last name"), "Hale");
    await user.type(field(dialog, "Phone"), "(503) 555-0141");
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(addContact).toHaveBeenCalledTimes(2);
  });

  // Catches: a refusal of the database shown nowhere (the form closing or doing nothing), or an owner the person may not choose not shown beside Owner.
  it("shows the database's refusal in words and keeps what was typed", async () => {
    addContact.mockRejectedValueOnce(new ContactError("notAllowed", "You can add a contact only for yourself and, as a lead, for people on your teams.", "42501"));
    const { user, dialog } = await open();
    await user.type(field(dialog, "Last name"), "Park");
    await user.type(field(dialog, "Email"), "owen@harborviewdental.example");
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    expect(await within(dialog).findByText("You can add a contact only for yourself and, as a lead, for people on your teams.")).toBeInTheDocument();
    expect(field(dialog, "Last name")).toHaveValue("Park");
    expect(onClose).not.toHaveBeenCalled();
    addContact.mockRejectedValueOnce(new ContactError("archived", "This account is archived. Nothing can be added to it.", "55000"));
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    expect(await within(dialog).findByText("This account is archived. Nothing can be added to it.")).toBeInTheDocument();
  });

  // Catches: a form over an account that cannot be read (it would save to nothing), or one that does not say it cannot take a contact.
  it("does not show the form when the account can't be read, or says an archived account takes none", async () => {
    getAddContactContext.mockRejectedValueOnce(new ContactError("failed", "Couldn't load the account."));
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(<QueryClientProvider client={client}><AddContactDialog firmId="f1" accountId="a1" onClose={onClose} onAdded={onAdded} /></QueryClientProvider>);
    const dialog = await screen.findByRole("dialog", { name: "Add a contact" });
    expect(await within(dialog).findByText("Couldn't load the account.")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Last name")).not.toBeInTheDocument();
    getAddContactContext.mockResolvedValueOnce(context());
    await user.click(within(dialog).getByRole("button", { name: "Try again" }));
    expect(await within(dialog).findByLabelText("Last name")).toBeInTheDocument();
    unmount();
    getAddContactContext.mockResolvedValue(context({ account: { id: "a1", name: "Harborview Dental Group", archived: true } }));
    render(<QueryClientProvider client={new QueryClient()}><AddContactDialog firmId="f1" accountId="a1" onClose={onClose} onAdded={onAdded} /></QueryClientProvider>);
    expect(await screen.findByText("This account is archived. Nothing can be added to it.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Last name")).not.toBeInTheDocument();
  });

  // Catches: Cancel losing what was typed without asking, or not closing a form nobody touched.
  it("closes at once when nothing was typed", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("the Add a contact form: leaving it", () => {
  // Catches: the dialog's own close button throwing away what was typed without asking (only Cancel asked).
  it("asks before the close button throws away what was typed, and closes at once when nothing was", async () => {
    const { user, dialog } = await open();
    await user.type(field(dialog, "Last name"), "Park");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(onClose).not.toHaveBeenCalled();
    const ask = await screen.findByRole("alertdialog");
    await user.click(within(ask).getByRole("button", { name: /Discard/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

describe("the Add a contact form: what the second save and the refusals do", () => {
  // Catches: the next blank form still holding the main contact from before the save (the refresh is asked for but not waited for), so ticking Main at once says
  // nothing about the takeover or names the wrong person.
  it("knows at once, from the saved contact, who is the main contact for the next one", async () => {
    addContact.mockResolvedValue({ contact: { id: "c1", firstName: "Owen", lastName: "Park", isMain: true }, previousMain: null });
    const { user, dialog } = await open();
    await user.click(field(dialog, "Main contact for this account"));
    await user.type(field(dialog, "Last name"), "Park");
    await user.type(field(dialog, "First name"), "Owen");
    await user.type(field(dialog, "Email"), "owen@harborviewdental.example");
    getAddContactContext.mockReturnValue(new Promise(() => {})); // the refresh never answers in time
    await user.click(within(dialog).getByRole("button", { name: "Save and add another" }));
    await waitFor(() => expect(field(dialog, "Last name")).toHaveValue(""));
    await user.click(field(dialog, "Main contact for this account"));
    expect(within(dialog).getByText("Owen Park is the main contact now. Saving makes this contact the main contact instead.")).toBeInTheDocument();
  });

  // Catches: a save that was not a main contact changing who the next form names.
  it("keeps naming the old main contact when the saved contact was not main", async () => {
    getAddContactContext.mockResolvedValue(context({ mainContact: { id: "c0", name: "Ada Main" } }));
    const { user, dialog } = await open();
    await user.type(field(dialog, "Last name"), "Park");
    await user.type(field(dialog, "Email"), "owen@harborviewdental.example");
    getAddContactContext.mockReturnValue(new Promise(() => {}));
    await user.click(within(dialog).getByRole("button", { name: "Save and add another" }));
    await waitFor(() => expect(field(dialog, "Last name")).toHaveValue(""));
    await user.click(field(dialog, "Main contact for this account"));
    expect(within(dialog).getByText("Ada Main is the main contact now. Saving makes this contact the main contact instead.")).toBeInTheDocument();
  });

  // Catches: "Save and add another" pressed on a form that fails its checks leaving the second action armed, so Enter after the correction saves and starts another
  // when the person meant Save.
  it("does not keep 'Save and add another' armed after a failed check: Enter then saves and closes", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("button", { name: "Save and add another" }));
    expect(await within(dialog).findByText("Enter the contact's last name.")).toBeInTheDocument();
    expect(addContact).not.toHaveBeenCalled();
    await user.type(field(dialog, "Last name"), "Park");
    await user.type(field(dialog, "Email"), "owen@harborviewdental.example{enter}");
    await waitFor(() => expect(addContact).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  // Catches: every 42501 shown under Owner, so a refusal to replace the main contact points at the wrong field.
  it("shows the refusal to replace the main contact at the form, and an owner refusal under Owner", async () => {
    addContact.mockRejectedValueOnce(new ContactError("notAllowed", "Only someone who may change Ada Main can make another contact the main one.", "42501"));
    const { user, dialog } = await open();
    await user.type(field(dialog, "Last name"), "Park");
    await user.type(field(dialog, "Email"), "owen@harborviewdental.example");
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    const words = await within(dialog).findByText("Only someone who may change Ada Main can make another contact the main one.");
    expect(field(dialog, "Owner")).toHaveAttribute("aria-invalid", "false");
    expect(field(dialog, "Owner").closest("div")?.contains(words)).toBe(false);
    addContact.mockRejectedValueOnce(new ContactError("notAllowed", "You can add a contact only for yourself and, as a lead, for people on your teams.", "42501"));
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    await waitFor(() => expect(field(dialog, "Owner")).toHaveAttribute("aria-invalid", "true"));
  });
});
