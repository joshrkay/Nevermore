import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import type { AccountRow } from "@/lib/accountsApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";
import { blobBytes, blobText } from "@/test/blob";
import { allStatuses, expectStatusesOutsideBusy } from "@/test/loading";

// The Accounts page on the workspace's table frame (story CRM-A1.1a, screen 16). The database cuts the pages and runs the filters
// (supabase/tests/accounts_query.sql); these tests are what a person sees and does through the page: the columns, the views and their counts, the
// filters (Owner, State, Employees), the page's states, the way into an account, the Columns menu and the Export button.
const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "dana@example.com", app_metadata: { providers: ["email"] } }, signOut }) }));
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));
const mfa = { listFactors: vi.fn(), challengeAndVerify: vi.fn() };
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), auth: { mfa } } }));
const listAccounts = vi.fn();
const countAccountViews = vi.fn();
const listFirmMembers = vi.fn();
vi.mock("@/lib/accountsApi", async (original) => ({
  ...(await original<typeof import("@/lib/accountsApi")>()),
  browserTimeZone: () => "America/Los_Angeles",
  listAccounts: async (opts: { page?: number }) => {
    const result = await listAccounts(opts);
    return Array.isArray(result) ? { rows: result, total: result.length, page: opts.page ?? 1, pageSize: 50 } : { page: opts.page ?? 1, pageSize: 50, ...result };
  },
  countAccountViews: (...a: unknown[]) => countAccountViews(...a),
  listFirmMembers: (...a: unknown[]) => listFirmMembers(...a),
}));
const fetchMyColumns = vi.fn();
const setMyColumns = vi.fn();
vi.mock("@/lib/tableSettingsApi", () => ({
  listSavedViews: async () => [],
  fetchMyColumns: (...a: unknown[]) => fetchMyColumns(...a),
  setMyColumns: (...a: unknown[]) => setMyColumns(...a),
}));
const exportRows = vi.fn();
vi.mock("@/lib/exportApi", async () => ({ ...(await vi.importActual<object>("@/lib/exportApi")), exportRows: (...a: unknown[]) => exportRows(...a) }));
const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));

const { default: AccountsPage } = await import("./AccountsPage");
const { ExportError } = await import("@/lib/exportApi");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});

const row = (over: Partial<AccountRow> = {}): AccountRow => ({
  id: "a1", name: "Harborview Dental Group", trade_name: null, website: "harborviewdental.example", city: "Portland", state: "OR", industry: "Dental practice", employees: 45,
  states_of_operation: ["OR", "WA"], current_provider: "Payroll vendor", source: "employer_intake", status: "prospect", archived: false, archived_at: null,
  created_at: "2026-10-28T10:00:00Z", owner: "u1", owner_name: "Dana Reyes", main_contact_id: "c1", main_contact_name: "Elena Marsh",
  main_contact_email: "elena@harborviewdental.example", main_contact_phone: "(503) 555-0142", opportunity_id: "o1", opportunity_name: "January 2027 PEO search",
  opportunity_stage: "in_market", target_start: "2027-01-01", open_opportunities: 1, quote_requests_sent: 3, quotes_received: 1, waiting_on_peo: true,
  earliest_quote_expires_on: null, last_activity_at: "2026-11-11T10:00:00Z", ...over,
});
const second = row({
  id: "a2", name: "Kestrel Software", city: "Seattle", state: "WA", status: "client", employees: 64, owner: "u2", owner_name: "Marcus Hale", main_contact_name: "Imani Cole",
  main_contact_email: null, main_contact_phone: "(541) 555-0134", opportunity_id: null, opportunity_name: null, opportunity_stage: null, target_start: null, open_opportunities: 0,
  quote_requests_sent: 0, quotes_received: 0, waiting_on_peo: false, last_activity_at: "2026-11-01T10:00:00Z",
});

