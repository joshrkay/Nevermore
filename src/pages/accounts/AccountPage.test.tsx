import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { AccountConflict, AccountPage as Page } from "@/lib/accountPageApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";
import { allStatuses, expectStatusesOutsideBusy, spoken } from "@/test/loading";

// An account's page through a faked client (story CRM-A2.1b): what a person sees and does. The database's own rules (who may see an account, who may change
// it, what the files are) are tested in supabase/tests/account_page.sql; here the client answers and the page draws it.

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "dana@example.com" }, signOut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { getAccountPage: vi.fn(), listAccountTab: vi.fn(), listAccountFiles: vi.fn(), updateAccount: vi.fn(), getSubmissionAccount: vi.fn() };
vi.mock("@/lib/accountPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountPageApi")), ...client }));
const advisor = { documentUrl: vi.fn(), recordActivity: vi.fn() };
vi.mock("@/lib/advisorApi", () => advisor);

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
  for (const fn of [...Object.values(client), ...Object.values(advisor), signOut]) fn.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  client.getAccountPage.mockResolvedValue(page());
});

describe("AccountPage: the header and the tabs", () => {
  // Catches: a header that leaves out a fact the screen shows, or shows buttons that belong to later stories (D-186, no dead buttons).
  it("shows the name, status, industry, location, employees, website and owner, and no button that does nothing", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Harborview Dental Group" })).toBeInTheDocument();
    expect(screen.getByText("Prospect")).toBeInTheDocument();
    expect(screen.getByText("Dental practice · Portland, OR · 45 employees · harborviewdental.example · Owner Dana Reyes")).toBeInTheDocument();
    for (const gone of ["Email", "New opportunity", "Log a call", "Add a task", "Add a contact", "Restore"]) {
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

  // Catches: a contact's name that opens nothing, or the Contacts tab with the contact somewhere out of view (a contact's own page is CRM-C1.1's).
  it("opens the Contacts tab with that contact in view, until a contact has a page of its own", async () => {
    const user = userEvent.setup();
    client.listAccountTab.mockResolvedValue(tabOf([contact(1), contact(2)], 2));
    const router = renderPage();
    await user.click(await within(await screen.findByRole("region", { name: /Contacts/ })).findByRole("link", { name: "Person2 Abel" }));
    expect(router.state.location.search).toBe("?tab=contacts&contact=c2");
    const row = (await screen.findByRole("cell", { name: "Person2 Abel" })).closest("tr") as HTMLElement;
    expect(row).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("cell", { name: /Elena Marsh/ }).closest("tr")).not.toHaveAttribute("aria-current");
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
  it("filters the Activity tab by kind: today All and Changes", async () => {
    const user = userEvent.setup();
    client.listAccountTab.mockResolvedValue(tabOf([change(1), change(2, { kind: "created", field: null, from: null, to: null, recordTable: "contacts", recordName: "Elena Marsh" })], 2));
    renderPage("/accounts/a1?tab=activity");
    expect(await screen.findByText("Employees changed from 40 to 45")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Show" });
    expect(within(group).getAllByRole("button").map((r) => r.textContent)).toEqual(["All", "Changes"]);
    expect(within(group).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Elena Marsh added as a contact")).toBeInTheDocument();
    await user.click(within(group).getByRole("button", { name: "Changes" }));
    expect(within(group).getByRole("button", { name: "Changes" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Employees changed from 40 to 45")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
});

describe("AccountPage: where focus goes", () => {
  // Catches: Enter on a link that opens another view leaving focus on the page's body.
  it("puts focus on the contact's name when a contact's name opens the Contacts tab", async () => {
    const user = userEvent.setup();
    serveTab([contact(1), contact(2)]);
    renderPage();
    const link = await within(await screen.findByRole("region", { name: /Contacts/ })).findByRole("link", { name: "Person2 Abel" });
    link.focus();
    await user.keyboard("{Enter}");
    const named = await screen.findByRole("link", { name: "Person2 Abel" });
    await waitFor(() => expect(named.closest("tr")).toHaveAttribute("aria-current", "true"));
    await waitFor(() => expect(screen.getByRole("link", { name: "Person2 Abel" })).toHaveFocus());
  });

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

  // Catches: an empty list that is blank, or one that points at an action that does not exist yet.
  it("says a new account's lists in one line each, with no action that does not exist yet", async () => {
    client.getAccountPage.mockResolvedValue(page({}, { contacts: tabOf([]), opportunities: tabOf([]), quotes: tabOf([]), files: tabOf([]), activity: tabOf([change(2, { kind: "created", field: null, from: null, to: null })], 1) }));
    renderPage();
    expect(await screen.findByText("No contacts yet.")).toBeInTheDocument();
    expect(screen.getByText("No opportunities yet.")).toBeInTheDocument();
    expect(screen.getByText("No quotes yet.")).toBeInTheDocument();
    for (const gone of [/Add a contact/, /New opportunity/, /New quote/]) {
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

  // Catches: an archived account that looks like any other, or that offers a Restore that does nothing yet (CRM-A1.1c).
  it("says an archived account is archived, with nothing to add and no Restore yet", async () => {
    client.getAccountPage.mockResolvedValue(page({ account: { ...account, archivedAt: "2026-11-10T10:00:00+00:00" } }));
    renderPage();
    const note = await screen.findByRole("note");
    expect(note).toHaveTextContent("This account is archived. Nothing can be added to it.");
    expect(screen.queryByRole("button", { name: /Restore/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Add/ })).toBeNull();
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
    expect(rows[1]).toContain("States of operationOR, WAORbob@example.com");
    expect(client.updateAccount).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
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
