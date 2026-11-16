import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSignedInUser } from "@/lib/signedInUser";
import { toast } from "sonner";
import type { AccountConflict, AccountPage as Page } from "@/lib/accountPageApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";
import { allStatuses, expectStatusesOutsideBusy, spoken } from "@/test/loading";

// An account's page through a faked client (story CRM-A2.1b): what a person sees and does. The database's own rules (who may see an account, who may change
// it, what the files are) are tested in supabase/tests/account_page.sql; here the client answers and the page draws it.

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com" }, signOut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { getAccountPage: vi.fn(), listAccountTab: vi.fn(), listAccountFiles: vi.fn(), updateAccount: vi.fn(), getSubmissionAccount: vi.fn() };
vi.mock("@/lib/accountPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountPageApi")), ...client }));
const actions = { archiveAccount: vi.fn(), restoreAccount: vi.fn(), deleteAccount: vi.fn(), changeAccountOwner: vi.fn() };
vi.mock("@/lib/accountActionsApi", () => actions);
const listFirmMembers = vi.fn();
vi.mock("@/lib/accountsApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountsApi")), listFirmMembers: (...a: unknown[]) => listFirmMembers(...a) }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }));
const advisor = { documentUrl: vi.fn(), recordActivity: vi.fn(), fetchMyMailbox: vi.fn() };
const conversations = { getConversation: vi.fn(), sendConversationMessage: vi.fn(), workTheQueue: vi.fn(), listAttachableFiles: vi.fn(), getAccountMessages: vi.fn() };
vi.mock("@/lib/conversationApi", async () => ({ ...(await vi.importActual<object>("@/lib/conversationApi")), ...conversations }));
vi.mock("@/lib/advisorApi", () => advisor);

const search = { noteRecentRecord: vi.fn() };
vi.mock("@/lib/searchApi", async () => ({ ...(await vi.importActual<object>("@/lib/searchApi")), ...search }));

const { default: AccountPage } = await import("./AccountPage");
const { AccountError } = await import("@/lib/accountPageApi");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});

const contact = (n: number, over: object = {}) => ({
  id: `c${n}`, firstName: n === 1 ? "Elena" : `Person${n}`, lastName: n === 1 ? "Marsh" : "Abel", title: n === 1 ? "Practice Manager" : null,
  email: n === 1 ? "elena@harborview.example" : null, phone: n === 1 ? "(503) 555-0142" : null, mobile: null, isMain: n === 1, doNotEmail: false, ...over,
});
const opportunity = (n: number, over: object = {}) => ({ id: `o${n}`, name: `Search ${n}`, stage: "in_market" as const, targetStart: "2027-01-01", submissionId: `i${n}`, ...over });
const quote = (n: number, over: object = {}) => ({
  id: n, submissionId: "i1", opportunityId: "o1", opportunityName: "Search 1", peoName: `PEO ${n}`, status: "sent", sentOn: "2026-11-06", quoteReceivedOn: null, quoteExpiresOn: null, ...over,
});
const change = (n: number, over: object = {}) => ({
  type: "change" as const, entryKey: `e${n}`, at: "2026-11-01T10:00:00+00:00", changeId: `ch${n}`, kind: "changed" as const, who: "dana@example.com", whoKind: "member" as const,
  field: "employees", from: 40, to: 45, recordTable: "accounts" as const, recordId: "a1", recordName: "Harborview Dental Group", ...over,
});
const file = (n: number) => ({ id: `d${n}`, fileName: `census-${n}.csv`, mimeType: "text/csv", sizeBytes: 2048, category: "employee_census", createdAt: "2026-11-02T10:00:00+00:00", submissionId: "i1", storagePath: `u1/i1/census-${n}.csv` });
const tabOf = <R,>(rows: R[], count = rows.length) => ({ count, rows });

/** The database's page of a tab: the rows from `offset`, at most 100 a page (it refuses more with 22023), and how many there are in all. */
const pageOf = <R,>(all: R[], o: { limit?: number; offset?: number } = {}) => {
  const limit = o.limit ?? 50;
  const offset = o.offset ?? 0;
  if (limit > 100 || limit < 0 || offset < 0) throw new AccountError("invalid", "A page is 0 to 100 rows, from a place that is not before the first", "22023");
  return tabOf(all.slice(offset, offset + limit), all.length);
};
/** A fake of `listAccountTab` and `listAccountFiles` over a list of rows, with the database's page rule. */
const serveTab = <R,>(all: R[]) => client.listAccountTab.mockImplementation(async (_f: string, _a: string, _t: string, o?: { limit?: number; offset?: number }) => pageOf(all, o));
const serveFiles = <R,>(all: R[]) => client.listAccountFiles.mockImplementation(async (_f: string, _a: string, o?: { limit?: number; offset?: number }) => pageOf(all, o));

const account = {
  id: "a1", version: 3, name: "Harborview Dental Group", tradeName: "Harborview Dental", website: "harborviewdental.example", webDomain: "harborviewdental.example",
  phone: "(503) 555-0140", street: "410 SW Alder St", city: "Portland", state: "OR", postalCode: "97204", industry: "Dental practice", employees: 45,
  statesOfOperation: ["OR", "WA"], currentProvider: "Payroll vendor", source: "employer_intake" as const, archivedAt: null,
  createdAt: "2026-10-28T10:00:00+00:00", updatedAt: "2026-11-01T10:00:00+00:00",
  status: "prospect" as const, owner: { id: "u1", name: "Dana Reyes" }, sourcePartner: "Kline CPA",
};
const page = (over: Partial<Page> = {}, tabs: Partial<Page["tabs"]> = {}): Page => ({
  account, canChange: true,
  tabs: {
    contacts: tabOf([contact(1), contact(2)], 2),
    opportunities: tabOf([opportunity(1), opportunity(2, { name: "A search with no intake", submissionId: null, stage: "qualifying", targetStart: null })], 2),
    quotes: tabOf([quote(1), quote(2)], 2),
    activity: tabOf([change(1), change(2, { kind: "created", field: null, from: null, to: null })], 14),
    files: tabOf([file(1)], 1),
    ...tabs,
  },
  ...over,
});