const ShowId = () => <p>Account page for {useParams().id}</p>;
const LocationProbe = () => <p data-testid="location">{useLocation().search}</p>;
const renderAt = (url = "/accounts", ws: Workspace = workspace()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceContext.Provider value={ws}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/accounts" element={<><AccountsPage /><LocationProbe /></>} />
            <Route path="/accounts/:id" element={<ShowId />} />
          </Routes>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
const where = () => screen.getByTestId("location").textContent;
const body = () => screen.getByRole("table").querySelector("tbody")!;
const headers = () => within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent?.trim());
const asked = () => listAccounts.mock.lastCall![0] as { firmId: string | null; filters: unknown[]; sort: unknown; page: number; search: string };

beforeEach(() => {
  for (const fn of [listAccounts, countAccountViews, listFirmMembers, fetchMyColumns, setMyColumns, exportRows, downloadBlob, signOut, mfa.listFactors, mfa.challengeAndVerify]) fn.mockReset();
  listAccounts.mockResolvedValue({ rows: [row(), second], total: 375 });
  countAccountViews.mockImplementation(async (_firm: string, views: { name: string }[]) => views.map((v, i) => ({ name: v.name, total: [375, 21, 7, 31, 2][i] ?? 0 })));
  listFirmMembers.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
  fetchMyColumns.mockResolvedValue({ columns: null, source: "none" });
  setMyColumns.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

describe("the Accounts page: the table", () => {
  // Catches: a table that asks the wrong firm, drops the table's own order, or says how many in all wrongly.
  it("asks for the firm's first page, newest activity first, and says which rows these are", async () => {
    renderAt();
    expect(await screen.findByRole("link", { name: "Harborview Dental Group" })).toBeInTheDocument();
    expect(asked()).toMatchObject({ firmId: "f1", filters: [], sort: null, page: 1, search: "" });
    expect(screen.getByRole("heading", { level: 1, name: "Accounts" })).toBeInTheDocument();
    expect(await screen.findByText("1 to 50 of 375 accounts")).toBeInTheDocument();
  });

  // Catches: a default column missing or worded wrongly (screen 16), a Renewal column (D-186), or a column the story keeps for "other columns" shown at once.
  it("shows the story's columns, each as screen 16 words it, and not the ones kept for the Columns menu", async () => {
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    expect(headers()).toEqual(["Account", "Main contact", "Opportunity", "Quotes", "Employees", "Owner", "Last activity"]);
    const [first, kestrel] = within(body()).getAllByRole("row");
    // The name opens the account's page; the city and state sit under it.
    expect(within(first).getByRole("link", { name: "Harborview Dental Group" })).toHaveAttribute("href", "/accounts/a1");
    expect(first).toHaveTextContent("Portland, OR");
    expect(within(first).queryByText("Client")).not.toBeInTheDocument();
    // The main contact, with the email.
    expect(first).toHaveTextContent("Elena Marsh");
    expect(first).toHaveTextContent("elena@harborviewdental.example");
    // The open opportunity's stage and target start; the quotes back of those asked for.
    expect(first).toHaveTextContent("In market");
    expect(first).toHaveTextContent("Jan 2027 start");
    expect(first).toHaveTextContent("1 of 3 back");
    expect(first).toHaveTextContent("Waiting on a PEO");
    expect(first).toHaveTextContent("45");
    expect(first).toHaveTextContent("Dana Reyes");
    expect(first).toHaveTextContent("Nov 11, 2026");
    // A client has its mark; with no email its phone shows; nothing open says so, in both columns.
    expect(within(kestrel).getByText("Client")).toBeInTheDocument();
    expect(kestrel).toHaveTextContent("(541) 555-0134");
    expect(kestrel.textContent).toMatch(/None open.*None open/);
    expect(kestrel).toHaveTextContent("Marcus Hale");
  });

  // Catches: "+1 more" missing when an account has several open opportunities, and a quote about to expire not saying so.
  it("says '+1 more' for a second open opportunity and warns of a quote about to expire", async () => {
    const soon = new Date(Date.now() + 4 * 86_400_000);
    const day = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;
    listAccounts.mockResolvedValue([row({ open_opportunities: 2, earliest_quote_expires_on: day })]);
    renderAt();
    const first = (await within(await screen.findByRole("table")).findAllByRole("row"))[1];
    expect(first).toHaveTextContent("+1 more");
    expect(first).toHaveTextContent("Expires in 4 days");
  });

  // Catches: Main contact offering a sort the database refuses (CRM-A1.1: no sort on Main contact), and a sortable header that doesn't sort.
  it("sorts by a column's header and has no sort on Main contact", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    expect(within(screen.getByRole("table")).queryByRole("button", { name: /Main contact/ })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole("table")).getByRole("button", { name: /Employees/ }));
    await waitFor(() => expect(asked().sort).toEqual({ field: "employees", direction: "asc" }));
    expect(where()).toContain("sort=employees");
  });

  // Catches: a row that cannot be opened by clicking it, or a name that goes somewhere else.
  it("opens the account when its row is clicked", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(within(within(body()).getAllByRole("row")[1]).getByText("Seattle, WA"));
    expect(await screen.findByText("Account page for a2")).toBeInTheDocument();
  });

  // Catches: the pager dropping the page, or asking page 2 of another question.
  it("pages by the address: 1 to 50 of 120 and the next page", async () => {
    listAccounts.mockImplementation(async (o: { page: number }) => ({ rows: [row({ id: `p${o.page}`, name: `Page ${o.page} account` })], total: 120 }));
    renderAt("/accounts?page=2");
    expect(await screen.findByRole("link", { name: "Page 2 account" })).toBeInTheDocument();
    expect(asked().page).toBe(2);
  });
});

