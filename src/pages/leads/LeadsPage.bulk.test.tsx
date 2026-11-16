import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { LeadRow } from "@/lib/leadsApi";
import type { BulkOutcome } from "@/lib/bulkChangeApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// Bulk actions, Undo and the bin on the Leads page (story CRM-L1.1b, slice 8.4). The database decides every rule (supabase/tests/leads_bulk.sql); these tests
// are what a person sees and does: the bar's actions, the dialog that says what will happen, the change and its Undo, and the bin with Restore.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com", app_metadata: { providers: ["email"] } }, signOut: vi.fn() }) }));
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), auth: { mfa: { listFactors: vi.fn(), challengeAndVerify: vi.fn() } } } }));
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
vi.mock("@/lib/accountCreateApi", () => ({ listAccountOwners: vi.fn() }));
vi.mock("@/lib/leadCreateApi", () => ({ createLead: vi.fn() }));
const bulk = { previewLeadsBulk: vi.fn(), applyLeadsBulk: vi.fn(), undoLeadsBulk: vi.fn(), listLeadsBin: vi.fn(), restoreLeads: vi.fn() };
vi.mock("@/lib/leadsBulkApi", async (original) => ({
  ...(await original<typeof import("@/lib/leadsBulkApi")>()),
  previewLeadsBulk: (...a: unknown[]) => bulk.previewLeadsBulk(...a),
  applyLeadsBulk: (...a: unknown[]) => bulk.applyLeadsBulk(...a),
  undoLeadsBulk: (...a: unknown[]) => bulk.undoLeadsBulk(...a),
  listLeadsBin: (...a: unknown[]) => bulk.listLeadsBin(...a),
  restoreLeads: (...a: unknown[]) => bulk.restoreLeads(...a),
}));
const firmLabels = vi.fn();
vi.mock("@/lib/bulkChangeApi", async (original) => ({ ...(await original<typeof import("@/lib/bulkChangeApi")>()), firmLabels: (...a: unknown[]) => firmLabels(...a) }));
const exportRows = vi.fn();
vi.mock("@/lib/exportApi", async () => ({ ...(await vi.importActual<object>("@/lib/exportApi")), exportRows: (...a: unknown[]) => exportRows(...a) }));
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: vi.fn() }));

const { default: LeadsPage } = await import("./LeadsPage");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});
const row = (over: Partial<LeadRow> = {}): LeadRow => ({
  id: "l1", name: "Lucia Reyes", title: "Owner", business: "Reyes Bakery", email: "lucia@reyes.example", phone: null, city: "Portland", state: "OR",
  employees: 23, current_provider: null, source: "added_by_hand", status: "working", not_fit_reason: null, created_at: "2026-11-01T10:00:00Z",
  owner: "u1", owner_name: "Dana Reyes", last_activity_at: "2026-11-11T10:00:00Z", ...over,
});
const rows = [row(), row({ id: "l2", name: "Min-jun Kim", business: "Kim Dental" }), row({ id: "l3", name: "Ana Solis", business: "Solis Care" })];
export const outcome = (over: Partial<BulkOutcome> = {}): BulkOutcome => ({
  selected: 2, tooMany: false, changed: 2, unchanged: 0, unavailable: 0, skipped: [], ownerName: null, label: null, opportunities: null, changeId: null, undoUntil: null, ...over,
});

const renderAt = (url = "/leads", ws: Workspace = workspace()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceContext.Provider value={ws}>
        <MemoryRouter initialEntries={[url]}>
          <Routes><Route path="/leads" element={<LeadsPage />} /></Routes>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
const bar = () => screen.queryByRole("region", { name: "Selected rows" });
const selectTwo = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByText("Ana Solis");
  await user.click(screen.getByRole("checkbox", { name: "Select Lucia Reyes" }));
  await user.click(screen.getByRole("checkbox", { name: "Select Min-jun Kim" }));
};

