import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { LeadRow } from "@/lib/leadsApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// The Leads page on the workspace's table frame (story CRM-L1.1a, slice 8.3, screen 14). The database cuts the pages and runs the filters
// (supabase/tests/leads_query.sql); these tests are what a person sees and does: the columns, the views and their counts, the states, and New lead.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com", app_metadata: { providers: ["email"] } }, signOut: vi.fn() }) }));
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), auth: { mfa: { listFactors: vi.fn() } } } }));
const listLeads = vi.fn();
const countLeadViews = vi.fn();
vi.mock("@/lib/leadsApi", async (original) => ({
  ...(await original<typeof import("@/lib/leadsApi")>()),
  listLeads: async (opts: { page?: number }) => ({ page: opts.page ?? 1, pageSize: 50, ...(await listLeads(opts)) }),
  countLeadViews: (...a: unknown[]) => countLeadViews(...a),
}));
const listFirmMembers = vi.fn();
vi.mock("@/lib/accountsApi", async (original) => ({
  ...(await original<typeof import("@/lib/accountsApi")>()),
  browserTimeZone: () => "America/Los_Angeles",
  listFirmMembers: (...a: unknown[]) => listFirmMembers(...a),
}));
vi.mock("@/lib/tableSettingsApi", () => ({
  listSavedViews: async () => [],
  saveView: vi.fn(),
  fetchMyColumns: async () => ({ columns: null, source: "none" }),
  setMyColumns: vi.fn(),
}));
const listAccountOwners = vi.fn();
vi.mock("@/lib/accountCreateApi", () => ({ listAccountOwners: (...a: unknown[]) => listAccountOwners(...a) }));
vi.mock("@/lib/leadCreateApi", () => ({ createLead: vi.fn() }));
const leadsCanConvert = vi.fn();
const getConvertMatches = vi.fn();
const convertLead = vi.fn();
vi.mock("@/lib/leadConvertApi", async (original) => ({
  ...(await original<typeof import("@/lib/leadConvertApi")>()),
  leadsCanConvert: (...a: unknown[]) => leadsCanConvert(...a),
  getConvertMatches: (...a: unknown[]) => getConvertMatches(...a),
  convertLead: (...a: unknown[]) => convertLead(...a),
}));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }));

const { default: LeadsPage } = await import("./LeadsPage");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});

const row = (over: Partial<LeadRow> = {}): LeadRow => ({
  id: "l1", name: "Lucia Reyes", title: "Owner", business: "Reyes Bakery", email: "lucia@reyes.example", phone: "(503) 555-0142", city: "Portland", state: "OR",
  employees: 23, current_provider: null, source: "added_by_hand", status: "working", not_fit_reason: null, created_at: "2026-11-01T10:00:00Z",
  owner: "u1", owner_name: "Dana Reyes", last_activity_at: "2026-11-11T10:00:00Z", labels: [], ...over,
});

const renderAt = (url = "/leads", ws: Workspace = workspace()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceContext.Provider value={ws}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/leads" element={<LeadsPage />} />
          </Routes>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
const headers = () => within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent?.trim()).filter((h) => h && h !== "Actions");

beforeEach(() => {
  for (const fn of [listLeads, countLeadViews, listFirmMembers, listAccountOwners, leadsCanConvert, getConvertMatches, convertLead, toastSuccess]) fn.mockReset();
  leadsCanConvert.mockResolvedValue([]);
  getConvertMatches.mockResolvedValue([]);
  listLeads.mockResolvedValue({ rows: [row()], total: 1 });
  countLeadViews.mockImplementation(async (_f: string, views: { name: string }[]) => views.map((v, i) => ({ name: v.name, total: [12, 1, 4, 5, 3, 2][i] ?? 0 })));
  listFirmMembers.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }]);
  listAccountOwners.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }]);
});
afterEach(() => cleanup());

