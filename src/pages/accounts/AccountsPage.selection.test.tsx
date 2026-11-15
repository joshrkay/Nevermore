import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import type { AccountRow } from "@/lib/accountsApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";
// Selecting rows on the Accounts page (story CRM-S3.6, screens 35 and 36): the checkboxes, the page, "Select all N that match" and the bar.
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
const saveView = vi.fn();
vi.mock("@/lib/tableSettingsApi", () => ({
  listSavedViews: async () => [],
  saveView: (...a: unknown[]) => saveView(...a),
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
            <Route path="/accounts" element={<><AccountsPage /><LocationProbe /><Link to="/accounts?filter=status:any_of:prospect">Other filter</Link></>} />
            <Route path="/accounts/:id" element={<ShowId />} />
          </Routes>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
const where = () => screen.getByTestId("location").textContent;
const body = () => screen.getByRole("table").querySelector("tbody")!;
const headers = () => within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent?.trim()).filter(Boolean);
const asked = () => listAccounts.mock.lastCall![0] as { firmId: string | null; filters: unknown[]; sort: unknown; page: number; search: string };

beforeEach(() => {
  for (const fn of [saveView, listAccounts, countAccountViews, listFirmMembers, fetchMyColumns, setMyColumns, exportRows, downloadBlob, signOut, mfa.listFactors, mfa.challengeAndVerify]) fn.mockReset();
  listAccounts.mockResolvedValue({ rows: [row(), second], total: 375 });
  countAccountViews.mockImplementation(async (_firm: string, views: { name: string }[]) => views.map((v, i) => ({ name: v.name, total: [375, 21, 7, 31, 2][i] ?? 0 })));
  listFirmMembers.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
  fetchMyColumns.mockResolvedValue({ columns: null, source: "none" });
  setMyColumns.mockResolvedValue(undefined);
  saveView.mockResolvedValue("v1");
});
afterEach(() => cleanup());

const third = row({ id: "a3", name: "Northline Logistics", owner: "u2", owner_name: "Marcus Hale" });
const check = (name: string) => screen.getByRole("checkbox", { name });
const pageBox = () => screen.getByRole("checkbox", { name: "Select all accounts on this page" });
const bar = () => screen.queryByRole("region", { name: "Selected rows" });

beforeEach(() => {
  listAccounts.mockResolvedValue({ rows: [row(), second, third], total: 375 });
});

describe("selecting rows on the Accounts page", () => {
  // Catches: a checkbox a screen reader cannot tell from the next one (each must carry its row's name), or no checkbox for the page.
  it("gives each row a checkbox named for the account, and the header one for the page", async () => {
    renderAt();
    await screen.findByRole("link", { name: "Harborview Dental Group" });
    for (const name of ["Harborview Dental Group", "Kestrel Software", "Northline Logistics"]) expect(check(`Select ${name}`)).not.toBeChecked();
    expect(pageBox()).not.toBeChecked();
    expect(bar()).toBeNull();
  });

  // Catches: the bar absent with a row selected, a wrong count, a button that does nothing (only Export and Clear work today, D-24), or Clear leaving the selection.
  it("shows the bar with the count, Export and Clear once a row is selected, and Clear empties it", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(check("Select Kestrel Software"));
    const selected = within(bar()!);
    expect(selected.getByText("1 selected")).toBeInTheDocument();
    expect(selected.getAllByRole("button").map((b) => b.textContent)).toEqual(["Export", "Clear"]);
    // The bar replaces the toolbar: no search box while rows are selected.
    expect(screen.queryByPlaceholderText("Search accounts, contacts, emails")).toBeNull();
    await user.click(selected.getByRole("button", { name: "Clear" }));
    expect(bar()).toBeNull();
    expect(check("Select Kestrel Software")).not.toBeChecked();
    expect(screen.getByPlaceholderText("Search accounts, contacts, emails")).toBeInTheDocument();
  });

  // Catches: the header checkbox selecting nothing or more than the page, or not showing a part-selected page.
  it("selects the page from the header, shows a part-selected page, and leaves the page out again", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(check("Select Kestrel Software"));
    expect((pageBox() as HTMLInputElement).indeterminate).toBe(true);
    await user.click(pageBox());
    expect(pageBox()).toBeChecked();
    expect(within(bar()!).getByText("3 selected")).toBeInTheDocument();
    await user.click(pageBox());
    expect(bar()).toBeNull();
  });

  // Catches: the offer missing when the page is selected, offered while it is not, or offered when the page holds every match.
  it("offers 'Select all 375 that match' only once the whole page is selected", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Kestrel Software" });
    expect(screen.queryByRole("button", { name: "Select all 375 that match" })).toBeNull();
    await user.click(check("Select Kestrel Software"));
    expect(screen.queryByRole("button", { name: "Select all 375 that match" })).toBeNull();
    await user.click(pageBox());
    expect(screen.getByText(/All 3 on this page are selected/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select all 375 that match" })).toBeInTheDocument();
  });

  it("does not offer it when every match is on the page", async () => {
    const user = userEvent.setup();
    listAccounts.mockResolvedValue({ rows: [row(), second, third], total: 3 });
    renderAt();
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(pageBox());
    expect(screen.queryByRole("button", { name: /Select all \d+ that match/ })).toBeNull();
  });

  // Catches: "all" exported as the ids on the page (or any list of ids), instead of the filters in force; and a count that is not the total.
  it("exports every match as the filters in force, with no ids, and a chosen few as their ids", async () => {
    const user = userEvent.setup();
    exportRows.mockResolvedValue({ table: "accounts", label: "Accounts", columns: [{ id: "name", label: "name" }], rows: [], count: 0, skipped: 0, exportedAt: "2026-11-19T10:00:00+00:00" });
    renderAt("/accounts?filter=status:any_of:client");
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(check("Select Kestrel Software"));
    await user.click(within(bar()!).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(exportRows).toHaveBeenCalledTimes(1));
    expect(exportRows).toHaveBeenLastCalledWith({ firmId: "f1", table: "accounts", filters: { time_zone: "America/Los_Angeles" }, ids: ["a2"] });
    await user.click(pageBox());
    await user.click(pageBox());
    await user.click(pageBox());
    await user.click(screen.getByRole("button", { name: "Select all 375 that match" }));
    expect(within(bar()!).getByText("All 375 accounts selected")).toBeInTheDocument();
    await user.click(within(bar()!).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(exportRows).toHaveBeenCalledTimes(2));
    const call = exportRows.mock.lastCall![0] as { filters: unknown; ids?: unknown };
    expect(call.ids).toBeUndefined();
    expect(call.filters).toEqual({ filters: [{ field: "status", op: "any_of", value: ["client"] }], time_zone: "America/Los_Angeles" });
  });

  // Catches: unchecking one row of "all" leaving all selected (it would export the row), or losing the rest.
  it("leaves 'all' when a row is unchecked, keeping the rest of the page selected", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(pageBox());
    await user.click(screen.getByRole("button", { name: "Select all 375 that match" }));
    expect(check("Select Kestrel Software")).toBeChecked();
    await user.click(check("Select Kestrel Software"));
    expect(within(bar()!).getByText("2 selected")).toBeInTheDocument();
    expect(check("Select Northline Logistics")).toBeChecked();
  });

  // Catches: sorting or the page's own refresh dropping the selection.
  it("keeps the selection through sorting and a refresh", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(check("Select Kestrel Software"));
    await user.click(screen.getByRole("button", { name: /^Employees/ }));
    await waitFor(() => expect(asked().sort).toMatchObject({ field: "employees" }));
    expect(check("Select Kestrel Software")).toBeChecked();
    expect(within(bar()!).getByText("1 selected")).toBeInTheDocument();
  });

  // Catches: the table's own 60-second refresh dropping the selection (D-144, D-184), or the rows coming back unticked.
  it("keeps the selection through the table's 60-second refresh", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderAt();
      await screen.findByRole("link", { name: "Kestrel Software" });
      await user.click(check("Select Kestrel Software"));
      const asks = listAccounts.mock.calls.length;
      await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
      await waitFor(() => expect(listAccounts.mock.calls.length).toBeGreaterThan(asks));
      expect(check("Select Kestrel Software")).toBeChecked();
      expect(within(bar()!).getByText("1 selected")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // Catches: Clear removing the focused button and dropping focus to the page.
  it("puts focus on the header's checkbox after Clear", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(check("Select Kestrel Software"));
    await user.click(within(bar()!).getByRole("button", { name: "Clear" }));
    expect(pageBox()).toHaveFocus();
  });

  // Catches: "Select all N that match" removing the focused button and dropping focus to the page.
  it("puts focus on 'Clear selection' after 'Select all 375 that match', and on the header's checkbox after that", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(pageBox());
    await user.click(screen.getByRole("button", { name: "Select all 375 that match" }));
    expect(screen.getByRole("button", { name: "Clear selection" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(pageBox()).toHaveFocus();
  });

  // Catches: a status region that arrives with its words (often not announced): it must be on the page before anything is selected.
  it("keeps one status region on the page, empty until rows are selected", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Kestrel Software" });
    const status = screen.getAllByRole("status").find((e) => e.classList.contains("sr-only") && !e.textContent && !e.querySelector("button"))!;
    expect(status).toBeDefined();
    await user.click(check("Select Kestrel Software"));
    expect(status).toHaveTextContent("1 selected");
  });

  // Catches: a selection that outlives the question it was made for (rows no longer on screen would be changed by a later bulk action).
  it("clears the selection when the view changes", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(check("Select Kestrel Software"));
    await user.click(screen.getByRole("link", { name: /^Clients/ }));
    await waitFor(() => expect(bar()).toBeNull());
    expect(check("Select Kestrel Software")).not.toBeChecked();
  });

  // Catches: clearing that only works across a remount: the filter is changed inside the app, with the page mounted.
  it("clears the selection when the filters change, with the page mounted", async () => {
    const user = userEvent.setup();
    renderAt("/accounts?filter=status:any_of:client");
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(check("Select Kestrel Software"));
    expect(bar()).not.toBeNull();
    // The filter row gives way to the bar while rows are selected, so the filter changes as Back or a link changes it: in the address.
    await user.click(screen.getByRole("link", { name: "Other filter" }));
    await waitFor(() => expect(where()).toContain("prospect"));
    await waitFor(() => expect(bar()).toBeNull());
    expect(check("Select Kestrel Software")).not.toBeChecked();
  });

  // Catches: Export offered in the bar to Nevermore support, who can look and not take (ADR 0024).
  it("offers Nevermore support no Export in the bar", async () => {
    const user = userEvent.setup();
    renderAt("/accounts", workspace({ isSupport: true, role: "Nevermore support" }));
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(check("Select Kestrel Software"));
    expect(within(bar()!).queryByRole("button", { name: "Export" })).toBeNull();
    expect(within(bar()!).getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  // Catches: a dimmed row of the previous question being ticked while the new answer is on its way, so an account that never matched is exported by its id.
  it("does not let a row left from the previous filter be selected until the new answer arrives", async () => {
    const user = userEvent.setup();
    renderAt("/accounts?filter=status:any_of:client");
    await screen.findByRole("link", { name: "Kestrel Software" });
    let answer!: (r: unknown) => void;
    listAccounts.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    await user.click(screen.getByRole("link", { name: "Other filter" }));
    await waitFor(() => expect(where()).toContain("prospect"));
    // The old rows are still on screen, dimmed: ticking one selects nothing.
    expect(check("Select Kestrel Software")).toHaveAttribute("aria-disabled", "true");
    await user.click(check("Select Kestrel Software"));
    expect(bar()).toBeNull();
    expect(check("Select Kestrel Software")).not.toBeChecked();
    await user.click(pageBox());
    expect(bar()).toBeNull();
    // The answer arrives: its rows can be selected, and an export holds only them.
    exportRows.mockResolvedValue({ table: "accounts", label: "Accounts", columns: [{ id: "name", label: "name" }], rows: [], count: 0, skipped: 0, exportedAt: "2026-11-19T10:00:00+00:00" });
    await act(async () => { answer({ rows: [third], total: 1, page: 1, pageSize: 50 }); });
    await user.click(await screen.findByRole("checkbox", { name: "Select Northline Logistics" }));
    await user.click(within(bar()!).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(exportRows).toHaveBeenCalledTimes(1));
    expect(exportRows.mock.lastCall![0]).toMatchObject({ ids: ["a3"] });
  });

  // Catches: the file holding fewer accounts than the bar said, with no reason given (an id deleted or no longer visible comes back as skipped).
  it("says how many selected accounts the export left out", async () => {
    const user = userEvent.setup();
    const ids = ["name", "main_contact", "main_contact_email", "main_contact_phone", "opportunity", "opportunity_stage", "target_start", "quote_requests_sent", "quotes_received", "earliest_quote_expires_on", "employees", "owner", "last_activity_at", "city", "state"];
    const made = (name: string) => Object.fromEntries(ids.map((id) => [id, id === "name" ? name : null]));
    exportRows.mockResolvedValue({ table: "accounts", label: "Accounts", columns: ids.map((id) => ({ id, label: id })), rows: [made("A"), made("B"), made("C")], count: 3, skipped: 1, exportedAt: "2026-11-19T10:00:00+00:00" });
    renderAt();
    await screen.findByRole("link", { name: "Kestrel Software" });
    await user.click(pageBox());
    await user.click(within(bar()!).getByRole("button", { name: "Export" }));
    expect(await screen.findByText("Exported 3 accounts. 1 selected account is no longer available.")).toBeInTheDocument();
  });
});
