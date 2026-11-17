import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { QuoteRow } from "@/lib/quotesApi";
import { blobText } from "@/test/blob";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// The Quotes page on the workspace's table frame (story CRM-Q4.1, slice 5.11, screen 2). The database cuts the pages and runs the filters
// (supabase/tests/quotes_query.sql); these tests are what a person sees and does: the columns, the links, the views and their counts, the states.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com", app_metadata: { providers: ["email"] } }, signOut: vi.fn() }) }));
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), auth: { mfa: { listFactors: vi.fn() } } } }));
const listQuotes = vi.fn();
const countQuoteViews = vi.fn();
vi.mock("@/lib/quotesApi", async (original) => ({
  ...(await original<typeof import("@/lib/quotesApi")>()),
  listQuotes: async (opts: { page?: number }) => ({ page: opts.page ?? 1, pageSize: 50, ...(await listQuotes(opts)) }),
  countQuoteViews: (...a: unknown[]) => countQuoteViews(...a),
}));
const listFirmMembers = vi.fn();
vi.mock("@/lib/accountsApi", async (original) => ({
  ...(await original<typeof import("@/lib/accountsApi")>()),
  browserTimeZone: () => "America/Los_Angeles",
  listFirmMembers: (...a: unknown[]) => listFirmMembers(...a),
}));
const saveView = vi.fn();
vi.mock("@/lib/tableSettingsApi", () => ({
  listSavedViews: async () => [],
  saveView: (...a: unknown[]) => saveView(...a),
  fetchMyColumns: async () => ({ columns: null, source: "none" }),
  setMyColumns: vi.fn(),
}));

const exportRows = vi.fn();
vi.mock("@/lib/exportApi", async () => ({ ...(await vi.importActual<object>("@/lib/exportApi")), exportRows: (...a: unknown[]) => exportRows(...a) }));
const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));

const applyQuotesBulk = vi.fn();
vi.mock("@/lib/quotesBulkApi", async (original) => ({ ...(await original<typeof import("@/lib/quotesBulkApi")>()), applyQuotesBulk: (...a: unknown[]) => applyQuotesBulk(...a) }));

const { default: QuotesPage } = await import("./QuotesPage");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});

const row = (over: Partial<QuoteRow> = {}): QuoteRow => ({
  key: "q5", quote_request_id: 5, opportunity_id: "o1", account_id: "a1", account_name: "Reyes Bakery", opportunity_name: "PEO search 2026", target_start: "2027-01-01",
  peo: "TriNet", status: "quoted", sent_on: "2026-11-01", sent_version: 1, admin_fee_pepm: 32.5, expires_on: "2026-12-01", proposed_start: null, file_id: "EAA-2026-0001",
  owner: "u1", owner_name: "Dana Reyes", new_mail: false, emails: 2, last_message_at: "2026-11-10T10:00:00Z", ...over,
});

const renderAt = (url = "/quotes", ws: Workspace = workspace()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceContext.Provider value={ws}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/quotes" element={<QuotesPage />} />
          </Routes>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
const headers = () => within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent?.trim()).filter((h) => h && h !== "Actions");

beforeEach(() => {
  for (const fn of [saveView, listQuotes, countQuoteViews, listFirmMembers, exportRows, downloadBlob, applyQuotesBulk]) fn.mockReset();
  listQuotes.mockResolvedValue({ rows: [row()], total: 1 });
  countQuoteViews.mockImplementation(async (_f: string, views: { name: string }[]) => views.map((v, i) => ({ name: v.name, total: [12, 1, 4, 5, 3, 2][i] ?? 0 })));
  saveView.mockResolvedValue("v1");
  listFirmMembers.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
});
afterEach(() => cleanup());