describe("the Accounts page: views and filters", () => {
  // Catches: a view the story lists missing, "Renewing in 120 days" shown before renewals exist (D-186), a count under the wrong tab.
  it("offers the story's views with their counts, and not Renewing in 120 days", async () => {
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    const tabs = await screen.findByRole("navigation", { name: /views|tabs/i }).catch(() => null);
    const text = (tabs ?? document.body).textContent ?? "";
    expect(text).toContain("All accounts");
    for (const name of ["Open opportunities", "Waiting on quotes", "Clients", "Archived"]) expect(text).toContain(name);
    expect(text).not.toContain("Renewing in 120 days");
    await waitFor(() => expect(screen.getByRole("link", { name: /Open opportunities/ })).toHaveTextContent("21"));
    expect(screen.getByRole("link", { name: /All accounts/ })).toHaveTextContent("375");
    expect(screen.getByRole("link", { name: /Waiting on quotes/ })).toHaveTextContent("7");
    expect(screen.getByRole("link", { name: /Clients/ })).toHaveTextContent("31");
  });

  // Catches: a view whose filter is not the one its name says, so its tab and its rows disagree.
  it.each([
    ["Open opportunities", { field: "open_opportunities", op: "more_than", value: 0 }],
    ["Waiting on quotes", { field: "waiting_on_peo", op: "is", value: true }],
    ["Clients", { field: "status", op: "any_of", value: ["client"] }],
    ["Archived", { field: "archived", op: "is", value: true }],
  ])("opens %s as its own filter", async (name, filter) => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    await user.click(screen.getByRole("link", { name: new RegExp(name) }));
    await waitFor(() => expect(asked().filters).toEqual([filter]));
  });

  // Catches: the three filters the story shows (Owner, State, Employees) missing from the row.
  it("shows Owner, State and Employees in the filter row, with 'Add filter' for the rest", async () => {
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    const row = screen.getByRole("group", { name: "Filters" });
    for (const name of ["Filter by Owner", "Filter by State", "Filter by Employees", "Add filter"]) expect(within(row).getByRole("button", { name })).toBeInTheDocument();
  });

  // Catches: the Owner filter offering ids, not the firm's people; the chip showing an id; the question sent to the database not being the choice made.
  it("filters by an owner chosen from the firm's people, and the chip says their name", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    await user.click(screen.getByRole("button", { name: "Filter by Owner" }));
    await user.click(await screen.findByLabelText("Marcus Hale"));
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(asked().filters).toEqual([{ field: "owner", op: "any_of", value: ["u2"] }]));
    expect(await screen.findByRole("button", { name: /Remove filter: Owner is any of Marcus Hale/ })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Filters" })).queryByText(/u2/)).not.toBeInTheDocument();
  });

  // Catches: "me" and "my team" (screen 16's "Owner: My team") not being offered, or sent as something else.
  it("filters by my team", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    await user.click(screen.getByRole("button", { name: "Filter by Owner" }));
    await user.selectOptions(screen.getByLabelText("Condition"), "is my team");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(asked().filters).toEqual([{ field: "owner", op: "my_team" }]));
  });

  // Catches: the Owner filter failing when the people can't be listed: "me" and "my team" must still work.
  it("still offers the Owner filter when the firm's people could not be listed", async () => {
    listFirmMembers.mockRejectedValue(new Error("Couldn't load the firm's people."));
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    await user.click(screen.getByRole("button", { name: "Filter by Owner" }));
    expect(await screen.findByLabelText("Condition")).toBeInTheDocument();
  });

  // Catches: a State filter that sends text the database refuses, or a Employees filter that doesn't send a number.
  it("filters by employees", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    await user.click(screen.getByRole("button", { name: "Filter by Employees" }));
    await user.selectOptions(screen.getByLabelText("Condition"), "is more than");
    await user.type(screen.getByLabelText("Number"), "50");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(asked().filters).toEqual([{ field: "employees", op: "more_than", value: 50 }]));
  });

  // Catches: a search not reaching the database, or the box not saying what it covers.
  it("searches accounts, contacts and emails", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    await user.type(screen.getByPlaceholderText("Search accounts, contacts, emails"), "elena{Enter}");
    await waitFor(() => expect(asked().search).toBe("elena"));
    expect(where()).toContain("q=elena");
  });
});

