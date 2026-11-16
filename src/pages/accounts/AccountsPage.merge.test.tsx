import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AccountRow } from "@/lib/accountsApi";
import type { BulkOutcome, UndoOutcome } from "@/lib/bulkChangeApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// Merging two accounts from the Accounts table's bar (story CRM-S4.3a, screen 37). The database decides who may merge and what moves
// (supabase/tests/merge_records.sql); these tests are what a person sees and does.
const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com", app_metadata: { providers: ["email"] } }, signOut }) }));
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
    return { rows: result.rows, total: result.total, page: opts.page ?? 1, pageSize: 50 };
  },
  countAccountViews: (...a: unknown[]) => countAccountViews(...a),
  listFirmMembers: (...a: unknown[]) => listFirmMembers(...a),
}));
const actions = { archiveAccount: vi.fn(), restoreAccount: vi.fn(), deleteAccount: vi.fn(), changeAccountOwner: vi.fn(), accountsCanChange: vi.fn() };
vi.mock("@/lib/accountActionsApi", () => actions);
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }));
vi.mock("@/lib/tableSettingsApi", () => ({
  listSavedViews: async () => [],
  saveView: vi.fn(),
  fetchMyColumns: async () => ({ columns: null, source: "none" }),
  setMyColumns: async () => undefined,
}));
const previewBulkChange = vi.fn();
const applyBulkChange = vi.fn();
const undoBulkChange = vi.fn();
const firmLabels = vi.fn();
vi.mock("@/lib/bulkChangeApi", async (original) => ({
  ...(await original<typeof import("@/lib/bulkChangeApi")>()),
  previewBulkChange: (...a: unknown[]) => previewBulkChange(...a),
  applyBulkChange: (...a: unknown[]) => applyBulkChange(...a),
  undoBulkChange: (...a: unknown[]) => undoBulkChange(...a),
  firmLabels: (...a: unknown[]) => firmLabels(...a),
}));
const merge = { previewMerge: vi.fn(), mergeAccounts: vi.fn() };
vi.mock("@/lib/mergeApi", async (original) => ({ ...(await original<typeof import("@/lib/mergeApi")>()), ...merge }));
const exportRows = vi.fn();
vi.mock("@/lib/exportApi", async () => ({ ...(await vi.importActual<object>("@/lib/exportApi")), exportRows: (...a: unknown[]) => exportRows(...a) }));
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: vi.fn() }));

const { default: AccountsPage } = await import("./AccountsPage");
const { BulkChangeError } = await import("@/lib/bulkChangeApi");
const { ExportError } = await import("@/lib/exportApi");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Lead", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});
const row = (over: Partial<AccountRow> = {}): AccountRow => ({
  id: "a1", name: "Harborview Dental Group", trade_name: null, website: null, city: "Portland", state: "OR", industry: null, employees: 45,
  states_of_operation: [], current_provider: null, source: "employer_intake", status: "prospect", archived: false, archived_at: null,
  created_at: "2026-10-28T10:00:00Z", owner: "u1", owner_name: "Dana Reyes", main_contact_id: null, main_contact_name: null,
  main_contact_email: null, main_contact_phone: null, opportunity_id: null, opportunity_name: null, opportunity_stage: null, target_start: null, open_opportunities: 1,
  quote_requests_sent: 0, quotes_received: 0, waiting_on_peo: false, earliest_quote_expires_on: null, last_activity_at: "2026-11-11T10:00:00Z", labels: [], renewal_date: null, ...over,
});
const rows = [
  row(),
  row({ id: "a2", name: "Tidewater Veterinary", owner: "u3", owner_name: "Priya Nair" }),
  row({ id: "a3", name: "Solis Home Care" }),
];

const preview = (over: Partial<BulkOutcome> = {}): BulkOutcome => ({
  selected: 3, tooMany: false, changed: 2, unchanged: 0, unavailable: 0, ownerName: "Marcus Hale", label: null, opportunities: { changed: 2, skipped: 0 }, changeId: null, undoUntil: null,
  skipped: [{ id: "a2", name: "Tidewater Veterinary", code: "level", reason: "owned by another team, which you can't change" }], ...over,
});
const made = (over: Partial<BulkOutcome> = {}): BulkOutcome => preview({ changeId: "chg1", undoUntil: new Date(Date.now() + 600_000).toISOString(), ...over });
const undone = (over: Partial<UndoOutcome> = {}): UndoOutcome => ({ restored: 2, skipped: [], gone: 0, opportunities: { restored: 2, skipped: 0, gone: 0 }, ...over });

let queryClient: QueryClient;
const renderAt = (url = "/accounts", ws: Workspace = workspace()) => {
  queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceContext.Provider value={ws}>
        <MemoryRouter initialEntries={[url]}>
          <Routes><Route path="/accounts" element={<AccountsPage />} /></Routes>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
};
const bar = () => screen.queryByRole("region", { name: "Selected rows" });
const check = (name: string) => screen.getByRole("checkbox", { name });
const selectTwo = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByRole("link", { name: "Solis Home Care" });
  await user.click(check("Select Harborview Dental Group"));
  await user.click(check("Select Tidewater Veterinary"));
};
const barButton = (name: string) => within(bar()!).getByRole("button", { name });
const dialog = () => screen.findByRole("dialog");
// The labels a dialog gives its fields, by their visible words.
const choose = async (user: ReturnType<typeof userEvent.setup>, d: HTMLElement, label: string, option: string) => user.selectOptions(within(d).getByLabelText(label), option);
const lastPreview = () => previewBulkChange.mock.lastCall as [string, Record<string, unknown>, Record<string, unknown>];

