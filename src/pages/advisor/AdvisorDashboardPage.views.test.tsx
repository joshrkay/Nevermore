import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { QueueRow } from "@/lib/queueApi";
import type { SavedView } from "@/lib/tableSettingsApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// Saved views on the submissions queue (story CRM-S3.4a): the tabs across the top are views, today's status tabs are the built-in ones, a person saves
// the current filters as their own view, renames and deletes it, an owner shares it with the firm, and each tab shows its count. The database's rules are
// in supabase/tests/table_settings.sql; these are what a person sees and does through the page, with the calls faked.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut: vi.fn() }) }));
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
const listQueue = vi.fn();
const countQueueViews = vi.fn();
vi.mock("@/lib/advisorApi", async (original) => ({ ...(await original<typeof import("@/lib/advisorApi")>()), listEmailProblems: async () => [] }));
vi.mock("@/lib/queueApi", async (original) => ({
  ...(await original<typeof import("@/lib/queueApi")>()),
  listQueue: async (opts: { page?: number }) => ({ page: 1, pageSize: 50, ...(await listQueue(opts)) }),
  countQueueViews: (...args: unknown[]) => countQueueViews(...args),
}));
const api = {
  listSavedViews: vi.fn(), saveView: vi.fn(), renameSavedView: vi.fn(), changeSavedView: vi.fn(), deleteSavedView: vi.fn(),
  shareSavedView: vi.fn(), unshareSavedView: vi.fn(), fetchMyColumns: vi.fn(), setMyColumns: vi.fn(),
};
vi.mock("@/lib/tableSettingsApi", () => ({
  listSavedViews: (...a: unknown[]) => api.listSavedViews(...a),
  saveView: (...a: unknown[]) => api.saveView(...a),
  renameSavedView: (...a: unknown[]) => api.renameSavedView(...a),
  changeSavedView: (...a: unknown[]) => api.changeSavedView(...a),
  deleteSavedView: (...a: unknown[]) => api.deleteSavedView(...a),
  shareSavedView: (...a: unknown[]) => api.shareSavedView(...a),
  unshareSavedView: (...a: unknown[]) => api.unshareSavedView(...a),
  fetchMyColumns: (...a: unknown[]) => api.fetchMyColumns(...a),
  setMyColumns: (...a: unknown[]) => api.setMyColumns(...a),
}));
const { default: AdvisorDashboardPage } = await import("./AdvisorDashboardPage");

const row = (over: Partial<QueueRow> = {}): QueueRow => ({
  session_id: "s1", company_name: "Acme", contact_name: "Pat Prospect", employee_count: 12, pipeline_status: "submitted", intake_status: "submitted",
  signer_name: "Jo Doe", submitted_at: "2026-10-01T12:00:00Z", created_at: "2026-09-30T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", missing_required: [],
  open_fields: 0, flagged_fields: 0, verified_fields: 0, file_id: "EAA-2026-ACME0001", states: ["CA", "NY"], needs_action: false, needs_action_note: null,
  quote_requests_sent: 0, quotes_received: 0, oldest_waiting_on: null, earliest_quote_expires_on: null, sent_older_version: false, new_peo_mail_requests: 0,
  start_month: null, has_new_peo_mail: false, waiting_on_peo: false, ...over,
});
const query = (over: Record<string, unknown> = {}) => ({ filters: [], sort: null, page: 1, search: "", ...over });
const yes = (field: string) => ({ field, op: "is", value: true });
const view = (over: Partial<SavedView> = {}): SavedView => ({
  id: "v1", name: "Chasing", filters: [yes("needs_action")] as SavedView["filters"], sort: null, columns: null, shared: false, mine: true,
  canChange: true, canShare: false, canUnshare: false, updatedAt: "2026-11-01T00:00:00Z", ...over,
});

const firm = { id: "firm-1", name: "Alpha", address: "alpha" };
const workspace = (over: Partial<Workspace> = {}): Workspace => ({ firm, role: "Owner", isOwner: true, isSupport: false, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: false, person: "Sam", ...over });
const Probe = () => <p data-testid="location">{useLocation().search}</p>;
const draw = (url = "/advisor", ws: Workspace = workspace()) =>
  render(
    <WorkspaceContext.Provider value={ws}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[url]}>
          <Routes><Route path="/advisor" element={<><AdvisorDashboardPage /><Probe /></>} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </WorkspaceContext.Provider>,
  );
