import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { AccountPage as Page } from "@/lib/accountPageApi";
import type { AccountRenewals, Renewal } from "@/lib/renewalsApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// An account's Renewals tab through a faked client (story CRM-A2.4b, screen 17; D-446 to D-455): what a person sees and does. The database's own rules (who may add and
// change, what is done, what each refusal says, that Start the renewal links) are tested in supabase/tests/placements_renewals.sql and start_the_renewal.sql; here the
// client answers and the page draws it and sends the right call.

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "dana@example.com" }, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { getAccountPage: vi.fn(), listAccountTab: vi.fn(), listAccountFiles: vi.fn(), updateAccount: vi.fn(), getSubmissionAccount: vi.fn() };
vi.mock("@/lib/accountPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountPageApi")), ...client }));
const renewalsClient = { getAccountRenewals: vi.fn(), addRenewal: vi.fn(), updateRenewal: vi.fn(), deleteRenewal: vi.fn(), markNotRenewed: vi.fn(), undoNotRenewed: vi.fn() };
vi.mock("@/lib/renewalsApi", async () => ({ ...(await vi.importActual<object>("@/lib/renewalsApi")), ...renewalsClient }));
const opportunities = { createOpportunity: vi.fn(), getNewOpportunityContext: vi.fn() };
vi.mock("@/lib/opportunityCreateApi", async () => ({ ...(await vi.importActual<object>("@/lib/opportunityCreateApi")), ...opportunities }));
vi.mock("@/lib/advisorApi", () => ({ documentUrl: vi.fn(), recordActivity: vi.fn() }));

const { default: AccountPage } = await import("./AccountPage");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Benefits", address: "acme" }, role: "Agent", isOwner: false, isSupport: false, supportEndsAt: null, supportSessionId: null,
  isPlatformAdmin: false, person: "Dana Reyes", ...over,
});
const tabOf = <R,>(rows: R[], count = rows.length) => ({ count, rows });
const account = {
  id: "a1", version: 3, name: "Harborview Dental Group", tradeName: null, website: null, webDomain: null, phone: null, street: null, city: "Portland", state: "OR", postalCode: null,
  industry: "Dental practice", employees: 45, statesOfOperation: ["OR"], currentProvider: null, source: "added_by_hand" as const, archivedAt: null as string | null,
  createdAt: "2026-10-28T10:00:00+00:00", updatedAt: "2026-11-01T10:00:00+00:00", status: "prospect" as const, owner: { id: "u1", name: "Dana Reyes" }, sourcePartner: null,
};
const page = (over: Partial<Page> = {}): Page => ({
  account, canChange: true,
  tabs: { contacts: tabOf([]), opportunities: tabOf([]), quotes: tabOf([]), activity: tabOf([]), files: tabOf([]) },
  ...over,
});
const renewal = (n: number, over: Partial<Renewal> = {}): Renewal => ({
  id: `r${n}`, version: 1, kind: "current_plan", withWhom: `Carrier ${n}`, renewsOn: "2027-01-01", daysAway: 45, opportunity: null, notRenewedOn: null, done: false, outcome: null, madeByWin: false, ...over,
});
const renewals = (rows: Renewal[], over: Partial<AccountRenewals> = {}): AccountRenewals => ({ count: rows.length, canChange: true, rows, ...over });

