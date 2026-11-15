import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AccountRow } from "@/lib/accountsApi";
import type { BulkOutcome, UndoOutcome } from "@/lib/bulkChangeApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// Bulk edit on the Accounts page (story CRM-S3.7a, screens 35 and 36): the bar's actions, the dialog that says what will happen from the database's preview,
// the change, Undo, every refusal in words, and Nevermore support. The database decides every rule (supabase/tests/bulk_changes.sql); these tests are what a
// person sees and does.
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
  quote_requests_sent: 0, quotes_received: 0, waiting_on_peo: false, earliest_quote_expires_on: null, last_activity_at: "2026-11-11T10:00:00Z", labels: [], ...over,
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

const renderAt = (url = "/accounts", ws: Workspace = workspace()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceContext.Provider value={ws}>
        <MemoryRouter initialEntries={[url]}>
          <Routes><Route path="/accounts" element={<AccountsPage />} /></Routes>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
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
  for (const fn of [listAccounts, countAccountViews, listFirmMembers, previewBulkChange, applyBulkChange, undoBulkChange, firmLabels, exportRows, signOut, mfa.listFactors, mfa.challengeAndVerify, ...Object.values(actions)]) fn.mockReset();
  listAccounts.mockResolvedValue({ rows, total: 375 });
  countAccountViews.mockImplementation(async (_f: string, views: { name: string }[]) => views.map((v) => ({ name: v.name, total: 1 })));
  listFirmMembers.mockResolvedValue([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
  firmLabels.mockResolvedValue([{ id: "l1", name: "Hot lead" }, { id: "l2", name: "Referral" }]);
  actions.accountsCanChange.mockResolvedValue(["a1", "a2", "a3"]);
  previewBulkChange.mockResolvedValue(preview());
  applyBulkChange.mockResolvedValue(made());
});
afterEach(() => cleanup());

describe("the bulk bar", () => {
  // Catches: an action of the story missing from the bar, or one that is there but not offered in the screen's order (Change owner, Set a field, Label, Archive, Export).
  it("offers Change owner, Set a field, Label, Archive, Export and Clear once rows are selected", async () => {
    const user = userEvent.setup();
    renderAt();
    await selectTwo(user);
    expect(within(bar()!).getAllByRole("button").map((b) => b.textContent)).toEqual(["Change owner", "Set a field", "Label", "Archive", "Export", "Clear"]);
  });

  // Catches (D-24, ADR 0024): Nevermore support being offered a change of anything.
  it("offers Nevermore support none of the actions", async () => {
    const user = userEvent.setup();
    renderAt("/accounts", workspace({ isSupport: true }));
    await selectTwo(user);
    for (const name of ["Change owner", "Set a field", "Label", "Archive"]) expect(within(bar()!).queryByRole("button", { name })).toBeNull();
    expect(within(bar()!).getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  // Catches: Export in the bar not handling the 12-hour sign-in as the toolbar's Export does, for "all that match".
  it("exports all that match with the step-up the toolbar's Export gives", async () => {
    const user = userEvent.setup();
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1" }], all: [] }, error: null });
    exportRows.mockRejectedValueOnce(new ExportError("signInAgain", "Sign in again to export a whole table."));
    renderAt("/accounts?filter=status:any_of:client");
    await screen.findByRole("link", { name: "Solis Home Care" });
    await user.click(screen.getByRole("checkbox", { name: "Select all accounts on this page" }));
    await user.click(screen.getByRole("button", { name: "Select all 375 that match" }));
    await user.click(barButton("Export"));
    const step = await screen.findByRole("dialog");
    expect(within(step).getByLabelText(/6-digit code/)).toBeInTheDocument();
    const call = exportRows.mock.lastCall![0] as { filters: { filters: unknown[] }; ids?: string[] };
    expect(call.ids).toBeUndefined();
    expect(call.filters.filters).toEqual([{ field: "status", op: "any_of", value: ["client"] }]);
  });
});

describe("Change owner", () => {
  // Catches: a dialog that does not say, from the preview and before anything changes, how many change, which are skipped and why; or one that changes at once.
  it("says exactly what will happen before anything changes, and changes only when asked", async () => {
    const user = userEvent.setup();
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Change owner"));
    const d = await dialog();
    expect(within(d).getByRole("heading", { name: "Change owner: 2 accounts" })).toBeInTheDocument();
    // Nothing is asked until someone is chosen.
    expect(previewBulkChange).not.toHaveBeenCalled();
    await choose(user, d, "New owner", "Marcus Hale");
    expect(await within(d).findByText("This will change the owner to Marcus Hale on 2 accounts.")).toBeInTheDocument();
    expect(within(d).getByText("1 will be skipped")).toBeInTheDocument();
    expect(within(d).getByText("Tidewater Veterinary: owned by another team, which you can't change")).toBeInTheDocument();
    expect(within(d).getByLabelText("Also change the owner of their 2 open opportunities")).toBeChecked();
    expect(within(d).getByText("You can undo this for ten minutes. It is recorded in each account's history.")).toBeInTheDocument();
    expect(lastPreview()).toEqual(["f1", { action: "owner", ownerId: "u2", changeOpenOpportunities: true }, { ids: ["a1", "a2"] }]);
    expect(applyBulkChange).not.toHaveBeenCalled();
    await user.click(within(d).getByRole("button", { name: "Change 2 accounts" }));
    await waitFor(() => expect(applyBulkChange).toHaveBeenCalledTimes(1));
    expect(applyBulkChange).toHaveBeenCalledWith("f1", { action: "owner", ownerId: "u2", changeOpenOpportunities: true }, { ids: ["a1", "a2"] });
  });

  // Catches: the opportunities box ignored (it would hand opportunities over when the person said not to).
  it("leaves the open opportunities alone when the box is unticked", async () => {
    const user = userEvent.setup();
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Change owner"));
    const d = await dialog();
    await choose(user, d, "New owner", "Marcus Hale");
    await user.click(await within(d).findByLabelText("Also change the owner of their 2 open opportunities"));
    await user.click(within(d).getByRole("button", { name: "Change 2 accounts" }));
    await waitFor(() => expect(applyBulkChange).toHaveBeenCalled());
    expect(applyBulkChange.mock.lastCall![1]).toEqual({ action: "owner", ownerId: "u2", changeOpenOpportunities: false });
    expect(await screen.findByText("Changed the owner to Marcus Hale on 2 accounts.")).toBeInTheDocument();
  });

  // Catches: a change that leaves the dialog open or the selection behind, a result that says nothing, or one with no Undo (ten minutes).
  it("says what changed, names what was skipped, ends the selection and offers Undo", async () => {
    const user = userEvent.setup();
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Change owner"));
    const d = await dialog();
    await choose(user, d, "New owner", "Marcus Hale");
    await user.click(await within(d).findByRole("button", { name: "Change 2 accounts" }));
    const result = await screen.findByRole("region", { name: "What the change did" });
    expect(within(result).getByText("Changed the owner to Marcus Hale on 2 accounts, and 2 open opportunities.")).toBeInTheDocument();
    expect(within(result).getByText("Tidewater Veterinary: owned by another team, which you can't change")).toBeInTheDocument();
    expect(within(result).getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(within(result).getByText("You can undo this for ten minutes.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(bar()).toBeNull();
    // The table asks again.
    await waitFor(() => expect(listAccounts.mock.calls.length).toBeGreaterThan(1));
  });

  // Catches: "all that match" sent as ids (the page's rows only), or as filters with ids beside them.
  it("sends the filters in force, and no ids, for 'all that match'", async () => {
    const user = userEvent.setup();
    renderAt("/accounts?filter=status:any_of:client");
    await screen.findByRole("link", { name: "Solis Home Care" });
    await user.click(screen.getByRole("checkbox", { name: "Select all accounts on this page" }));
    await user.click(screen.getByRole("button", { name: "Select all 375 that match" }));
    await user.click(barButton("Change owner"));
    const d = await dialog();
    expect(within(d).getByRole("heading", { name: "Change owner: 375 accounts" })).toBeInTheDocument();
    await choose(user, d, "New owner", "Marcus Hale");
    await within(d).findByText(/This will change the owner/);
    expect(lastPreview()[2]).toEqual({ filters: { filters: [{ field: "status", op: "any_of", value: ["client"] }], time_zone: "America/Los_Angeles" } });
    await user.click(within(d).getByRole("button", { name: "Change 2 accounts" }));
    await waitFor(() => expect(applyBulkChange).toHaveBeenCalled());
    expect(applyBulkChange.mock.lastCall![2]).toEqual(lastPreview()[2]);
  });

  // Catches: the 1,000 cap answered with a change, or with no words.
  it("says when the selection is over 1,000, asks for a narrower one, and does not change", async () => {
    const user = userEvent.setup();
    previewBulkChange.mockResolvedValue(preview({ selected: 1250, tooMany: true, changed: 0, skipped: [] }));
    renderAt();
    await screen.findByRole("link", { name: "Solis Home Care" });
    await user.click(screen.getByRole("checkbox", { name: "Select all accounts on this page" }));
    await user.click(screen.getByRole("button", { name: "Select all 375 that match" }));
    await user.click(barButton("Change owner"));
    const d = await dialog();
    await choose(user, d, "New owner", "Marcus Hale");
    expect(await within(d).findByText("That is 1,250 accounts. A bulk change takes at most 1,000: narrow the selection and try again.")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Change accounts" }));
    expect(applyBulkChange).not.toHaveBeenCalled();
  });

  // Catches: a person left to confirm a change that would do nothing.
  it("says nothing will change and does not call the change", async () => {
    const user = userEvent.setup();
    previewBulkChange.mockResolvedValue(preview({ changed: 0, unchanged: 2, skipped: [], opportunities: null }));
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Change owner"));
    const d = await dialog();
    await choose(user, d, "New owner", "Marcus Hale");
    expect(await within(d).findByText("Nothing will change.")).toBeInTheDocument();
    expect(within(d).getByText("2 accounts already belong to that owner, so they stay as they are.")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Change accounts" }));
    expect(await within(d).findByText("Nothing would change, so there is nothing to do.")).toBeInTheDocument();
    expect(applyBulkChange).not.toHaveBeenCalled();
  });

  // Catches: selected accounts that were deleted or hidden since being silently dropped from the counts.
  it("counts accounts that are no longer available, never naming them", async () => {
    const user = userEvent.setup();
    previewBulkChange.mockResolvedValue(preview({ unavailable: 1, skipped: [] }));
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Change owner"));
    const d = await dialog();
    await choose(user, d, "New owner", "Marcus Hale");
    expect(await within(d).findByText("1 selected account is no longer available to you, so it is left out.")).toBeInTheDocument();
  });

  // Catches: Choosing nobody going to the database, or a required field not marked.
  it("says 'Required' and asks for an owner when none is chosen", async () => {
    const user = userEvent.setup();
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Change owner"));
    const d = await dialog();
    expect(within(d).getByText("Required")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Change accounts" }));
    expect(await within(d).findByText("Choose who will own these accounts.", { selector: '[role="alert"]' })).toBeInTheDocument();
    expect(applyBulkChange).not.toHaveBeenCalled();
  });

  // Catches (the form kit): a second press while the save is in flight making the change twice, or the dialog closing under it.
  it("changes once when the button is pressed twice, and does not close while changing", async () => {
    const user = userEvent.setup();
    let finish: (o: BulkOutcome) => void = () => undefined;
    applyBulkChange.mockReturnValue(new Promise<BulkOutcome>((resolve) => { finish = resolve; }));
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Change owner"));
    const d = await dialog();
    await choose(user, d, "New owner", "Marcus Hale");
    const go = await within(d).findByRole("button", { name: "Change 2 accounts" });
    fireEvent.click(go);
    fireEvent.submit(d.querySelector("form")!);
    await user.keyboard("{Escape}");
    expect(applyBulkChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    finish(made());
    expect(await screen.findByRole("region", { name: "What the change did" })).toBeInTheDocument();
  });

  // Catches: a change made with a preview that was for other choices (or none yet).
  it("waits for the check before it changes", async () => {
    const user = userEvent.setup();
    previewBulkChange.mockReturnValue(new Promise(() => undefined));
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Change owner"));
    const d = await dialog();
    await choose(user, d, "New owner", "Marcus Hale");
    expect(await within(d).findByText("Checking what this will do…")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Change accounts" }));
    expect(await within(d).findByText("Wait for the check above to finish, then try again.")).toBeInTheDocument();
    expect(applyBulkChange).not.toHaveBeenCalled();
  });

  // Catches: Cancel changing anything.
  it("changes nothing when cancelled, and keeps the selection", async () => {
    const user = userEvent.setup();
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Change owner"));
    const d = await dialog();
    await user.click(within(d).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(applyBulkChange).not.toHaveBeenCalled();
    expect(within(bar()!).getByText("2 selected")).toBeInTheDocument();
  });
});

describe("refusals", () => {
  // Catches (ADR 0023): a closing firm's refusal shown as nothing, or as a technical text; and a change still offered.
  it("shows a closing firm's refusal in words, from the check, and makes no change", async () => {
    const user = userEvent.setup();
    previewBulkChange.mockRejectedValue(new BulkChangeError("readOnly", "This firm is closing, so nothing in it can be changed. You can still export its records.", "PT423"));
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Archive"));
    const d = await dialog();
    expect(await within(d).findByRole("alert")).toHaveTextContent("This firm is closing, so nothing in it can be changed. You can still export its records.");
    await user.click(within(d).getByRole("button", { name: /^Archive/ }));
    expect(applyBulkChange).not.toHaveBeenCalled();
  });

  // Catches: a refusal from the change itself swallowed; the dialog must stay open with what was chosen.
  it("shows the change's own refusal in the dialog and keeps the choices", async () => {
    const user = userEvent.setup();
    applyBulkChange.mockRejectedValue(new BulkChangeError("notAllowed", "You can't change accounts in this firm.", "42501"));
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Change owner"));
    const d = await dialog();
    await choose(user, d, "New owner", "Marcus Hale");
    await user.click(await within(d).findByRole("button", { name: "Change 2 accounts" }));
    expect(await within(d).findByText("You can't change accounts in this firm.")).toBeInTheDocument();
    expect(within(d).getByLabelText("New owner")).toHaveValue("u2");
    // The selection is kept: the change did not happen.
    expect(screen.queryByRole("region", { name: "What the change did" })).toBeNull();
    await user.click(within(d).getByRole("button", { name: "Cancel" }));
    await user.click(await screen.findByRole("button", { name: "Discard changes" }));
    expect(within(bar()!).getByText("2 selected")).toBeInTheDocument();
  });

  // Catches: the over-1,000 refusal of the change itself (a selection that grew after the check) not shown.
  it("shows the cap's refusal when the change itself is refused for too many", async () => {
    const user = userEvent.setup();
    applyBulkChange.mockRejectedValue(new BulkChangeError("tooMany", "That is 1,001 accounts. A bulk change takes at most 1,000: narrow the selection and try again.", "PT413"));
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Archive"));
    const d = await dialog();
    await within(d).findByText("This will archive 2 accounts.");
    await user.click(within(d).getByRole("button", { name: "Archive 2 accounts" }));
    expect(await within(d).findByText(/That is 1,001 accounts/)).toBeInTheDocument();
  });
});

describe("Set a field", () => {
  // Catches: the name or a worked-out field being offered; or a field the database doesn't take.
  it("offers the optional fields only, and says what will be set", async () => {
    const user = userEvent.setup();
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Set a field"));
    const d = await dialog();
    const offered = within(within(d).getByLabelText("Field")).getAllByRole("option").map((o) => o.textContent);
    expect(offered).toEqual(["Choose a field", "Trade name", "Website", "Phone", "Street", "City", "State", "ZIP", "Industry", "Employees", "States of operation", "Current provider"]);
    await choose(user, d, "Field", "Industry");
    fireEvent.change(within(d).getByLabelText("New value"), { target: { value: "Dental practice" } });
    expect(await within(d).findByText('This will set Industry to "Dental practice" on 2 accounts.')).toBeInTheDocument();
    expect(lastPreview()[1]).toEqual({ action: "field", field: "industry", value: "Dental practice" });
    await user.click(within(d).getByRole("button", { name: "Change 2 accounts" }));
    await waitFor(() => expect(applyBulkChange).toHaveBeenCalledWith("f1", { action: "field", field: "industry", value: "Dental practice" }, { ids: ["a1", "a2"] }));
    expect(await screen.findByText('Set Industry to "Dental practice" on 2 accounts.')).toBeInTheDocument();
  });

  // Catches: a blank value being sent as an empty string (the database clears on null) or the page saying "set to nothing".
  it("clears a field when the value is left blank, in words", async () => {
    const user = userEvent.setup();
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Set a field"));
    const d = await dialog();
    await choose(user, d, "Field", "Current provider");
    expect(await within(d).findByText("This will clear Current provider on 2 accounts.")).toBeInTheDocument();
    expect(lastPreview()[1]).toEqual({ action: "field", field: "current_provider", value: null });
  });

  // Catches: employees sent as text, or a value that is not a number reaching the database.
  it("sends employees as a number, and refuses a word in words under the field", async () => {
    const user = userEvent.setup();
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Set a field"));
    const d = await dialog();
    await choose(user, d, "Field", "Employees");
    fireEvent.change(within(d).getByLabelText("New value"), { target: { value: "many" } });
    fireEvent.blur(within(d).getByLabelText("New value"));
    expect(await within(d).findByRole("alert")).toHaveTextContent(/whole number/i);
    expect(previewBulkChange).not.toHaveBeenCalled();
    fireEvent.change(within(d).getByLabelText("New value"), { target: { value: "25" } });
    await within(d).findByText("This will set Employees to \"25\" on 2 accounts.");
    expect(lastPreview()[1]).toEqual({ action: "field", field: "employees", value: 25 });
  });

  // Catches: the database's words for a value it refuses (a phone) lost.
  it("shows the database's own words when the check refuses the value", async () => {
    const user = userEvent.setup();
    previewBulkChange.mockRejectedValue(new BulkChangeError("invalid", "Enter a phone number like (503) 555-0142. An extension can follow, like x12.", "22023"));
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Set a field"));
    const d = await dialog();
    await choose(user, d, "Field", "Website");
    fireEvent.change(within(d).getByLabelText("New value"), { target: { value: "x" } });
    expect(await within(d).findByText("Enter a phone number like (503) 555-0142. An extension can follow, like x12.")).toBeInTheDocument();
  });
});

describe("Label", () => {
  // Catches: adding a label sent as the wrong action, or the Label column hint (a hidden column) missing so a person can't see what they did.
  it("adds a label typed, says so, and points to the Label column", async () => {
    const user = userEvent.setup();
    previewBulkChange.mockResolvedValue(preview({ label: "Hot lead", opportunities: null, skipped: [{ id: "a3", name: "Solis Home Care", code: "archived", reason: "It is archived, and nothing can be added to an archived account. Restore it first." }] }));
    applyBulkChange.mockResolvedValue(made({ opportunities: null, skipped: [] }));
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Label"));
    const d = await dialog();
    fireEvent.change(within(d).getByLabelText("Label"), { target: { value: "Hot lead" } });
    expect(await within(d).findByText('This will add the label "Hot lead" to 2 accounts.')).toBeInTheDocument();
    expect(within(d).getByText("Solis Home Care: It is archived, and nothing can be added to an archived account. Restore it first.")).toBeInTheDocument();
    expect(lastPreview()[1]).toEqual({ action: "label_add", name: "Hot lead" });
    await user.click(within(d).getByRole("button", { name: "Change 2 accounts" }));
    expect(await screen.findByText('Added the label "Hot lead" to 2 accounts.')).toBeInTheDocument();
    expect(screen.getByText("Show the Label column from Columns to see the labels.")).toBeInTheDocument();
  });

  // Catches: Remove offering words the firm doesn't have, or sending the add action.
  it("removes a label chosen from the firm's own", async () => {
    const user = userEvent.setup();
    previewBulkChange.mockResolvedValue(preview({ opportunities: null, skipped: [], changed: 2 }));
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Label"));
    const d = await dialog();
    await choose(user, d, "Change", "Remove a label");
    const labelSelect = await within(d).findByLabelText("Label");
    expect(within(labelSelect).getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose a label", "Hot lead", "Referral"]);
    await user.selectOptions(labelSelect, "Referral");
    expect(await within(d).findByText('This will remove the label "Referral" from 2 accounts.')).toBeInTheDocument();
    expect(lastPreview()[1]).toEqual({ action: "label_remove", name: "Referral" });
  });

  // Catches: a label of nothing, or of over 40 characters, reaching the database.
  it("asks for a label and keeps it to 40 characters", async () => {
    const user = userEvent.setup();
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Label"));
    const d = await dialog();
    await user.click(within(d).getByRole("button", { name: "Change accounts" }));
    expect(await within(d).findByText("Type a label.")).toBeInTheDocument();
    fireEvent.change(within(d).getByLabelText("Label"), { target: { value: "x".repeat(41) } });
    fireEvent.blur(within(d).getByLabelText("Label"));
    expect(await within(d).findByText("Keep a label to 40 characters.")).toBeInTheDocument();
    expect(applyBulkChange).not.toHaveBeenCalled();
  });
});

describe("Archive", () => {
  // Catches: archiving with no preview, or with fields nobody asked for.
  it("says how many will be archived at once, and archives", async () => {
    const user = userEvent.setup();
    previewBulkChange.mockResolvedValue(preview({ opportunities: null, skipped: [] }));
    applyBulkChange.mockResolvedValue(made({ opportunities: null, skipped: [] }));
    renderAt();
    await selectTwo(user);
    await user.click(barButton("Archive"));
    const d = await dialog();
    expect(await within(d).findByText("This will archive 2 accounts.")).toBeInTheDocument();
    expect(lastPreview()[1]).toEqual({ action: "archive" });
    await user.click(within(d).getByRole("button", { name: "Archive 2 accounts" }));
    expect(await screen.findByText("Archived 2 accounts.")).toBeInTheDocument();
    expect(applyBulkChange).toHaveBeenCalledWith("f1", { action: "archive" }, { ids: ["a1", "a2"] });
  });
});

describe("Undo", () => {
  const change = async (user: ReturnType<typeof userEvent.setup>, outcome: BulkOutcome = made()) => {
    applyBulkChange.mockResolvedValue(outcome);
    await selectTwo(user);
    await user.click(barButton("Change owner"));
    const d = await dialog();
    await choose(user, d, "New owner", "Marcus Hale");
    await user.click(await within(d).findByRole("button", { name: "Change 2 accounts" }));
    return screen.findByRole("region", { name: "What the change did" });
  };

  // Catches: Undo asking for another change, or its answer not said: what was put back, what was left and why (by name), and what was deleted since.
  it("undoes the change and says what it put back and what it left, in words", async () => {
    const user = userEvent.setup();
    undoBulkChange.mockResolvedValue(undone({
      restored: 1, gone: 1, skipped: [{ id: "a1", name: "Harborview Dental Group", code: "changed_since", reason: "Its owner was changed after this change." }],
      opportunities: { restored: 1, skipped: 1, gone: 0 },
    }));
    renderAt();
    const result = await change(user);
    await user.click(within(result).getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(undoBulkChange).toHaveBeenCalledWith("f1", "chg1"));
    const after = await screen.findByRole("region", { name: "What the change did" });
    await within(after).findByText("Undone.");
    expect(within(after).getByText("1 account is back as it was.")).toBeInTheDocument();
    expect(within(after).getByText("1 open opportunity is back as it was.")).toBeInTheDocument();
    expect(within(after).getByText("1 open opportunity was left as it is.")).toBeInTheDocument();
    expect(within(after).getByText("1 account was deleted since, so there is nothing to put back.")).toBeInTheDocument();
    expect(within(after).getByText("1 was skipped and left as they are")).toBeInTheDocument();
    expect(within(after).getByText("Harborview Dental Group: Its owner was changed after this change.")).toBeInTheDocument();
    // It can be undone only once.
    expect(within(after).queryByRole("button", { name: "Undo" })).toBeNull();
    await waitFor(() => expect(listAccounts.mock.calls.length).toBeGreaterThan(2));
  });

  // Catches: an expired undo answered with nothing, or Undo still offered after the database said it is too late.
  it("says in words that the ten minutes have passed, and offers no Undo again", async () => {
    const user = userEvent.setup();
    undoBulkChange.mockRejectedValue(new BulkChangeError("expired", "That change was made more than 10 minutes ago, so it can no longer be undone.", "PT410"));
    renderAt();
    const result = await change(user);
    await user.click(within(result).getByRole("button", { name: "Undo" }));
    expect(await within(result).findByText("That change was made more than 10 minutes ago, so it can no longer be undone.")).toBeInTheDocument();
    expect(within(result).queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("says in words that the change was already undone", async () => {
    const user = userEvent.setup();
    undoBulkChange.mockRejectedValue(new BulkChangeError("alreadyUndone", "That change was already undone.", "PT409"));
    renderAt();
    const result = await change(user);
    await user.click(within(result).getByRole("button", { name: "Undo" }));
    expect(await within(result).findByText("That change was already undone.")).toBeInTheDocument();
    expect(within(result).queryByRole("button", { name: "Undo" })).toBeNull();
  });

  // Catches: a change that is not the person's, or whose membership changed, shown as a failure to retry.
  it("says in words when the change isn't theirs to undo", async () => {
    const user = userEvent.setup();
    undoBulkChange.mockRejectedValue(new BulkChangeError("notFound", "That change isn't available to undo", "PT404"));
    renderAt();
    const result = await change(user);
    await user.click(within(result).getByRole("button", { name: "Undo" }));
    expect(await within(result).findByText("That change isn't available to undo")).toBeInTheDocument();
    expect(within(result).queryByRole("button", { name: "Undo" })).toBeNull();
  });

  // Catches: a failed undo that can't be tried again, or one that says nothing.
  it("keeps Undo after a failure that may pass, and says so", async () => {
    const user = userEvent.setup();
    undoBulkChange.mockRejectedValueOnce(new BulkChangeError("failed", "Couldn't undo that change. Try again.")).mockResolvedValue(undone());
    renderAt();
    const result = await change(user);
    await user.click(within(result).getByRole("button", { name: "Undo" }));
    expect(await within(result).findByText("Couldn't undo that change. Try again.")).toBeInTheDocument();
    await user.click(within(result).getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Undone.")).toBeInTheDocument();
  });

  // Catches: a change that did nothing offering an Undo of nothing.
  it("offers no Undo when nothing changed", async () => {
    const user = userEvent.setup();
    renderAt();
    const result = await change(user, made({ changed: 0, changeId: null, undoUntil: null, skipped: [] }));
    expect(within(result).getByText("Nothing changed.")).toBeInTheDocument();
    expect(within(result).queryByRole("button", { name: "Undo" })).toBeNull();
  });
});
