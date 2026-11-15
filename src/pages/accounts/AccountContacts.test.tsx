import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { AccountPage as Page } from "@/lib/accountPageApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// Adding a contact and moving one, on an account's page through a faked client (story CRM-A2.2, screen 24): what a person sees and does. The database's own rules
// (who may add, the one main contact, who may move and what goes with a contact) are tested in supabase/tests/add_contact.sql; the forms' own behaviour in
// AddContactDialog.test.tsx and MoveContactDialog.test.tsx. Here the page offers them where they can work, and asks its lists again after each.

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com" }, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { getAccountPage: vi.fn(), listAccountTab: vi.fn(), listAccountFiles: vi.fn(), updateAccount: vi.fn(), getSubmissionAccount: vi.fn() };
vi.mock("@/lib/accountPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountPageApi")), ...client }));
const contacts = { addContact: vi.fn(), getAddContactContext: vi.fn(), listMoveChoices: vi.fn(), moveContact: vi.fn() };
vi.mock("@/lib/contactApi", async () => ({ ...(await vi.importActual<object>("@/lib/contactApi")), ...contacts }));
const listAccountOwners = vi.fn();
vi.mock("@/lib/accountCreateApi", () => ({ createAccount: vi.fn(), listAccountOwners: (...a: unknown[]) => listAccountOwners(...a) }));
vi.mock("@/lib/advisorApi", () => ({ documentUrl: vi.fn(), recordActivity: vi.fn() }));

const { default: AccountPage } = await import("./AccountPage");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});

const tabOf = <R,>(rows: R[], count = rows.length) => ({ count, rows });
const account = {
  id: "a1", version: 3, name: "Harborview Dental Group", tradeName: null, website: null, webDomain: null, phone: null, street: null, city: "Portland", state: "OR", postalCode: null,
  industry: "Dental practice", employees: 45, statesOfOperation: ["OR"], currentProvider: null, source: "added_by_hand" as const, archivedAt: null as string | null,
  createdAt: "2026-10-28T10:00:00+00:00", updatedAt: "2026-11-01T10:00:00+00:00", status: "prospect" as const, owner: { id: "u1", name: "Dana Reyes" }, sourcePartner: null,
};
const elena = { id: "c1", firstName: "Elena", lastName: "Marsh", title: "Practice Manager", email: "elena@harborview.example", phone: null, mobile: null, isMain: true, doNotEmail: false };
const page = (over: Partial<Page> = {}): Page => ({
  account, canChange: true,
  tabs: { contacts: tabOf([elena]), opportunities: tabOf([]), quotes: tabOf([]), activity: tabOf([]), files: tabOf([]) },
  ...over,
});

const Where = () => {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
};
const renderPage = (path = "/accounts/a1", ws: Workspace = workspace()) => {
  const router = createMemoryRouter([{ path: "/accounts/:id", element: <><AccountPage /><Where /></> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
      <WorkspaceContext.Provider value={ws}><RouterProvider router={router} /></WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  for (const fn of [...Object.values(client), ...Object.values(contacts), listAccountOwners]) fn.mockReset();
  vi.mocked(toast.success).mockReset();
  client.getAccountPage.mockResolvedValue(page());
  client.listAccountTab.mockImplementation(async () => tabOf([elena]));
  contacts.getAddContactContext.mockResolvedValue({ account: { id: "a1", name: "Harborview Dental Group", archived: false }, mainContact: { id: "c1", name: "Elena Marsh" } });
  contacts.listMoveChoices.mockResolvedValue([{ id: "a2", name: "Harborview East" }]);
  listAccountOwners.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }]);
});