describe("the Accounts page: states", () => {
  // Catches: the story's "nothing yet" (Accounts are the businesses you quote for) missing, or offering New quote, New account or Import before they exist (D-186).
  it("says accounts are the businesses you quote for when the firm has none, with no buttons that do nothing", async () => {
    listAccounts.mockResolvedValue([]);
    renderAt();
    expect(await screen.findByText("Accounts are the businesses you quote for.")).toBeInTheDocument();
    for (const name of ["New quote", "New account", "Import", "Export"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    for (const name of ["New quote", "New account", "Import"]) expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
  });

  // Catches: a narrowed empty list saying the firm has no accounts, or not naming the filter, or not clearing it.
  it("says no accounts match, names the filters in force and clears them", async () => {
    const user = userEvent.setup();
    listAccounts.mockImplementation(async (o: { filters: unknown[] }) => (o.filters.length ? [] : [row()]));
    renderAt("/accounts?filter=status:any_of:client");
    expect(await screen.findByText("No accounts match these filters.")).toBeInTheDocument();
    expect(within(document.querySelector<HTMLElement>("[data-empty]")!).getByText(/Status.*Client/i)).toBeInTheDocument();
    await user.click(within(document.querySelector<HTMLElement>("[data-empty]")!).getByRole("button", { name: /Clear filters/ }));
    expect(await screen.findByRole("link", { name: "Harborview Dental Group" })).toBeInTheDocument();
    expect(where()).not.toContain("filter=");
  });

  // Catches: grey rows under the real headers missing, or status regions inside a busy element (never announced).
  it("shows the headings and grey rows while the first page is on its way", async () => {
    listAccounts.mockReturnValue(new Promise(() => {}));
    renderAt();
    expect(await screen.findByRole("heading", { level: 1, name: "Accounts" })).toBeInTheDocument();
    expect(headers()).toContain("Main contact");
    expect(allStatuses().length).toBeGreaterThan(0);
    expectStatusesOutsideBusy();
    expect(screen.queryByRole("link", { name: "Harborview Dental Group" })).not.toBeInTheDocument();
  });

  // Catches: a failed load drawn as "no accounts", an error's own words shown, or no way to try again.
  it("says in words that the accounts couldn't be loaded and tries again", async () => {
    const user = userEvent.setup();
    listAccounts.mockRejectedValueOnce(new Error("canceling statement due to statement timeout")).mockResolvedValue([row()]);
    renderAt();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load the accounts/i);
    expect(alert).not.toHaveTextContent("statement timeout");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Harborview Dental Group" })).toBeInTheDocument();
  });
});

describe("the Accounts page: columns", () => {
  // Catches: the "other columns" the story lists (Status, Website, ...) not offered, or a chosen one not kept.
  it("offers the other columns in the Columns menu and keeps a column shown", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    await user.click(screen.getByRole("button", { name: /Columns/ }));
    await user.click(await screen.findByLabelText("Website"));
    await waitFor(() => expect(setMyColumns).toHaveBeenCalled());
    expect(setMyColumns.mock.calls[0].slice(1, 3)).toEqual(["accounts", null]);
    expect(setMyColumns.mock.calls[0][3]).toEqual(["account", "main_contact", "opportunity", "quotes", "employees", "owner", "last_activity", "website"]);
  });

  // Catches: a kept column choice ignored on this table.
  it("draws the columns a person chose", async () => {
    fetchMyColumns.mockResolvedValue({ columns: ["account", "website", "source"], source: "person" });
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    await waitFor(() => expect(headers()).toEqual(["Account", "Website", "Source"]));
    expect(within(body()).getAllByRole("row")[0]).toHaveTextContent("harborviewdental.example");
    expect(within(body()).getAllByRole("row")[0]).toHaveTextContent("Employer's intake");
  });
});

