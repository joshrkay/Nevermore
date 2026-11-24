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
  owner: "u1", owner_name: "Dana Reyes", last_activity_at: "2026-11-11T10:00:00Z", labels: [], ...over,
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

  // Catches (ADR 0024, from mutation): Nevermore support offered a change of anything; it keeps Export's line and Clear.
  it("offers Nevermore support none of the changes", async () => {
    const user = userEvent.setup();
    renderAt("/leads", workspace({ isSupport: true }));
    await selectTwo(user);
    for (const name of ["Change owner", "Change status", "Not a fit", "Set a field", "Label", "Delete"]) expect(within(bar()!).queryByRole("button", { name })).toBeNull();
    expect(within(bar()!).getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  // Catches (CRM-S3.6, from mutation): "Select all N that match" sent as the page's ids, so the change misses every lead on the other pages.
  it("sends the table's filters, not ids, for all that match", async () => {
    const user = userEvent.setup();
    listLeads.mockResolvedValue({ rows, total: 120 });
    bulk.previewLeadsBulk.mockResolvedValue(outcome({ selected: 120, changed: 120 }));
    renderAt("/leads?q=reyes");
    await screen.findByText("Ana Solis");
    await user.click(screen.getByRole("checkbox", { name: /Select all|select the page/i }));
    await user.click(await screen.findByRole("button", { name: "Select all 120 that match" }));
    await user.click(within(bar()!).getByRole("button", { name: "Delete" }));
    await screen.findByRole("dialog", { name: "Delete 120 leads?" });
    expect(bulk.previewLeadsBulk.mock.lastCall![2]).toEqual({ filters: expect.objectContaining({ filters: [], time_zone: "America/Los_Angeles" }) });
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

  // Catches (D-811): Change status offering Converted or Not a fit, or the change sent without the status chosen.
  it("changes the status to New or Working", async () => {
    const user = userEvent.setup();
    bulk.previewLeadsBulk.mockResolvedValue(outcome());
    bulk.applyLeadsBulk.mockResolvedValue(outcome({ changeId: "c1", undoUntil: "2026-11-16T10:10:00Z" }));
    renderAt();
    await selectTwo(user);
    await user.click(within(bar()!).getByRole("button", { name: "Change status" }));
    const d = await screen.findByRole("dialog", { name: "Change status: 2 leads" });
    const status = within(d).getByLabelText("New status");
    expect(within(status).getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose a status", "New", "Working"]);
    await user.selectOptions(status, "working");
    await user.click(await within(d).findByRole("button", { name: "Change 2 leads" }));
    expect(bulk.applyLeadsBulk).toHaveBeenCalledWith("f1", { action: "status", status: "working" }, { ids: ["l1", "l2"] });
    expect(await screen.findByText("Set 2 leads to Working.")).toBeInTheDocument();
  });

  // Catches (D-811, CRM-L1.3): Not a fit without one reason from the short list.
  it("marks them Not a fit with one reason for all", async () => {
    const user = userEvent.setup();
    bulk.previewLeadsBulk.mockResolvedValue(outcome());
    bulk.applyLeadsBulk.mockResolvedValue(outcome({ changeId: "c1", undoUntil: "2026-11-16T10:10:00Z" }));
    renderAt();
    await selectTwo(user);
    await user.click(within(bar()!).getByRole("button", { name: "Not a fit" }));
    const d = await screen.findByRole("dialog", { name: "Not a fit: 2 leads" });
    const reason = within(d).getByLabelText("Reason");
    expect(within(reason).getAllByRole("option").map((o) => o.textContent)).toEqual(
      ["Choose a reason", "Too small", "Wrong industry", "Not interested", "Bad contact details", "Other"]);
    await user.selectOptions(reason, "too_small");
    await user.click(await within(d).findByRole("button", { name: "Change 2 leads" }));
    expect(bulk.applyLeadsBulk).toHaveBeenCalledWith("f1", { action: "not_fit", reason: "too_small" }, { ids: ["l1", "l2"] });
    expect(await screen.findByText("Marked 2 leads Not a fit: Too small.")).toBeInTheDocument();
  });

  // Catches (D-811): Change owner not offering the firm's people, or the change sent to someone else.
  it("gives them to another member of the firm", async () => {
    const user = userEvent.setup();
    bulk.previewLeadsBulk.mockResolvedValue(outcome({ ownerName: "Marcus Hale" }));
    bulk.applyLeadsBulk.mockResolvedValue(outcome({ ownerName: "Marcus Hale", changeId: "c1", undoUntil: "2026-11-16T10:10:00Z" }));
    renderAt();
    await selectTwo(user);
    await user.click(within(bar()!).getByRole("button", { name: "Change owner" }));
    const d = await screen.findByRole("dialog", { name: "Change owner: 2 leads" });
    await user.selectOptions(await within(d).findByLabelText("New owner"), "u2");
    await user.click(await within(d).findByRole("button", { name: "Change 2 leads" }));
    expect(bulk.applyLeadsBulk).toHaveBeenCalledWith("f1", { action: "owner", ownerId: "u2" }, { ids: ["l1", "l2"] });
    expect(await screen.findByText("Gave 2 leads to Marcus Hale.")).toBeInTheDocument();
  });

  // Catches (CRM-S3.7): Set a field offering the name or the status, or a number sent as text.
  it("sets an optional field, never the name or the status", async () => {
    const user = userEvent.setup();
    bulk.previewLeadsBulk.mockResolvedValue(outcome());
    bulk.applyLeadsBulk.mockResolvedValue(outcome({ changeId: "c1", undoUntil: "2026-11-16T10:10:00Z" }));
    renderAt();
    await selectTwo(user);
    await user.click(within(bar()!).getByRole("button", { name: "Set a field" }));
    const d = await screen.findByRole("dialog", { name: "Set a field: 2 leads" });
    const field = within(d).getByLabelText("Field");
    expect(within(field).getAllByRole("option").map((o) => o.textContent)).toEqual(
      ["Choose a field", "Title", "Business", "Email", "Phone", "City", "State", "Employees", "Current provider"]);
    await user.selectOptions(field, "employees");
    await user.type(within(d).getByLabelText("New value"), "40");
    await user.click(await within(d).findByRole("button", { name: "Change 2 leads" }));
    expect(bulk.applyLeadsBulk).toHaveBeenCalledWith("f1", { action: "field", field: "employees", value: 40 }, { ids: ["l1", "l2"] });
    expect(await screen.findByText("Set Employees on 2 leads.")).toBeInTheDocument();
  });

  // Catches (D-805, D-811): Label not putting the firm's word on the leads, or not offering the firm's own words to take off.
  it("adds a label typed in, and takes off one the firm has", async () => {
    const user = userEvent.setup();
    firmLabels.mockResolvedValue([{ id: "b1", name: "Hot" }]);
    bulk.previewLeadsBulk.mockResolvedValue(outcome({ label: "Hot" }));
    bulk.applyLeadsBulk.mockResolvedValue(outcome({ label: "Hot", changeId: "c1", undoUntil: "2026-11-16T10:10:00Z" }));
    renderAt();
    await selectTwo(user);
    await user.click(within(bar()!).getByRole("button", { name: "Label" }));
    let d = await screen.findByRole("dialog", { name: "Label: 2 leads" });
    await user.type(within(d).getByLabelText("Label"), "Hot");
    await user.click(await within(d).findByRole("button", { name: "Change 2 leads" }));
    expect(bulk.applyLeadsBulk).toHaveBeenLastCalledWith("f1", { action: "label_add", name: "Hot" }, { ids: ["l1", "l2"] });
    expect(await screen.findByText("Put the label Hot on 2 leads.")).toBeInTheDocument();
    await selectTwo(user);
    await user.click(within(bar()!).getByRole("button", { name: "Label" }));
    d = await screen.findByRole("dialog", { name: "Label: 2 leads" });
    await user.selectOptions(within(d).getByLabelText("Change"), "label_remove");
    await user.selectOptions(await within(d).findByLabelText("Label"), "Hot");
    await user.click(await within(d).findByRole("button", { name: "Change 2 leads" }));
    expect(bulk.applyLeadsBulk).toHaveBeenLastCalledWith("f1", { action: "label_remove", name: "Hot" }, { ids: ["l1", "l2"] });
    expect(await screen.findByText("Took the label Hot off 2 leads.")).toBeInTheDocument();
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