describe("Add contact on an account's page", () => {
  // Catches: no way to add a contact from where the contacts are (the Overview's Contacts panel and the Contacts tab), or one where the database will refuse
  // every write (a Nevermore support session, ADR 0024) or says nothing can be added (an archived account, D-222): no button that does nothing (D-24).
  it("offers Add contact over the contacts, on the Overview and on the Contacts tab", async () => {
    const user = userEvent.setup();
    renderPage();
    const overview = await screen.findByRole("region", { name: /^Contacts/ });
    expect(within(overview).getByRole("button", { name: "Add contact" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^Contacts/ }));
    await screen.findByRole("table", { name: "The account's contacts" });
    expect(screen.getAllByRole("button", { name: "Add contact" }).length).toBeGreaterThan(0);
  });

  it("offers none to Nevermore support or on an archived account", async () => {
    renderPage("/accounts/a1", workspace({ isSupport: true }));
    await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" });
    expect(screen.queryByRole("button", { name: "Add contact" })).toBeNull();
  });

  it("offers none on an archived account", async () => {
    client.getAccountPage.mockResolvedValue(page({ account: { ...account, archivedAt: "2026-11-01T00:00:00+00:00" } }));
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" });
    expect(screen.queryByRole("button", { name: "Add contact" })).toBeNull();
  });

  // Catches: the form opening for another account, a save that leaves the lists showing the old contacts (the story: the new contact is on the account), or a
  // missing word that the new main contact replaced the old.
  it("opens the form on this account, and after a save asks the page and its lists again", async () => {
    const user = userEvent.setup();
    contacts.addContact.mockResolvedValue({ contact: { id: "c9", firstName: "Owen", lastName: "Park", isMain: true }, previousMain: { id: "c1", name: "Elena Marsh" } });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add contact" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a contact" });
    expect(await within(dialog).findByText("On Harborview Dental Group")).toBeInTheDocument();
    const pageReads = client.getAccountPage.mock.calls.length;
    await user.type(await within(dialog).findByLabelText("Last name"), "Park");
    await user.type(within(dialog).getByLabelText("Email"), "owen@harborview.example");
    await user.click(within(dialog).getByLabelText("Main contact for this account"));
    expect(within(dialog).getByText("Elena Marsh is the main contact now. Saving makes this contact the main contact instead.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Save contact" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(contacts.addContact).toHaveBeenCalledWith("f1", "a1", expect.objectContaining({ lastName: "Park", isMain: true }));
    await waitFor(() => expect(client.getAccountPage.mock.calls.length).toBeGreaterThan(pageReads));
    expect(toast.success).toHaveBeenCalledWith("Contact added. Owen Park is now the main contact, and Elena Marsh isn't any more.");
  });

  // Catches: "Save and add a contact" on New account (CRM-A1.2) landing on an account page with nothing open, or leaving the flag in the address so a refresh
  // opens the form again.
  it("opens the form as the page arrives when the address says so (Save and add a contact), once", async () => {
    renderPage("/accounts/a1?addContact=1");
    expect(await screen.findByRole("dialog", { name: "Add a contact" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/accounts/a1"));
    expect(screen.getByTestId("where").textContent).not.toContain("addContact");
  });

  it("does not open it for Nevermore support, who cannot add", async () => {
    renderPage("/accounts/a1?addContact=1", workspace({ isSupport: true }));
    await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Move a contact from an account's page", () => {
  const openContacts = async () => {
    const user = userEvent.setup();
    renderPage("/accounts/a1?tab=contacts");
    await screen.findByRole("table", { name: "The account's contacts" });
    return user;
  };

  // Catches: Move offered to someone who may not change the account (the database refuses it), or missing for someone who may.
  it("offers Move on each contact to a person who may change the account", async () => {
    await openContacts();
    expect(await screen.findByRole("button", { name: "Move Elena Marsh to another account" })).toBeInTheDocument();
  });

  it("offers no Move where the account cannot be changed", async () => {
    client.getAccountPage.mockResolvedValue(page({ canChange: false }));
    renderPage("/accounts/a1?tab=contacts");
    await screen.findByRole("table", { name: "The account's contacts" });
    expect(screen.queryByRole("button", { name: /^Move / })).toBeNull();
  });

  // Catches: the move not asking the page again (the contact, and what went with it, still on the account), or the person not told where it went.
  it("moves the contact, says where it went, and asks the page's lists again", async () => {
    const user = await openContacts();
    contacts.moveContact.mockResolvedValue({ from: { id: "a1", name: "Harborview Dental Group" }, to: { id: "a2", name: "Harborview East" }, wasMain: true, activitiesMoved: 2, opportunityLinksDropped: 0, mainContactCleared: 0 });
    await user.click(await screen.findByRole("button", { name: "Move Elena Marsh to another account" }));
    const dialog = await screen.findByRole("dialog", { name: "Move Elena Marsh" });
    const reads = client.getAccountPage.mock.calls.length;
    await user.click(await within(dialog).findByRole("radio", { name: "Harborview East" }));
    await user.click(within(dialog).getByRole("button", { name: "Move contact" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(contacts.moveContact).toHaveBeenCalledWith("f1", "c1", "a2", false);
    await waitFor(() => expect(client.getAccountPage.mock.calls.length).toBeGreaterThan(reads));
    expect(toast.success).toHaveBeenCalledWith("Elena Marsh moved to Harborview East, with 2 calls, notes and tasks. Harborview Dental Group has no main contact now.");
  });
});

describe("An account with no contacts", () => {
  const empty = () => page({ tabs: { contacts: tabOf([]), opportunities: tabOf([]), quotes: tabOf([]), activity: tabOf([]), files: tabOf([]) } });

  // Catches: "No contacts yet." left with nothing to do about it (CRM-A2.1's "No contacts yet. Add a contact" has no action until this story), or an action shown
  // where the database will refuse (support, an archived account).
  it("offers Add a contact in the empty line, on the Overview and on the Contacts tab, and it opens the form", async () => {
    const user = userEvent.setup();
    client.getAccountPage.mockResolvedValue(empty());
    client.listAccountTab.mockImplementation(async () => tabOf([]));
    renderPage();
    const overview = await screen.findByRole("region", { name: /^Contacts/ });
    expect(within(overview).getByText("No contacts yet.")).toBeInTheDocument();
    await user.click(within(overview).getByRole("button", { name: "Add a contact" }));
    expect(await screen.findByRole("dialog", { name: "Add a contact" })).toBeInTheDocument();
  });

  it("offers it on the Contacts tab too", async () => {
    const user = userEvent.setup();
    client.getAccountPage.mockResolvedValue(empty());
    client.listAccountTab.mockImplementation(async () => tabOf([]));
    renderPage("/accounts/a1?tab=contacts");
    await user.click(await screen.findByRole("button", { name: "Add a contact" }));
    expect(await screen.findByRole("dialog", { name: "Add a contact" })).toBeInTheDocument();
  });

  it("says only 'No contacts yet.' in a support session and on an archived account", async () => {
    client.getAccountPage.mockResolvedValue(empty());
    renderPage("/accounts/a1", workspace({ isSupport: true }));
    expect(await screen.findByText("No contacts yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a contact" })).toBeNull();
  });

  it("says only 'No contacts yet.' on an archived account", async () => {
    client.getAccountPage.mockResolvedValue({ ...empty(), account: { ...account, archivedAt: "2026-11-01T00:00:00+00:00" } });
    renderPage();
    expect(await screen.findByText("No contacts yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a contact" })).toBeNull();
  });
});