describe("the Leads page (CRM-L1.1a)", () => {
  // Catches: the wrong firm asked, the table's own order dropped, or a default column missing.
  it("asks for the firm's first page in the table's own order and shows the story's columns", async () => {
    renderAt();
    expect(await screen.findByText("Lucia Reyes")).toBeInTheDocument();
    expect(listLeads.mock.lastCall![0]).toMatchObject({ firmId: "f1", filters: [], sort: null, page: 1, search: "" });
    expect(screen.getByRole("heading", { level: 1, name: "Leads" })).toBeInTheDocument();
    expect(headers()).toEqual(["Lead", "Business", "Email and phone", "Status", "Source", "Last activity", "Owner"]);
    const cells = within(screen.getByRole("table")).getByText("Reyes Bakery").closest("tr")!;
    expect(within(cells).getByText("Working")).toBeInTheDocument();
    expect(within(cells).getByText("Added by hand")).toBeInTheDocument();
    expect(within(cells).getByText("lucia@reyes.example")).toBeInTheDocument();
  });

  // Catches: a view the story names left out, or a tab that counts the wrong question.
  it("offers the story's views, each with its count", async () => {
    renderAt();
    await screen.findByText("Lucia Reyes");
    for (const name of ["Open", "New", "Working", "Converted", "Not a fit"]) expect(await screen.findByRole("link", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    const asked = countLeadViews.mock.lastCall![1] as { name: string; filters: unknown[] }[];
    expect(asked.find((v) => v.name === "open")?.filters).toEqual([{ field: "status", op: "any_of", value: ["new", "working"] }]);
  });

  // Catches: an empty firm told nothing matches, or no way to add the first lead.
  it("says what leads are when the firm has none, and offers New lead", async () => {
    listLeads.mockResolvedValue({ rows: [], total: 0 });
    renderAt();
    expect(await screen.findByText("Leads are people you aren't quoting yet")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "New lead" })[0]);
    expect(await screen.findByRole("dialog", { name: "New lead" })).toBeInTheDocument();
  });

  // Catches: Nevermore support offered a way to make a lead (it can only look, ADR 0024).
  it("offers Nevermore support no New lead", async () => {
    renderAt("/leads", workspace({ isSupport: true }));
    await screen.findByText("Lucia Reyes");
    expect(screen.queryByRole("button", { name: "New lead" })).not.toBeInTheDocument();
  });

  // Catches: a narrowed table that finds nothing said as an empty firm.
  it("says no leads match the filters when a view finds none", async () => {
    listLeads.mockResolvedValue({ rows: [], total: 0 });
    renderAt("/leads?view=converted");
    expect(await screen.findByText(/No leads match/)).toBeInTheDocument();
  });

  // Catches: a lead's name that leads nowhere now that a lead has a page (slice 8.5).
  it("links each lead's name to its page", async () => {
    renderAt();
    expect(await screen.findByRole("link", { name: "Lucia Reyes" })).toHaveAttribute("href", "/leads/l1");
  });
});

