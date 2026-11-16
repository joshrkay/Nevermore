import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { ContactConflict, ContactPage as Page } from "@/lib/contactPageApi";
import type { ActivityItem } from "@/lib/activityApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// A contact's page through a faked client (story CRM-C1.1, screen 18): what a person sees and does. The database's own rules (who may see a contact, who may change
// it, the main contact, the version) are tested in supabase/tests/contact_page.sql; here the client answers and the page draws it.

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com" }, signOut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { getContactPage: vi.fn(), listContactActivity: vi.fn(), updateContact: vi.fn() };
vi.mock("@/lib/contactPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/contactPageApi")), ...client }));
const activity = { logActivity: vi.fn(), updateActivity: vi.fn(), addToNote: vi.fn(), setTaskDone: vi.fn(), getActivityOptions: vi.fn() };
vi.mock("@/lib/activityApi", async () => ({ ...(await vi.importActual<object>("@/lib/activityApi")), ...activity }));
const contacts = { addContact: vi.fn(), getAddContactContext: vi.fn(), listMoveChoices: vi.fn(), moveContact: vi.fn() };
vi.mock("@/lib/contactApi", async () => ({ ...(await vi.importActual<object>("@/lib/contactApi")), ...contacts }));
const listFirmMembers = vi.fn();
vi.mock("@/lib/accountsApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountsApi")), listFirmMembers: (...a: unknown[]) => listFirmMembers(...a) }));
const listAccountOwners = vi.fn();
vi.mock("@/lib/accountCreateApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountCreateApi")), listAccountOwners: (...a: unknown[]) => listAccountOwners(...a) }));

const search = { noteRecentRecord: vi.fn() };
vi.mock("@/lib/searchApi", async () => ({ ...(await vi.importActual<object>("@/lib/searchApi")), ...search }));

const { default: ContactPage } = await import("./ContactPage");
const { ContactError } = await import("@/lib/contactApi");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});

const contact = {
  id: "c1", version: 3, accountId: "a1", firstName: "Elena", lastName: "Marsh", title: "Practice Manager", email: "elena@harborview.example", phone: "(503) 555-0142",
  mobile: null as string | null, isMain: true, doNotEmail: false, owner: { id: "u1", name: "Dana Reyes" } as { id: string; name: string } | null,
  createdAt: "2026-09-03T10:00:00+00:00", updatedAt: "2026-11-01T10:00:00+00:00",
  account: { id: "a1", name: "Harborview Dental Group", archived: false },
};
const opportunity = (n: number, over: object = {}) => ({ id: `o${n}`, name: `Search ${n}`, stage: "in_market" as const, targetStart: "2027-01-01", submissionId: `i${n}`, ...over });
const page = (over: Partial<Page> = {}, c: Partial<typeof contact> = {}): Page => ({
  contact: { ...contact, ...c }, canChange: true, canMove: true, canAdd: true, opportunities: { count: 2, rows: [opportunity(1), opportunity(2, { name: "A search with no intake", submissionId: null, stage: "lost", targetStart: null })] },
  ...over,
});

const item = (over: Partial<ActivityItem> = {}): ActivityItem => ({
  type: "call", id: "x1", entryKey: "x1", at: "2026-11-13T18:30:00+00:00", who: "Dana Reyes", authorId: "u1", contact: { id: "c1", name: "Elena Marsh" }, opportunity: null, outcome: null, title: null,
  body: null, additions: [], assignee: null, dueOn: null, doneAt: null, doneBy: null, canEdit: true, editableUntil: null, ...over, ...(over.id ? { entryKey: over.id } : {}),
});
const call = item({ id: "call1", outcome: "spoke", body: "Renewal came in 14% up" });
const note = item({ type: "note", id: "note1", body: "Elena runs the day to day", editableUntil: "2026-11-14T18:30:00+00:00" });
const task = item({ type: "task", id: "task1", title: "Check Elena sent the loss run", dueOn: "2020-01-01", assignee: { id: "u1", name: "Dana Reyes" } });

const pageOf = <R,>(all: R[], o: { offset?: number; limit?: number } = {}) => ({ count: all.length, rows: all.slice(o.offset ?? 0, (o.offset ?? 0) + (o.limit ?? 50)) });
const serveActivity = (all: ActivityItem[]) => client.listContactActivity.mockImplementation(async (_f: string, _c: string, o?: { offset?: number; limit?: number }) => pageOf(all, o));