const Where = () => {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
};
const renderPage = (path = "/accounts/a1", ws: Workspace = workspace()) => {
  const router = createMemoryRouter([{ path: "/accounts/:id", element: <><AccountPage /><Where /></> }, { path: "*", element: <Where /> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
      <WorkspaceContext.Provider value={ws}><RouterProvider router={router} /></WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return router;
};
const tabNames = () => screen.getAllByRole("tab").map((t) => t.textContent);
const panel = (name: RegExp | string) => screen.getByRole("region", { name });

beforeEach(() => {
  // The app's identity boundary says who is signed in; these pages render without it.
  setSignedInUser("u1");
  for (const fn of [...Object.values(client), ...Object.values(advisor), ...Object.values(actions), signOut]) fn.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  client.getAccountPage.mockResolvedValue(page());
  for (const fn of Object.values(conversations)) fn.mockReset();
  advisor.fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "dana@example.com" });
  conversations.getConversation.mockResolvedValue({ conversationId: null, messages: [], mailbox: { connected: true, lastSendFailed: false } });
  conversations.listAttachableFiles.mockResolvedValue([]);
  conversations.getAccountMessages.mockResolvedValue([]);
});

describe("AccountPage: Email", () => {
  // Catches: an account's page with no Email (CRM-E1.2's first criterion), an Email that offers contacts of another account, or that writes to someone
  // other than the contact chosen; and coming back anywhere but here, to the same contact, after connecting a mailbox (D-650).
  it("asks which of the account's contacts, then opens the place to write for the one chosen", async () => {
    const user = userEvent.setup();
    client.listAccountTab.mockResolvedValue(tabOf([contact(2), contact(1)], 2));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Email" }));
    const dialog = await screen.findByRole("dialog", { name: "Which contact?" });
    expect(within(dialog).getAllByRole("button", { name: /^Write to / })[0]).toHaveTextContent("Elena Marsh");
    expect(client.listAccountTab).toHaveBeenCalledWith("f1", "a1", "contacts", { limit: 100, offset: 0 });
    await user.click(within(dialog).getByRole("button", { name: /^Write to Elena Marsh/ }));
    expect(await screen.findByRole("region", { name: "Emails" })).toBeInTheDocument();
    expect(conversations.getConversation).toHaveBeenCalledWith("f1", "c1");
  });

  // Catches: the account's page not showing the mail with its contacts (CRM-E1.3: one message shown on every record it belongs to, from 6.4's
  // account_conversation_messages), or a message not saying which contact it is with.
  it("shows the emails with the account's contacts on its Overview, newest first, each naming its contact", async () => {
    conversations.getAccountMessages.mockResolvedValue([
      { id: "m2", direction: "inbound", from: "elena@harborview.example", to: [], subject: "Re: Your renewal", body: "Friday?", status: "received",
        failureKind: null, failureReason: null, at: "2026-11-11T09:00:00+00:00", contactId: "c1" },
      { id: "m1", direction: "outbound", from: "dana@example.com", to: ["elena@harborview.example"], subject: "Your renewal", body: "Hi", status: "sent",
        failureKind: null, failureReason: null, at: "2026-11-10T09:00:00+00:00", contactId: "c1" },
    ]);
    renderPage();
    const list = await screen.findByRole("list", { name: "Emails with the account's contacts" });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Re: Your renewal");
    expect(items[0]).toHaveTextContent("Elena Marsh");
    expect(items[1]).toHaveTextContent("Your renewal");
    expect(conversations.getAccountMessages).toHaveBeenCalledWith("f1", { accountId: "a1" });
  });

  // Catches: coming back from connecting a mailbox to the account's page with the place to write closed, so the unsent message seems lost (D-653).
  it("back from connecting a mailbox, opens the place to write for the contact being written to", async () => {
    client.listAccountTab.mockResolvedValue(tabOf([contact(2), contact(1)], 2));
    renderPage("/accounts/a1?email=c1");
    const dialog = await screen.findByRole("dialog", { name: "Write to Elena Marsh" });
    expect(await within(dialog).findByRole("region", { name: "Emails" })).toBeInTheDocument();
    expect(conversations.getConversation).toHaveBeenCalledWith("f1", "c1");
  });
});

describe("AccountPage: the menu's recent records", () => {
  // Catches: a record that never reaches the search box's "last five opened" because no page notes it (CRM-S1.2a).
  it("notes the account as opened once its page has loaded, once", async () => {
    search.noteRecentRecord.mockReset().mockResolvedValue(true);
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(search.noteRecentRecord).toHaveBeenCalledWith("f1", "account", "a1"));
    expect(search.noteRecentRecord).toHaveBeenCalledTimes(1);
  });

  it("notes nothing for a page that isn't there, and shows the page whatever the note does", async () => {
    search.noteRecentRecord.mockReset().mockRejectedValue(new Error("down"));
    client.getAccountPage.mockResolvedValue(null);
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

describe("AccountPage: from one account to another", () => {
  const bravo = { ...account, id: "a2", name: "Bravo Plumbing", tradeName: null, industry: "Plumbing", employees: 12, city: "Salem", website: null };

  // Catches: the page keeping the previous account's data (and its open form and version) under the new account's address, so a Save names the new account with
  // the old account's fields. Two new accounts are both at version 1.
  it("shows nothing of the previous account while the next loads, and a save names the next account with its own fields", async () => {
    const user = userEvent.setup();
    let resolveB: (p: Page) => void = () => {};
    client.getAccountPage.mockImplementation(async (_f: string, id: string) => (id === "a1" ? page() : new Promise<Page>((r) => { resolveB = r; })));
    client.updateAccount.mockResolvedValue({ conflict: false, account: { ...bravo, version: 4 } });
    const router = renderPage();
    await user.click(await screen.findByRole("button", { name: /^Edit/ }));
    expect(screen.getByLabelText("Account name")).toHaveValue("Harborview Dental Group");

    await act(async () => { await router.navigate("/accounts/a2"); });
    expect(screen.queryByLabelText("Account name")).toBeNull();
    expect(screen.queryByText("Harborview Dental Group")).toBeNull();

    await act(async () => { resolveB(page({ account: bravo })); });
    expect(await screen.findByRole("heading", { level: 1, name: "Bravo Plumbing" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Edit/ }));
    expect(screen.getByLabelText("Account name")).toHaveValue("Bravo Plumbing");
    await user.type(screen.getByLabelText("Industry"), "s");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateAccount).toHaveBeenCalledTimes(1));
    expect(client.updateAccount.mock.calls[0][1]).toBe("a2");
    expect(client.updateAccount.mock.calls[0][2]).toMatchObject({ name: "Bravo Plumbing", industry: "Plumbings", employees: 12, city: "Salem" });
  });
});

describe("AccountPage: the header and the tabs", () => {
  // Catches: a header that leaves out a fact the screen shows, or shows buttons that belong to later stories (D-186, no dead buttons).
  it("shows the name, status, industry, location, employees, website and owner, and no button that does nothing", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" })).toBeInTheDocument();
    expect(screen.getByText("Prospect")).toBeInTheDocument();
    expect(screen.getByText("Dental practice · Portland, OR · 45 employees · harborviewdental.example · Owner Dana Reyes")).toBeInTheDocument();
    // Email is CRM-E1.2's, here since slice 6.3 ("AccountPage: Email").
    for (const gone of ["New opportunity", "Add a contact", "Restore"]) {
      expect(screen.queryByRole("button", { name: gone }), gone).toBeNull();
      expect(screen.queryByRole("link", { name: gone }), gone).toBeNull();
    }
    expect(client.getAccountPage).toHaveBeenCalledWith("f1", "a1");
  });

  it("says a client is a Client, and an account with no owner has none", async () => {
    client.getAccountPage.mockResolvedValue(page({ account: { ...account, status: "client", owner: null, industry: null, employees: null, website: null, city: null, state: null } }));
    renderPage();
    expect(await screen.findByText("Client")).toBeInTheDocument();
    expect(screen.getByText("No owner")).toBeInTheDocument();
  });

  // Catches: a Renewals tab (D-186), a missing tab, or a count that is not the database's.
  it("has the six tabs, each with its count, and no Renewals tab", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(tabNames()).toEqual(["Overview", "Contacts2", "Opportunities2", "Quotes2", "Activity14", "Files1"]);
    expect(screen.queryByRole("tab", { name: /Renewals/ })).toBeNull();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens a tab from its own tab, with the tab in the address", async () => {
    const user = userEvent.setup();
    client.listAccountTab.mockResolvedValue(tabOf([contact(1), contact(2)], 2));
    const router = renderPage();
    await user.click(await screen.findByRole("tab", { name: /Contacts/ }));
    expect(router.state.location.search).toBe("?tab=contacts");
    expect(await screen.findByRole("region", { name: /Contacts/ })).toBeInTheDocument();
    expect(client.listAccountTab).toHaveBeenCalledWith("f1", "a1", "contacts", { limit: 50, offset: 0 });
    await user.click(screen.getByRole("tab", { name: "Overview" }));
    expect(router.state.location.search).toBe("");
  });
});