beforeEach(() => {
  for (const fn of [listLeads, countLeadViews, listFirmMembers, firmLabels, exportRows, ...Object.values(bulk)]) fn.mockReset();
  listLeads.mockResolvedValue({ rows, total: 3 });
  countLeadViews.mockImplementation(async (_f: string, views: { name: string }[]) => views.map((v) => ({ name: v.name, total: 1 })));
  listFirmMembers.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
  firmLabels.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe("the leads' bulk bar (CRM-L1.1b)", () => {
  // Catches: an action the story lists missing from the bar, or offered out of the story's order.
  it("offers Change owner, Change status, Not a fit, Set a field, Label, Delete, Export and Clear once rows are selected", async () => {
    const user = userEvent.setup();
    renderAt();
    await selectTwo(user);
    expect(within(bar()!).getAllByRole("button").map((b) => b.textContent)).toEqual(
      ["Change owner", "Change status", "Not a fit", "Set a field", "Label", "Delete", "Export", "Clear"]);
  });

  // Catches (CRM-L1.1): a delete made without asking, a question that does not name the count, or no word of the bin and its 30 days.
  it("asks before deleting, naming the count, then moves them to the bin and says so", async () => {
    const user = userEvent.setup();
    bulk.previewLeadsBulk.mockResolvedValue(outcome({ changed: 1, skipped: [{ id: "l2", name: "Min-jun Kim", code: "converted", reason: "It is converted, so it can be read but not changed or deleted." }] }));
    bulk.applyLeadsBulk.mockResolvedValue(outcome({ changed: 1, changeId: "c1", undoUntil: "2026-11-16T10:10:00Z" }));
    renderAt();
    await selectTwo(user);
    await user.click(within(bar()!).getByRole("button", { name: "Delete" }));
    const d = await screen.findByRole("dialog", { name: "Delete 2 leads?" });
    expect(await within(d).findByText("This will move 1 lead to the bin. An owner can restore it for 30 days; after that it is removed for good.")).toBeInTheDocument();
    expect(within(d).getByText(/Min-jun Kim: It is converted/)).toBeInTheDocument();
    expect(bulk.applyLeadsBulk).not.toHaveBeenCalled();
    await user.click(within(d).getByRole("button", { name: "Delete 1 lead" }));
    expect(bulk.applyLeadsBulk).toHaveBeenCalledWith("f1", { action: "delete" }, { ids: ["l1", "l2"] });
    expect(await screen.findByText("Moved 1 lead to the bin.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  // Catches (D-202): Undo that asks nothing of the database, or says nothing of what it put back.
  it("undoes the change and says what it put back", async () => {
    const user = userEvent.setup();
    bulk.previewLeadsBulk.mockResolvedValue(outcome());
    bulk.applyLeadsBulk.mockResolvedValue(outcome({ changeId: "c1", undoUntil: "2026-11-16T10:10:00Z" }));
    bulk.undoLeadsBulk.mockResolvedValue({ restored: 2, skipped: [], gone: 0, opportunities: { restored: 0, skipped: 0, gone: 0 } });
    renderAt();
    await selectTwo(user);
    await user.click(within(bar()!).getByRole("button", { name: "Delete" }));
    const d = await screen.findByRole("dialog");
    await user.click(await within(d).findByRole("button", { name: "Delete 2 leads" }));
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(bulk.undoLeadsBulk).toHaveBeenCalledWith("f1", "c1");
    expect(await screen.findByText("Undone. 2 leads put back.")).toBeInTheDocument();
  });
});

describe("the bin (CRM-L1.1b, D-806)", () => {
  const binned = { id: "l9", name: "Owen Park", business: "Park Plumbing", email: null, phone: null, status: "new" as const, owner: "u1", owner_name: "Dana Reyes",
    deleted_at: "2026-11-01T10:00:00Z", removed_on: "2026-12-01" };

  // Catches: the bin offered to someone who is not an owner (an agent, Nevermore support is offered no Restore), or not offered to an owner.
  it("is offered to an owner only", async () => {
    renderAt();
    await screen.findByText("Ana Solis");
    expect(screen.queryByRole("button", { name: "Deleted" })).toBeNull();
    cleanup();
    renderAt("/leads", workspace({ isOwner: true, role: "Owner" }));
    await screen.findByText("Ana Solis");
    expect(screen.getByRole("button", { name: "Deleted" })).toBeInTheDocument();
  });

  // Catches (CRM-L1.1): a lead in the bin with no way back, or no word of when it goes for good.
  it("lists the deleted leads with the day each is removed, and restores one", async () => {
    const user = userEvent.setup();
    bulk.listLeadsBin.mockResolvedValue({ rows: [binned], total: 1, page: 1, pageSize: 50 });
    bulk.restoreLeads.mockResolvedValue({ restored: 1, unavailable: 0 });
    renderAt("/leads", workspace({ isOwner: true, role: "Owner" }));
    await screen.findByText("Ana Solis");
    await user.click(screen.getByRole("button", { name: "Deleted" }));
    const d = await screen.findByRole("dialog", { name: "Deleted leads" });
    expect(await within(d).findByText("Owen Park")).toBeInTheDocument();
    expect(within(d).getByText("Removed for good on Dec 1, 2026")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Restore Owen Park" }));
    expect(bulk.restoreLeads).toHaveBeenCalledWith("f1", ["l9"]);
    expect(await within(d).findByText("Owen Park is back in the leads.")).toBeInTheDocument();
  });
});