const Where = () => {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
};
let queryClient: QueryClient;
const renderPage = (path = "/contacts/c1", ws: Workspace = workspace()) => {
  queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  const router = createMemoryRouter([{ path: "/contacts/:id", element: <><ContactPage /><Where /></> }, { path: "*", element: <Where /> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceContext.Provider value={ws}><RouterProvider router={router} /></WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return router;
};
/** The query keys asked again so far (the first three parts name what: "account", firm, id). */
const invalidated = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((c) => ((c[0] as { queryKey: readonly unknown[] }).queryKey).slice(0, 3).join("/"));
const panel = (name: RegExp | string) => screen.getByRole("region", { name });

beforeEach(() => {
  for (const fn of [...Object.values(client), ...Object.values(activity), ...Object.values(contacts), listFirmMembers, listAccountOwners, signOut]) fn.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  client.getContactPage.mockResolvedValue(page());
  serveActivity([call, note, task]);
  listFirmMembers.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
  listAccountOwners.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }]);
  activity.getActivityOptions.mockResolvedValue({ contacts: [{ id: "c1", name: "Elena Marsh", title: null }], opportunities: [], people: [{ id: "u1", name: "Dana Reyes" }] });
});

describe("ContactPage: the menu's recent records", () => {
  // Catches: a record that never reaches the search box's "last five opened" because no page notes it (CRM-S1.2a).
  it("notes the contact as opened once its page has loaded, once", async () => {
    search.noteRecentRecord.mockReset().mockResolvedValue(true);
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(search.noteRecentRecord).toHaveBeenCalledWith("f1", "contact", "c1"));
    expect(search.noteRecentRecord).toHaveBeenCalledTimes(1);
  });

  it("notes nothing for a page that isn't there, and shows the page whatever the note does", async () => {
    search.noteRecentRecord.mockReset().mockRejectedValue(new Error("down"));
    client.getContactPage.mockResolvedValue(null);
    renderPage();
    await screen.findByText(/isn.t available|not available|couldn.t find|can.t be found/i);
    expect(search.noteRecentRecord).not.toHaveBeenCalled();
  });

  it("is not stopped by a failing note", async () => {
    search.noteRecentRecord.mockReset().mockRejectedValue(new Error("down"));
    renderPage();
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});

describe("ContactPage: the header", () => {
  // Catches: a header that leaves out a fact the story names (name, main contact, title, account linked, email, phone), or one that shows buttons that belong to later
  // stories (Email the contact is Epic 6's, D-186: no dead buttons).
  it("shows the name, Main contact, title at the account (linked), email and phone, with Log a call and Add a task and no Email", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Elena Marsh" })).toBeInTheDocument();
    const line = screen.getByText(/Practice Manager at/).closest("p") as HTMLElement;
    expect(screen.getByText("Main contact", { selector: "span.inline-flex" })).toBeInTheDocument();
    expect(screen.getByText(/Practice Manager at/)).toBeInTheDocument();
    expect(within(screen.getByText(/Practice Manager at/).closest("p") as HTMLElement).getByRole("link", { name: "Harborview Dental Group" })).toHaveAttribute("href", "/accounts/a1");
    expect(line).toHaveTextContent("elena@harborview.example");
    expect(line).toHaveTextContent("(503) 555-0142");
    expect(screen.getByRole("button", { name: /^Log a call/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Add a task/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Email/ })).toBeNull();
    expect(screen.queryByText(/Emails with|Write to/)).toBeNull();
  });

  // Catches: the trail back leading nowhere, or the account not reachable from the contact.
  it("leads back by a trail: Accounts / the account / the contact", async () => {
    renderPage();
    const trail = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(trail).getByRole("link", { name: "Accounts" })).toHaveAttribute("href", "/accounts");
    expect(within(trail).getByRole("link", { name: "Harborview Dental Group" })).toHaveAttribute("href", "/accounts/a1");
    expect(within(trail).getByText("Elena Marsh")).toHaveAttribute("aria-current", "page");
  });

  // Catches: a contact who is not the main contact shown as one, or a contact with only a mobile shown with no way to reach them.
  it("shows no Main contact for another contact, and a mobile when there is no phone", async () => {
    client.getContactPage.mockResolvedValue(page({}, { isMain: false, phone: null, mobile: "(503) 555-0199", title: null }));
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Elena Marsh" });
    expect(screen.queryByText("Main contact", { selector: "span.inline-flex" })).toBeNull();
    const line = screen.getByText(/^At/).closest("p") as HTMLElement;
    expect(line).toHaveTextContent("At Harborview Dental Group");
    expect(line).toHaveTextContent("(503) 555-0199");
  });

  // Catches: "Do not email" kept but not shown (D-186: stored and shown, hides nothing yet).
  it("shows Do not email in the header and the details when it is on, and says No when it is off", async () => {
    client.getContactPage.mockResolvedValue(page({}, { doNotEmail: true }));
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Elena Marsh" });
    expect(screen.getByText("Do not email", { selector: "span.inline-flex" })).toBeInTheDocument();
    expect(within(panel("Details")).getByText("Do not email").nextElementSibling).toHaveTextContent("Yes");
  });
});