describe("AccountPage: the Overview", () => {
  // Catches: details that leave out a standard field, a source without the partner, an owner as an id.
  it("shows the details down one side", async () => {
    renderPage();
    const details = await screen.findByRole("region", { name: "Details" });
    const row = (label: string) => within(details).getByText(label).nextElementSibling as HTMLElement;
    expect(row("Account name")).toHaveTextContent("Harborview Dental Group");
    expect(row("Trade name")).toHaveTextContent("Harborview Dental");
    expect(row("Website")).toHaveTextContent("harborviewdental.example");
    expect(row("Phone")).toHaveTextContent("(503) 555-0140");
    expect(row("Address")).toHaveTextContent("410 SW Alder StPortland, OR 97204");
    expect(row("Industry")).toHaveTextContent("Dental practice");
    expect(row("Employees")).toHaveTextContent("45");
    expect(row("States")).toHaveTextContent("OR, WA");
    expect(row("Current provider")).toHaveTextContent("Payroll vendor");
    expect(row("Source")).toHaveTextContent("Employer's intake · Kline CPA");
    expect(row("Owner")).toHaveTextContent("Dana Reyes");
    expect(within(details).queryByText(/Renewal/)).toBeNull();
  });

  it("says Not provided for a field the account does not have", async () => {
    client.getAccountPage.mockResolvedValue(page({ account: { ...account, tradeName: null, street: null, city: null, state: null, postalCode: null } }));
    renderPage();
    const details = await screen.findByRole("region", { name: "Details" });
    expect(within(details).getByText("Trade name").nextElementSibling).toHaveTextContent("Not provided");
    expect(within(details).getByText("Address").nextElementSibling).toHaveTextContent("Not provided");
  });

  // Catches: the page's lists not showing the rows or their count, a Renewals list (D-186), a "See all" that opens nothing.
  it("shows each list's rows with its count and a See all, and no Renewals", async () => {
    renderPage();
    const contacts = await screen.findByRole("region", { name: /Contacts/ });
    expect(within(contacts).getByRole("heading", { name: /Contacts\s*2/ })).toBeInTheDocument();
    expect(within(contacts).getByText("Practice Manager")).toBeInTheDocument();
    expect(within(contacts).getByText("elena@harborview.example")).toBeInTheDocument();
    expect(within(contacts).getByText("Main")).toBeInTheDocument();
    const opportunities = screen.getByRole("region", { name: /Opportunities/ });
    expect(within(opportunities).getByText("In market")).toBeInTheDocument();
    expect(within(opportunities).getByText("Qualifying")).toBeInTheDocument();
    expect(within(opportunities).getByText("Jan 1, 2027")).toBeInTheDocument();
    const quotes = screen.getByRole("region", { name: /Quotes/ });
    expect(within(quotes).getAllByRole("row")).toHaveLength(3);
    expect(within(quotes).getAllByText("Waiting")).toHaveLength(2);
    const activity = screen.getByRole("region", { name: /Recent activity/ });
    expect(within(activity).getByText("Employees changed from 40 to 45")).toBeInTheDocument();
    expect(within(activity).getByText("Account created")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Renewals/ })).toBeNull();
    expect(screen.getAllByRole("link", { name: /^See all/ }).map((l) => l.textContent)).toEqual(["See all contacts", "See all opportunities", "See all quotes", "See all activity"]);
  });

  // Catches: "See all" that goes nowhere, or opens another tab.
  it("opens a list's tab from its See all, and the tab holds the whole list", async () => {
    const user = userEvent.setup();
    client.listAccountTab.mockResolvedValue(tabOf([opportunity(1), opportunity(2), opportunity(3)], 3));
    const router = renderPage();
    await user.click(await screen.findByRole("link", { name: "See all opportunities" }));
    expect(router.state.location.search).toBe("?tab=opportunities");
    expect(client.listAccountTab).toHaveBeenCalledWith("f1", "a1", "opportunities", { limit: 50, offset: 0 });
    expect(await screen.findByText("Search 3")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Opportunities/ })).toHaveAttribute("aria-selected", "true");
  });
});