const where = () => screen.getByTestId("location").textContent;
const tabs = () => within(screen.getByRole("navigation", { name: "Views" }));
const tabNames = () => tabs().getAllByRole("link").map((l) => l.textContent);
const headerSort = (name: string) => screen.getByRole("columnheader", { name: new RegExp(`^${name}`) }).getAttribute("aria-sort");

beforeEach(() => {
  listQueue.mockReset().mockResolvedValue({ rows: [row()], total: 1 });
  countQueueViews.mockReset().mockResolvedValue([]);
  for (const f of Object.values(api)) f.mockReset();
  api.listSavedViews.mockResolvedValue([]);
  api.fetchMyColumns.mockResolvedValue({ columns: null, source: "default" });
  api.setMyColumns.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("the saved views bar", () => {
  // Catches: saved views asked for under the wrong firm or table, or not asked for at all.
  it("asks for this firm's saved views of the submissions table", async () => {
    draw();
    await waitFor(() => expect(api.listSavedViews).toHaveBeenCalledWith("firm-1", "submissions"));
  });

  // Catches: a saved view missing from the tabs, or the built-in tabs pushed out of their place.
  it("draws each saved view as a tab after the built-in ones, with its count", async () => {
    api.listSavedViews.mockResolvedValue([view({ id: "v1", name: "Chasing" }), view({ id: "v2", name: "Big firms", filters: [{ field: "employee_count", op: "more_than", value: 100 }] as SavedView["filters"] })]);
    countQueueViews.mockResolvedValue([{ name: "all", total: 20 }, { name: "v1", total: 4 }, { name: "v2", total: 7 }]);
    draw();
    expect(await screen.findByRole("link", { name: "Chasing 4" })).toBeInTheDocument();
    const names = tabNames();
    expect(names[0]).toBe("All statuses20");
    expect(names.slice(-2)).toEqual(["Chasing4", "Big firms7"]);
    expect(names.indexOf("Won")).toBeLessThan(names.indexOf("Chasing4"));
    // The count is asked by the view's own id, over its own filters (names of views can repeat; ids can't).
    const views = countQueueViews.mock.calls.at(-1)![0] as { name: string; filters: unknown[] }[];
    expect(views.find((v) => v.name === "v1")).toEqual({ name: "v1", filters: [yes("needs_action")] });
  });

  // Catches: opening a saved view asking for the table's rows, not the view's filters and sort, or the address not saying which view it is.
  it("opens a saved view with its filters and its sort, and the sort is in the headers", async () => {
    api.listSavedViews.mockResolvedValue([view({ sort: { field: "employee_count", direction: "desc" } })]);
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole("link", { name: /^Chasing/ }));
    await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")], sort: { field: "employee_count", direction: "desc" } })));
    expect(where()).toBe("?view=v1");
    expect(screen.getByRole("link", { name: /^Chasing/ })).toHaveAttribute("aria-current", "page");
    expect(headerSort("Employees")).toBe("descending");
  });

  // Catches: a sort clicked on another tab following the person into a view that has an order of its own, so the view does not open in its order.
  it("opens a view with its own order even when a column was sorted on the tab before", async () => {
    api.listSavedViews.mockResolvedValue([view({ sort: { field: "employee_count", direction: "desc" } })]);
    const user = userEvent.setup();
    draw("/advisor?sort=company_name");
    await user.click(await screen.findByRole("link", { name: /^Chasing/ }));
    expect(where()).toBe("?view=v1");
    await waitFor(() => expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")], sort: { field: "employee_count", direction: "desc" } })));
  });

  // Catches: a bookmark of a saved view landing on All because the views had not arrived when the address was read (D-141).
  it("honours a bookmarked saved view once the views have arrived, without asking for the wrong rows first", async () => {
    api.listSavedViews.mockResolvedValue([view()]);
    draw("/advisor?view=v1");
    expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
    expect(listQueue).toHaveBeenCalledTimes(1);
    expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")] }));
    expect(where()).toBe("?view=v1");
  });

  // Catches: a shared view looking like the person's own, so they try to rename a colleague's view.
  it("marks a view the firm shares, and gives a view a colleague saved no way to change it for an agent", async () => {
    api.listSavedViews.mockResolvedValue([view({ id: "v3", name: "Team's", shared: true, mine: false, canChange: false })]);
    draw("/advisor", workspace({ role: "Agent", isOwner: false }));
    const tab = await screen.findByRole("link", { name: /^Team's/ });
    expect(tab).toHaveTextContent("Shared with the firm");
    expect(screen.queryByRole("button", { name: "Options for Team's" })).toBeNull();
  });

  // Catches: the queue failing to show because the views failed to load (D-141: the table falls back to what it has).
  it("still shows the queue, and says the saved views couldn't be loaded, with a way to ask again", async () => {
    api.listSavedViews.mockRejectedValueOnce(new Error("Couldn't load the views."));
    const user = userEvent.setup();
    draw();
    expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
    expect(await screen.findByText("Your saved views couldn't be loaded.")).toBeInTheDocument();
    api.listSavedViews.mockResolvedValue([view()]);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /^Chasing/ })).toBeInTheDocument();
    expect(screen.queryByText("Your saved views couldn't be loaded.")).toBeNull();
  });
});

const ask = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByRole("link", { name: "Acme" });
  await user.click(screen.getByRole("button", { name: "Save this as a view" }));
  return screen.getByRole("dialog");
};
const typeName = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, name: string) => {
  await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
  await user.type(within(dialog).getByRole("textbox", { name: "Name" }), name);
};