describe("ContactPage: the details", () => {
  // Catches: a detail missing (the screen's rows) or shown by a code (the owner by id).
  it("shows each detail, the account as a link, and Not provided for what is empty", async () => {
    client.getContactPage.mockResolvedValue(page({}, { mobile: null, title: null }));
    renderPage();
    const details = within(await screen.findByRole("region", { name: "Details" }));
    const value = (label: string) => details.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;
    expect(value("First name")).toHaveTextContent("Elena");
    expect(value("Last name")).toHaveTextContent("Marsh");
    expect(value("Title")).toHaveTextContent("Not provided");
    expect(within(value("Account")).getByRole("link", { name: "Harborview Dental Group" })).toHaveAttribute("href", "/accounts/a1");
    expect(value("Email")).toHaveTextContent("elena@harborview.example");
    expect(value("Phone")).toHaveTextContent("(503) 555-0142");
    expect(value("Mobile")).toHaveTextContent("Not provided");
    expect(value("Do not email")).toHaveTextContent("No");
    expect(value("Owner")).toHaveTextContent("Dana Reyes");
    expect(value("Added")).toHaveTextContent("Sep 3, 2026");
  });

  it("says a contact with no owner has none", async () => {
    client.getContactPage.mockResolvedValue(page({}, { owner: null }));
    renderPage();
    const details = within(await screen.findByRole("region", { name: "Details" }));
    expect(details.getByText("Owner", { selector: "dt" }).nextElementSibling).toHaveTextContent("Not provided");
  });
});

describe("ContactPage: the opportunities", () => {
  // Catches: an opportunity that opens nothing (D-187: its submission's page, or plain text with none), or one shown without its stage.
  it("lists the opportunities the contact is on, each named with its stage, opening its own page (D-430)", async () => {
    renderPage();
    const list = within(await screen.findByRole("region", { name: /Opportunities/ }));
    expect(list.getByRole("link", { name: "Search 1" })).toHaveAttribute("href", "/opportunities/o1");
    expect(list.getByRole("link", { name: "A search with no intake" })).toHaveAttribute("href", "/opportunities/o2");
    expect(list.getByText("In market")).toBeInTheDocument();
    expect(list.getAllByText(/^Main contact/)).toHaveLength(2);
  });

  // Catches: the story's empty state missing.
  it("says Not on an opportunity yet when there is none", async () => {
    client.getContactPage.mockResolvedValue(page({ opportunities: { count: 0, rows: [] } }));
    renderPage();
    const list = within(await screen.findByRole("region", { name: /Opportunities/ }));
    expect(await list.findByText("Not on an opportunity yet")).toBeInTheDocument();
  });

  it("says how many are shown when the contact is on more than the page holds", async () => {
    client.getContactPage.mockResolvedValue(page({ opportunities: { count: 120, rows: [opportunity(1)] } }));
    renderPage();
    expect(await screen.findByText("Showing 1 of 120.")).toBeInTheDocument();
  });
});