describe("AccountPage: every name opens its record", () => {
  // Catches: an opportunity or a quote opening nothing, or an opportunity with no submission linking to one (D-187).
  it("opens an opportunity's and a quote's submission, and shows an opportunity with none as plain text", async () => {
    renderPage();
    const opportunities = await screen.findByRole("region", { name: /Opportunities/ });
    expect(within(opportunities).getByRole("link", { name: "Search 1" })).toHaveAttribute("href", "/advisor/submissions/i1");
    expect(within(opportunities).queryByRole("link", { name: "A search with no intake" })).toBeNull();
    expect(within(opportunities).getByText("A search with no intake")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /Quotes/ })).getByRole("link", { name: "PEO 1" })).toHaveAttribute("href", "/advisor/submissions/i1");
  });

  // Catches: a contact's name that opens nothing, or still opens the Contacts tab instead of the contact's own page (CRM-C1.1).
  it("opens the contact's own page from a contact's name, on the Overview and on the Contacts tab", async () => {
    const user = userEvent.setup();
    client.listAccountTab.mockResolvedValue(tabOf([contact(1), contact(2)], 2));
    const router = renderPage();
    await user.click(await within(await screen.findByRole("region", { name: /Contacts/ })).findByRole("link", { name: "Person2 Abel" }));
    expect(router.state.location.pathname).toBe("/contacts/c2");
    await act(async () => { await router.navigate("/accounts/a1?tab=contacts"); });
    await user.click(await within(await screen.findByRole("region", { name: /Contacts/ })).findByRole("link", { name: "Person2 Abel" }));
    expect(router.state.location.pathname).toBe("/contacts/c2");
  });

  // Catches: a contact further down than the first fifty never coming into view, or one past row 100 never coming (a page asked for from row 0 with a longer
  // limit is refused by the database at 100).
  it("loads on, a page at a time, until a contact named in the address is in the list", async () => {
    const all = Array.from({ length: 130 }, (_, i) => contact(i + 1000));
    all[119] = contact(2);
    serveTab(all);
    renderPage("/accounts/a1?tab=contacts&contact=c2");
    expect((await screen.findByText("Person2 Abel", undefined, { timeout: 4000 })).closest("tr")).toHaveAttribute("aria-current", "true");
    expect(client.listAccountTab.mock.calls.map((c) => c[3])).toEqual([{ limit: 50, offset: 0 }, { limit: 50, offset: 50 }, { limit: 50, offset: 100 }]);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("AccountPage: a contact named in the address, when a page fails", () => {
  // Catches: the page that failed being asked for again and again, for as long as the contact is not in view.
  it("asks for the failed page once, and says so", async () => {
    const all = Array.from({ length: 130 }, (_, i) => contact(i + 1000));
    client.listAccountTab.mockImplementation(async (_f: string, _a: string, _t: string, o?: { limit?: number; offset?: number }) => {
      if (o?.offset === 50) throw new AccountError("failed", "Couldn't load the list. Try again.");
      return pageOf(all, o);
    });
    renderPage("/accounts/a1?tab=contacts&contact=c2");
    expect(await screen.findByText(/We couldn't refresh the contacts/, undefined, { timeout: 4000 })).toBeInTheDocument();
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(client.listAccountTab).toHaveBeenCalledTimes(2);
  });
});

describe("AccountPage: paging when the list moves under the person", () => {
  // Catches: a later page coming back null (the account removed, or no longer seen, between two pages) crashing the page.
  it("says the account isn't available when a later page comes back null, and does not crash", async () => {
    const user = userEvent.setup();
    const all = Array.from({ length: 80 }, (_, i) => quote(i + 1));
    client.listAccountTab.mockImplementation(async (_f: string, _a: string, _t: string, o?: { limit?: number; offset?: number }) => (o?.offset === 50 ? null : pageOf(all, o)));
    renderPage("/accounts/a1?tab=quotes");
    await user.click(await screen.findByRole("button", { name: "Show more" }, { timeout: 4000 }));
    expect(await screen.findByText("This account isn't available.")).toBeInTheDocument();
    expect(screen.queryByText("PEO 1")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Harborview Dental Group" })).toBeInTheDocument();
  });

  // Catches: a "Showing N of M" with a Show more that is disabled for ever, when a refresh shrank the list and the last page came back empty.
  it("offers Show more only when there is a next page", async () => {
    const user = userEvent.setup();
    const all = Array.from({ length: 80 }, (_, i) => quote(i + 1));
    client.listAccountTab.mockImplementation(async (_f: string, _a: string, _t: string, o?: { limit?: number; offset?: number }) =>
      (o?.offset === 50 ? tabOf([], 80) : pageOf(all, o)));
    renderPage("/accounts/a1?tab=quotes");
    await user.click(await screen.findByRole("button", { name: "Show more" }, { timeout: 4000 }));
    await waitFor(() => expect(client.listAccountTab).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Show more" })).toBeNull());
    expect(screen.queryByText(/^Showing/)).toBeNull();
    expect(screen.getByText("PEO 50")).toBeInTheDocument();
  });

  // Catches: the same row twice (and a repeated React key) when rows shifted between two pages.
  it("shows a row once when the next page repeats one of the first", async () => {
    const user = userEvent.setup();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const all = Array.from({ length: 80 }, (_, i) => contact(i + 1000));
    client.listAccountTab.mockImplementation(async (_f: string, _a: string, _t: string, o?: { limit?: number; offset?: number }) =>
      (o?.offset === 50 ? tabOf([all[49], ...all.slice(50, 79)], 80) : pageOf(all, o)));
    renderPage("/accounts/a1?tab=contacts");
    await user.click(await screen.findByRole("button", { name: "Show more" }, { timeout: 4000 }));
    await screen.findByText("Person1078 Abel");
    expect(screen.getAllByText("Person1049 Abel")).toHaveLength(1);
    expect(screen.getAllByRole("row")).toHaveLength(1 + 79);
    expect(errors.mock.calls.filter((c) => String(c[0]).includes("same key"))).toEqual([]);
    // Asked again once, and not again while the list keeps repeating the row.
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(client.listAccountTab.mock.calls.map((c) => c[3].offset)).toEqual([0, 50, 0, 50]);
    errors.mockRestore();
  });
});

describe("AccountPage: a contact named in the address that is not in the list", () => {
  // Catches: the loader fetching every page of a long list for a contact that is not on the account.
  it("stops loading by itself after 500 rows, says so, and leaves Show more", { timeout: 20000 }, async () => {
    const user = userEvent.setup();
    // As someone who may not change the account: a Move button on each of 500 rows costs about 3 s in jsdom and this test is about the loader, not the buttons.
    client.getAccountPage.mockResolvedValue(page({ canChange: false }));
    serveTab(Array.from({ length: 700 }, (_, i) => contact(i + 1000)));
    renderPage("/accounts/a1?tab=contacts&contact=nobody");
    expect(await screen.findByText("That contact isn't in the first 500 here.", undefined, { timeout: 8000 })).toBeInTheDocument();
    expect(client.listAccountTab).toHaveBeenCalledTimes(10);
    expect(screen.getByText("Showing 500 of 700.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Showing 550 of 700.")).toBeInTheDocument();
    expect(client.listAccountTab).toHaveBeenCalledTimes(11);
  });

  it("says the contact isn't on the account once every row is loaded", async () => {
    serveTab(Array.from({ length: 120 }, (_, i) => contact(i + 1000)));
    renderPage("/accounts/a1?tab=contacts&contact=nobody");
    expect(await screen.findByText("That contact isn't on this account.", undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(client.listAccountTab).toHaveBeenCalledTimes(3);
    expect(screen.queryByText(/first 500/)).toBeNull();
  });

  it("says nothing of the contact while the page they are on is still to come", async () => {
    serveTab(Array.from({ length: 130 }, (_, i) => contact(i === 120 ? 2 : i + 1000)));
    renderPage("/accounts/a1?tab=contacts&contact=c2");
    await screen.findByText("Person2 Abel", undefined, { timeout: 4000 });
    expect(screen.queryByText(/That contact isn't/)).toBeNull();
  });
});

describe("AccountPage: a repeated row leaves a tab one row short", () => {
  // Catches: two raw pages adding up to the count while holding count - 1 distinct rows, so Show more never offers the missing row.
  it("asks the tab's pages again once, and every row is reachable afterwards", async () => {
    const all = Array.from({ length: 60 }, (_, i) => contact(i + 1000));
    // The second page, the first time it is read, repeats the last row of the first (a row shifted between the two reads); read again it is right.
    let shiftedOnce = true;
    client.listAccountTab.mockImplementation(async (_f: string, _a: string, _t: string, o?: { limit?: number; offset?: number }) => {
      if (shiftedOnce && o?.offset === 50) {
        shiftedOnce = false;
        return tabOf([all[49], ...all.slice(50, 59)], 60);
      }
      return pageOf(all, o);
    });
    const user = userEvent.setup();
    renderPage("/accounts/a1?tab=contacts");
    await user.click(await screen.findByRole("button", { name: "Show more" }, { timeout: 4000 }));
    expect(await screen.findByText("Person1059 Abel", undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getAllByText("Person1049 Abel")).toHaveLength(1);
    expect(screen.getAllByRole("row")).toHaveLength(1 + 60);
    // The first page, the shifted second, then both read again once: no more.
    expect(client.listAccountTab.mock.calls.map((c) => c[3].offset)).toEqual([0, 50, 0, 50]);
  });
});

describe("AccountPage: the tabs' own lists", () => {
  // Catches: "Show more" asking again from the first row with a longer limit, which the database refuses past 100: the rows on screen swapped for a failure.
  it("shows the Quotes tab's rows with their dates, and Show more adds the next fifty after the rows already there, past a hundred rows", async () => {
    const user = userEvent.setup();
    serveTab(Array.from({ length: 160 }, (_, i) => quote(i + 1, { quoteReceivedOn: "2026-11-03", quoteExpiresOn: "2026-12-05" })));
    renderPage("/accounts/a1?tab=quotes");
    expect(await screen.findByText("Showing 50 of 160.")).toBeInTheDocument();
    expect(screen.getAllByText("Dec 5, 2026").length).toBe(50);
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Showing 100 of 160.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Showing 150 of 160.")).toBeInTheDocument();
    expect(screen.getByText("PEO 150")).toBeInTheDocument();
    expect(screen.getByText("PEO 101")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("PEO 160")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(client.listAccountTab.mock.calls.map((c) => c[3])).toEqual([0, 50, 100, 150].map((offset) => ({ limit: 50, offset })));
  });

  it("pages the Files tab the same way", async () => {
    const user = userEvent.setup();
    serveFiles(Array.from({ length: 120 }, (_, i) => file(i + 1)));
    renderPage("/accounts/a1?tab=files");
    expect(await screen.findByText("Showing 50 of 120.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show more" }));
    await user.click(await screen.findByRole("button", { name: "Show more" }));
    expect(await screen.findByText("census-120.csv")).toBeInTheDocument();
    expect(client.listAccountFiles.mock.calls.map((c) => c[2])).toEqual([0, 50, 100].map((offset) => ({ limit: 50, offset })));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // Catches: a page that fails taking the rows already on screen with it.
  it("keeps the rows on screen when the next page fails, and says they may be out of date", async () => {
    const user = userEvent.setup();
    const all = Array.from({ length: 80 }, (_, i) => quote(i + 1));
    client.listAccountTab.mockImplementation(async (_f: string, _a: string, _t: string, o?: { limit?: number; offset?: number }) => {
      if (o?.offset === 50) throw new AccountError("failed", "Couldn't load the list. Try again.");
      return pageOf(all, o);
    });
    renderPage("/accounts/a1?tab=quotes");
    await user.click(await screen.findByRole("button", { name: "Show more" }, { timeout: 4000 }));
    expect(await screen.findByText(/We couldn't refresh the quotes/)).toBeInTheDocument();
    expect(screen.getByText("PEO 50")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // Catches: a kind filter with more than All and Changes (calls, notes and tasks come with CRM-E1.5), or one that hides the changes.
  it("filters the Activity tab by kind: All, Calls, Notes, Tasks and Changes, each asked of the database", async () => {
    const user = userEvent.setup();
    client.listAccountTab.mockResolvedValue(tabOf([change(1), change(2, { kind: "created", field: null, from: null, to: null, recordTable: "contacts", recordName: "Elena Marsh" })], 2));
    renderPage("/accounts/a1?tab=activity");
    expect(await screen.findByText("Employees changed from 40 to 45")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Show" });
    expect(within(group).getAllByRole("button").map((r) => r.textContent)).toEqual(["All", "Calls", "Notes", "Tasks", "Changes"]);
    expect(within(group).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Elena Marsh added as a contact")).toBeInTheDocument();
    await user.click(within(group).getByRole("button", { name: "Changes" }));
    // The filter is asked of the database and the list comes back whole (counts and pages are of what is shown).
    await screen.findByText("Employees changed from 40 to 45");
    const after = screen.getByRole("group", { name: "Show" });
    expect(within(after).getByRole("button", { name: "Changes" })).toHaveAttribute("aria-pressed", "true");
    expect(within(after).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("row")).toHaveLength(3);
    await waitFor(() => expect(client.listAccountTab).toHaveBeenLastCalledWith("f1", "a1", "activity", { limit: 50, offset: 0, filter: "changes" }));
  });
});

describe("AccountPage: where focus goes", () => {
  it("does not take focus back from Show more when more rows of the same contact's list load", async () => {
    const user = userEvent.setup();
    serveTab(Array.from({ length: 80 }, (_, i) => contact(i === 0 ? 2 : i + 1000)));
    renderPage("/accounts/a1?tab=contacts&contact=c2");
    await waitFor(() => expect(screen.getByRole("link", { name: "Person2 Abel" })).toHaveFocus(), { timeout: 4000 });
    const more = screen.getByRole("button", { name: "Show more" });
    await user.click(more);
    await screen.findByText("Person1079 Abel");
    expect(screen.getByRole("link", { name: "Person2 Abel" })).not.toHaveFocus();
  });

  it("puts focus on the tab's heading when See all opens it", async () => {
    const user = userEvent.setup();
    serveTab([opportunity(1), opportunity(2), opportunity(3)]);
    renderPage();
    const seeAll = await screen.findByRole("link", { name: "See all opportunities" });
    seeAll.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("heading", { name: /^Opportunities/ })).toHaveFocus());
  });

  it("leaves focus on the tab when a tab is chosen from the tab list", async () => {
    const user = userEvent.setup();
    serveTab([contact(1)]);
    renderPage();
    const tab = await screen.findByRole("tab", { name: /Contacts/ });
    await user.click(tab);
    await screen.findByRole("heading", { name: /^Contacts/ });
    expect(screen.getByRole("tab", { name: /Contacts/ })).toHaveFocus();
  });

  // Catches: Cancel leaving focus on the page's body once the form it was in has gone.
  it("puts focus on Edit when Cancel closes the form", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Edit/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Edit/ })).toHaveFocus());
  });

  // Catches: the edit form taking a phone, or states of operation, that the database refuses, now that the form that makes an account asks the same rules.
  it("asks the edit form's phone and states of operation the rules the New account form asks", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Edit/ }));
    const phone = screen.getByLabelText("Phone");
    await user.clear(phone);
    await user.type(phone, "call me");
    const states = screen.getByLabelText("States of operation");
    await user.clear(states);
    await user.type(states, "OR, XX");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a phone number like (503) 555-0142. An extension can follow, like x12.")).toBeInTheDocument();
    expect(screen.getByText("Use two-letter state codes from the list, like OR, WA.")).toBeInTheDocument();
  });

  // Catches: the edit form refusing to save another field because the phone it kept is not in the current format (the phone is judged only when it changes).
  it("saves another field of an account whose phone is in an older format, and still judges a phone that is changed", async () => {
    const user = userEvent.setup();
    client.getAccountPage.mockResolvedValue(page({ account: { ...account, phone: "call me" } }));
    client.updateAccount.mockResolvedValue({ conflict: false, account: { ...account, phone: "call me", industry: "Dentistry", version: 2 } });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Edit/ }));
    const industry = screen.getByLabelText("Industry");
    await user.clear(industry);
    await user.type(industry, "Dentistry");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateAccount).toHaveBeenCalledTimes(1));
    expect(client.updateAccount.mock.calls[0][2]).toMatchObject({ phone: "call me", industry: "Dentistry" });
    await user.click(await screen.findByRole("button", { name: /^Edit/ }));
    await user.type(screen.getByLabelText("Phone"), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a phone number like (503) 555-0142. An extension can follow, like x12.")).toBeInTheDocument();
    expect(client.updateAccount).toHaveBeenCalledTimes(1);
  });

  // Catches: the database's answer to a number out of range shown as the generic failure, not under Employees.
  it("puts the database's answer to a number out of range under Employees", async () => {
    const { AccountError } = await import("@/lib/accountPageApi");
    const user = userEvent.setup();
    client.updateAccount.mockRejectedValue(new AccountError("invalid", "Enter a number up to 2,147,483,647.", "22003"));
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Edit/ }));
    await user.type(screen.getByLabelText("Industry"), "s");
    await user.click(screen.getByRole("button", { name: "Save" }));
    const message = await screen.findByText("Enter a number up to 2,147,483,647.");
    expect(screen.getByLabelText("Employees")).toHaveAccessibleDescription(expect.stringContaining(message.textContent!));
  });

  // Catches: each arrow key in the tab list adding a history entry, so Back steps through every tab the arrows passed.
  it("replaces the address when a tab is chosen, so Back leaves the page and does not step through tabs", async () => {
    const user = userEvent.setup();
    serveTab([contact(1)]);
    const router = renderPage();
    await user.click(await screen.findByRole("tab", { name: /Contacts/ }));
    expect(router.state.location.search).toBe("?tab=contacts");
    expect(router.state.historyAction).toBe("REPLACE");
  });
});

describe("AccountPage: the Files tab", () => {
  beforeEach(() => {
    client.listAccountFiles.mockResolvedValue(tabOf([file(1), file(2)], 2));
    advisor.documentUrl.mockResolvedValue("https://storage.example/signed");
  });

  // Catches: a download built here and not by the one place that signs, a link kept or logged, a download that is not recorded.
  it("downloads each file through documentUrl, the app's one place that signs a link", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign }, configurable: true });
    renderPage("/accounts/a1?tab=files");
    expect(await screen.findByText("census-1.csv")).toBeInTheDocument();
    expect(client.listAccountFiles).toHaveBeenCalledWith("f1", "a1", { limit: 50, offset: 0 });
    expect(screen.getAllByText("Employee census")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Download census-2.csv" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://storage.example/signed"));
    expect(advisor.documentUrl).toHaveBeenCalledWith({ storage_path: "u1/i1/census-2.csv", file_name: "census-2.csv" });
    expect(advisor.recordActivity).toHaveBeenCalledWith("document_downloaded", "document", "d2");
  });

  // Catches: a download offered during a support session (ADR 0024).
  it("offers no download during a Nevermore support session, and says why", async () => {
    renderPage("/accounts/a1?tab=files", workspace({ isSupport: true, role: "Nevermore support" }));
    expect(await screen.findByText("census-1.csv")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Download" })).toBeNull();
    expect(screen.getByText("Downloads are off during Nevermore support.")).toBeInTheDocument();
  });

  it("says why a file did not open, in words", async () => {
    const user = userEvent.setup();
    advisor.documentUrl.mockRejectedValue(new Error("Couldn't open that file."));
    renderPage("/accounts/a1?tab=files");
    await user.click(await screen.findByRole("button", { name: "Download census-1.csv" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't open that file."));
    expect(advisor.recordActivity).not.toHaveBeenCalled();
  });
});

describe("AccountPage: the states", () => {
  // Catches: a loading state that shows nothing of the page's frame, or says nothing to a screen reader.
  it("shows the header, the tabs and each list's heading with grey rows while it loads, and says so once", async () => {
    client.getAccountPage.mockReturnValue(new Promise(() => {}));
    renderPage();
    await waitFor(() => expect(spoken().map((s) => s.textContent)).toEqual(["Loading account"]));
    for (const heading of ["Details", "Contacts", "Opportunities", "Quotes", "Recent activity"]) expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    for (const name of ["Overview", "Contacts", "Opportunities", "Quotes", "Activity", "Files"]) expect(screen.getByText(name, { selector: "li" })).toBeInTheDocument();
    expect(allStatuses().filter((e) => e.textContent).length).toBe(1);
    expectStatusesOutsideBusy();
  });

  // Catches: an empty list that is blank, or one that points at an action that does not exist yet. Add a contact exists since CRM-A2.2 (AccountContacts.test.tsx).
  it("says a new account's lists in one line each, with no action that does not exist yet", async () => {
    client.getAccountPage.mockResolvedValue(page({}, { contacts: tabOf([]), opportunities: tabOf([]), quotes: tabOf([]), files: tabOf([]), activity: tabOf([change(2, { kind: "created", field: null, from: null, to: null })], 1) }));
    renderPage();
    expect(await screen.findByText("No contacts yet.")).toBeInTheDocument();
    expect(screen.getByText("No opportunities yet.")).toBeInTheDocument();
    expect(screen.getByText("No quotes yet.")).toBeInTheDocument();
    for (const gone of [/New opportunity/, /New quote/]) {
      expect(screen.queryByRole("button", { name: gone })).toBeNull();
      expect(screen.queryByRole("link", { name: gone })).toBeNull();
    }
    expect(screen.queryByRole("link", { name: /See all (contacts|opportunities|quotes)/ })).toBeNull();
  });

  // Catches: the "No quotes" line said for a new account, or not said when opportunities exist and none was sent.
  it("says quotes appear when an opportunity is sent to a PEO, when opportunities exist and none was sent", async () => {
    client.getAccountPage.mockResolvedValue(page({}, { quotes: tabOf([]) }));
    renderPage();
    expect(await screen.findByText("No quotes yet. Quotes appear when an opportunity is sent to a PEO.")).toBeInTheDocument();
  });

  it("says the Files tab's line when there are no files", async () => {
    client.listAccountFiles.mockResolvedValue(tabOf([]));
    renderPage("/accounts/a1?tab=files");
    expect(await screen.findByText(/^No files yet\./)).toBeInTheDocument();
  });

  // Catches: a failed list that takes the page with it, shows the failure's own text, or has no way to try again.
  it("says a list failed on its own, with Try again, and the rest of the page stays", async () => {
    const user = userEvent.setup();
    client.listAccountTab.mockRejectedValueOnce(new AccountError("failed", "Couldn't load the list. Try again.")).mockResolvedValue(tabOf([contact(1)], 1));
    renderPage("/accounts/a1?tab=contacts");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load the contacts.");
    expect(alert).not.toHaveTextContent("Couldn't load the list. Try again.");
    expect(screen.getByRole("heading", { level: 1, name: "Harborview Dental Group" })).toBeInTheDocument();
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Elena Marsh")).toBeInTheDocument();
    expect(client.listAccountTab).toHaveBeenCalledTimes(2);
  });

  it("says the whole page failed, with Try again, when the account could not be read at all", async () => {
    const user = userEvent.setup();
    client.getAccountPage.mockRejectedValueOnce(new AccountError("failed", "Couldn't load the account. Try again.")).mockResolvedValue(page());
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load this account.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" })).toBeInTheDocument();
  });

  // Catches: no way from the account back to the list (screen 17's "Accounts / name"), or a link that goes elsewhere.
  it("shows 'Accounts / name' above the header, and 'Accounts' goes to the list", async () => {
    const user = userEvent.setup();
    renderPage();
    const crumbs = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(crumbs).toHaveTextContent("Accounts / Harborview Dental Group");
    expect(within(crumbs).getByRole("link", { name: "Accounts" })).toHaveAttribute("href", "/accounts");
    await user.click(within(crumbs).getByRole("link", { name: "Accounts" }));
    expect(screen.queryByRole("heading", { level: 1, name: "Harborview Dental Group" })).not.toBeInTheDocument();
  });

  // Catches: the breadcrumb under the archived note (screen 17 puts it first).
  it("puts the breadcrumb above the archived note", async () => {
    client.getAccountPage.mockResolvedValue(page({ account: { ...account, archivedAt: "2026-11-10T10:00:00+00:00" } }));
    renderPage();
    const crumbs = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(crumbs.compareDocumentPosition(screen.getByRole("note")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Catches: an account that isn't there leaving the person a link to the submissions, not the list it was opened from.
  it("offers the way back to all accounts when an account isn't available", async () => {
    client.getAccountPage.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole("link", { name: "Back to all accounts" })).toHaveAttribute("href", "/accounts");
  });

  // Catches: an account that is not there, or not the person's, saying which of the two it is.
  it("says an account that is not there or not theirs isn't available, the same for both", async () => {
    client.getAccountPage.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole("heading", { name: "This account isn't available." })).toBeInTheDocument();
  });

  it("says an address that is no account at all isn't available", async () => {
    client.getAccountPage.mockRejectedValue(new AccountError("failed", "Couldn't load the account. Try again.", "22P02"));
    renderPage("/accounts/not-an-id");
    expect(await screen.findByRole("heading", { name: "This account isn't available." })).toBeInTheDocument();
  });

  // Catches: an archived account that looks like any other, or a Restore that does not restore and reload the page (CRM-A1.1c).
  it("says an archived account is archived, with nothing to add, and Restore brings it back", async () => {
    const user = userEvent.setup();
    client.getAccountPage.mockResolvedValue(page({ account: { ...account, archivedAt: "2026-11-10T10:00:00+00:00" } }));
    actions.restoreAccount.mockResolvedValue({ changed: true });
    renderPage();
    const note = await screen.findByRole("note");
    expect(note).toHaveTextContent("This account is archived. Nothing can be added to it.");
    expect(screen.queryByRole("button", { name: /^Add/ })).toBeNull();
    client.getAccountPage.mockResolvedValue(page());
    await user.click(within(note).getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(actions.restoreAccount).toHaveBeenCalledWith("f1", "a1"));
    await waitFor(() => expect(screen.queryByRole("note")).toBeNull());
  });

  // Catches: Restore (and the actions menu) offered to someone the database will refuse (D-209).
  it("offers neither Restore nor the actions to someone who may not change the account", async () => {
    client.getAccountPage.mockResolvedValue(page({ canChange: false, account: { ...account, archivedAt: "2026-11-10T10:00:00+00:00" } }));
    renderPage();
    await screen.findByRole("note");
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
    expect(screen.queryByRole("button", { name: /More actions/ })).toBeNull();
  });

  // Catches: a deleted account's page left on screen, asking the database for an account that is gone.
  it("leaves for the Accounts list when the account is deleted", async () => {
    const user = userEvent.setup();
    actions.deleteAccount.mockResolvedValue({ name: "Harborview Dental Group" });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "More actions for this account" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/accounts"));
    expect(actions.deleteAccount).toHaveBeenCalledWith("f1", "a1");
  });

  // Catches: the account's open opportunities counted wrongly for the owner offer (one Lost, one open on the page: one is offered).
  it("offers the owner change with the open opportunities it holds", async () => {
    const user = userEvent.setup();
    client.getAccountPage.mockResolvedValue(page({}, { opportunities: tabOf([opportunity(1), opportunity(2, { stage: "lost" })], 2) }));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "More actions for this account" }));
    await user.click(screen.getByRole("menuitem", { name: "Change owner" }));
    expect(await screen.findByLabelText(/Also change the owner of its 1 open opportunity/)).toBeInTheDocument();
  });
});

describe("AccountPage: edit in place", () => {
  const edited = { ...account, employees: 52, version: 4 };
  const open = async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Edit/ }));
    return user;
  };

  // Catches: Edit offered to someone the database will refuse (D-209).
  it("offers Edit only when the database says the person may change the account", async () => {
    client.getAccountPage.mockResolvedValue(page({ canChange: false }));
    renderPage();
    await screen.findByRole("region", { name: "Details" });
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
  });

  // Catches: a save that sends the wrong version, drops a field, does not close the form or does not show the saved values.
  it("saves every field from the version the person started from and shows what was saved", async () => {
    // What the reload that follows a save reads is the saved account.
    client.updateAccount.mockImplementation(async () => {
      client.getAccountPage.mockResolvedValue(page({ account: { ...account, ...edited } }));
      return { conflict: false, account: edited };
    });
    const user = await (async () => { renderPage(); return open(); })();
    const employees = screen.getByLabelText("Employees");
    expect(employees).toHaveValue("45");
    await user.clear(employees);
    await user.type(employees, "52");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateAccount).toHaveBeenCalledTimes(1));
    expect(client.updateAccount).toHaveBeenCalledWith("f1", "a1", {
      name: "Harborview Dental Group", tradeName: "Harborview Dental", website: "harborviewdental.example", phone: "(503) 555-0140", street: "410 SW Alder St",
      city: "Portland", state: "OR", postalCode: "97204", industry: "Dental practice", employees: 52, statesOfOperation: ["OR", "WA"], currentProvider: "Payroll vendor",
    }, 3);
    expect(toast.success).toHaveBeenCalledWith("Account saved");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save" })).toBeNull());
    const details = screen.getByRole("region", { name: "Details" });
    expect(within(details).getByText("Employees").nextElementSibling).toHaveTextContent("52");
    expect(screen.getByRole("button", { name: /^Edit/ })).toHaveFocus();
    expect(screen.getByText(/52 employees/)).toBeInTheDocument();
  });

  it("sends a blank as a blank and the states of operation as capital letters, each once", async () => {
    client.updateAccount.mockResolvedValue({ conflict: false, account: edited });
    renderPage();
    const user = await open();
    await user.clear(screen.getByLabelText("Trade name"));
    await user.clear(screen.getByLabelText("Employees"));
    const states = screen.getByLabelText("States of operation");
    await user.clear(states);
    await user.type(states, "wa, or WA");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateAccount).toHaveBeenCalled());
    expect(client.updateAccount.mock.calls[0][2]).toMatchObject({ tradeName: "", employees: null, statesOfOperation: ["WA", "OR"] });
  });

  // Catches: a required name saved empty, "Required" not said in words, a number that is not one sent anyway.
  it("says what is wrong in words and sends nothing", async () => {
    renderPage();
    const user = await open();
    expect(screen.getByLabelText("Account name")).toHaveAccessibleDescription(/Required/);
    await user.clear(screen.getByLabelText("Account name"));
    await user.clear(screen.getByLabelText("Employees"));
    await user.type(screen.getByLabelText("Employees"), "lots");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter the account's name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a whole number, like 45.")).toBeInTheDocument();
    expect(client.updateAccount).not.toHaveBeenCalled();
  });

  // Catches: a refusal shown in our words and not the database's, a form that closes over a refusal, a lost edit.
  it("shows a refusal in the database's words and keeps what was typed", async () => {
    client.updateAccount.mockRejectedValue(new AccountError("notAllowed", "Only the account's owner, a lead of the owner's team or an owner of the firm can change it", "42501"));
    renderPage();
    const user = await open();
    await user.type(screen.getByLabelText("Industry"), " group");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only the account's owner, a lead of the owner's team or an owner of the firm can change it");
    expect(screen.getByLabelText("Industry")).toHaveValue("Dental practice group");
  });

  it("says what the database says of a closing firm", async () => {
    client.updateAccount.mockRejectedValue(new AccountError("readOnly", "This firm is closing, so nothing can be changed.", "PT423"));
    renderPage();
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This firm is closing, so nothing can be changed.");
  });

  const conflict: AccountConflict = {
    conflict: true, currentVersion: 5,
    current: { name: "Harborview Dental Group", tradeName: "Harborview Dental", website: "harborviewdental.example", phone: "(503) 555-0199", street: "410 SW Alder St", city: "Portland", state: "OR",
      postalCode: "97204", industry: "Dental practice", employees: 60, statesOfOperation: ["OR"], currentProvider: "Payroll vendor" },
    changed: [{ field: "employees", value: 60, who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" }, { field: "states_of_operation", value: ["OR"], who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" }],
  };

  // Catches: a conflict that overwrites, or one that shows the fields by their column names, or without who changed them.
  it("sets what was typed beside what is there now when someone saved first, and saves nothing", async () => {
    client.updateAccount.mockResolvedValueOnce(conflict);
    renderPage();
    const user = await open();
    await user.clear(screen.getByLabelText("Employees"));
    await user.type(screen.getByLabelText("Employees"), "52");
    await user.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Someone else changed this account")).toBeInTheDocument();
    const rows = within(dialog).getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(rows[0]).toContain("Employees5260bob@example.com");
    // The person never touched this field, so the dialog says so rather than showing the form's value as theirs (CRM-S2.4a fixes, D-183).
    expect(rows[1]).toContain("States of operationYou didn't change thisORbob@example.com");
    expect(client.updateAccount).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  // Catches: archiving or an owner change (both change the version) shown to someone saving at that moment by their column names and an id.
  it("words an archive and an owner change in a conflict as Archived and Owner, with a date and a name", async () => {
    listFirmMembers.mockResolvedValue([{ value: "u2", label: "Marcus Hale" }]);
    client.updateAccount.mockResolvedValueOnce({
      ...conflict,
      changed: [
        { field: "archived_at", value: "2026-11-14T10:00:00+00:00", who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" },
        { field: "owner_id", value: "u2", who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" },
      ],
    });
    renderPage();
    const user = await open();
    await waitFor(() => expect(listFirmMembers).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("alertdialog");
    const rows = within(dialog).getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(rows[0]).toContain("ArchivedYou didn't change thisNov 14, 2026");
    expect(rows[1]).toContain("OwnerYou didn't change thisMarcus Hale");
    expect(dialog.textContent).not.toMatch(/archived_at|owner_id|u2/);
  });

  // Catches: Keep mine saving again from the old version (refused again), or Keep theirs leaving the old version behind.
  it("saves again from the version that holds their change with Keep mine", async () => {
    client.updateAccount.mockResolvedValueOnce(conflict).mockResolvedValueOnce({ conflict: false, account: { ...edited, version: 6 } });
    renderPage();
    const user = await open();
    await user.clear(screen.getByLabelText("Employees"));
    await user.type(screen.getByLabelText("Employees"), "52");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Keep mine" }));
    await waitFor(() => expect(client.updateAccount).toHaveBeenCalledTimes(2));
    expect(client.updateAccount.mock.calls[1][3]).toBe(5);
    expect(client.updateAccount.mock.calls[1][2]).toMatchObject({ employees: 52 });
  });

  it("puts their values in the form with Keep theirs, and the next save starts from their version", async () => {
    client.updateAccount.mockResolvedValueOnce(conflict).mockResolvedValueOnce({ conflict: false, account: { ...edited, version: 6 } });
    renderPage();
    const user = await open();
    await user.clear(screen.getByLabelText("Employees"));
    await user.type(screen.getByLabelText("Employees"), "52");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Keep theirs" }));
    await waitFor(() => expect(screen.getByLabelText("Employees")).toHaveValue("60"));
    expect(screen.getByLabelText("States of operation")).toHaveValue("OR");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateAccount).toHaveBeenCalledTimes(2));
    expect(client.updateAccount.mock.calls[1][3]).toBe(5);
  });

  // Catches: a save that names the version a refresh brought under the open form, a version the person never saw: someone else's change would be overwritten.
  it("sends the version the person started from when a refresh brought a newer one under the open form", async () => {
    client.updateAccount.mockResolvedValue({ conflict: true, currentVersion: 4, current: { ...conflict.current, employees: 52 }, changed: [{ field: "employees", value: 52, who: "bob@example.com", at: "2026-11-14T10:00:00+00:00" }] });
    renderPage();
    const user = await open();
    client.getAccountPage.mockResolvedValue(page({ account: { ...account, employees: 52, version: 4 } }));
    act(() => { document.dispatchEvent(new Event("visibilitychange", { bubbles: true })); });
    await waitFor(() => expect(client.getAccountPage.mock.calls.length).toBeGreaterThan(1));
    await user.type(screen.getByLabelText("Industry"), "s");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.updateAccount).toHaveBeenCalled());
    expect(client.updateAccount.mock.calls[0][3]).toBe(3);
    expect(client.updateAccount.mock.calls[0][2]).toMatchObject({ employees: 45 });
  });

  it("closes without saving on Cancel when nothing changed", async () => {
    renderPage();
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(client.updateAccount).not.toHaveBeenCalled();
  });

  it("asks the account again after a save, so its history shows the change", async () => {
    client.updateAccount.mockResolvedValue({ conflict: false, account: edited });
    renderPage();
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.getAccountPage.mock.calls.length).toBeGreaterThan(1));
  });
});

describe("AccountPage: waiting for the firm", () => {
  it("asks nothing until the workspace names the firm", async () => {
    renderPage("/accounts/a1", workspace({ firm: null }));
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(client.getAccountPage).not.toHaveBeenCalled();
    expect(spoken().map((s) => s.textContent)).toEqual(["Loading account"]);
  });
});