beforeEach(() => {
  for (const fn of [listAccounts, countAccountViews, listFirmMembers, previewBulkChange, applyBulkChange, undoBulkChange, firmLabels, exportRows, signOut, mfa.listFactors, mfa.challengeAndVerify, ...Object.values(actions), ...Object.values(merge)]) fn.mockReset();
  listAccounts.mockResolvedValue({ rows, total: 375 });
  countAccountViews.mockImplementation(async (_f: string, views: { name: string }[]) => views.map((v) => ({ name: v.name, total: 1 })));
  listFirmMembers.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
  firmLabels.mockResolvedValue([{ id: "l1", name: "Hot lead" }, { id: "l2", name: "Referral" }]);
  actions.accountsCanChange.mockResolvedValue(["a1", "a2", "a3"]);
  previewBulkChange.mockResolvedValue(preview());
  applyBulkChange.mockResolvedValue(made());
});
afterEach(() => cleanup());


const previewOf = (over: object = {}) => ({
  kind: "account", problem: null, differs: ["name"], kept: { id: "a1", version: 2, name: "Harborview Dental Group" }, removed: { id: "a2", version: 4, name: "Tidewater Veterinary" },
  moves: { contacts: 1 }, ...over,
});
beforeEach(() => merge.previewMerge.mockResolvedValue(previewOf()));

describe("Merge in the bar", () => {
  // Catches: Merge missing for two chosen accounts, or asking about the wrong pair (the first chosen is the one kept).
  it("is offered for exactly two accounts, and opens the choice with the first chosen kept", async () => {
    const user = userEvent.setup();
    renderAt();
    await selectTwo(user);
    await user.click(await within(bar()!).findByRole("button", { name: "Merge" }));
    await screen.findByRole("group", { name: "Which value to keep" });
    expect(merge.previewMerge).toHaveBeenCalledWith("f1", "account", "a1", "a2");
    expect(actions.accountsCanChange).toHaveBeenCalledWith("f1", ["a1", "a2"]);
  });

  // Catches: Merge offered for one account or for three (two is the story's number).
  it("is not offered for one account or three", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("link", { name: "Solis Home Care" });
    await user.click(check("Select Harborview Dental Group"));
    expect(within(bar()!).queryByRole("button", { name: "Merge" })).toBeNull();
    await user.click(check("Select Tidewater Veterinary"));
    await within(bar()!).findByRole("button", { name: "Merge" });
    await user.click(check("Select Solis Home Care"));
    expect(within(bar()!).queryByRole("button", { name: "Merge" })).toBeNull();
  });

  // Catches: Merge offered where the person may not change both accounts (they would learn it by being refused).
  it("is hidden when the person may not change both accounts", async () => {
    const user = userEvent.setup();
    actions.accountsCanChange.mockImplementation(async (_f: string, ids: string[]) => (ids.length === 2 ? ["a1"] : ["a1", "a2", "a3"]));
    renderAt();
    await selectTwo(user);
    await waitFor(() => expect(actions.accountsCanChange).toHaveBeenCalledWith("f1", ["a1", "a2"]));
    expect(within(bar()!).queryByRole("button", { name: "Merge" })).toBeNull();
  });

  // Catches: Nevermore support offered a change (D-24, ADR 0024).
  it("is not offered to Nevermore support", async () => {
    const user = userEvent.setup();
    renderAt("/accounts", workspace({ isSupport: true }));
    await selectTwo(user);
    expect(within(bar()!).queryByRole("button", { name: "Merge" })).toBeNull();
  });

  // Catches: the selection left on rows that no longer exist, or the table not asked again after a merge.
  it("clears the selection and asks the table again after a merge", async () => {
    const user = userEvent.setup();
    merge.mergeAccounts.mockResolvedValue({ record: { id: "a1", version: 3 }, removed: { id: "a2", name: "Tidewater Veterinary" }, moved: { contacts: 1, contactsMerged: 0, opportunities: 0, activities: 0, placements: 0, renewals: 0, labels: 0 } });
    renderAt();
    await selectTwo(user);
    await user.click(await within(bar()!).findByRole("button", { name: "Merge" }));
    await screen.findByRole("group", { name: "Which value to keep" });
    const before = listAccounts.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(merge.mergeAccounts).toHaveBeenCalledWith("f1", "a1", "a2", { name: "kept" }, { kept: 2, removed: 4 }));
    await waitFor(() => expect(bar()).toBeNull());
    await waitFor(() => expect(listAccounts.mock.calls.length).toBeGreaterThan(before));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Catches: the removed account's cached page (and the kept one's) left as it was, so reopening either shows records that no longer match.
  it("asks again for both accounts' pages after a merge", async () => {
    const user = userEvent.setup();
    merge.mergeAccounts.mockResolvedValue({ record: { id: "a1", version: 3 }, removed: { id: "a2", name: "Tidewater Veterinary" }, moved: { contacts: 1, contactsMerged: 0, opportunities: 0, activities: 0, placements: 0, renewals: 0, labels: 0 } });
    renderAt();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    await selectTwo(user);
    await user.click(await within(bar()!).findByRole("button", { name: "Merge" }));
    await screen.findByRole("group", { name: "Which value to keep" });
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(merge.mergeAccounts).toHaveBeenCalled());
    const keys = () => spy.mock.calls.map((c) => ((c[0] as { queryKey: readonly unknown[] }).queryKey).join("/"));
    await waitFor(() => expect(keys()).toContain("account/f1/a1"));
    expect(keys()).toContain("account/f1/a2");
  });
});