const Where = () => {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
};
const renderTab = (ws: Workspace = workspace()) => {
  const router = createMemoryRouter([
    { path: "/accounts/:id", element: <><AccountPage /><Where /></> },
    { path: "/opportunities/:id", element: <p data-testid="opportunity-page"><Where /></p> },
  ], { initialEntries: ["/accounts/a1?tab=renewals"] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
      <WorkspaceContext.Provider value={ws}><RouterProvider router={router} /></WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
};
const tab = async () => within(await screen.findByRole("region", { name: /^Renewals/ }));
const rowOf = async (name: RegExp | string) => (await tab()).getByRole("cell", { name }).closest("tr") as HTMLElement;

beforeEach(() => {
  for (const fn of [...Object.values(client), ...Object.values(renewalsClient), ...Object.values(opportunities)]) fn.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  client.getAccountPage.mockResolvedValue(page());
  client.listAccountTab.mockImplementation(async () => tabOf([]));
  renewalsClient.getAccountRenewals.mockResolvedValue(renewals([renewal(1)]));
  opportunities.getNewOpportunityContext.mockResolvedValue({
    account: { id: "a1", name: "Harborview Dental Group", archived: false, employees: 45 }, mainContact: { id: "c1", name: "Elena Marsh" },
    contacts: [{ id: "c1", name: "Elena Marsh", title: null, isMain: true }], partners: [], owners: [{ id: "u1", name: "Dana Reyes" }],
  });
  opportunities.createOpportunity.mockResolvedValue({ id: "o9", version: 1, stage: "qualifying" });
});

describe("the Renewals tab: what it shows (D-448, D-449, D-454)", () => {
  // Catches: a column of the story missing (what, with whom, the date, days away, the opportunity working it), the count not the database's, or days away worded another way.
  it("lists each renewal with what renews, with whom, the date, how far away it is and its opportunity", async () => {
    renewalsClient.getAccountRenewals.mockResolvedValue(renewals([
      renewal(1, { kind: "peo_placement", withWhom: "Justworks", daysAway: 45, opportunity: { id: "o1", name: "January 2027 renewal", stage: "qualifying" } }),
      renewal(2, { daysAway: 0 }),
      renewal(3, { daysAway: 1 }),
    ]));
    renderTab();
    const t = await tab();
    expect(t.getByRole("heading", { name: /Renewals\s*3/ })).toBeInTheDocument();
    expect(t.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["What renews", "With", "Renewal date", "In", "Being worked in", "Actions"]);
    const first = await rowOf("Justworks");
    expect(first).toHaveTextContent("A PEO placement");
    expect(first).toHaveTextContent("Jan 1, 2027");
    expect(first).toHaveTextContent("in 45 days");
    expect(within(first).getByRole("link", { name: "January 2027 renewal" })).toHaveAttribute("href", "/opportunities/o1");
    expect(await rowOf("Carrier 2")).toHaveTextContent("today");
    expect(await rowOf("Carrier 3")).toHaveTextContent("in 1 day");
  });

  // Catches: a past renewal not done looking like the others (D-448: warning colour), and its words ("12 days ago").
  it("shows a past renewal that is not done in the warning colour", async () => {
    renewalsClient.getAccountRenewals.mockResolvedValue(renewals([renewal(1, { daysAway: -12 })]));
    renderTab();
    const ago = within(await rowOf("Carrier 1")).getByText("12 days ago");
    expect(ago.className).toContain("text-warning");
  });

  // Catches: a done renewal still offering to be started or marked, or "Renewed" / "Didn't renew" not said (D-449).
  it("says a renewal is renewed or didn't renew, and offers no Start the renewal or Didn't renew on a done one", async () => {
    renewalsClient.getAccountRenewals.mockResolvedValue(renewals([
      renewal(1, { done: true, outcome: "renewed", opportunity: { id: "o1", name: "Won one", stage: "won" } }),
      renewal(2, { done: true, outcome: "not_renewed", notRenewedOn: "2026-12-01" }),
    ]));
    renderTab();
    const won = await rowOf("Carrier 1");
    expect(within(won).getByText("Renewed")).toBeInTheDocument();
    expect(within(won).queryByRole("button", { name: /Start the renewal/ })).toBeNull();
    expect(within(won).queryByRole("button", { name: /Didn't renew/ })).toBeNull();
    const lost = await rowOf("Carrier 2");
    expect(within(lost).getByText("Didn't renew")).toBeInTheDocument();
    expect(within(lost).queryByRole("button", { name: /Start the renewal/ })).toBeNull();
    expect(within(lost).getByRole("button", { name: /Undo/ })).toBeInTheDocument();
  });

  // Catches: the empty tab not saying what to do (CRM-A2.1), or a second "Add a renewal" beside the empty line.
  it("says 'No renewal on file' with one Add a renewal when there are none", async () => {
    renewalsClient.getAccountRenewals.mockResolvedValue(renewals([]));
    renderTab();
    const t = await tab();
    expect(t.getByText(/No renewal on file\./)).toBeInTheDocument();
    expect(t.getAllByRole("button", { name: "Add a renewal" })).toHaveLength(1);
  });

  // Catches: Add, Edit, Delete and Start shown where the database refuses every write (a Nevermore support session, an archived account), or to someone who may not change.
  it("offers no actions in a support session, and only Add on an account the person may see but not change", async () => {
    renderTab(workspace({ isSupport: true }));
    expect((await rowOf("Carrier 1")).querySelectorAll("button")).toHaveLength(0);
    expect((await tab()).queryByRole("button", { name: "Add a renewal" })).toBeNull();
  });

  it("offers Add a renewal but no Edit, Delete, Didn't renew or Start to someone who may not change the account", async () => {
    renewalsClient.getAccountRenewals.mockResolvedValue(renewals([renewal(1)], { canChange: false }));
    renderTab();
    const t = await tab();
    expect(t.getByRole("button", { name: "Add a renewal" })).toBeInTheDocument();
    expect(t.queryByRole("button", { name: /Edit|Delete|Didn't renew|Start the renewal/ })).toBeNull();
  });
});

describe("the Renewals tab: Start the renewal (D-449)", () => {
  // Catches: no way to start from a renewal; the form not opened for that renewal; the save not linking it (the renewal's id) and the opportunity's page not opened.
  it("opens New opportunity filled in for the renewal, saves with its id and opens the new opportunity", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(within(await rowOf("Carrier 1")).getByRole("button", { name: /Start the renewal/ }));
    const dialog = await screen.findByRole("dialog", { name: "Start the renewal" });
    expect(await within(dialog).findByLabelText("Opportunity name")).toHaveValue("January 2027 renewal");
    expect(within(dialog).getByLabelText("Source")).toHaveValue("Renewal");
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    await waitFor(() => expect(opportunities.createOpportunity).toHaveBeenCalledWith("f1", "a1", expect.objectContaining({ renewalId: "r1", source: "Renewal", targetStart: "2027-01-01" })));
    expect(await screen.findByTestId("opportunity-page")).toBeInTheDocument();
  });

  // Catches: Start the renewal offered while an open opportunity works the renewal (D-449), or not offered again once that opportunity was lost.
  it("is not offered while an open opportunity works the renewal, and is again once it was lost", async () => {
    renewalsClient.getAccountRenewals.mockResolvedValue(renewals([
      renewal(1, { opportunity: { id: "o1", name: "Working", stage: "in_market" } }),
      renewal(2, { opportunity: { id: "o2", name: "Gone", stage: "lost" } }),
    ]));
    renderTab();
    expect(within(await rowOf("Carrier 1")).queryByRole("button", { name: /Start the renewal/ })).toBeNull();
    const lost = await rowOf("Carrier 2");
    expect(within(lost).getByRole("link", { name: "Gone, lost" })).toBeInTheDocument();
    expect(within(lost).getByRole("button", { name: /Start the renewal/ })).toBeInTheDocument();
  });
});

describe("Start the renewal after someone else started it first (D-449)", () => {
  // Catches: the renewal still showing "Start the renewal" after the database says an open opportunity already works it, so the person tries again and again.
  it("reads the renewals again, so the renewal now shows the other opportunity", async () => {
    const user = userEvent.setup();
    opportunities.createOpportunity.mockRejectedValue(new (await import("@/lib/opportunityCreateApi")).OpportunityError("renewalTaken", "Its renewal is being worked by January 2027 renewal", "PT409"));
    renderTab();
    await user.click(within(await rowOf("Carrier 1")).getByRole("button", { name: /Start the renewal/ }));
    const dialog = await screen.findByRole("dialog", { name: "Start the renewal" });
    await within(dialog).findByLabelText("Opportunity name");
    const reads = renewalsClient.getAccountRenewals.mock.calls.length;
    renewalsClient.getAccountRenewals.mockResolvedValue(renewals([renewal(1, { opportunity: { id: "o7", name: "January 2027 renewal", stage: "in_market" } })]));
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    expect(await within(dialog).findByText("Its renewal is being worked by January 2027 renewal")).toBeInTheDocument();
    await waitFor(() => expect(renewalsClient.getAccountRenewals.mock.calls.length).toBeGreaterThan(reads));
  });
});

describe("the Renewals tab: Add a renewal (D-447)", () => {
  // Catches: the form's fields wrong, the start date asked for a current plan (the database refuses it), what was typed sent untrimmed or under another name, the list not read again.
  it("adds a PEO placement renewal with its start date, then reads the renewals again", async () => {
    const user = userEvent.setup();
    renewalsClient.addRenewal.mockResolvedValue(renewal(9));
    renderTab();
    await user.click((await tab()).getByRole("button", { name: "Add a renewal" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a renewal" });
    await user.type(within(dialog).getByLabelText("With"), "  Justworks ");
    await user.type(within(dialog).getByLabelText("Renewal date"), "2027-06-01");
    await user.type(within(dialog).getByLabelText("Placement start date"), "2026-06-01");
    await user.click(within(dialog).getByRole("button", { name: "Add renewal" }));
    await waitFor(() => expect(renewalsClient.addRenewal).toHaveBeenCalledWith("f1", "a1", { kind: "peo_placement", withWhom: "Justworks", renewsOn: "2027-06-01", placementStartOn: "2026-06-01" }));
    await waitFor(() => expect(renewalsClient.getAccountRenewals.mock.calls.length).toBeGreaterThan(1));
    expect(toast.success).toHaveBeenCalledWith("Renewal added");
  });

  // Catches: a "With" that takes 200 characters when the database takes 80, and the start date's refusal put under the Renewal date field (it is about no field of the form).
  it("holds With to 80 characters, and puts a refusal about the start date beside the buttons, not under the date", async () => {
    const user = userEvent.setup();
    const { RenewalError } = await import("@/lib/renewalsApi");
    renewalsClient.addRenewal.mockRejectedValue(new RenewalError("invalid", "Only a PEO placement has a start date.", "22023"));
    renderTab();
    await user.click((await tab()).getByRole("button", { name: "Add a renewal" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a renewal" });
    expect(within(dialog).getByLabelText("With")).toHaveAttribute("maxlength", "80");
    await user.type(within(dialog).getByLabelText("With"), "Justworks");
    await user.type(within(dialog).getByLabelText("Renewal date"), "2027-06-01");
    await user.click(within(dialog).getByRole("button", { name: "Add renewal" }));
    const words = await within(dialog).findByText("Only a PEO placement has a start date.");
    expect(within(dialog).getByLabelText("Renewal date")).not.toHaveAccessibleDescription(/Only a PEO placement/);
  });

  it("asks no start date for the employer's current plan", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click((await tab()).getByRole("button", { name: "Add a renewal" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a renewal" });
    await user.selectOptions(within(dialog).getByLabelText("What renews"), "current_plan");
    expect(within(dialog).queryByLabelText("Placement start date")).toBeNull();
  });

  // Catches: a missing with-whom or date sent to the database, or a refusal in its words lost.
  it("asks for who it is with and the date before sending, and shows the database's refusal in its words", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click((await tab()).getByRole("button", { name: "Add a renewal" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a renewal" });
    await user.click(within(dialog).getByRole("button", { name: "Add renewal" }));
    expect(await within(dialog).findByText("Enter who it is with.")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter the renewal date.")).toBeInTheDocument();
    expect(renewalsClient.addRenewal).not.toHaveBeenCalled();
  });
});

describe("the Renewals tab: Edit, with the conflict dialog (D-46)", () => {
  // Catches: the save not naming the version the person started from, or the page not reading the list again.
  it("saves with whom and the date from the version the renewal had when Edit was opened", async () => {
    const user = userEvent.setup();
    renewalsClient.getAccountRenewals.mockResolvedValue(renewals([renewal(1, { version: 4 })]));
    renewalsClient.updateRenewal.mockResolvedValue({ conflict: false, renewal: renewal(1, { version: 5, withWhom: "Aetna" }) });
    renderTab();
    await user.click(within(await rowOf("Carrier 1")).getByRole("button", { name: /Edit/ }));
    const dialog = await screen.findByRole("dialog", { name: "Edit the renewal" });
    await user.clear(within(dialog).getByLabelText("With"));
    await user.type(within(dialog).getByLabelText("With"), "Aetna");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(renewalsClient.updateRenewal).toHaveBeenCalledWith("f1", "r1", { withWhom: "Aetna", renewsOn: "2027-01-01" }, 4));
  });

  // Catches: someone else's change overwritten, or lost without the person being asked: the dialog sets what they typed beside what is there now and nothing is saved.
  it("opens the conflict dialog when someone saved first, and saves nothing", async () => {
    const user = userEvent.setup();
    renewalsClient.updateRenewal.mockResolvedValue({
      conflict: true, currentVersion: 2, current: { withWhom: "Their Carrier", renewsOn: "2027-01-01", notRenewedOn: null },
      changed: [{ field: "with_whom", value: "Their Carrier", who: "marcus@example.com", at: "2026-11-14T10:00:00Z" }],
    });
    renderTab();
    await user.click(within(await rowOf("Carrier 1")).getByRole("button", { name: /Edit/ }));
    const dialog = await screen.findByRole("dialog", { name: "Edit the renewal" });
    await user.clear(within(dialog).getByLabelText("With"));
    await user.type(within(dialog).getByLabelText("With"), "My Carrier");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    const conflict = await screen.findByRole("alertdialog");
    expect(within(conflict).getByText("Someone else changed this renewal")).toBeInTheDocument();
    expect(within(conflict).getAllByText("Their Carrier").length).toBeGreaterThan(0);
    expect(within(conflict).getAllByText("My Carrier").length).toBeGreaterThan(0);
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("the Renewals tab: Didn't renew and its undo (D-451)", () => {
  // Catches: the day not offered as the renewal's date, the version not sent, or the mark not sent at all.
  it("marks it from its own version with the day offered as the renewal's date", async () => {
    const user = userEvent.setup();
    renewalsClient.getAccountRenewals.mockResolvedValue(renewals([renewal(1, { version: 3 })]));
    renewalsClient.markNotRenewed.mockResolvedValue({ conflict: false, renewal: renewal(1, { version: 4, done: true, outcome: "not_renewed", notRenewedOn: "2027-01-01" }) });
    renderTab();
    await user.click(within(await rowOf("Carrier 1")).getByRole("button", { name: /Didn't renew/ }));
    const dialog = await screen.findByRole("dialog", { name: "Didn't renew" });
    expect(within(dialog).getByLabelText("Day it didn't renew")).toHaveValue("2027-01-01");
    await user.click(within(dialog).getByRole("button", { name: "Mark as not renewed" }));
    await waitFor(() => expect(renewalsClient.markNotRenewed).toHaveBeenCalledWith("f1", "r1", "2027-01-01", 3));
  });

  // Catches: Undo not sending the version it saw, or a stale undo told as success.
  it("undoes it from the version it saw, and says so when someone else changed it first", async () => {
    const user = userEvent.setup();
    renewalsClient.getAccountRenewals.mockResolvedValue(renewals([renewal(1, { version: 6, done: true, outcome: "not_renewed", notRenewedOn: "2026-12-01" })]));
    renewalsClient.undoNotRenewed.mockResolvedValue({ conflict: true, currentVersion: 7, current: { withWhom: null, renewsOn: null, notRenewedOn: null }, changed: [] });
    renderTab();
    await user.click(within(await rowOf("Carrier 1")).getByRole("button", { name: /Undo/ }));
    await waitFor(() => expect(renewalsClient.undoNotRenewed).toHaveBeenCalledWith("f1", "r1", 6));
    expect(toast.error).toHaveBeenCalledWith("Someone else changed this renewal. It is shown as it is now.");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("the Renewals tab: Undo is guarded against a double click", () => {
  // Catches: a second click while the undo is on its way sending a second undo (from a version that has just moved: a spurious conflict).
  it("disables Undo while it is in flight, so two clicks send one undo", async () => {
    const user = userEvent.setup();
    renewalsClient.getAccountRenewals.mockResolvedValue(renewals([renewal(1, { version: 6, done: true, outcome: "not_renewed", notRenewedOn: "2026-12-01" })]));
    let finish: (v: unknown) => void = () => {};
    renewalsClient.undoNotRenewed.mockReturnValue(new Promise((r) => { finish = r; }));
    renderTab();
    const undo = within(await rowOf("Carrier 1")).getByRole("button", { name: /Undo/ });
    await user.click(undo);
    await user.click(undo);
    expect(renewalsClient.undoNotRenewed).toHaveBeenCalledTimes(1);
    expect(undo).toBeDisabled();
    finish({ conflict: false, renewal: renewal(1, { version: 7 }) });
    await waitFor(() => expect(undo).not.toBeDisabled());
  });
});

describe("the Renewals tab: Delete (D-452)", () => {
  // Catches: a delete with no question, one not from the version seen, or one offered on a renewal a win made (it is deleted only by reopening that win).
  it("asks first, then deletes from the version seen, and offers none on a renewal a win made", async () => {
    const user = userEvent.setup();
    renewalsClient.getAccountRenewals.mockResolvedValue(renewals([renewal(1, { version: 2 }), renewal(2, { madeByWin: true })]));
    renewalsClient.deleteRenewal.mockResolvedValue({ conflict: false });
    renderTab();
    expect(within(await rowOf("Carrier 2")).queryByRole("button", { name: /Delete/ })).toBeNull();
    await user.click(within(await rowOf("Carrier 1")).getByRole("button", { name: /Delete/ }));
    const ask = await screen.findByRole("alertdialog");
    expect(renewalsClient.deleteRenewal).not.toHaveBeenCalled();
    await user.click(within(ask).getByRole("button", { name: "Delete renewal" }));
    await waitFor(() => expect(renewalsClient.deleteRenewal).toHaveBeenCalledWith("f1", "r1", 2));
    expect(toast.success).toHaveBeenCalledWith("Renewal deleted");
  });
});