describe("Convert on a row (CRM-L1.1's row action, #190)", () => {
  const lucia = row({ id: "l1", name: "Lucia Reyes" });
  const hal = row({ id: "l2", name: "Hal Brenner", business: "Brenner Mechanical", email: "hal@brenner.example", status: "not_fit", not_fit_reason: "too_small" });
  const rowOf = async (name: string) => (await screen.findByText(name)).closest("tr") as HTMLElement;

  // Catches: Convert offered on a lead the database would refuse (Not a fit, Converted, in the bin, another agent's), so the dialog opens and only then is the agent told no,
  // or left off a lead that can be converted.
  it("offers Convert on the rows the database says can be converted, and on no other", async () => {
    listLeads.mockResolvedValue({ rows: [lucia, hal], total: 2 });
    leadsCanConvert.mockResolvedValue(["l1"]);
    renderAt();
    expect(await within(await rowOf("Lucia Reyes")).findByRole("button", { name: "Convert Lucia Reyes" })).toBeInTheDocument();
    expect(within(await rowOf("Hal Brenner")).queryByRole("button", { name: /Convert/ })).toBeNull();
    expect(leadsCanConvert).toHaveBeenCalledWith("f1", ["l1", "l2"]);
  });

  // Catches: Convert offered before the database has answered (every row would show it, and some would be refused), or a failed check taking the whole table down
  // with it instead of leaving the rows and no Convert.
  it("offers no Convert until the database has answered, or when it cannot answer, and the rows still show", async () => {
    let answer: (ids: string[]) => void = () => {};
    leadsCanConvert.mockReturnValue(new Promise<string[]>((resolve) => { answer = resolve; }));
    renderAt();
    await rowOf("Lucia Reyes");
    expect(screen.queryByRole("button", { name: /Convert/ })).toBeNull();
    answer(["l1"]);
    expect(await screen.findByRole("button", { name: "Convert Lucia Reyes" })).toBeInTheDocument();
    cleanup();
    leadsCanConvert.mockReset();
    leadsCanConvert.mockRejectedValue(new Error("down"));
    renderAt();
    await rowOf("Lucia Reyes");
    await waitFor(() => expect(leadsCanConvert).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Convert/ })).toBeNull();
    expect(screen.getByText("Lucia Reyes")).toBeInTheDocument();
  });

  // Catches: Convert offered to Nevermore support, who can only look (ADR 0024); or asked about for them all the same.
  it("offers Convert to no one in a support session, and does not ask", async () => {
    leadsCanConvert.mockResolvedValue(["l1"]);
    renderAt("/leads", workspace({ isSupport: true }));
    await rowOf("Lucia Reyes");
    expect(screen.queryByRole("button", { name: /Convert/ })).toBeNull();
    expect(leadsCanConvert).not.toHaveBeenCalled();
  });

  // Catches: the row's Convert opening the lead's page instead of the dialog (a click on the row), or opening it for another lead than the row's.
  it("opens the Convert dialog for that row's lead, over the table", async () => {
    listLeads.mockResolvedValue({ rows: [lucia, hal], total: 2 });
    leadsCanConvert.mockResolvedValue(["l1", "l2"]);
    renderAt();
    const user = userEvent.setup();
    await user.click(await within(await rowOf("Hal Brenner")).findByRole("button", { name: "Convert Hal Brenner" }));
    expect(await screen.findByRole("dialog", { name: "Convert Hal Brenner" })).toBeInTheDocument();
    expect(getConvertMatches).toHaveBeenCalledWith("f1", "l2");
    // Still on the Leads page (a modal hides the page from the accessibility tree, so it is asked for as hidden): the row was not opened.
    expect(screen.getByRole("heading", { level: 1, name: "Leads", hidden: true })).toBeInTheDocument();
  });

  // Catches: a conversion that leaves the table showing the lead as it was (a Convert still offered on a Converted lead), or says nothing of where the lead went.
  it("after converting, says where the lead went and reads the table again", async () => {
    convertLead.mockResolvedValue({ account: { id: "a9", name: "Reyes Bakery", created: true }, contact: null, opportunity: null });
    leadsCanConvert.mockResolvedValue(["l1"]);
    renderAt();
    const user = userEvent.setup();
    await user.click(await within(await rowOf("Lucia Reyes")).findByRole("button", { name: "Convert Lucia Reyes" }));
    const dialog = await screen.findByRole("dialog", { name: "Convert Lucia Reyes" });
    const before = listLeads.mock.calls.length;
    listLeads.mockResolvedValue({ rows: [row({ id: "l1", name: "Lucia Reyes", status: "converted" })], total: 1 });
    await user.click(within(dialog).getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Converted into Reyes Bakery"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(listLeads.mock.calls.length).toBeGreaterThan(before));
    expect(convertLead.mock.calls[0].slice(0, 2)).toEqual(["f1", "l1"]);
  });
});