describe("ContactPage: calls, notes and tasks", () => {
  // Catches: another contact's rows, or the account's own, on this page; the account's rows drawn with other words; a row's contact not linked to its page.
  it("lists this contact's calls, notes and tasks as the account's Activity tab does", async () => {
    renderPage();
    const table = within(await screen.findByRole("table", { name: "The contact's calls, notes and tasks" }));
    const rows = table.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Spoke");
    expect(rows[0]).toHaveTextContent("Renewal came in 14% up");
    expect(rows[1]).toHaveTextContent("Elena runs the day to day");
    expect(rows[2]).toHaveTextContent("Check Elena sent the loss run");
    expect(rows[2]).toHaveTextContent("Overdue");
    expect(client.listContactActivity).toHaveBeenCalledWith("f1", "c1", { filter: "all", limit: 50, offset: 0 });
    expect(within(rows[0]).getByRole("link", { name: "Elena Marsh" })).toHaveAttribute("href", "/contacts/c1");
    expect(screen.getByRole("heading", { name: /Calls, notes and tasks/ })).toHaveTextContent("3");
  });

  // Catches: filters that do not narrow (the database narrows, so each is asked for), or a Changes filter that the contact's list does not have.
  it("narrows to Calls, Notes or Tasks by asking the database, with no Changes", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table", { name: "The contact's calls, notes and tasks" });
    expect(screen.queryByRole("button", { name: "Changes" })).toBeNull();
    serveActivity([call]);
    await user.click(screen.getByRole("button", { name: "Calls" }));
    await waitFor(() => expect(client.listContactActivity).toHaveBeenCalledWith("f1", "c1", { filter: "calls", limit: 50, offset: 0 }));
    expect(screen.getByRole("button", { name: "Calls" })).toHaveAttribute("aria-pressed", "true");
    serveActivity([]);
    await user.click(screen.getByRole("button", { name: "Notes" }));
    expect(await screen.findByText("No notes yet.")).toBeInTheDocument();
  });

  it("says there are none yet", async () => {
    serveActivity([]);
    renderPage();
    expect(await screen.findByText("No calls, notes or tasks yet.")).toBeInTheDocument();
  });

  // Catches: Show more asking from row 0 again, or past a hundred rows (the database refuses a page over 100).
  it("loads the next fifty with Show more, from the rows already loaded", async () => {
    const user = userEvent.setup();
    serveActivity(Array.from({ length: 120 }, (_, i) => item({ id: `r${i}`, type: "note", body: `Note ${i}` })));
    renderPage();
    await screen.findByText("Note 0");
    expect(screen.getByText("Showing 50 of 120.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show more" }));
    await screen.findByText("Note 99");
    await user.click(screen.getByRole("button", { name: "Show more" }));
    await screen.findByText("Note 119");
    expect(client.listContactActivity.mock.calls.map((c) => c[2])).toEqual([
      { filter: "all", limit: 50, offset: 0 }, { filter: "all", limit: 50, offset: 50 }, { filter: "all", limit: 50, offset: 100 },
    ]);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  }, 30_000);

  // Catches: a newer activity logged between two page reads shifting every row down one, so the second page repeats the first's last row and the list ends
  // one older row short (offsets and the end of the list are counted from raw page lengths).
  it("reads the loaded pages again when a row arrives between two pages, so no row is skipped", async () => {
    const user = userEvent.setup();
    const all = Array.from({ length: 120 }, (_, i) => item({ id: `r${i}`, type: "note", body: `Note ${i}` }));
    serveActivity(all);
    renderPage();
    await screen.findByText("Note 0");
    all.unshift(item({ id: "new", type: "note", body: "Note new" }));
    await user.click(screen.getByRole("button", { name: "Show more" }));
    await screen.findByText("Note 98");
    // Asked again, once: the first two pages from one ordering.
    await waitFor(() => expect(screen.getByText("Note new")).toBeInTheDocument());
    while (screen.queryByRole("button", { name: "Show more" })) {
      await user.click(screen.getByRole("button", { name: "Show more" }));
      await waitFor(() => expect(client.listContactActivity).toHaveBeenCalled());
    }
    const shown = (screen.getByRole("table", { name: "The contact's calls, notes and tasks" }).textContent ?? "");
    for (let i = 0; i < 120; i += 1) expect(shown).toContain(`Note ${i}`);
    expect(screen.getAllByRole("row").length - 1).toBe(121);
  }, 30_000);

  // Catches: this list failing and taking the page with it, or no way to ask again.
  it("fails on its own, with Try again, and the rest of the page stays", async () => {
    const user = userEvent.setup();
    client.listContactActivity.mockRejectedValueOnce(new ContactError("failed", "Couldn't load the activity. Try again."));
    renderPage();
    const list = within(await screen.findByRole("region", { name: /Calls, notes and tasks/ }));
    expect(await list.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Elena Marsh" })).toBeInTheDocument();
    await user.click(list.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("table", { name: "The contact's calls, notes and tasks" })).toBeInTheDocument();
  });
});