describe("the Quotes page (CRM-Q4.1)", () => {
  // Catches: the wrong firm asked, the table's own order ("needs me first", no sort at all) dropped, or a default column missing.
  it("asks for the firm's first page in the table's own order and shows the story's columns", async () => {
    renderAt();
    expect(await screen.findByText("Reyes Bakery")).toBeInTheDocument();
    expect(listQuotes.mock.lastCall![0]).toMatchObject({ firmId: "f1", filters: [], sort: null, page: 1, search: "" });
    expect(screen.getByRole("heading", { level: 1, name: "Quotes" })).toBeInTheDocument();
    expect(headers()).toEqual(["Account", "PEO", "Status", "Sent", "Admin fee PEPM", "Expires", "Owner"]);
    const cells = within(screen.getByRole("table")).getByText("Reyes Bakery").closest("tr")!;
    expect(within(cells).getByText("Quoted")).toBeInTheDocument();
    expect(within(cells).getByText("$32.50")).toBeInTheDocument();
  });

  // Catches: a view the story names left out, or a tab that counts the wrong question. Waiting on a PEO is 5.1's open statuses (sent, acknowledged, question open: the
  // menu's count, the glossary's "open"); Open is everything not finished, those and the New quotes not sent yet and the quotes that are back.
  it("offers the story's views, each with its count", async () => {
    renderAt();
    await screen.findByText("Reyes Bakery");
    for (const name of ["Open", "Not sent yet", "Waiting on a PEO", "Quoted", "Declined", "Closed"]) expect(await screen.findByRole("link", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    const asked = countQuoteViews.mock.lastCall![1] as { name: string; filters: unknown[] }[];
    expect(asked.find((v) => v.name === "open")?.filters).toEqual([{ field: "status", op: "any_of", value: ["not_sent", "sent", "acknowledged", "question_open", "quoted"] }]);
    expect(asked.find((v) => v.name === "waiting")?.filters).toEqual([{ field: "status", op: "any_of", value: ["sent", "acknowledged", "question_open"] }]);
  });

  // Catches: an empty firm told nothing matches, or no way to start the first quote.
  it("says what the table is for when the firm has no quotes, and offers New quote", async () => {
    listQuotes.mockResolvedValue({ rows: [], total: 0 });
    renderAt();
    expect(await screen.findByText("Your quotes will be listed here")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New quote" })).toHaveAttribute("href", "/new-quote");
  });

  // Catches: a narrowed table that finds nothing said as an empty firm.
  it("says no quotes match the filters when a view finds none", async () => {
    listQuotes.mockResolvedValue({ rows: [], total: 0 });
    renderAt("/quotes?view=declined");
    expect(await screen.findByText(/No quotes match/)).toBeInTheDocument();
    expect(screen.queryByText("Your quotes will be listed here")).not.toBeInTheDocument();
  });

  // Catches: a failed load drawn as an empty firm.
  it("says the quotes could not be loaded, with Try again, when the call fails", async () => {
    listQuotes.mockRejectedValue(new Error("boom"));
    renderAt();
    expect(await screen.findByText("We couldn't load the quotes.")).toBeInTheDocument();
    expect(screen.queryByText("Your quotes will be listed here")).not.toBeInTheDocument();
  });

  // Catches: Nevermore support offered a way to start a quote (it can only look, ADR 0024).
  it("offers Nevermore support no New quote", async () => {
    listQuotes.mockResolvedValue({ rows: [], total: 0 });
    renderAt("/quotes", workspace({ isSupport: true }));
    expect(await screen.findByText("Your quotes will be listed here")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New quote" })).not.toBeInTheDocument();
  });

  // Catches: the PEO that leads nowhere now that a quote has its own page (slice 5.9, /quotes/:quoteRequestId).
  it("opens the quote's page from the PEO", async () => {
    renderAt();
    expect(await screen.findByRole("link", { name: "TriNet" })).toHaveAttribute("href", "/quotes/5");
  });

  // Catches: the account that leads nowhere, or to the account when the story says the opportunity.
  it("opens the opportunity from the account", async () => {
    renderAt();
    expect(await screen.findByRole("link", { name: "Reyes Bakery" })).toHaveAttribute("href", "/opportunities/o1");
  });

  // Catches: a New quote left half done read as a code ("not_sent"), or given a PEO link that opens nothing (D-1702: no quote request yet).
  it("reads a New quote left half done as Not sent yet, with no PEO to open", async () => {
    listQuotes.mockResolvedValue({ rows: [row({ key: "o2", quote_request_id: null, opportunity_id: "o2", account_name: "Kim Dental", peo: null, status: "not_sent", sent_on: null, admin_fee_pepm: null, expires_on: null, file_id: null })], total: 1 });
    renderAt();
    const cells = (await screen.findByText("Kim Dental")).closest("tr")!;
    expect(within(cells).getByText("Not sent yet")).toBeInTheDocument();
    expect(within(cells).queryAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/opportunities/o2"]);
  });

  // Catches: an expired quote that reads like a live one (D-1705: its expiry moves nothing, but it says Expired), or a live one that says it.
  it("says Expired on a quote past its expiry, and only on one", async () => {
    listQuotes.mockResolvedValue({ rows: [
      row({ key: "q1", quote_request_id: 1, account_name: "Old Co", expires_on: "2020-01-01" }),
      row({ key: "q2", quote_request_id: 2, account_name: "Fresh Co", expires_on: "2999-01-01" }),
      row({ key: "q3", quote_request_id: 3, account_name: "Sent Co", status: "sent", expires_on: "2020-01-01" }),
    ], total: 3 });
    renderAt();
    const old = (await screen.findByText("Old Co")).closest("tr")!;
    expect(within(old).getByText("Expired")).toBeInTheDocument();
    expect(within(screen.getByText("Fresh Co").closest("tr")!).queryByText("Expired")).not.toBeInTheDocument();
    expect(within(screen.getByText("Sent Co").closest("tr")!).queryByText("Expired")).not.toBeInTheDocument();
  });

  // Catches: the old queue unreachable once Quotes in the menu opens this page (D-1707: it stays until it is retired).
  it("links to the old queue as Submissions", async () => {
    renderAt();
    await screen.findByText("Reyes Bakery");
    expect(screen.getByRole("link", { name: "Submissions" })).toHaveAttribute("href", "/advisor");
  });

  // Catches: a search box that does not reach the database's search (every word in the account, the PEO or the File ID).
  it("searches accounts, PEOs and File IDs", async () => {
    renderAt();
    await screen.findByText("Reyes Bakery");
    await userEvent.type(screen.getByPlaceholderText("Search accounts, PEOs, File IDs"), "trinet{Enter}");
    await vi.waitFor(() => expect(listQuotes.mock.lastCall![0]).toMatchObject({ search: "trinet" }));
  });

  // Catches: no way to narrow the table by who owns a quote or where it stands, the filters a broker reaches for daily.
  it("shows Owner and Status in the filter row, with 'Add filter' for the rest", async () => {
    renderAt();
    await screen.findByText("Reyes Bakery");
    for (const name of ["Filter by Owner", "Filter by Status", "Add filter"]) expect(await screen.findByRole("button", { name })).toBeInTheDocument();
  });

  // Catches: a Status filter that offers no statuses, or one that offers a code ("not_sent", "question_open") in place of its words.
  it("offers each status, in words, to the Status filter", async () => {
    renderAt();
    await screen.findByText("Reyes Bakery");
    await userEvent.click(await screen.findByRole("button", { name: "Filter by Status" }));
    // Within the Status filter: "Sent" is also a column's heading (D-1833 made a sent quote read Sent).
    const statusFilter = await screen.findByRole("dialog", { name: "Filter on Status" });
    for (const name of ["Not sent yet", "Sent", "Acknowledged", "Question open", "Quoted", "Declined", "Closed"]) expect(within(statusFilter).getByText(name, { selector: "label, [role=option], [role=menuitemcheckbox], span" })).toBeInTheDocument();
  });

  // Catches: the columns the table has beyond the usual seven unreachable, so a broker can't see a quote's File ID or its target start.
  it("offers the other columns under Columns", async () => {
    renderAt();
    await screen.findByText("Reyes Bakery");
    await userEvent.click(screen.getByRole("button", { name: "Columns" }));
    const menu = await screen.findByLabelText("Columns", { selector: "[role=dialog]" });
    for (const name of ["Opportunity", "Version sent", "Proposed start", "Target start", "File ID", "Days waiting", "Emails"]) expect(within(menu).getByLabelText(name)).not.toBeChecked();
    expect(within(menu).getByLabelText("PEO")).toBeChecked();
  });

  // Catches: an export of something other than what is on screen: the filters in force, the search, the time zone, and the columns shown, worded as the page words them.
  it("exports the quotes that match the view and search in force, as a file of the columns shown", async () => {
    const columns = ["account", "opportunity", "peo", "status", "sent_on", "sent_version", "admin_fee_pepm", "expires_on", "proposed_start", "target_start", "emails", "new_mail", "last_message_at", "file_id", "owner"].map((id) => ({ id, label: id }));
    const exported = { account: "Reyes Bakery", opportunity: "PEO search 2026", peo: "TriNet", status: "Quoted", sent_on: "2026-11-01", sent_version: 1, admin_fee_pepm: 32.5, expires_on: "2026-12-01",
      proposed_start: null, target_start: "2027-01-01", emails: 2, new_mail: false, last_message_at: null, file_id: "EAA-2026-0001", owner: "Dana Reyes" };
    exportRows.mockResolvedValue({ table: "quotes", label: "Quotes", columns, rows: [exported], count: 1, skipped: 0, exportedAt: "2026-11-19T10:00:00+00:00" });
    renderAt("/quotes?view=quoted&q=trinet");
    await userEvent.click(await screen.findByRole("button", { name: "Export" }));
    expect(await screen.findByText("Exported 1 quote.")).toBeInTheDocument();
    expect(exportRows).toHaveBeenCalledWith({
      firmId: "f1", table: "quotes", filters: { filters: [{ field: "status", op: "any_of", value: ["quoted"] }], search: "trinet", time_zone: "America/Los_Angeles" },
    });
    const [blob, name] = downloadBlob.mock.calls[0] as [Blob, string];
    expect(name).toBe("quotes-2026-11-19.csv");
    expect(await blobText(blob)).toBe("Account,PEO,Status,Sent,Admin fee PEPM,Expires,Owner\r\nReyes Bakery,TriNet,Quoted,2026-11-01,32.5,2026-12-01,Dana Reyes\r\n");
  });

  // Catches: the story's bulk actions missing from the bar, or one it rules out offered (a quote's status, figures and dates are never bulk-edited).
  it("offers Change owner, Close and Export once rows are selected, and no edit of a status, figure or date", async () => {
    renderAt();
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Reyes Bakery, TriNet" }));
    const bar = screen.getByRole("region", { name: "Selected rows" });
    expect(within(bar).getAllByRole("button").map((b) => b.textContent)).toEqual(["Change owner", "Close", "Export", "Clear"]);
  });

  // Catches: the owner chosen but never sent, the rows sent as something other than their keys, or a result the person is never told (D-1704: the opportunity's owner is what changes).
  it("changes the owner of the selected quotes' opportunities and says what it did", async () => {
    applyQuotesBulk.mockResolvedValue({ selected: 1, requested: 1, unavailable: 0, changed: 1, unchanged: 0, skipped: [] });
    renderAt();
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Reyes Bakery, TriNet" }));
    await userEvent.click(within(screen.getByRole("region", { name: "Selected rows" })).getByRole("button", { name: "Change owner" }));
    const dialog = await screen.findByRole("dialog", { name: "Change owner: 1 quote" });
    await userEvent.selectOptions(await within(dialog).findByLabelText("New owner"), "u2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Change owner" }));
    expect(applyQuotesBulk).toHaveBeenCalledWith("f1", { action: "owner", ownerId: "u2" }, { ids: ["q5"] });
    expect(await screen.findByText("Gave 1 opportunity to Marcus Hale.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Catches: Close sent without its one reason, or the reason sent in words instead of the database's code, or a result that says nothing of what was closed.
  it("closes the selected quotes with one reason and says what it did", async () => {
    applyQuotesBulk.mockResolvedValue({ selected: 1, requested: 1, unavailable: 0, changed: 1, unchanged: 0, skipped: [] });
    renderAt();
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Reyes Bakery, TriNet" }));
    await userEvent.click(within(screen.getByRole("region", { name: "Selected rows" })).getByRole("button", { name: "Close" }));
    const dialog = await screen.findByRole("dialog", { name: "Close: 1 quote" });
    expect(within(dialog).getByRole("button", { name: "Close quotes" })).toBeDisabled();
    await userEvent.selectOptions(within(dialog).getByLabelText("Why they close"), "peo_not_a_fit");
    await userEvent.click(within(dialog).getByRole("button", { name: "Close quotes" }));
    expect(applyQuotesBulk).toHaveBeenCalledWith("f1", { action: "close", reason: "peo_not_a_fit" }, { ids: ["q5"] });
    expect(await screen.findByText("Closed 1 quote request.")).toBeInTheDocument();
  });

  // Catches: rows the person may not change skipped without a word (the level rule, a won or lost opportunity, an archived account), or keys that were no row said nowhere.
  it("names every quote that was skipped, with the database's reason, and those that were no row to see", async () => {
    applyQuotesBulk.mockResolvedValue({
      selected: 2, requested: 3, unavailable: 1, changed: 1, unchanged: 0,
      skipped: [{ key: "o9", name: "Kim Dental", code: "finished", reason: "This opportunity is won or lost, so it is finished." }],
    });
    renderAt();
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Reyes Bakery, TriNet" }));
    await userEvent.click(within(screen.getByRole("region", { name: "Selected rows" })).getByRole("button", { name: "Close" }));
    const dialog = await screen.findByRole("dialog", { name: "Close: 1 quote" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Why they close"), "other");
    await userEvent.click(within(dialog).getByRole("button", { name: "Close quotes" }));
    const result = await screen.findByRole("region", { name: "What the change did" });
    expect(within(result).getByText("Kim Dental: This opportunity is won or lost, so it is finished.")).toBeInTheDocument();
    expect(within(result).getByText("1 quote you can no longer see was left out.")).toBeInTheDocument();
  });

  // Catches (CRM-S3.6): "Select all N that match" sent as the page's keys, so the change misses every quote on the other pages.
  it("sends the table's filters, not keys, for all that match", async () => {
    listQuotes.mockResolvedValue({ rows: [row()], total: 120 });
    applyQuotesBulk.mockResolvedValue({ selected: 120, requested: 120, unavailable: 0, changed: 120, unchanged: 0, skipped: [] });
    renderAt("/quotes?q=reyes");
    await screen.findByText("Reyes Bakery");
    await userEvent.click(screen.getByRole("checkbox", { name: /Select all|select the page/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Select all 120 that match" }));
    await userEvent.click(within(screen.getByRole("region", { name: "Selected rows" })).getByRole("button", { name: "Close" }));
    const dialog = await screen.findByRole("dialog", { name: "Close: 120 quotes" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Why they close"), "other");
    await userEvent.click(within(dialog).getByRole("button", { name: "Close quotes" }));
    expect(applyQuotesBulk.mock.lastCall![2]).toEqual({ filters: { filters: [], search: "reyes", time_zone: "America/Los_Angeles" } });
  });

  // Catches (ADR 0024): Nevermore support offered a change of anything; it keeps Export's line and Clear.
  it("offers Nevermore support none of the changes", async () => {
    renderAt("/quotes", workspace({ isSupport: true }));
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Reyes Bakery, TriNet" }));
    const bar = screen.getByRole("region", { name: "Selected rows" });
    for (const name of ["Change owner", "Close"]) expect(within(bar).queryByRole("button", { name })).toBeNull();
    expect(within(bar).getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  // Catches: no way to ask again for the quotes without leaving the page (new mail and answers arrive while it is open).
  it("asks the database again when Refresh is pressed", async () => {
    renderAt();
    await screen.findByText("Reyes Bakery");
    const before = listQuotes.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await vi.waitFor(() => expect(listQuotes.mock.calls.length).toBeGreaterThan(before));
  });

  // Catches: a view saved from the default layout keeping no columns (it would then show whatever the person has later, not what they saw).
  it("saves a view from the default layout with the seven columns on screen", async () => {
    renderAt();
    await screen.findByText("Reyes Bakery");
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Save this as a view" })).not.toHaveAttribute("aria-disabled"));
    await userEvent.click(screen.getByRole("button", { name: "Save this as a view" }));
    await userEvent.type(await screen.findByLabelText("Name"), "My view");
    await userEvent.click(screen.getByRole("button", { name: "Save view" }));
    await vi.waitFor(() => expect(saveView).toHaveBeenCalled());
    expect(saveView.mock.calls[0][0]).toMatchObject({ table: "quotes", name: "My view", columns: ["account", "peo", "status", "sent", "admin_fee", "expires", "owner"] });
  });
});