describe("saving the current filters as a view", () => {
  // Catches: the filters on screen not being what is kept (the new view would open on other rows), or the sort and columns left out.
  it("keeps the filters in force, the sort and the person's columns under the name, and opens the new view", async () => {
    api.fetchMyColumns.mockResolvedValue({ columns: ["company", "status"], source: "mine" });
    api.saveView.mockResolvedValue("new-1");
    const user = userEvent.setup();
    draw("/advisor?view=won&filter=needs_action:is:true&sort=-employee_count");
    const dialog = await ask(user);
    await typeName(user, dialog, "  Chasing wins ");
    api.listSavedViews.mockResolvedValue([view({ id: "new-1", name: "Chasing wins", filters: [{ field: "pipeline_status", op: "any_of", value: ["won"] }, yes("needs_action")] as SavedView["filters"], sort: { field: "employee_count", direction: "desc" }, columns: ["company", "status"] })]);
    await user.click(within(dialog).getByRole("button", { name: "Save view" }));
    await waitFor(() => expect(api.saveView).toHaveBeenCalledTimes(1));
    expect(api.saveView).toHaveBeenCalledWith({
      firmId: "firm-1", table: "submissions", name: "Chasing wins",
      filters: [{ field: "pipeline_status", op: "any_of", value: ["won"] }, yes("needs_action")],
      sort: { field: "employee_count", direction: "desc" }, columns: ["company", "status"],
    });
    // The new tab is the one open, with the chips gone: they are the view's own filters now.
    await waitFor(() => expect(where()).toBe("?view=new-1"));
    expect(await screen.findByRole("link", { name: /^Chasing wins/ })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [{ field: "pipeline_status", op: "any_of", value: ["won"] }, yes("needs_action")], sort: { field: "employee_count", direction: "desc" } }));
  });

  // Catches: moving to a view the list doesn't hold yet (the refresh after the save didn't bring it), which the table would drop with "That view isn't available".
  it("stays where it is, with no complaint, when the saved view has not reached the list yet", async () => {
    api.saveView.mockResolvedValue("new-1");
    const user = userEvent.setup();
    draw("/advisor?filter=needs_action:is:true");
    const dialog = await ask(user);
    await typeName(user, dialog, "Chasing");
    await user.click(within(dialog).getByRole("button", { name: "Save view" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(where()).toBe("?filter=needs_action:is:true");
    expect(screen.queryByText(/isn't available/)).toBeNull();
  });

  // Catches: columns being saved when the person has kept none (the view would pin the usual columns for everyone it is shared with).
  it("keeps no columns when the person has kept none, and no sort when there is none", async () => {
    api.saveView.mockResolvedValue("new-1");
    const user = userEvent.setup();
    draw();
    const dialog = await ask(user);
    await typeName(user, dialog, "Everything");
    await user.click(within(dialog).getByRole("button", { name: "Save view" }));
    await waitFor(() => expect(api.saveView).toHaveBeenCalledWith({ firmId: "firm-1", table: "submissions", name: "Everything", filters: [], sort: null, columns: null }));
  });

  // Catches: a view saved with no name, or the blank reaching the database.
  it("asks for a name, in words, before anything is kept", async () => {
    const user = userEvent.setup();
    draw();
    const dialog = await ask(user);
    expect(within(dialog).getByText("Required")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Save view" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Give the view a name.");
    expect(api.saveView).not.toHaveBeenCalled();
  });

  // Catches: a name that is taken (or any refusal) closing the dialog and losing what was typed.
  it("keeps the dialog open with the database's words when the name is taken, and the name as typed", async () => {
    api.saveView.mockRejectedValue(new Error('You already have a view called "Chasing" on this table'));
    const user = userEvent.setup();
    draw();
    const dialog = await ask(user);
    await typeName(user, dialog, "Chasing");
    await user.click(within(dialog).getByRole("button", { name: "Save view" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent('You already have a view called "Chasing" on this table');
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Chasing");
  });

  // Catches: a closing firm or a support session being told to try again, for a save that can never work (ADR 0023, ADR 0024, D-217).
  it("shows the words of a closing firm's refusal as they are", async () => {
    api.saveView.mockRejectedValue(new Error("This firm is closing, so nothing in it can be changed."));
    const user = userEvent.setup();
    draw();
    const dialog = await ask(user);
    await typeName(user, dialog, "Chasing");
    await user.click(within(dialog).getByRole("button", { name: "Save view" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This firm is closing, so nothing in it can be changed.");
    expect(within(dialog).queryByText(/try again/i)).toBeNull();
  });

  // Catches: the dialog's earlier refusal staying on screen the next time it opens.
  it("opens clean the next time", async () => {
    api.saveView.mockRejectedValue(new Error("Nope."));
    const user = userEvent.setup();
    draw();
    let dialog = await ask(user);
    await typeName(user, dialog, "Chasing");
    await user.click(within(dialog).getByRole("button", { name: "Save view" }));
    await within(dialog).findByRole("alert");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    dialog = await ask(user);
    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("");
  });
});

const options = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole("button", { name: `Options for ${name}` }));
  return screen.getByRole("dialog");
};

describe("a person's own views", () => {
  beforeEach(() => {
    api.listSavedViews.mockResolvedValue([view()]);
    for (const f of [api.renameSavedView, api.deleteSavedView, api.shareSavedView, api.unshareSavedView, api.changeSavedView]) f.mockResolvedValue(undefined);
  });

  // Catches: a built-in tab offering to be renamed or deleted (built-in views are code, nothing can delete them).
  it("gives the built-in tabs no options", async () => {
    draw();
    await screen.findByRole("link", { name: /^Chasing/ });
    expect(screen.getAllByRole("button", { name: /^Options for/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Options for Won" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Options for All statuses" })).toBeNull();
  });

  describe("renaming", () => {
    // Catches: the rename not reaching the database by the view's id, or the tab keeping the old name.
    it("renames the view and the tab says the new name", async () => {
      const user = userEvent.setup();
      draw();
      let dialog = await options(user, "Chasing");
      await user.click(within(dialog).getByRole("button", { name: "Rename" }));
      dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Chasing");
      await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
      await user.type(within(dialog).getByRole("textbox", { name: "Name" }), " Needs me ");
      api.listSavedViews.mockResolvedValue([view({ name: "Needs me" })]);
      await user.click(within(dialog).getByRole("button", { name: "Rename view" }));
      expect(api.renameSavedView).toHaveBeenCalledWith("v1", "Needs me");
      expect(await screen.findByRole("link", { name: /^Needs me/ })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /^Chasing/ })).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    // Catches: a clash with another name closing the dialog and losing the typed name.
    it("keeps the dialog open with the database's words when the name is taken", async () => {
      api.renameSavedView.mockRejectedValue(new Error('You already have a view called "Big" on this table'));
      const user = userEvent.setup();
      draw();
      let dialog = await options(user, "Chasing");
      await user.click(within(dialog).getByRole("button", { name: "Rename" }));
      dialog = screen.getByRole("dialog");
      await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
      await user.type(within(dialog).getByRole("textbox", { name: "Name" }), "Big");
      await user.click(within(dialog).getByRole("button", { name: "Rename view" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent('You already have a view called "Big" on this table');
      expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Big");
    });
  });

  describe("deleting", () => {
    // Catches: a view deleted by one stray click, with nothing said about what goes with it.
    it("asks first, says what goes with it, and deletes nothing when cancelled", async () => {
      const user = userEvent.setup();
      draw();
      let dialog = await options(user, "Chasing");
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText(/Delete the view "Chasing"\?/)).toBeInTheDocument();
      expect(within(dialog).getByText(/choices of columns/)).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(api.deleteSavedView).not.toHaveBeenCalled();
      expect(screen.getByRole("link", { name: /^Chasing/ })).toBeInTheDocument();
    });

    // Catches: a deleted view that is the one open staying open, or the address left naming it (a "That view isn't available" line for the person's own act).
    it("deletes the view, and when it was open goes to all statuses without saying it is unavailable", async () => {
      const user = userEvent.setup();
      draw("/advisor?view=v1&filter=waiting_on_peo:is:true");
      let dialog = await options(user, "Chasing");
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      dialog = screen.getByRole("dialog");
      api.listSavedViews.mockResolvedValue([]);
      await user.click(within(dialog).getByRole("button", { name: "Delete view" }));
      expect(api.deleteSavedView).toHaveBeenCalledWith("v1");
      await waitFor(() => expect(screen.queryByRole("link", { name: /^Chasing/ })).toBeNull());
      expect(where()).toBe("?filter=waiting_on_peo:is:true");
      expect(screen.queryByText(/isn't available/)).toBeNull();
      expect(screen.getByRole("link", { name: /^All statuses/ })).toHaveAttribute("aria-current", "page");
    });

    // Catches: focus falling to the page when the tab it was on goes (a keyboard person loses their place in the bar).
    it("puts focus on the first tab once the deleted view's tab is gone", async () => {
      const user = userEvent.setup();
      draw();
      let dialog = await options(user, "Chasing");
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      dialog = screen.getByRole("dialog");
      api.listSavedViews.mockResolvedValue([]);
      await user.click(within(dialog).getByRole("button", { name: "Delete view" }));
      await waitFor(() => expect(screen.queryByRole("link", { name: /^Chasing/ })).toBeNull());
      await waitFor(() => expect(screen.getByRole("link", { name: /^All statuses/ })).toHaveFocus());
    });

    // Catches: a refused delete (a closing firm) saying nothing, or telling the person to try again.
    it("says why in the database's words when it can't be deleted, and keeps the view", async () => {
      api.deleteSavedView.mockRejectedValue(new Error("This firm is closing, so nothing in it can be changed."));
      const user = userEvent.setup();
      draw();
      let dialog = await options(user, "Chasing");
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Delete view" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("This firm is closing, so nothing in it can be changed.");
      expect(screen.getByRole("link", { name: /^Chasing/ })).toBeInTheDocument();
    });
  });

  describe("sharing, for an owner", () => {
    // Catches: an agent being offered sharing (only an owner may), or an owner not being offered it.
    it("offers Share with the firm to an owner on their own private view, and nothing of the kind to an agent", async () => {
      const user = userEvent.setup();
      api.listSavedViews.mockResolvedValue([view({ canShare: true })]);
      const { unmount } = draw();
      let dialog = await options(user, "Chasing");
      expect(within(dialog).getByRole("button", { name: "Share with the firm" })).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Stop sharing" })).toBeNull();
      unmount();
      api.listSavedViews.mockResolvedValue([view({ canShare: false })]);
      draw("/advisor", workspace({ role: "Agent", isOwner: false }));
      dialog = await options(user, "Chasing");
      expect(within(dialog).queryByRole("button", { name: /Share/ })).toBeNull();
    });

    // Catches: sharing that is asked for but not shown (the tab keeps looking private), or asked for by the wrong view.
    it("shares the view with the firm, and the tab says it is shared", async () => {
      api.listSavedViews.mockResolvedValue([view({ canShare: true })]);
      const user = userEvent.setup();
      draw();
      const dialog = await options(user, "Chasing");
      api.listSavedViews.mockResolvedValue([view({ shared: true, canShare: false, canUnshare: true })]);
      await user.click(within(dialog).getByRole("button", { name: "Share with the firm" }));
      expect(api.shareSavedView).toHaveBeenCalledWith("v1");
      expect(await screen.findByRole("link", { name: /^Chasing.*Shared with the firm/ })).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    // Catches: an owner who can't take a colleague's shared view back to private, or being offered to delete or rename it.
    it("lets an owner stop sharing a colleague's shared view, and offers them nothing else on it", async () => {
      api.listSavedViews.mockResolvedValue([view({ id: "v9", name: "Team's", shared: true, mine: false, canChange: false, canUnshare: true })]);
      const user = userEvent.setup();
      draw();
      const dialog = await options(user, "Team's");
      expect(within(dialog).queryByRole("button", { name: "Rename" })).toBeNull();
      expect(within(dialog).queryByRole("button", { name: "Delete" })).toBeNull();
      api.listSavedViews.mockResolvedValue([]);
      await user.click(within(dialog).getByRole("button", { name: "Stop sharing" }));
      expect(api.unshareSavedView).toHaveBeenCalledWith("v9");
      await waitFor(() => expect(screen.queryByRole("link", { name: /^Team's/ })).toBeNull());
    });

    // Catches: a refused share (another shared view of the same name) failing silently.
    it("says why in the database's words when the view can't be shared", async () => {
      api.listSavedViews.mockResolvedValue([view({ canShare: true })]);
      api.shareSavedView.mockRejectedValue(new Error('The firm already shares a view called "Chasing" on this table'));
      const user = userEvent.setup();
      draw();
      const dialog = await options(user, "Chasing");
      await user.click(within(dialog).getByRole("button", { name: "Share with the firm" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent('The firm already shares a view called "Chasing" on this table');
    });
  });

  describe("a view that was changed on screen", () => {
    // Catches: no way to keep a changed view (the person has to delete it and save it again), or chips left over a view that now holds them.
    it("offers to keep the chips and the sort as the view's own, and keeps them", async () => {
      api.fetchMyColumns.mockResolvedValue({ columns: ["company", "status"], source: "mine_for_view" });
      const user = userEvent.setup();
      draw("/advisor?view=v1&filter=waiting_on_peo:is:true&sort=-employee_count");
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.getByText("Changed on screen, not kept.")).toBeInTheDocument();
      api.listSavedViews.mockResolvedValue([view({ filters: [yes("needs_action"), yes("waiting_on_peo")] as SavedView["filters"], sort: { field: "employee_count", direction: "desc" } })]);
      await waitFor(() => expect(screen.getByRole("button", { name: "Keep the changes to Chasing" })).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "Keep the changes to Chasing" }));
      expect(api.changeSavedView).toHaveBeenCalledWith("v1", { filters: [yes("needs_action"), yes("waiting_on_peo")], sort: { field: "employee_count", direction: "desc" }, columns: ["company", "status"] });
      await waitFor(() => expect(where()).toBe("?view=v1"));
      await waitFor(() => expect(screen.queryByText("Changed on screen, not kept.")).toBeNull());
    });

    // Catches: the offer showing on a view nobody changed, or on a view the person may not change.
    it("offers nothing on a view as it is saved, or on a colleague's view", async () => {
      api.listSavedViews.mockResolvedValue([view({ id: "v9", name: "Team's", shared: true, mine: false, canChange: false })]);
      draw("/advisor?view=v9&filter=waiting_on_peo:is:true");
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.queryByRole("button", { name: /^Keep the changes/ })).toBeNull();
      expect(screen.getByText("Changed on screen, not kept.")).toBeInTheDocument();
      cleanup();
      api.listSavedViews.mockResolvedValue([view()]);
      draw("/advisor?view=v1");
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.queryByText("Changed on screen, not kept.")).toBeNull();
      expect(screen.queryByRole("button", { name: /^Keep the changes/ })).toBeNull();
    });
  });
});

describe("what a view brings with it", () => {
  const headerWords = () => screen.getAllByRole("columnheader").map((h) => h.textContent);

  // Catches: a view's columns saved but never drawn, or asked for under no view (the person's table choice shown on every view).
  it("draws the columns of the open view as the database answers for it, and the table's own on another tab", async () => {
    api.listSavedViews.mockResolvedValue([view({ columns: ["company", "status"] })]);
    api.fetchMyColumns.mockImplementation(async (_f: string, _t: string, id: string | null) => (id === "v1" ? { columns: ["company", "status"], source: "view" } : { columns: null, source: "default" }));
    const user = userEvent.setup();
    draw();
    await screen.findByRole("link", { name: "Acme" });
    expect(headerWords()).toHaveLength(10);
    await user.click(screen.getByRole("link", { name: /^Chasing/ }));
    await waitFor(() => expect(headerWords()).toEqual(["Company", "Status"]));
    expect(api.fetchMyColumns).toHaveBeenCalledWith("firm-1", "submissions", "v1");
    await user.click(screen.getByRole("link", { name: /^All statuses/ }));
    await waitFor(() => expect(headerWords()).toHaveLength(10));
  });

  // Catches: a change of columns on a view being kept for the whole table, so every other tab changes with it.
  it("keeps a change of columns made on a view for that view", async () => {
    api.listSavedViews.mockResolvedValue([view()]);
    const user = userEvent.setup();
    draw("/advisor?view=v1");
    await screen.findByRole("link", { name: "Acme" });
    await user.click(screen.getByRole("button", { name: "Columns" }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).queryByText("Available once your columns have loaded.")).toBeNull());
    await user.click(within(screen.getByRole("dialog")).getByRole("checkbox", { name: "Completeness" }));
    await waitFor(() => expect(api.setMyColumns).toHaveBeenCalledWith("firm-1", "submissions", "v1", expect.not.arrayContaining(["completeness"])));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Go back to this view's columns" })).toBeInTheDocument();
  });

  // Catches: a view's order that no column shows being invisible, with no way back to it once another column is sorted.
  it("says the order of a view whose sort no column shows, and goes back to it", async () => {
    api.listSavedViews.mockResolvedValue([view({ sort: { field: "signer_name", direction: "asc" } })]);
    const user = userEvent.setup();
    draw("/advisor?view=v1");
    expect(await screen.findByText("Order: Signer, ascending")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Company/ }));
    expect(await screen.findByText("Sorted by Company, ascending.")).toBeInTheDocument();
    expect(where()).toBe("?view=v1&sort=company_name");
    await user.click(screen.getByRole("button", { name: "Back to this view's order" }));
    await waitFor(() => expect(where()).toBe("?view=v1"));
    expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")], sort: { field: "signer_name", direction: "asc" } }));
  });

  // Catches: the tabs' numbers no longer agreeing with the rows each tab opens once a person's own filters are on screen (D-137).
  it("counts every tab, saved ones too, under the filters on screen", async () => {
    api.listSavedViews.mockResolvedValue([view()]);
    draw("/advisor?filter=waiting_on_peo:is:true&q=acme");
    await screen.findByRole("link", { name: "Acme" });
    await waitFor(() => expect((countQueueViews.mock.calls.at(-1)![0] as { name: string }[]).some((v) => v.name === "v1")).toBe(true));
    const [views, opts] = countQueueViews.mock.calls.at(-1)!;
    expect(views.find((v: { name: string }) => v.name === "v1").filters).toEqual([yes("needs_action"), yes("waiting_on_peo")]);
    expect(opts).toEqual({ search: "acme" });
  });

  // Catches: a deleted or unshared view that is open being kept for ever, or the person left on rows that no longer match any tab.
  it("goes to all statuses, and says the view isn't available, when a colleague's view is gone at the next refresh", async () => {
    api.listSavedViews.mockResolvedValue([view({ id: "v9", name: "Team's", shared: true, mine: false, canChange: false })]);
    const client = new QueryClient();
    render(
      <WorkspaceContext.Provider value={workspace()}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/advisor?view=v9"]}>
            <Routes><Route path="/advisor" element={<><AdvisorDashboardPage /><Probe /></>} /></Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </WorkspaceContext.Provider>,
    );
    await screen.findByRole("link", { name: "Acme" });
    expect(where()).toBe("?view=v9");
    api.listSavedViews.mockResolvedValue([]);
    await client.refetchQueries({ queryKey: ["table", "firm-1", "submissions", "saved-views"] });
    expect(await screen.findByText("That view isn't available, so this shows all statuses.")).toBeInTheDocument();
    await waitFor(() => expect(where()).toBe(""));
  });
});