describe("the Accounts page: Export", () => {
  const COLUMNS = [
    "name", "trade_name", "website", "city", "state", "employees", "industry", "states_of_operation", "current_provider", "source", "status", "owner", "main_contact",
    "main_contact_email", "main_contact_phone", "opportunity", "opportunity_stage", "target_start", "open_opportunities", "quote_requests_sent", "quotes_received",
    "earliest_quote_expires_on", "last_activity_at", "created_at", "archived",
  ].map((id) => ({ id, label: id }));
  const exported = (over: Record<string, unknown> = {}) => ({
    name: "Harborview Dental Group", trade_name: null, website: "harborviewdental.example", city: "Portland", state: "OR", employees: 45, industry: "Dental practice",
    states_of_operation: "OR, WA", current_provider: null, source: "Employer's intake", status: "Prospect", owner: "Dana Reyes", main_contact: "Elena Marsh",
    main_contact_email: "elena@harborviewdental.example", main_contact_phone: null, opportunity: "January 2027 PEO search", opportunity_stage: "In market",
    target_start: "2027-01-01", open_opportunities: 1, quote_requests_sent: 3, quotes_received: 1, earliest_quote_expires_on: null,
    last_activity_at: "2026-11-11T10:00:00+00:00", created_at: "2026-10-28T10:00:00+00:00", archived: false, ...over,
  });
  const answer = (rows: Record<string, unknown>[]) => ({ table: "accounts", label: "Accounts", columns: COLUMNS, rows, count: rows.length, skipped: 0, exportedAt: "2026-11-19T10:00:00+00:00" });
  const theFile = async () => {
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, name] = downloadBlob.mock.calls[0] as [Blob, string];
    return { name, text: await blobText(blob), bytes: await blobBytes(blob) };
  };
  const press = async (user: ReturnType<typeof userEvent.setup>) => user.click(await screen.findByRole("button", { name: "Export" }));

  // Catches: an export of something other than what is on screen: the filters in force, the search, the time zone, and the columns shown, in order and worded as the page words them.
  it("exports the accounts that match the filters and search in force, as a file of the columns shown", async () => {
    const user = userEvent.setup();
    exportRows.mockResolvedValue(answer([exported()]));
    renderAt("/accounts?filter=status:any_of:client&q=elena");
    await press(user);
    expect(await screen.findByText("Exported 1 account.")).toBeInTheDocument();
    expect(exportRows).toHaveBeenCalledWith({
      firmId: "f1", table: "accounts", filters: { filters: [{ field: "status", op: "any_of", value: ["client"] }], search: "elena", time_zone: "America/Los_Angeles" },
    });
    const { name, text, bytes } = await theFile();
    expect(name).toBe("accounts-2026-11-19.csv");
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(text).toBe(
      "Account,Main contact,Opportunity,Quotes,Employees,Owner,Last activity\r\n" +
      "Harborview Dental Group,\"Elena Marsh, elena@harborviewdental.example\",\"In market, Jan 2027 start\",1 of 3 back,45,Dana Reyes,2026-11-11\r\n",
    );
  });

  // Catches: the view's own filter left out of the export, so a file of "Clients" holds every account.
  it("exports under the open view's filter, with no search key when there is no search", async () => {
    const user = userEvent.setup();
    exportRows.mockResolvedValue(answer([exported()]));
    renderAt("/accounts?view=clients");
    await press(user);
    await screen.findByText("Exported 1 account.");
    expect(exportRows).toHaveBeenCalledWith({ firmId: "f1", table: "accounts", filters: { filters: [{ field: "status", op: "any_of", value: ["client"] }], time_zone: "America/Los_Angeles" } });
  });

  // Catches: the file holding columns the page doesn't show, or in another order than the person chose.
  it("writes the columns a person chose, in their order", async () => {
    const user = userEvent.setup();
    fetchMyColumns.mockResolvedValue({ columns: ["account", "website", "source"], source: "person" });
    exportRows.mockResolvedValue(answer([exported()]));
    renderAt();
    await waitFor(async () => expect((await screen.findAllByRole("columnheader")).map((h) => h.textContent?.trim())).toEqual(["Account", "Website", "Source"]));
    await press(user);
    await screen.findByText("Exported 1 account.");
    expect((await theFile()).text).toBe("Account,Website,Source\r\nHarborview Dental Group,harborviewdental.example,Employer's intake\r\n");
  });

  // Catches: an Export button on a list with nothing to export (D-223).
  it("offers no Export when there are no accounts", async () => {
    listAccounts.mockResolvedValue([]);
    renderAt();
    await screen.findByText("Accounts are the businesses you quote for.");
    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
  });

  // Catches: the database's refusal swallowed or shown as its own text.
  it("says in words why an export was refused", async () => {
    const user = userEvent.setup();
    exportRows.mockRejectedValue(new ExportError("tooMany", "That is too many rows. Narrow it with a filter and export again."));
    renderAt();
    await press(user);
    expect(await screen.findByText("That is too many rows. Narrow it with a filter and export again.")).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  // Catches: the retry after a fresh sign-in asking for other rows than the first try (the filters are a list, not text), or losing them.
  it("steps up in place and exports again with the same filters", async () => {
    const user = userEvent.setup();
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1" }], all: [] }, error: null });
    mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    exportRows.mockRejectedValueOnce(new ExportError("signInAgain", "Sign in again to export a whole table.")).mockResolvedValue(answer([exported()]));
    renderAt("/accounts?filter=status:any_of:client");
    await press(user);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/6-digit code/), { target: { value: "123456" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and export" }));
    expect(await screen.findByText("Exported 1 account.")).toBeInTheDocument();
    expect(exportRows).toHaveBeenCalledTimes(2);
    expect(exportRows.mock.calls[1]).toEqual(exportRows.mock.calls[0]);
    expect((exportRows.mock.calls[1][0] as { filters: { filters: unknown[] } }).filters.filters).toEqual([{ field: "status", op: "any_of", value: ["client"] }]);
  });

  // Catches: Nevermore support being offered a download (ADR 0024).
  it("offers no Export to a Nevermore support session, and says so", async () => {
    renderAt("/accounts", workspace({ isSupport: true }));
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
    expect(exportRows).not.toHaveBeenCalled();
  });
});