describe("ContactPage: logging a call, a note or a task about this contact", () => {
  // Catches: Log a call from the contact's page not naming the contact (it must be With them), or being sent to the account's id wrong.
  it("logs a call with this contact chosen, on its account", async () => {
    const user = userEvent.setup();
    activity.logActivity.mockResolvedValue({ activity: call, followUp: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Log a call/ }));
    await waitFor(() => expect(screen.getByLabelText("With")).not.toBeDisabled());
    expect(screen.getByLabelText("With")).toHaveValue("c1");
    expect(activity.getActivityOptions).toHaveBeenCalledWith("f1", "a1");
    await user.type(screen.getByLabelText("What was said"), "Spoke about renewal");
    const before = client.getContactPage.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.logActivity).toHaveBeenCalledTimes(1));
    expect(activity.logActivity.mock.calls[0][1]).toMatchObject({ kind: "call", accountId: "a1", contactId: "c1", body: "Spoke about renewal" });
    expect(toast.success).toHaveBeenCalledWith("Call logged");
    // Every list of the contact is asked again.
    await waitFor(() => expect(client.getContactPage.mock.calls.length).toBeGreaterThan(before));
  });

  it("adds a note and a task about this contact the same way", async () => {
    const user = userEvent.setup();
    activity.logActivity.mockResolvedValue({ activity: note, followUp: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add a note" }));
    await waitFor(() => expect(screen.getByLabelText("With")).not.toBeDisabled());
    expect(screen.getByLabelText("With")).toHaveValue("c1");
    await user.type(screen.getByLabelText("Note"), "Prefers mornings");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(activity.logActivity).toHaveBeenCalledTimes(1));
    expect(activity.logActivity.mock.calls[0][1]).toMatchObject({ kind: "note", contactId: "c1", accountId: "a1" });
    await user.click(await screen.findByRole("button", { name: /^Add a task/ }));
    await waitFor(() => expect(screen.getByLabelText("With")).not.toBeDisabled());
    expect(screen.getByLabelText("With")).toHaveValue("c1");
  });

  // Catches: marking a task done not working from here, or not asking the contact's list again.
  it("marks a task done and asks the list again", async () => {
    const user = userEvent.setup();
    activity.setTaskDone.mockResolvedValue({ ...task, doneAt: "2026-11-14T10:00:00+00:00" });
    renderPage();
    const table = await screen.findByRole("table", { name: "The contact's calls, notes and tasks" });
    const before = client.listContactActivity.mock.calls.length;
    await user.click(within(table).getByRole("button", { name: /Mark done/ }));
    await waitFor(() => expect(activity.setTaskDone).toHaveBeenCalledWith("f1", "task1", true));
    await waitFor(() => expect(client.listContactActivity.mock.calls.length).toBeGreaterThan(before));
  });

  // Catches: buttons offered where the database refuses every write (a Nevermore support session, ADR 0024).
  it("offers none of it in a Nevermore support session", async () => {
    renderPage("/contacts/c1", workspace({ isSupport: true }));
    await screen.findByRole("heading", { level: 1, name: "Elena Marsh" });
    expect(screen.queryByRole("button", { name: /^Log a call|^Add a task|^Add a note|^Move|Mark done|^Edit (call|note|task)/ })).toBeNull();
  });

  // Catches: an archived account taking a new call, note or task through its contact (D-222), or hiding Edit, Mark done and Move, which it still allows.
  it("says the account is archived and offers nothing to add, but still Edit, Mark done and Move", async () => {
    client.getContactPage.mockResolvedValue(page({ canAdd: false }, { account: { id: "a1", name: "Harborview Dental Group", archived: true } }));
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Elena Marsh" });
    expect(screen.getByText("This account is archived.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Log a call|^Add a task|^Add a note|Add to note/ })).toBeNull();
    const table = await screen.findByRole("table", { name: "The contact's calls, notes and tasks" });
    expect(within(table).getByRole("button", { name: /Mark done/ })).toBeInTheDocument();
    expect(within(table).getAllByRole("button", { name: /^Edit/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Move to another account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Edit the contact/ })).toBeInTheDocument();
  });
});

describe("ContactPage: Move", () => {
  // Catches: Move offered to someone the database would refuse (the picker says so in words), or missing for someone who may.
  it("offers Move only when the database says the person may move the contact", async () => {
    const { unmount } = renderAndUnmount();
    expect(await screen.findByRole("button", { name: "Move to another account" })).toBeInTheDocument();
    unmount();
    client.getContactPage.mockResolvedValue(page({ canMove: false }));
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Elena Marsh" });
    expect(screen.queryByRole("button", { name: "Move to another account" })).toBeNull();
  });

  // Catches: a move that leaves the page showing the old account, or a Move that sends the wrong contact.
  it("moves the contact and asks the page again, so it names the new account", async () => {
    const user = userEvent.setup();
    contacts.listMoveChoices.mockResolvedValue([{ id: "a2", name: "Harborview East" }]);
    contacts.moveContact.mockResolvedValue({ from: { id: "a1", name: "Harborview Dental Group" }, to: { id: "a2", name: "Harborview East" }, wasMain: true, activitiesMoved: 3, opportunityLinksDropped: 0, mainContactCleared: 0 });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Move to another account" }));
    await user.click(await screen.findByRole("radio", { name: "Harborview East" }));
    const before = client.getContactPage.mock.calls.length;
    client.getContactPage.mockResolvedValue(page({}, { account: { id: "a2", name: "Harborview East", archived: false }, accountId: "a2", isMain: false }));
    await user.click(screen.getByRole("button", { name: /^Move/ }));
    await waitFor(() => expect(contacts.moveContact).toHaveBeenCalledTimes(1));
    expect(contacts.moveContact.mock.calls[0][1]).toBe("c1");
    await waitFor(() => expect(client.getContactPage.mock.calls.length).toBeGreaterThan(before));
    expect(await within(await screen.findByRole("navigation", { name: "Breadcrumb" })).findByRole("link", { name: "Harborview East" })).toHaveAttribute("href", "/accounts/a2");
  });
});

describe("ContactPage: Move refreshes both accounts", () => {
  // Catches: the account the contact went to keeping its old contacts list (the provider asks only the account it was on), or the one it left.
  it("asks the account the contact left and the one it joined again, and the contact", async () => {
    const user = userEvent.setup();
    contacts.listMoveChoices.mockResolvedValue([{ id: "a2", name: "Harborview East" }]);
    contacts.moveContact.mockResolvedValue({ from: { id: "a1", name: "Harborview Dental Group" }, to: { id: "a2", name: "Harborview East" }, wasMain: false, activitiesMoved: 0, opportunityLinksDropped: 0, mainContactCleared: 0 });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Move to another account" }));
    await user.click(await screen.findByRole("radio", { name: "Harborview East" }));
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    await user.click(screen.getByRole("button", { name: /^Move/ }));
    await waitFor(() => expect(contacts.moveContact).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(invalidated(spy)).toEqual(expect.arrayContaining(["account/f1/a1", "account/f1/a2", "contact/f1/c1"])));
  });
});

function renderAndUnmount() {
  const router = createMemoryRouter([{ path: "/contacts/:id", element: <><ContactPage /><Where /></> }], { initialEntries: ["/contacts/c1"] });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
      <WorkspaceContext.Provider value={workspace()}><RouterProvider router={router} /></WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
}

describe("ContactPage: edit in place", () => {
  const open = async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Edit the contact/ }));
    return user;
  };
  const saved = (over: object = {}) => ({ conflict: false, contact: { ...contact, version: 4, ...over }, previousMain: null });

  // Catches: Edit shown to someone the level rule refuses (D-209), or missing for someone it serves.
  it("offers Edit only when the database says the person may change the contact", async () => {
    client.getContactPage.mockResolvedValue(page({ canChange: false }));
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Elena Marsh" });
    expect(screen.queryByRole("button", { name: /^Edit the contact/ })).toBeNull();
  });

  // Catches: a save that names the wrong version, drops a field, or sends what was typed untrimmed or as the wrong type.
  it("sends every field with the version the edit started from, and puts the saved values on the page", async () => {
    client.updateContact.mockResolvedValue(saved({ title: "Office Manager", doNotEmail: true }));
    renderPage();
    const user = await open();
    client.getContactPage.mockResolvedValue(page({}, { title: "Office Manager", doNotEmail: true, version: 4 }));
    expect(screen.getByLabelText("First name")).toHaveValue("Elena");
    expect(screen.getByLabelText("Owner")).toHaveValue("u1");
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "  Office Manager ");
    await user.click(screen.getByRole("checkbox", { name: "Do not email" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateContact).toHaveBeenCalledTimes(1));
    expect(client.updateContact).toHaveBeenCalledWith("f1", "c1", {
      firstName: "Elena", lastName: "Marsh", title: "Office Manager", email: "elena@harborview.example", phone: "(503) 555-0142", mobile: "", ownerId: "u1", isMain: true, doNotEmail: true,
    }, 3);
    expect(toast.success).toHaveBeenCalledWith("Contact saved");
    expect(await screen.findByRole("button", { name: /^Edit the contact/ })).toHaveFocus();
    expect(within(panel("Details")).getByText("Office Manager")).toBeInTheDocument();
  });

  // Catches: a missing last name or no way to reach the contact accepted by the form, or said in codes.
  it("says in words what is wrong, before asking the database", async () => {
    renderPage();
    const user = await open();
    await user.clear(screen.getByLabelText("Last name"));
    await user.clear(screen.getByLabelText("Email"));
    await user.clear(screen.getByLabelText("Phone"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter the contact's last name.")).toBeInTheDocument();
    expect(screen.getByText("Enter an email or a phone number.")).toBeInTheDocument();
    expect(client.updateContact).not.toHaveBeenCalled();
  });

  // Catches: an older-format phone or email blocking a save of another field (the database's rule: judged only when changed), or a changed one let through.
  it("does not judge a phone or email left as it was, and judges one that is changed", async () => {
    client.getContactPage.mockResolvedValue(page({}, { phone: "ask for Pat", email: "pat@harborview" }));
    client.updateContact.mockResolvedValue(saved({ title: "Boss", phone: "ask for Pat", email: "pat@harborview" }));
    renderPage();
    const user = await open();
    await user.type(screen.getByLabelText("Title"), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateContact).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole("button", { name: /^Edit the contact/ }));
    await user.type(screen.getByLabelText("Phone"), "x");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Enter a phone number like/)).toBeInTheDocument();
    expect(client.updateContact).toHaveBeenCalledTimes(1);
  });

  // Catches: the database's refusal (the level rule on the old main contact, a closing firm) lost, or shown as a failure to try again.
  it("shows the database's refusal in its own words and keeps what was typed", async () => {
    client.updateContact.mockRejectedValue(new ContactError("notAllowed", "Only someone who may change Sam Park can make another contact the main one.", "42501"));
    renderPage();
    const user = await open();
    await user.type(screen.getByLabelText("Title"), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Only someone who may change Sam Park can make another contact the main one.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Practice Manager!");
    expect(toast.success).not.toHaveBeenCalled();
  });

  // Catches: ticking Main contact taking over silently: the form says who it takes over from; the toast says who it displaced.
  it("says before saving that Main contact takes over, and after saving who it took over from", async () => {
    client.getContactPage.mockResolvedValue(page({}, { isMain: false }));
    client.updateContact.mockResolvedValue({ conflict: false, contact: { ...contact, version: 4, isMain: true }, previousMain: { id: "c2", name: "Sam Park" } });
    renderPage();
    const user = await open();
    await user.click(screen.getByRole("checkbox", { name: "Main contact for this account" }));
    // Several status regions can be on the page (each list's "List refresh" region is always present, CRM-S2.4a fixes), so find this one by its words.
    expect(screen.getAllByRole("status").find((el) => el.textContent?.includes("Saving makes this contact the account's main contact"))).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Contact saved. Sam Park isn't the main contact any more."));
    expect(client.updateContact.mock.calls[0][2]).toMatchObject({ isMain: true });
  });

  // Catches: the contact a new main contact displaced keeping its old page (it still shows "Main contact") until its own refresh, a minute later.
  it("asks the displaced main contact's page again, and the saved contact's and its account's", async () => {
    client.getContactPage.mockResolvedValue(page({}, { isMain: false }));
    client.updateContact.mockResolvedValue({ conflict: false, contact: { ...contact, version: 4, isMain: true }, previousMain: { id: "c2", name: "Sam Park" } });
    renderPage();
    const user = await open();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    await user.click(screen.getByRole("checkbox", { name: "Main contact for this account" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(invalidated(spy)).toContain("contact/f1/c2"));
    expect(invalidated(spy)).toEqual(expect.arrayContaining(["contact/f1/c1", "account/f1/a1"]));
  });

  // Catches: the owner choice offering the person someone the database would refuse, or dropping the present owner (so saving would change it), or sending an id for none.
  it("offers the present owner first, then the people the database lets the person give it to", async () => {
    listAccountOwners.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u3", label: "Sam Lee" }]);
    client.getContactPage.mockResolvedValue(page({}, { owner: { id: "u9", name: "Pat Gone" } }));
    renderPage();
    await open();
    await waitFor(() => expect(within(screen.getByLabelText("Owner")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Pat Gone", "Dana Reyes", "Sam Lee"]));
    expect(screen.getByLabelText("Owner")).toHaveValue("u9");
  });

  it("offers No owner for a contact that has none, and sends nothing for it", async () => {
    client.getContactPage.mockResolvedValue(page({}, { owner: null }));
    client.updateContact.mockResolvedValue(saved({ owner: null }));
    renderPage();
    const user = await open();
    expect(screen.getByLabelText("Owner")).toHaveValue("");
    await user.type(screen.getByLabelText("Title"), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateContact).toHaveBeenCalledTimes(1));
    expect(client.updateContact.mock.calls[0][2]).toMatchObject({ ownerId: null });
  });

  describe("when someone saved first", () => {
    const conflict: ContactConflict = {
      conflict: true, currentVersion: 5,
      current: { firstName: "Elena", lastName: "Marsh", title: "Director", email: "elena@harborview.example", phone: "(503) 555-0142", mobile: null, ownerId: "u2", isMain: true, doNotEmail: true },
      changed: [
        { field: "title", value: "Director", who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" },
        { field: "owner_id", value: "u2", who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" },
        { field: "do_not_email", value: true, who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" },
      ],
    };

    // Catches: a conflict that overwrites, or shows columns and ids instead of words, or without who changed them.
    it("shows what changed, in words, and saves nothing", async () => {
      client.updateContact.mockResolvedValueOnce(conflict);
      renderPage();
      const user = await open();
      await waitFor(() => expect(listFirmMembers).toHaveBeenCalled());
      await user.type(screen.getByLabelText("Title"), "!");
      await user.click(screen.getByRole("button", { name: "Save" }));
      const dialog = await screen.findByRole("alertdialog");
      const rows = within(dialog).getAllByRole("row").slice(1).map((r) => r.textContent);
      expect(rows[0]).toContain("Title");
      expect(rows[0]).toContain("Director");
      expect(rows[1]).toContain("OwnerYou didn't change thisMarcus Hale");
      expect(rows[2]).toContain("Do not emailYou didn't change thisYes");
      expect(dialog.textContent).not.toMatch(/owner_id|do_not_email|u2/);
      expect(toast.success).not.toHaveBeenCalled();
    });

    // Catches: Keep theirs putting an owner in the form that the box has no option for, so it shows the first option while Save sends the other (u2).
    it("shows their owner after Keep theirs even when the person could not have chosen them, and saves that owner", async () => {
      client.updateContact.mockResolvedValueOnce(conflict).mockResolvedValueOnce(saved({ version: 6, owner: { id: "u2", name: "Marcus Hale" } }));
      renderPage();
      const user = await open();
      await waitFor(() => expect(listFirmMembers).toHaveBeenCalled());
      await user.type(screen.getByLabelText("Title"), "!");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await user.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Keep theirs" }));
      await waitFor(() => expect(screen.getByLabelText("Owner")).toHaveValue("u2"));
      expect(within(screen.getByLabelText("Owner")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Dana Reyes", "Marcus Hale"]);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(client.updateContact).toHaveBeenCalledTimes(2));
      expect(client.updateContact.mock.calls[1][2]).toMatchObject({ ownerId: "u2" });
    });

    // Catches: Keep mine saving again from the old version (refused again).
    it("saves again from the version that holds their change with Keep mine", async () => {
      client.updateContact.mockResolvedValueOnce(conflict).mockResolvedValueOnce(saved({ version: 6 }));
      renderPage();
      const user = await open();
      await user.type(screen.getByLabelText("Title"), "!");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await user.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Keep mine" }));
      await waitFor(() => expect(client.updateContact).toHaveBeenCalledTimes(2));
      expect(client.updateContact.mock.calls[1][3]).toBe(5);
      expect(client.updateContact.mock.calls[1][2]).toMatchObject({ title: "Practice Manager!" });
    });
  });
});

describe("ContactPage: the states", () => {
  // Catches: a blank page while loading, or headings missing from the loading page.
  it("shows the header and each panel's heading with grey lines while the contact is on its way", () => {
    client.getContactPage.mockReturnValue(new Promise(() => {}));
    renderPage();
    for (const heading of ["Details", "Opportunities", "Calls, notes and tasks"]) expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });

  // Catches: the same answer for a contact that is not there and one whose account the person may not see (the database gives one answer), said in other words.
  it("says This contact isn't available when there is none to show", async () => {
    client.getContactPage.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText(/This contact isn't available/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to all accounts" })).toHaveAttribute("href", "/accounts");
  });

  it("says the whole page failed, with Try again", async () => {
    const user = userEvent.setup();
    client.getContactPage.mockRejectedValueOnce(new ContactError("failed", "Couldn't load the contact. Try again."));
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Elena Marsh" })).toBeInTheDocument();
  });

  // Catches: the previous contact's open form and version drawn under the next contact's address (a save would name the next with the old fields).
  it("shows nothing of the previous contact while the next loads", async () => {
    let resolveNext: (p: Page) => void = () => {};
    client.getContactPage.mockImplementation(async (_f: string, id: string) => (id === "c1" ? page() : new Promise<Page>((r) => { resolveNext = r; })));
    const router = renderPage();
    await screen.findByRole("heading", { level: 1, name: "Elena Marsh" });
    await act(async () => { await router.navigate("/contacts/c2"); });
    expect(screen.queryByText("Elena Marsh")).toBeNull();
    await act(async () => { resolveNext(page({}, { id: "c2", firstName: "Sam", lastName: "Park" })); });
    expect(await screen.findByRole("heading", { level: 1, name: "Sam Park" })).toBeInTheDocument();
  });
});
