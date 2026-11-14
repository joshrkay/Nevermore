import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import type { QueueRow } from "@/lib/queueApi";
import { WorkspaceContext, type Workspace } from "@/components/workspace/workspaceContext";

// Saved views on the queue (story CRM-S3.4a, D-215 on). The database's rules for saved views (who reads, changes, shares; the names and the limits) are
// proved in supabase/tests/table_settings.sql; this file is what a person sees and does through the page, against a small fake of the database's
// functions that keeps the rules the page leans on (D-50). Any call the fake does not know is refused loudly, so a page that asks for something it
// should not is a failing test.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut: vi.fn() }) }));
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => ({ status: "none" }) }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const listQueue = vi.fn();
const countQueueViews = vi.fn();
const listEmailProblems = vi.fn();
vi.mock("@/lib/advisorApi", async (original) => ({ ...(await original<typeof import("@/lib/advisorApi")>()), listEmailProblems: () => listEmailProblems() }));
vi.mock("@/lib/queueApi", async (original) => ({
  ...(await original<typeof import("@/lib/queueApi")>()),
  listQueue: async (opts: { page?: number }) => {
    const result = await listQueue(opts);
    return Array.isArray(result) ? { rows: result, total: result.length, page: opts.page ?? 1, pageSize: 50 } : { page: opts.page ?? 1, pageSize: 50, ...result };
  },
  countQueueViews: (...args: unknown[]) => countQueueViews(...args),
}));
const { default: AdvisorDashboardPage } = await import("./AdvisorDashboardPage");

const query = (over: Record<string, unknown> = {}) => ({ filters: [], sort: null, page: 1, search: "", ...over });
const pipeline = (...values: string[]) => ({ field: "pipeline_status", op: "any_of", value: values });
const yes = (field: string) => ({ field, op: "is", value: true });

const row = (over: Partial<QueueRow> = {}): QueueRow => ({
  session_id: "s1", company_name: "Acme", contact_name: "Pat Prospect", employee_count: 12, pipeline_status: "submitted", intake_status: "submitted",
  signer_name: "Jo Doe", submitted_at: "2026-10-01T12:00:00Z", created_at: "2026-09-30T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", missing_required: [],
  open_fields: 0, flagged_fields: 0, verified_fields: 0, file_id: "EAA-2026-ACME0001", states: ["CA", "NY"], needs_action: false, needs_action_note: null,
  quote_requests_sent: 0, quotes_received: 0, oldest_waiting_on: null, earliest_quote_expires_on: null, sent_older_version: false, new_peo_mail_requests: 0,
  start_month: null, has_new_peo_mail: false, waiting_on_peo: false, ...over,
});

// ---- the database's functions, in memory: only what the page depends on ----
interface Stored { id: string; owner: string; name: string; filters: unknown[]; sort: unknown; columns: string[] | null; shared: boolean }
const ME = "me";
const SOMEONE = "someone-else";
let role: "owner" | "agent" = "agent";
let stored: Stored[] = [];
let nextId = 1;
/** Words the database refuses every write with (a closing firm, a support session: PT423). */
let locked: string | null = null;
/** Names the table's own column choice for the person (`null` is none), and per saved view. */
let keptColumns: string[] | null = null;
const keptOnView = new Map<string, string[]>();

const stored1 = (over: Partial<Stored> & { name: string }): Stored => ({ id: `view-${nextId++}`, owner: ME, filters: [], sort: null, columns: null, shared: false, ...over });
const refused = (code: string, message: string) => ({ data: null, error: { code, message } });
const ok = (data: unknown = null) => ({ data, error: null });
const listed = () =>
  stored
    .filter((v) => v.owner === ME || v.shared)
    .map((v) => ({
      view_id: v.id, name: v.name, filters: v.filters, sort: v.sort, columns: v.columns, shared: v.shared, mine: v.owner === ME,
      can_change: v.owner === ME && (!v.shared || role === "owner"), can_share: role === "owner" && v.owner === ME && !v.shared, can_unshare: role === "owner" && v.shared,
      updated_at: "2026-11-14T10:00:00Z",
    }));
const nameProblem = (name: string, except?: string) => {
  const trimmed = name.trim();
  if (trimmed === "" || Array.from(trimmed).length > 60) return refused("22023", "A view's name is 1 to 60 characters, with no space around it and no invisible character in it");
  if (stored.some((v) => v.owner === ME && v.id !== except && v.name.toLowerCase() === trimmed.toLowerCase())) return refused("PT409", `You already have a view called "${trimmed}" on this table`);
  return null;
};
const database = async (name: string, args: Record<string, unknown>) => {
  const writes = ["save_view", "rename_saved_view", "change_saved_view", "delete_saved_view", "share_saved_view", "unshare_saved_view", "set_my_table_columns"];
  if (locked !== null && writes.includes(name)) return refused("PT423", locked);
  const view = stored.find((v) => v.id === (args.p_view_id as string));
  switch (name) {
    case "list_saved_views": return ok(listed());
    case "my_table_columns": {
      const id = args.p_view_id as string | null;
      const found = id ? stored.find((v) => v.id === id) : undefined;
      if (id && !found) return refused("PT404", "That view isn't available");
      if (id && keptOnView.has(id)) return ok([{ columns: keptOnView.get(id), source: "mine_for_view" }]);
      if (found?.columns) return ok([{ columns: found.columns, source: "view" }]);
      return ok([{ columns: keptColumns, source: keptColumns ? "mine" : "default" }]);
    }
    case "set_my_table_columns": {
      const id = args.p_view_id as string | null;
      if (id) { if (args.p_columns) keptOnView.set(id, args.p_columns as string[]); else keptOnView.delete(id); } else keptColumns = args.p_columns as string[] | null;
      return ok();
    }
    case "save_view": {
      const problem = nameProblem(args.p_name as string);
      if (problem) return problem;
      if (stored.filter((v) => v.owner === ME).length >= 30) return refused("PT422", "You can keep at most 30 views of a table. Delete one first.");
      const made = stored1({ name: (args.p_name as string).trim(), filters: args.p_filters as unknown[], sort: args.p_sort, columns: args.p_columns as string[] | null });
      stored.push(made);
      return ok(made.id);
    }
    case "rename_saved_view": {
      if (!view) return refused("PT404", "That view isn't available");
      const problem = nameProblem(args.p_name as string, view.id);
      if (problem) return problem;
      view.name = (args.p_name as string).trim();
      return ok();
    }
    case "change_saved_view": {
      if (!view) return refused("PT404", "That view isn't available");
      Object.assign(view, { filters: args.p_filters, sort: args.p_sort, columns: args.p_columns });
      return ok();
    }
    case "delete_saved_view": {
      if (!view) return refused("PT404", "That view isn't available");
      stored = stored.filter((v) => v !== view);
      return ok();
    }
    case "share_saved_view": {
      if (!view) return refused("PT404", "That view isn't available");
      if (role !== "owner") return refused("42501", "Only an owner of the firm can share a view");
      view.shared = true;
      return ok();
    }
    case "unshare_saved_view": {
      if (!view) return refused("PT404", "That view isn't available");
      if (role !== "owner") return refused("42501", "Only an owner of the firm can stop sharing a view");
      view.shared = false;
      return ok();
    }
    default: return refused("XX000", `unexpected call to ${name}`);
  }
};
const asksOf = (name: string) => rpc.mock.calls.filter(([n]) => n === name).map(([, args]) => args);

const workspace = (): Workspace => ({
  firm: { id: "firm-1", name: "Alpha", address: "alpha" }, role: role === "owner" ? "Owner" : "Agent", isOwner: role === "owner", isSupport: false,
  supportEndsAt: null, supportSessionId: null, isPlatformAdmin: false, person: "Sam",
});
const LocationProbe = () => <p data-testid="location">{useLocation().search}</p>;
const renderAt = (url = "/advisor") =>
  render(
    <WorkspaceContext.Provider value={workspace()}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/advisor" element={<><AdvisorDashboardPage /><LocationProbe /></>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </WorkspaceContext.Provider>,
  );
const where = () => screen.getByTestId("location").textContent;
const filterRowGroup = () => screen.getByRole("group", { name: "Filters" });
const tabs = () => screen.getByRole("navigation", { name: "Views" });

// A queue that can be left for a row and come back to (a row opens /advisor/submissions/:id), as the app's routes do. `goTo` leaves or comes back the way a
// row's link, the browser's Back button or a typed address does, for the moments when a question over the page (Radix's alert dialog) makes the page's own links
// unreachable; `path` says where the person is now.
const ShowId = () => <p>Detail page for {useParams().id}</p>;
const GoBack = () => { const go = useNavigate(); return <button type="button" onClick={() => go(-1)}>Go back</button>; };
const PathProbe = () => { const { pathname, search } = useLocation(); return <p data-testid="path">{pathname}{search}</p>; };
let goTo: (to: string | number) => void = () => {};
const Navigator = () => { const go = useNavigate(); goTo = (to) => (typeof to === "number" ? go(to) : go(to)); return null; };
const renderWithRows = (client: QueryClient, url = "/advisor") =>
  render(
    <WorkspaceContext.Provider value={workspace()}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/advisor" element={<AdvisorDashboardPage />} />
            <Route path="/advisor/submissions/:id" element={<><ShowId /><GoBack /></>} />
          </Routes>
          <PathProbe />
          <Navigator />
        </MemoryRouter>
      </QueryClientProvider>
    </WorkspaceContext.Provider>,
  );
const path = () => screen.getByTestId("path").textContent;
/** Makes the database's answer to one function wait until the test lets it through (it is made, as the database would, when it is let through). */
const holdAnswerTo = (fn: string) => {
  const held = { answer: () => {} };
  rpc.mockImplementation((name: string, args: Record<string, unknown>) =>
    name === fn ? new Promise((resolve) => { held.answer = () => resolve(database(name, args)); }) : database(name, args));
  return held;
};

describe("saved views on the queue (CRM-S3.4a)", () => {
  beforeEach(() => {
    role = "agent";
    stored = [];
    nextId = 1;
    locked = null;
    keptColumns = null;
    keptOnView.clear();
    rpc.mockReset().mockImplementation(database);
    listQueue.mockReset().mockResolvedValue([row()]);
    countQueueViews.mockReset().mockResolvedValue([]);
    listEmailProblems.mockReset().mockResolvedValue([]);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  describe("the tabs", () => {
    // Catches: saved views never reaching the tabs, or reaching them with no number: "tabs across the top of a table are views" and "each view's tab shows its count".
    it("shows each saved view as a tab after the built-in ones, with its count, counted under its own filters", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      countQueueViews.mockImplementation(async (views: { name: string }[]) => views.map((v) => ({ name: v.name, total: v.name === "view-1" ? 4 : 20 })));
      renderAt();
      expect(await within(tabs()).findByRole("link", { name: "Hot leads 4" })).toBeInTheDocument();
      const names = within(tabs()).getAllByRole("link").map((l) => l.textContent);
      expect(names[0]).toMatch(/^All statuses/);
      expect(names[names.length - 1]).toMatch(/^Hot leads/);
      const [views] = countQueueViews.mock.calls.at(-1)!;
      expect(views.find((v: { name: string }) => v.name === "view-1")).toEqual({ name: "view-1", filters: [yes("needs_action")] });
      expect(asksOf("list_saved_views")).toEqual([{ p_firm_id: "firm-1", p_table: "submissions" }]);
    });

    // Catches: a shared view and a private one of the same name being indistinguishable on the tabs (a person's private view may carry the name of a shared
    // one), and a screen reader hearing nothing of it.
    it("marks the views the firm shares apart from the person's own, in words and not by colour alone", async () => {
      stored = [
        stored1({ name: "Hot leads", owner: SOMEONE, shared: true }),
        stored1({ name: "Hot leads", filters: [yes("waiting_on_peo")] }),
      ];
      renderAt();
      await within(tabs()).findByRole("link", { name: /shared with the firm/ });
      const links = within(tabs()).getAllByRole("link").filter((l) => /Hot leads/.test(l.textContent ?? ""));
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAccessibleName("Hot leads (shared with the firm)");
      expect(links[1]).toHaveAccessibleName("Hot leads");
    });
  });

  describe("opening a view", () => {
    const byCompany = { field: "company_name", direction: "asc" };

    // Catches: a view's sort being saved and never used, so every saved view opens in the table's own order ("the sort is kept with the saved view").
    it("asks for the rows in the view's own order, and the header says so", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")], sort: byCompany })];
      renderAt("/advisor?view=view-1");
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")], sort: byCompany }));
      expect(screen.getByRole("columnheader", { name: "Company" })).toHaveAttribute("aria-sort", "ascending");
      expect(where()).toBe("?view=view-1");
      expect(screen.getByRole("link", { name: /^Hot leads/ })).toHaveAttribute("aria-current", "page");
    });

    // Catches: the view's sort winning over a column the person has just clicked, so a header click does nothing on a saved view.
    it("lets a sort in the address win over the view's own", async () => {
      stored = [stored1({ name: "Hot leads", sort: byCompany })];
      renderAt("/advisor?view=view-1&sort=-employee_count");
      await screen.findByRole("link", { name: "Acme" });
      expect(listQueue).toHaveBeenLastCalledWith(query({ sort: { field: "employee_count", direction: "desc" } }));
      expect(screen.getByRole("columnheader", { name: "Company" })).toHaveAttribute("aria-sort", "none");
      expect(screen.getByRole("columnheader", { name: "Employees" })).toHaveAttribute("aria-sort", "descending");
    });
  });

  describe("the counts", () => {
    // Catches: the tabs' numbers being asked for twice on every visit, once for the built-in views and again when the saved ones arrive (the database counts
    // every tab's rows each time). The one round is two calls: the built-in tabs, then the saved ones.
    it("asks for the counts once, with the saved views in them, after the views have arrived", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      let arrive!: () => void;
      rpc.mockImplementation((name: string, args: Record<string, unknown>) =>
        name === "list_saved_views" ? new Promise((resolve) => { arrive = () => resolve(database(name, args)); }) : database(name, args));
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      await new Promise((r) => setTimeout(r, 60));
      expect(countQueueViews).not.toHaveBeenCalled();
      await act(async () => arrive());
      await waitFor(() => expect(countQueueViews).toHaveBeenCalledTimes(2));
      await new Promise((r) => setTimeout(r, 60));
      expect(countQueueViews).toHaveBeenCalledTimes(2);
      const names = countQueueViews.mock.calls.map(([views]) => views.map((v: { name: string }) => v.name));
      expect(names[0]).toContain("all");
      expect(names[0]).not.toContain("view-1");
      expect(names[1]).toEqual(["view-1"]);
    });

    // Catches: one saved view the database refuses (a filter on a field it has since dropped) making every built-in tab lose its number, because they were asked
    // for in the same call; a saved view's failure may cost the saved views' numbers, never the built-in tabs'.
    it("asks for the saved views' counts apart from the built-in ones, so a view the database refuses never takes the built-in tabs' numbers", async () => {
      stored = [stored1({ name: "Broken", filters: [{ field: "gone", op: "is", value: true }] })];
      countQueueViews.mockImplementation(async (views: { name: string; filters: { field: string }[] }[]) => {
        if (views.some((v) => v.filters.some((f) => f.field === "gone"))) throw new Error("View: a field it does not take");
        return views.map((v) => ({ name: v.name, total: 7 }));
      });
      renderAt();
      expect(await within(tabs()).findByRole("link", { name: "All statuses 7" })).toBeInTheDocument();
      expect(within(tabs()).getByRole("link", { name: "Won 7" })).toBeInTheDocument();
      expect(within(tabs()).getByRole("link", { name: "Broken" })).toBeInTheDocument();
    });
  });

  describe("the order", () => {
    const byCompany = { field: "company_name", direction: "asc" };
    const employeesFirst = { field: "employee_count", direction: "desc" };

    // Catches: a column the person sorted by on one tab being kept on a saved view that was saved in its own order, so the view's order ("the sort is kept
    // with the saved view") is never seen after a click; and the opposite: a tab with no order of its own throwing away the one the person chose.
    it("brings the view's own order when its tab is chosen, and keeps the person's sort over a tab that has none", async () => {
      stored = [stored1({ name: "By company", sort: byCompany }), stored1({ name: "Plain" })];
      const user = userEvent.setup();
      renderAt("/advisor?sort=-employee_count");
      await within(tabs()).findByRole("link", { name: "By company" });
      await user.click(within(tabs()).getByRole("link", { name: "Plain" }));
      await waitFor(() => expect(where()).toBe("?view=view-2&sort=-employee_count"));
      await user.click(within(tabs()).getByRole("link", { name: "By company" }));
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ sort: byCompany }));
      expect(screen.getByRole("columnheader", { name: "Company" })).toHaveAttribute("aria-sort", "ascending");
    });

    // Catches: the line over the table saying the order is "Newest first" while a saved view's own column is the order; and "Back to newest first" taking
    // a person to an order the view was never in.
    it("says nothing over the table while the view's own order shows, and offers the way back to that order once another column is sorted", async () => {
      stored = [stored1({ name: "By company", sort: byCompany })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.queryByText(/^Order:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Sorted by/)).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Employees" }));
      expect(await screen.findByText("Sorted by Employees, ascending.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Back to newest first" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Back to the order of “By company”" }));
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ sort: byCompany }));
      expect(screen.getByRole("columnheader", { name: "Company" })).toHaveAttribute("aria-sort", "ascending");
    });

    // Catches: a view with no order of its own losing the table's way back ("Back to newest first") once it has been sorted.
    it("keeps the table's own way back on a view that has no order of its own", async () => {
      stored = [stored1({ name: "Plain" })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1&sort=-employee_count");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(screen.getByRole("button", { name: "Back to newest first" }));
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      expect(await screen.findByText("Order: Newest first")).toBeInTheDocument();
    });

    // Catches: a sort the view already has being written to the address as a sort of the person's own, so the view then looks changed ("modified") for no
    // reason and the line over the table offers a way back from an order that is the view's.
    it("reads a sort equal to the view's own as no sort, and rewrites the address", async () => {
      stored = [stored1({ name: "Most staff", sort: employeesFirst })];
      renderAt("/advisor?view=view-1&sort=-employee_count");
      await screen.findByRole("link", { name: "Acme" });
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      expect(screen.queryByText(/^Sorted by/)).not.toBeInTheDocument();
    });
  });

  describe("the columns", () => {
    const headers = () => screen.getAllByRole("columnheader").map((h) => h.textContent);

    // Catches: a saved view's own columns being saved and never shown, or the person's choice for the table (here Contact only) being shown on the view, so
    // "kept per person per table and per saved view" is the table's alone (D-193).
    it("shows the view's own columns on its tab, asks for the person's choice on that view, and leaves the table's own choice alone on the other tabs", async () => {
      keptColumns = ["company", "contact"];
      stored = [stored1({ name: "Short", columns: ["company", "quotes", "status"] })];
      const user = userEvent.setup();
      renderAt();
      await within(tabs()).findByRole("link", { name: "Short" });
      await waitFor(() => expect(headers()).toEqual(["Company", "Contact"]));
      await user.click(within(tabs()).getByRole("link", { name: "Short" }));
      await waitFor(() => expect(headers()).toEqual(["Company", "Quotes", "Status"]));
      expect(asksOf("my_table_columns")).toContainEqual({ p_firm_id: "firm-1", p_table: "submissions", p_view_id: "view-1" });
      await user.click(within(tabs()).getByRole("link", { name: /^All statuses/ }));
      await waitFor(() => expect(headers()).toEqual(["Company", "Contact"]));
    });

    // Catches: "Back to default columns" on a saved view promising the table's defaults when it lands on the view's own columns (the database's order: the person's
    // own choice for the view, the view's columns, their choice for the table, the defaults), which D-193 left for this story to word.
    it("words the way back on a saved view as the view's own columns, and says it is there already when it is", async () => {
      stored = [stored1({ name: "Short", columns: ["company", "quotes", "status"] })];
      keptOnView.set("view-1", ["company", "states"]);
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await waitFor(() => expect(headers()).toEqual(["Company", "States"]));
      await user.click(screen.getByRole("button", { name: "Columns" }));
      const menu = await screen.findByRole("dialog", { name: "Columns" });
      expect(within(menu).queryByRole("button", { name: "Back to default columns" })).not.toBeInTheDocument();
      await user.click(within(menu).getByRole("button", { name: "Back to this view's columns" }));
      await waitFor(() => expect(headers()).toEqual(["Company", "Quotes", "Status"]));
      expect(asksOf("set_my_table_columns")).toEqual([{ p_firm_id: "firm-1", p_table: "submissions", p_view_id: "view-1", p_columns: null }]);
      expect(within(menu).getByRole("status")).toHaveTextContent("This view's columns restored. 3 columns shown.");
      const back = within(menu).getByRole("button", { name: "Back to this view's columns" });
      expect(back).toHaveAttribute("aria-disabled", "true");
      expect(back).toHaveAccessibleDescription("These are this view's columns already.");
    });

    // Catches: a column the table no longer has (named by a view saved before it was retired) being counted among the view's columns, so the way back says "4 columns"
    // over a table of 3 and never reads as "there already".
    it("counts only the view's columns the table still has", async () => {
      stored = [stored1({ name: "Short", columns: ["company", "retired", "quotes", "status"] })];
      keptOnView.set("view-1", ["company", "states"]);
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await waitFor(() => expect(headers()).toEqual(["Company", "States"]));
      await user.click(screen.getByRole("button", { name: "Columns" }));
      const menu = await screen.findByRole("dialog", { name: "Columns" });
      await user.click(within(menu).getByRole("button", { name: "Back to this view's columns" }));
      await waitFor(() => expect(headers()).toEqual(["Company", "Quotes", "Status"]));
      expect(within(menu).getByRole("status")).toHaveTextContent("This view's columns restored. 3 columns shown.");
      expect(within(menu).getByRole("button", { name: "Back to this view's columns" })).toHaveAttribute("aria-disabled", "true");
    });

    // Catches: a column choice made on a saved view being kept for the table, so one tab's columns change every tab's.
    it("keeps a column chosen on a view for that view alone", async () => {
      stored = [stored1({ name: "Short", columns: ["company", "quotes", "status"] })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await waitFor(() => expect(headers()).toEqual(["Company", "Quotes", "Status"]));
      await user.click(screen.getByRole("button", { name: "Columns" }));
      await user.click(within(await screen.findByRole("dialog", { name: "Columns" })).getByRole("checkbox", { name: "Status" }));
      await waitFor(() => expect(keptOnView.get("view-1")).toEqual(["company", "quotes"]));
      expect(keptColumns).toBeNull();
      expect(headers()).toEqual(["Company", "Quotes"]);
    });
  });

  describe("saving the current state as a view", () => {
    const DEFAULT_IDS = ["company", "contact", "states", "employees", "submitted", "status", "completeness", "quotes", "waiting_since", "quote_expires"];
    const openSave = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole("button", { name: "Save this as a view" }));
      return screen.findByRole("dialog", { name: "Save this as a view" });
    };
    const nameIt = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, name: string) => {
      await user.type(within(dialog).getByRole("textbox", { name: "View name" }), name);
      await user.click(within(dialog).getByRole("button", { name: "Save view" }));
    };

    // Catches: the story's first line ("a person can save the current filters as their own view") not being there; a view saved with something other
    // than what the person is looking at (the chips, the sort, the columns on screen); and the new view not being the one opened afterwards.
    it("keeps the filters in force, the sort and the columns shown under a name, and opens that view with nothing left over the top of it", async () => {
      const user = userEvent.setup();
      renderAt("/advisor?filter=needs_action:is:true&sort=-employee_count");
      await screen.findByRole("link", { name: "Acme" });
      const dialog = await openSave(user);
      await nameIt(user, dialog, "Hot leads");
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      expect(asksOf("save_view")).toEqual([{
        p_firm_id: "firm-1", p_table: "submissions", p_name: "Hot leads", p_filters: [yes("needs_action")],
        p_sort: { field: "employee_count", direction: "desc" }, p_columns: DEFAULT_IDS,
      }]);
      expect(await within(tabs()).findByRole("link", { name: /^Hot leads/ })).toHaveAttribute("aria-current", "page");
      expect(screen.queryByRole("dialog", { name: "Save this as a view" })).not.toBeInTheDocument();
      // The view now holds the filters and the sort, so nothing is left over the top of it: no chip, no line about another sort.
      expect(screen.queryByRole("list", { name: "Filters in force" })).not.toBeInTheDocument();
      expect(screen.queryByText(/^Sorted by/)).not.toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")], sort: { field: "employee_count", direction: "desc" } }));
      expect(screen.queryByText(/isn't available/)).not.toBeInTheDocument();
    });

    // Catches: a save nobody is told happened (the form just disappears), and focus dropped to the page instead of the new tab, so a keyboard person has to
    // find the view they made.
    it("says in one polite status what it did, and puts focus on the new view's tab", async () => {
      const user = userEvent.setup();
      renderAt("/advisor?filter=needs_action:is:true");
      await screen.findByRole("link", { name: "Acme" });
      await nameIt(user, await openSave(user), "Hot leads");
      const status = await screen.findByText("Saved the view “Hot leads”. It is open now.");
      expect(status).toHaveAttribute("role", "status");
      expect(status).toHaveAttribute("aria-live", "polite");
      await waitFor(() => expect(within(tabs()).getByRole("link", { name: /^Hot leads/ })).toHaveFocus());
    });

    // Catches: the status being put on the page already holding its words (a live region inserted with text is not reliably announced), which would make the
    // announcement of a save unreliable; and a status on every page that never saves a view.
    it("puts the status on the page, empty, when the first control is used, and not before", async () => {
      const user = userEvent.setup();
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.queryAllByRole("status").filter((s) => s.className.includes("sr-only"))).toHaveLength(0);
      await user.click(screen.getByRole("button", { name: "Save this as a view" }));
      const empty = (await screen.findAllByRole("status")).filter((s) => s.className.includes("sr-only"));
      expect(empty).toHaveLength(1);
      expect(empty[0]).toBeEmptyDOMElement();
    });

    // Catches: a view starting from the table's tab ("Won") saving only the chips and losing the tab's own filters, so what is saved is not what the person
    // was looking at.
    it("keeps the open tab's own filters as well as the chips, so the view is what was on screen", async () => {
      const user = userEvent.setup();
      renderAt("/advisor?view=won&filter=needs_action:is:true");
      await screen.findByRole("link", { name: "Acme" });
      await nameIt(user, await openSave(user), "Won and urgent");
      await waitFor(() => expect(asksOf("save_view")).toHaveLength(1));
      expect(asksOf("save_view")[0]).toMatchObject({ p_filters: [pipeline("won"), yes("needs_action")] });
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [pipeline("won"), yes("needs_action")] }));
    });

    // Catches: a view saved with the table's default columns when the person has chosen their own (the story: "a view is a name, filters, sort and columns").
    it("keeps the columns the person has chosen, in their order", async () => {
      keptColumns = ["company", "quotes", "status"];
      const user = userEvent.setup();
      renderAt();
      await waitFor(() => expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Company", "Quotes", "Status"]));
      await nameIt(user, await openSave(user), "Short");
      await waitFor(() => expect(asksOf("save_view")).toHaveLength(1));
      expect(asksOf("save_view")[0]).toMatchObject({ p_columns: ["company", "quotes", "status"] });
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      expect(await within(tabs()).findByRole("link", { name: /^Short/ })).toHaveAttribute("aria-current", "page");
      await new Promise((r) => setTimeout(r, 80));
      // Opening the view it just made draws the same columns, with no wait to ask the database what the person already knows.
      expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Company", "Quotes", "Status"]);
      expect(asksOf("my_table_columns").filter((a) => a.p_view_id === "view-1")).toHaveLength(0);
      expect(screen.queryByText("Loading submissions")).not.toBeInTheDocument();
    });
  });

  describe("a view that has been changed", () => {
    const bar = () => screen.getByRole("group", { name: "This view" });
    const DEFAULT_IDS = ["company", "contact", "states", "employees", "submitted", "status", "completeness", "quotes", "waiting_since", "quote_expires"];

    // Catches: the view's own filters being shown as chips (they are the tab's, D-169), or the view being called changed with nothing over it, which would
    // offer a save that changes nothing.
    it("is not called changed while nothing is over it, and says who can see it", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      expect(within(bar()).getByText("Only you can see this view.")).toBeInTheDocument();
      expect(within(bar()).queryByText(/changes you haven't saved/)).not.toBeInTheDocument();
      expect(within(bar()).queryByRole("button", { name: "Save changes to this view" })).not.toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "Filters in force" })).not.toBeInTheDocument();
    });

    // Catches: "Save changes" keeping only the chips (the view's own filters lost), or leaving them over the view after the save so it still reads as changed.
    it("keeps what is on screen in the view when its own person saves the changes, and the chips and sort go into it", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1&filter=waiting_on_peo:is:true&sort=-employee_count");
      await screen.findByRole("link", { name: "Acme" });
      expect(within(bar()).getByText("This view has changes you haven't saved.")).toBeInTheDocument();
      await user.click(within(bar()).getByRole("button", { name: "Save changes to this view" }));
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      expect(asksOf("change_saved_view")).toEqual([{
        p_view_id: "view-1", p_filters: [yes("needs_action"), yes("waiting_on_peo")], p_sort: { field: "employee_count", direction: "desc" }, p_columns: DEFAULT_IDS,
      }]);
      expect(await screen.findByText("Saved the changes to “Hot leads”.")).toHaveAttribute("role", "status");
      expect(stored[0].filters).toEqual([yes("needs_action"), yes("waiting_on_peo")]);
      await waitFor(() => expect(within(bar()).queryByText(/changes you haven't saved/)).not.toBeInTheDocument());
      expect(screen.queryByRole("list", { name: "Filters in force" })).not.toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action"), yes("waiting_on_peo")], sort: { field: "employee_count", direction: "desc" } }));
      expect(screen.queryByText(/isn't available/)).not.toBeInTheDocument();
    });

    // Catches: "Save changes" being tried with no connection (D-182's way: the button says why and ignores the click), the chips being lost with it.
    it("is not usable offline: the button says why and sends nothing", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
      try {
        const user = userEvent.setup();
        renderAt("/advisor?view=view-1&filter=waiting_on_peo:is:true");
        await screen.findByRole("link", { name: "Acme" });
        const save = within(bar()).getByRole("button", { name: "Save changes to this view" });
        expect(save).toHaveAttribute("aria-disabled", "true");
        expect(save).toHaveAccessibleDescription("You're offline. Saving is back when you are.");
        await user.click(save);
        expect(asksOf("change_saved_view")).toHaveLength(0);
        expect(where()).toBe("?view=view-1&filter=waiting_on_peo:is:true");
      } finally {
        online.mockRestore();
      }
    });

    // Catches: the rows being asked for in between: the address cleared before the view holds what the chips said, so the table shows the view as it was saved
    // for a moment, and flickers.
    it("never asks for the view as it was saved before it holds the changes", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1&filter=waiting_on_peo:is:true");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(bar()).getByRole("button", { name: "Save changes to this view" }));
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      await new Promise((r) => setTimeout(r, 60));
      expect(listQueue).not.toHaveBeenCalledWith(query({ filters: [yes("needs_action")] }));
    });

    // Catches: a refused save (a closing firm, a support session) clearing the chips the person had put over the view, so what they did is lost with the refusal,
    // or being told nothing about why.
    it("keeps the chips on screen and says why beside the button when the changes can't be kept, and puts focus back on it", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      locked = "Nevermore support can look, not change";
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1&filter=waiting_on_peo:is:true");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(bar()).getByRole("button", { name: "Save changes to this view" }));
      expect(await within(bar()).findByRole("alert")).toHaveTextContent("Nevermore support can look, not change, so the changes weren't saved.");
      expect(within(bar()).getByRole("button", { name: "Save changes to this view" })).toHaveFocus();
      expect(where()).toBe("?view=view-1&filter=waiting_on_peo:is:true");
      expect(screen.getByRole("list", { name: "Filters in force" })).toBeInTheDocument();
      expect(stored[0].filters).toEqual([yes("needs_action")]);
    });

    // Catches: a sort alone not counting as a change to the view (the story keeps the sort with the view), or a search counting as one (a view keeps no search).
    it("counts a sort as a change and a search as none", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      renderAt("/advisor?view=view-1&q=acme");
      await screen.findByRole("link", { name: "Acme" });
      expect(within(bar()).queryByText(/changes you haven't saved/)).not.toBeInTheDocument();
      cleanup();
      renderAt("/advisor?view=view-1&sort=-employee_count");
      await screen.findByRole("link", { name: "Acme" });
      expect(within(bar()).getByText("This view has changes you haven't saved.")).toBeInTheDocument();
    });

    // Catches: "Clear filters" leaving the view for "All statuses" (the story's line: it removes the chips and leaves the view), which would lose the tab the
    // person is on.
    it("keeps the view open when Clear filters takes the chips off it", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1&filter=waiting_on_peo:is:true");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(filterRowGroup()).getByRole("button", { name: "Clear filters" }));
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")] }));
      expect(within(bar()).queryByText(/changes you haven't saved/)).not.toBeInTheDocument();
    });

    // Catches: a person who may not change a view (it is the firm's, shared by someone else) being offered a save that the database refuses, instead of
    // the one thing they can do: keep their own version.
    it("offers no save over a view the person can't change, and says what they can do instead", async () => {
      stored = [stored1({ name: "Firm's view", owner: SOMEONE, shared: true, filters: [yes("needs_action")] })];
      renderAt("/advisor?view=view-1&filter=waiting_on_peo:is:true");
      await screen.findByRole("link", { name: "Acme" });
      expect(within(bar()).getByText("Shared with the firm.")).toBeInTheDocument();
      expect(within(bar()).getByText("This view has changes you haven't saved. “Save this as a view” keeps them as a view of your own.")).toBeInTheDocument();
      expect(within(bar()).queryByRole("button", { name: "Save changes to this view" })).not.toBeInTheDocument();
    });
  });

  describe("renaming a view", () => {
    const bar = () => screen.getByRole("group", { name: "This view" });
    const openRename = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(within(bar()).getByRole("button", { name: "Rename" }));
      return screen.findByRole("dialog", { name: "Rename this view" });
    };

    // Catches: the story's "rename it" not being there; the old name not being in the box to edit; a rename that leaves the tab, the address or the rows as they
    // were; and focus dropped to the page when the form closes.
    it("opens the form with the name in it, renames the view, keeps it open, and says so", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      const dialog = await openRename(user);
      const box = within(dialog).getByRole("textbox", { name: "View name" });
      expect(box).toHaveValue("Hot leads");
      expect(box).toHaveFocus();
      await user.clear(box);
      await user.type(box, "Urgent");
      await user.click(within(dialog).getByRole("button", { name: "Rename view" }));
      await waitFor(() => expect(asksOf("rename_saved_view")).toEqual([{ p_view_id: "view-1", p_name: "Urgent" }]));
      expect(await within(tabs()).findByRole("link", { name: /^Urgent/ })).toHaveAttribute("aria-current", "page");
      expect(within(tabs()).queryByRole("link", { name: /Hot leads/ })).not.toBeInTheDocument();
      expect(await screen.findByText("Renamed to “Urgent”.")).toHaveAttribute("role", "status");
      expect(screen.queryByRole("dialog", { name: "Rename this view" })).not.toBeInTheDocument();
      expect(where()).toBe("?view=view-1");
      await waitFor(() => expect(within(bar()).getByRole("button", { name: "Rename" })).toHaveFocus());
    });

    // Catches: a name that is taken being lost with the refusal; and a rename to the same name being sent as a change.
    it("says why in the database's words, and keeps the form open with what was typed, when the name is taken", async () => {
      stored = [stored1({ name: "Hot leads" }), stored1({ name: "Urgent" })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      const dialog = await openRename(user);
      const box = within(dialog).getByRole("textbox", { name: "View name" });
      await user.clear(box);
      await user.type(box, "urgent");
      await user.click(within(dialog).getByRole("button", { name: "Rename view" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent('You already have a view called "urgent" on this table');
      expect(box).toHaveValue("urgent");
      expect(stored[0].name).toBe("Hot leads");
    });

    // Catches: a person who may not change the view (it is the firm's) being offered a rename the database refuses.
    it("is not offered on a view the person can't change", async () => {
      stored = [stored1({ name: "Firm's view", owner: SOMEONE, shared: true })];
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      expect(within(bar()).queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    });

    // Catches: a built-in view (today's status tabs, in code, so nothing can change it) being given controls that could never work.
    it("is not offered on a built-in view, which has no bar at all", async () => {
      renderAt("/advisor?view=won");
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.queryByRole("group", { name: "This view" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    });
  });

  describe("deleting a view", () => {
    const bar = () => screen.getByRole("group", { name: "This view" });
    const confirmation = (name: string) => screen.findByRole("alertdialog", { name: `Delete the view “${name}”?` });

    // Catches: a view deleted at one click with no question; the question not saying what goes and what stays (the submissions are untouched: a view is only a
    // way of looking at them); and focus not starting on the safe choice.
    it("asks first, in plain words, and Cancel deletes nothing and puts focus back on the button", async () => {
      stored = [stored1({ name: "Hot leads" })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(bar()).getByRole("button", { name: "Delete" }));
      const dialog = await confirmation("Hot leads");
      expect(within(dialog).getByText("The submissions stay.")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(asksOf("delete_saved_view")).toHaveLength(0);
      expect(stored).toHaveLength(1);
      await waitFor(() => expect(within(bar()).getByRole("button", { name: "Delete" })).toHaveFocus());
    });

    // Catches: a deleted view still being the open one (the address naming a view that is gone, so a bookmark-style "isn't available" line shows for the
    // person's own action), its tab staying, or focus being dropped to the page when the button goes with the view.
    it("deletes the view, goes to all statuses, takes the tab away and puts focus on the all tab, saying so once", async () => {
      stored = [stored1({ name: "Hot leads" }), stored1({ name: "Other" })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(bar()).getByRole("button", { name: "Delete" }));
      await user.click(within(await confirmation("Hot leads")).getByRole("button", { name: "Delete view" }));
      await waitFor(() => expect(asksOf("delete_saved_view")).toEqual([{ p_view_id: "view-1" }]));
      await waitFor(() => expect(where()).toBe(""));
      await waitFor(() => expect(within(tabs()).queryByRole("link", { name: /Hot leads/ })).not.toBeInTheDocument());
      expect(within(tabs()).getByRole("link", { name: /Other/ })).toBeInTheDocument();
      expect(within(tabs()).getByRole("link", { name: /^All statuses/ })).toHaveAttribute("aria-current", "page");
      await waitFor(() => expect(within(tabs()).getByRole("link", { name: /^All statuses/ })).toHaveFocus());
      expect(await screen.findByText("Deleted the view “Hot leads”. Showing all statuses.")).toHaveAttribute("role", "status");
      expect(screen.queryByText(/isn't available/)).not.toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query());
    });

    // Catches: a shared view being deleted as if it were only the person's, when it goes for everyone in the firm.
    it("says a shared view goes for everyone in the firm", async () => {
      role = "owner";
      stored = [stored1({ name: "Hot leads", shared: true })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(bar()).getByRole("button", { name: "Delete" }));
      expect(within(await confirmation("Hot leads")).getByText("It is shared with the firm, so it goes for everyone in it.")).toBeInTheDocument();
    });

    // Catches: a refused delete closing the question and saying nothing, or the person's view going from the screen though it was kept.
    it("says why in plain words and leaves the view where it is when the database refuses", async () => {
      stored = [stored1({ name: "Hot leads" })];
      locked = "This firm is closing and can't be changed";
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(bar()).getByRole("button", { name: "Delete" }));
      const dialog = await confirmation("Hot leads");
      await user.click(within(dialog).getByRole("button", { name: "Delete view" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("This firm is closing and can't be changed, so the view wasn't deleted.");
      expect(within(dialog).getByRole("button", { name: "Delete view" })).toBeEnabled();
      // The question is still open: the page behind it is hidden from a screen reader until it is answered.
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(where()).toBe("?view=view-1");
      expect(within(tabs()).getByRole("link", { name: /Hot leads/ })).toBeInTheDocument();
      expect(stored).toHaveLength(1);
      // Asked again, the question starts clean: the last refusal is not left on it.
      await user.click(within(bar()).getByRole("button", { name: "Delete" }));
      expect(within(await confirmation("Hot leads")).queryByRole("alert")).not.toBeInTheDocument();
    });

    // Catches: a delete offered on a view the person may not delete (the firm's, shared by someone else).
    it("is not offered on a view the person can't change", async () => {
      stored = [stored1({ name: "Firm's view", owner: SOMEONE, shared: true })];
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      expect(within(bar()).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    });
  });

  describe("sharing a view with the firm", () => {
    const bar = () => screen.getByRole("group", { name: "This view" });

    // Catches: "an owner can share a view with the firm" not being there, a share made at one click, and a share that leaves the tab, the bar and the button as they
    // were, so nothing says it happened.
    it("lets an owner share their own view after asking, marks its tab, says so once, and offers to stop sharing in the same place", async () => {
      role = "owner";
      stored = [stored1({ name: "Hot leads" })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(bar()).getByRole("button", { name: "Share with the firm" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Share “Hot leads” with the firm?" });
      expect(within(dialog).getByText("Everyone in the firm will see this tab, with its filters, sort and columns. Only an owner can stop sharing it.")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
      expect(asksOf("share_saved_view")).toHaveLength(0);
      await user.click(within(dialog).getByRole("button", { name: "Share with the firm" }));
      await waitFor(() => expect(asksOf("share_saved_view")).toEqual([{ p_view_id: "view-1" }]));
      expect(await screen.findByText("“Hot leads” is shared with the firm.")).toHaveAttribute("role", "status");
      await waitFor(() => expect(within(tabs()).getByRole("link", { name: /Hot leads \(shared with the firm\)/ })).toBeInTheDocument());
      expect(within(bar()).getByText("Shared with the firm.")).toBeInTheDocument();
      const stop = await within(bar()).findByRole("button", { name: "Stop sharing" });
      expect(within(bar()).queryByRole("button", { name: "Share with the firm" })).not.toBeInTheDocument();
      // The same button, so a keyboard person is where they were.
      await waitFor(() => expect(stop).toHaveFocus());
    });

    // Catches: an agent (who can't share, the database says so) being offered a share, and owners' power over a view that is not theirs leaking into the
    // person's own private views.
    it("is not offered to someone who is not an owner", async () => {
      stored = [stored1({ name: "Hot leads" })];
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      expect(within(bar()).queryByRole("button", { name: "Share with the firm" })).not.toBeInTheDocument();
      expect(within(bar()).queryByRole("button", { name: "Stop sharing" })).not.toBeInTheDocument();
    });

    // Catches: stopping to share looking like a delete (the view goes), or being done without a question: for the firm, the tab goes.
    it("lets an owner stop sharing a view, saying what happens, and it goes back to being only theirs", async () => {
      role = "owner";
      stored = [stored1({ name: "Hot leads", shared: true })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(bar()).getByRole("button", { name: "Stop sharing" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Stop sharing “Hot leads”?" });
      expect(within(dialog).getByText("It goes back to being a view only you can see. The rest of the firm will no longer see this tab.")).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Stop sharing" }));
      await waitFor(() => expect(asksOf("unshare_saved_view")).toEqual([{ p_view_id: "view-1" }]));
      expect(await screen.findByText("“Hot leads” is no longer shared. Only you can see it.")).toHaveAttribute("role", "status");
      await waitFor(() => expect(within(bar()).getByText("Only you can see this view.")).toBeInTheDocument());
      expect(within(tabs()).queryByText(/shared with the firm/)).not.toBeInTheDocument();
      expect(within(bar()).getByRole("button", { name: "Share with the firm" })).toBeInTheDocument();
      expect(where()).toBe("?view=view-1");
    });

    // Catches: an owner who stops sharing a colleague's view being left on a view that is no longer theirs to read (the database answers "isn't available" for
    // it from then on).
    it("goes to all statuses when an owner stops sharing a colleague's view, since it is no longer one they may open", async () => {
      role = "owner";
      stored = [stored1({ name: "Their view", owner: SOMEONE, shared: true })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      expect(within(bar()).queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
      await user.click(within(bar()).getByRole("button", { name: "Stop sharing" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Stop sharing “Their view”?" });
      expect(within(dialog).getByText("It goes back to being private to whoever saved it, so it will no longer be in your views or the firm's.")).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Stop sharing" }));
      await waitFor(() => expect(where()).toBe(""));
      expect(await screen.findByText("Stopped sharing “Their view”. It is private to whoever saved it, so it is no longer in your views.")).toBeInTheDocument();
      await waitFor(() => expect(within(tabs()).queryByRole("link", { name: /Their view/ })).not.toBeInTheDocument());
      expect(screen.queryByText(/isn't available/)).not.toBeInTheDocument();
      await waitFor(() => expect(within(tabs()).getByRole("link", { name: /^All statuses/ })).toHaveFocus());
    });

    // Catches: a refused share (another of the owner's views already has the name a shared view would carry; a closing firm) closing the question as though it
    // worked.
    it("says why in the database's words inside the question when it can't be shared, and nothing changes", async () => {
      role = "owner";
      stored = [stored1({ name: "Hot leads" })];
      rpc.mockImplementation(async (name: string, args: Record<string, unknown>) =>
        name === "share_saved_view" ? refused("PT409", "Another of your views has this name: rename it before sharing it") : database(name, args));
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(bar()).getByRole("button", { name: "Share with the firm" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Share “Hot leads” with the firm?" });
      await user.click(within(dialog).getByRole("button", { name: "Share with the firm" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Another of your views has this name: rename it before sharing it");
      expect(stored[0].shared).toBe(false);
    });
  });

  describe("when a view can't be saved", () => {
    const openSave = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole("button", { name: "Save this as a view" }));
      return screen.findByRole("dialog", { name: "Save this as a view" });
    };
    const nameIt = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, name: string) => {
      await user.type(within(dialog).getByRole("textbox", { name: "View name" }), name);
      await user.click(within(dialog).getByRole("button", { name: "Save view" }));
    };
    const box = (dialog: HTMLElement) => within(dialog).getByRole("textbox", { name: "View name" });

    // Catches: a nameless view being sent (the database refuses it with words nobody can act on), or the reason not being said under the box in the workspace
    // form's way ("Required", in words).
    it("asks for a name in words, sends nothing and keeps the form open when there is none", async () => {
      const user = userEvent.setup();
      renderAt();
      const dialog = await openSave(user);
      await user.click(within(dialog).getByRole("button", { name: "Save view" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Required");
      expect(box(dialog)).toHaveFocus();
      expect(asksOf("save_view")).toHaveLength(0);
      // Spaces are no name either.
      await user.type(box(dialog), "   ");
      await user.click(within(dialog).getByRole("button", { name: "Save view" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Required");
      expect(asksOf("save_view")).toHaveLength(0);
    });

    // Catches: a name over the database's 60 characters being sent and refused with a sentence about the database, and spaces around a name being sent for
    // the database to refuse (the database wants none: the form trims them).
    it("says a name is up to 60 characters, counting characters and not UTF-16 units, and trims the spaces around one", async () => {
      const user = userEvent.setup();
      renderAt();
      const dialog = await openSave(user);
      await user.type(box(dialog), "x".repeat(61));
      await user.click(within(dialog).getByRole("button", { name: "Save view" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("A view's name is up to 60 characters.");
      expect(asksOf("save_view")).toHaveLength(0);
      await user.clear(box(dialog));
      // Sixty emoji are 120 UTF-16 units and sixty characters: allowed. Spaces around them go.
      await user.type(box(dialog), `  ${"🙂".repeat(60)}  `);
      await user.click(within(dialog).getByRole("button", { name: "Save view" }));
      await waitFor(() => expect(asksOf("save_view")).toHaveLength(1));
      expect(asksOf("save_view")[0]).toMatchObject({ p_name: "🙂".repeat(60) });
    });

    // Catches: a view saved from a view that has an order of its own losing it, because only the address's sort was kept (the view's is not in the address).
    it("keeps the order of the view it is saved from, when the address holds none", async () => {
      stored = [stored1({ name: "By company", sort: { field: "company_name", direction: "asc" } })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1&filter=needs_action:is:true");
      await screen.findByRole("link", { name: "Acme" });
      await nameIt(user, await openSave(user), "Copy of it");
      await waitFor(() => expect(asksOf("save_view")).toHaveLength(1));
      expect(asksOf("save_view")[0]).toMatchObject({ p_sort: { field: "company_name", direction: "asc" } });
    });

    // Catches: an owner who has just saved a view not being able to share it until the page is reloaded (the new view is listed with what the person may do).
    it("lists the view just saved with what an owner may do with it: share it, without reading the list again", async () => {
      role = "owner";
      let reads = 0;
      rpc.mockImplementation((name: string, args: Record<string, unknown>) =>
        name === "list_saved_views" && ++reads > 1 ? new Promise(() => {}) : database(name, args));
      const user = userEvent.setup();
      renderAt();
      await nameIt(user, await openSave(user), "Hot leads");
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      expect(await within(screen.getByRole("group", { name: "This view" })).findByRole("button", { name: "Share with the firm" })).toBeInTheDocument();
    });

    // Catches: a name that is taken closing the form and losing what was typed, or hiding the database's own words ('You already have a view called "X"').
    it("says why in the database's words beside the button, keeps the form open with the name typed, and puts focus back on the button", async () => {
      stored = [stored1({ name: "Hot leads" })];
      const user = userEvent.setup();
      renderAt("/advisor?filter=needs_action:is:true");
      const dialog = await openSave(user);
      await user.type(box(dialog), "hot LEADS");
      await user.click(within(dialog).getByRole("button", { name: "Save view" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent('You already have a view called "hot LEADS" on this table');
      expect(box(dialog)).toHaveValue("hot LEADS");
      expect(within(dialog).getByRole("button", { name: "Save view" })).toHaveFocus();
      // The filters the person had on screen are still on screen, and no view was made.
      expect(where()).toBe("?filter=needs_action:is:true");
      expect(stored).toHaveLength(1);
      // The next try clears the words; a different name goes through.
      await user.clear(box(dialog));
      await user.type(box(dialog), "Hotter leads");
      await user.click(within(dialog).getByRole("button", { name: "Save view" }));
      await waitFor(() => expect(where()).toBe("?view=view-2"));
    });

    // Catches: a closing firm or a support session (the database refuses every write, PT423) told "Try again" for a save that can never work, as the column
    // choice was before CRM-S3.1a; and the person's filters being lost with the refusal.
    it("says in plain words that a closing firm or a support session can't keep a view, keeps what the person did on screen, and never says Try again", async () => {
      locked = "This firm is closing and can't be changed";
      const user = userEvent.setup();
      renderAt("/advisor?filter=needs_action:is:true");
      const dialog = await openSave(user);
      await user.type(box(dialog), "Hot leads");
      await user.click(within(dialog).getByRole("button", { name: "Save view" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("This firm is closing and can't be changed, so the view wasn't saved.");
      expect(within(dialog).getByRole("alert")).not.toHaveTextContent(/try again/i);
      expect(box(dialog)).toHaveValue("Hot leads");
      expect(where()).toBe("?filter=needs_action:is:true");
      expect(screen.getByRole("list", { name: "Filters in force" })).toBeInTheDocument();
    });

    // Catches: the ceiling (30 views of a table) being hidden behind a generic failure, so a person can't tell they have to delete one first.
    it("says in the database's words that a person keeps at most 30 views of a table", async () => {
      stored = Array.from({ length: 30 }, (_, i) => stored1({ name: `View ${i + 1}` }));
      const user = userEvent.setup();
      renderAt();
      const dialog = await openSave(user);
      await user.type(box(dialog), "One too many");
      await user.click(within(dialog).getByRole("button", { name: "Save view" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("You can keep at most 30 views of a table. Delete one first.");
      expect(stored).toHaveLength(30);
    });

    // Catches: Escape saving, or losing focus: the form closes with nothing to lose, and focus goes back to the button that opened it.
    it("closes on Escape with nothing saved, and focus goes back to the button", async () => {
      const user = userEvent.setup();
      renderAt();
      const dialog = await openSave(user);
      await user.type(box(dialog), "Half a name");
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save this as a view" })).not.toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Save this as a view" })).toHaveFocus();
      expect(asksOf("save_view")).toHaveLength(0);
    });

    // Catches: a failure the database did not word for people (a dropped connection) reaching the screen as its own text.
    it("never shows the network's own words", async () => {
      rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (name === "save_view" ? refused("XX000", "TypeError: Failed to fetch") : database(name, args)));
      const user = userEvent.setup();
      renderAt();
      const dialog = await openSave(user);
      await user.type(box(dialog), "Hot leads");
      await user.click(within(dialog).getByRole("button", { name: "Save view" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Couldn't save the view. Try again.");
      expect(within(dialog).getByRole("alert")).not.toHaveTextContent(/fetch/i);
    });

    // Catches: saving with no connection being tried (and failing in a way that says nothing), or Save looking usable with the reason nowhere (D-182's way).
    it("is not usable offline: the button says why and sends nothing, and Enter says the save wasn't made", async () => {
      const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
      try {
        const user = userEvent.setup();
        renderAt();
        const dialog = await openSave(user);
        await user.type(box(dialog), "Hot leads");
        const save = within(dialog).getByRole("button", { name: "Save view" });
        expect(save).toHaveAttribute("aria-disabled", "true");
        expect(save).toHaveAccessibleDescription("You're offline. Saving is back when you are.");
        await user.click(save);
        expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
        await user.type(box(dialog), "{Enter}");
        expect(await within(dialog).findByRole("alert")).toHaveTextContent("You're offline, so this wasn't saved. Try again when you're back online. What you typed is still here.");
        expect(asksOf("save_view")).toHaveLength(0);
        expect(box(dialog)).toHaveValue("Hot leads");
      } finally {
        online.mockRestore();
      }
    });

    // Catches: a view saved while the person's own column choice is still being read, which would keep the table's default columns instead (D-190).
    it("is not usable until the person's columns are known: it stays in the tab order, says why and does not open", async () => {
      let arrive!: () => void;
      rpc.mockImplementation((name: string, args: Record<string, unknown>) =>
        name === "my_table_columns" ? new Promise((resolve) => { arrive = () => resolve(database(name, args)); }) : database(name, args));
      const user = userEvent.setup();
      renderAt();
      const button = await screen.findByRole("button", { name: "Save this as a view" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription("Available once your columns have loaded");
      await user.click(button);
      expect(screen.queryByRole("dialog", { name: "Save this as a view" })).not.toBeInTheDocument();
      await act(async () => arrive());
      await waitFor(() => expect(screen.getByRole("button", { name: "Save this as a view" })).not.toHaveAttribute("aria-disabled"));
    });
  });

  describe("when the saved views can't be loaded", () => {
    // Catches: the saved views failing and the table going on as though the person had none, so a view they made seems to have vanished; and the rows being held up
    // by it (the built-in tabs and the rows are theirs to use whether or not the saved ones arrive).
    it("shows the table and the built-in tabs, says in one line that the saved views couldn't be loaded, and asks again on Try again", async () => {
      stored = [stored1({ name: "Hot leads" })];
      let fail = true;
      rpc.mockImplementation(async (name: string, args: Record<string, unknown>) =>
        name === "list_saved_views" && fail ? refused("XX000", "internal detail") : database(name, args));
      const user = userEvent.setup();
      renderAt();
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      const line = await screen.findByText("Your saved views couldn't be loaded.");
      expect(line.closest("[role=status]")).not.toBeNull();
      expect(screen.queryByText(/internal detail/)).not.toBeInTheDocument();
      expect(within(tabs()).getByRole("link", { name: /^Won/ })).toBeInTheDocument();
      fail = false;
      await user.click(within(line.closest("[role=status]") as HTMLElement).getByRole("button", { name: "Try again" }));
      expect(await within(tabs()).findByRole("link", { name: "Hot leads" })).toBeInTheDocument();
      expect(screen.queryByText("Your saved views couldn't be loaded.")).not.toBeInTheDocument();
    });

    // Catches: a bookmark of a saved view that could not be looked up showing a table that is not the view, with no word that it isn't.
    it("says a bookmarked view isn't available, and shows every status, while they can't be loaded", async () => {
      rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (name === "list_saved_views" ? refused("XX000", "x") : database(name, args)));
      renderAt("/advisor?view=view-1");
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(screen.getByText("That view isn't available, so this shows all statuses.")).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query());
    });
  });

  describe("what a saved view does to the rest of the table", () => {
    // Catches: a saved view with no rows being worded as though the whole table were empty, or its way back leaving the person on the view.
    it("names the view in the empty state and leaves it with Show all statuses", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      listQueue.mockResolvedValue([]);
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      expect(await screen.findByText("No submissions match these filters.")).toBeInTheDocument();
      expect(screen.getByText("View: Hot leads")).toBeInTheDocument();
      listQueue.mockResolvedValue([row()]);
      await user.click(screen.getByRole("button", { name: "Show all statuses" }));
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(where()).toBe("");
      expect(listQueue).toHaveBeenLastCalledWith(query());
    });

    // Catches: a saved view the database won't read (a filter on a field it has since dropped) leaving the person with a panel and no way to take the view
    // away: the bar must stay, so it can be deleted.
    it("keeps the view's bar over the database's refusal, so a view that can't be read can still be deleted", async () => {
      stored = [stored1({ name: "Stale", filters: [{ field: "gone", op: "is", value: true }] })];
      listQueue.mockRejectedValue(Object.assign(new Error("There is no field called gone to filter by"), { code: "22023" }));
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      expect(await screen.findByText("There is no field called gone to filter by")).toBeInTheDocument();
      await user.click(within(screen.getByRole("group", { name: "This view" })).getByRole("button", { name: "Delete" }));
      await user.click(within(await screen.findByRole("alertdialog", { name: "Delete the view “Stale”?" })).getByRole("button", { name: "Delete view" }));
      await waitFor(() => expect(stored).toHaveLength(0));
      await waitFor(() => expect(where()).toBe(""));
    });

    // Catches: the saved-view controls drawn on a page with no firm to keep a view for (a page outside the workspace shell), where every call would be refused.
    it("draws no saved-view controls where there is no firm", async () => {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={["/advisor"]}>
            <Routes><Route path="/advisor" element={<AdvisorDashboardPage />} /></Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await screen.findByRole("link", { name: "Acme" });
      expect(screen.queryByRole("button", { name: "Save this as a view" })).not.toBeInTheDocument();
      expect(rpc).not.toHaveBeenCalled();
      // Nor are the tabs left waiting for views that can't come: their numbers are asked for.
      await waitFor(() => expect(countQueueViews).toHaveBeenCalledTimes(1));
    });

    // Catches: a bookmark of a saved view being dropped in the moment before the shell knows the firm (asked for no views yet, so none is listed), and the views
    // being asked for with no firm (the database would refuse it).
    it("keeps a bookmarked saved view until the firm is known, asks for the views once, for that firm, and then honours it", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      const client = new QueryClient();
      const tree = (firm: boolean) => (
        <WorkspaceContext.Provider value={{ ...workspace(), firm: firm ? workspace().firm : null }}>
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={["/advisor?view=view-1"]}>
              <Routes><Route path="/advisor" element={<><AdvisorDashboardPage /><LocationProbe /></>} /></Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </WorkspaceContext.Provider>
      );
      const { rerender } = render(tree(false));
      await new Promise((r) => setTimeout(r, 60));
      expect(asksOf("list_saved_views")).toHaveLength(0);
      expect(listQueue).not.toHaveBeenCalled();
      expect(where()).toBe("?view=view-1");
      rerender(tree(true));
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(asksOf("list_saved_views")).toEqual([{ p_firm_id: "firm-1", p_table: "submissions" }]);
      expect(listQueue).toHaveBeenCalledTimes(1);
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")] }));
      expect(where()).toBe("?view=view-1");
    });
  });

  describe("staying in step", () => {
    /** The first read of the views answers; every later one never does, so what is on screen after an action can only have come from the action. */
    const readsOnlyOnce = () => {
      let reads = 0;
      rpc.mockImplementation((name: string, args: Record<string, unknown>) =>
        name === "list_saved_views" && ++reads > 1 ? new Promise(() => {}) : database(name, args));
    };

    // Catches: a view a colleague shared (or deleted) never showing until the page is reloaded: the views are asked again with the rows, on the minute (D-49).
    it("asks for the views again on the minute, so a view a colleague shares appears without a reload", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      renderAt();
      await screen.findByRole("link", { name: "Acme" });
      expect(asksOf("list_saved_views")).toHaveLength(1);
      stored = [stored1({ name: "Shared by a colleague", owner: SOMEONE, shared: true })];
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(await within(tabs()).findByRole("link", { name: /Shared by a colleague/ })).toBeInTheDocument();
      expect(asksOf("list_saved_views")).toHaveLength(2);
    });

    // Catches: an action that ends on the address drawn when the button was pressed, which puts back what the person had typed or taken off since (the
    // database may take a while to answer). It ends on the address of now.
    it("keeps what the person typed in the search while the view was being saved", async () => {
      let answer!: () => void;
      rpc.mockImplementation((name: string, args: Record<string, unknown>) =>
        name === "save_view" ? new Promise((resolve) => { answer = () => resolve(database(name, args)); }) : database(name, args));
      const user = userEvent.setup();
      renderAt("/advisor?filter=needs_action:is:true");
      await user.click(await screen.findByRole("button", { name: "Save this as a view" }));
      await user.type(within(await screen.findByRole("dialog", { name: "Save this as a view" })).getByRole("textbox", { name: "View name" }), "Hot leads");
      await user.click(screen.getByRole("button", { name: "Save view" }));
      await waitFor(() => expect(asksOf("save_view")).toHaveLength(1));
      await user.type(screen.getByRole("searchbox", { name: "Search" }), "acme");
      await waitFor(() => expect(where()).toContain("q=acme"));
      await act(async () => answer());
      await waitFor(() => expect(where()).toBe("?view=view-1&q=acme"));
    });

    // Catches: the new view (and the address that names it) waiting for the list to be read again, so a slow read leaves the person on a table that says the view
    // they just made isn't available.
    it("opens a view just saved without waiting for the list of views to be read again", async () => {
      readsOnlyOnce();
      const user = userEvent.setup();
      renderAt("/advisor?filter=needs_action:is:true");
      await user.click(await screen.findByRole("button", { name: "Save this as a view" }));
      await user.type(within(await screen.findByRole("dialog", { name: "Save this as a view" })).getByRole("textbox", { name: "View name" }), "Hot leads");
      await user.click(screen.getByRole("button", { name: "Save view" }));
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      expect(await within(tabs()).findByRole("link", { name: /^Hot leads/ })).toHaveAttribute("aria-current", "page");
      expect(screen.queryByText(/isn't available/)).not.toBeInTheDocument();
    });

    // Catches: a rename, a share and a delete showing only once the list has been read again.
    it("shows a rename, a share and a delete at once, without waiting for the list to be read again", async () => {
      role = "owner";
      stored = [stored1({ name: "Hot leads" }), stored1({ name: "Other" })];
      readsOnlyOnce();
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      const bar = () => screen.getByRole("group", { name: "This view" });
      await user.click(within(bar()).getByRole("button", { name: "Rename" }));
      const box = within(await screen.findByRole("dialog", { name: "Rename this view" })).getByRole("textbox", { name: "View name" });
      await user.clear(box);
      await user.type(box, "Urgent");
      await user.click(screen.getByRole("button", { name: "Rename view" }));
      expect(await within(tabs()).findByRole("link", { name: /^Urgent/ })).toBeInTheDocument();
      await user.click(within(bar()).getByRole("button", { name: "Share with the firm" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Share with the firm" }));
      expect(await within(bar()).findByRole("button", { name: "Stop sharing" })).toBeInTheDocument();
      await user.click(within(bar()).getByRole("button", { name: "Delete" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete view" }));
      await waitFor(() => expect(within(tabs()).queryByRole("link", { name: /Urgent/ })).not.toBeInTheDocument());
      expect(within(tabs()).getByRole("link", { name: /Other/ })).toBeInTheDocument();
    });

    // Catches: saved changes (and the chips going into the view) waiting for the list of views to be read again, so a slow read leaves the chips over a view that
    // already holds them, or shows the view as it was before.
    it("shows a view's saved changes at once, without waiting for the list to be read again", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      readsOnlyOnce();
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1&filter=waiting_on_peo:is:true");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(screen.getByRole("group", { name: "This view" })).getByRole("button", { name: "Save changes to this view" }));
      await waitFor(() => expect(where()).toBe("?view=view-1"));
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action"), yes("waiting_on_peo")] }));
      expect(screen.queryByText("This view has changes you haven't saved.")).not.toBeInTheDocument();
    });

    // Catches: stopping to share showing only once the list has been read again: the bar still saying "Shared with the firm." and offering to stop, so a second press
    // is the first one asked again.
    it("shows a view that stopped being shared at once, whether it was the person's own or a colleague's", async () => {
      role = "owner";
      stored = [stored1({ name: "Mine", shared: true }), stored1({ name: "Theirs", owner: SOMEONE, shared: true })];
      readsOnlyOnce();
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      const bar = () => screen.getByRole("group", { name: "This view" });
      await user.click(within(bar()).getByRole("button", { name: "Stop sharing" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Stop sharing" }));
      expect(await within(bar()).findByRole("button", { name: "Share with the firm" })).toBeInTheDocument();
      expect(within(bar()).getByText("Only you can see this view.")).toBeInTheDocument();
      await user.click(within(tabs()).getByRole("link", { name: /^Theirs/ }));
      await user.click(await within(bar()).findByRole("button", { name: "Stop sharing" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Stop sharing" }));
      await waitFor(() => expect(within(tabs()).queryByRole("link", { name: /^Theirs/ })).not.toBeInTheDocument());
      expect(within(tabs()).getByRole("link", { name: /^Mine/ })).toBeInTheDocument();
      expect(where()).toBe("");
    });

    // Catches: "Save changes" being kept with only the chips' sort, so a view saved in its own order loses it the first time it is changed.
    it("keeps the view's own order when its changes are saved with no sort in the address", async () => {
      stored = [stored1({ name: "By company", sort: { field: "company_name", direction: "asc" } })];
      const user = userEvent.setup();
      renderAt("/advisor?view=view-1&filter=needs_action:is:true");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(screen.getByRole("group", { name: "This view" })).getByRole("button", { name: "Save changes to this view" }));
      await waitFor(() => expect(asksOf("change_saved_view")).toHaveLength(1));
      expect(asksOf("change_saved_view")[0]).toMatchObject({ p_sort: { field: "company_name", direction: "asc" }, p_filters: [yes("needs_action")] });
      await waitFor(() => expect(where()).toBe("?view=view-1"));
    });

    // Catches: a built-in tab asking the database for the person's choice "on a view" that is no row (the database refuses a view that isn't there).
    it("asks for the person's column choice for the table, not for a view, on a built-in tab", async () => {
      renderAt("/advisor?view=won");
      await screen.findByRole("link", { name: "Acme" });
      await waitFor(() => expect(asksOf("my_table_columns").length).toBeGreaterThan(0));
      expect(asksOf("my_table_columns").every((a) => a.p_view_id === null)).toBe(true);
    });
  });

  describe("an action that is answered after the person has left the queue", () => {
    // The database can take a while to answer; the person may have opened a row meanwhile. What the action does to the address belongs to the queue they were
    // looking at, and they are not there any more.
    const leaveThenAnswer = async (held: { answer: () => void }) => {
      act(() => goTo("/advisor/submissions/s1"));
      await screen.findByText("Detail page for s1");
      await act(async () => { held.answer(); await new Promise((r) => setTimeout(r, 50)); });
    };
    // Back lands on the queue they left, not on the row they opened: nothing was added to the history on the way.
    const backToTheQueue = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole("button", { name: "Go back" }));
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
    };

    // Catches: a view saved while the person opened a row pulling them back to the queue, on the new view, when the database answers (and a history entry
    // pushed, so Back lands on the row again).
    it("leaves them on the row they opened when the view they were saving is saved", async () => {
      const held = holdAnswerTo("save_view");
      const user = userEvent.setup();
      renderWithRows(new QueryClient(), "/advisor?filter=needs_action:is:true");
      await user.click(await screen.findByRole("button", { name: "Save this as a view" }));
      await user.type(within(await screen.findByRole("dialog", { name: "Save this as a view" })).getByRole("textbox", { name: "View name" }), "Hot leads");
      await user.click(screen.getByRole("button", { name: "Save view" }));
      await waitFor(() => expect(asksOf("save_view")).toHaveLength(1));
      await leaveThenAnswer(held);
      expect(path()).toBe("/advisor/submissions/s1");
      await backToTheQueue(user);
      expect(path()).toBe("/advisor?filter=needs_action:is:true");
    });

    // Catches: the same for "Save changes to this view".
    it("leaves them on the row they opened when the changes they were saving are saved", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      const held = holdAnswerTo("change_saved_view");
      const user = userEvent.setup();
      renderWithRows(new QueryClient(), "/advisor?view=view-1&filter=waiting_on_peo:is:true");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(screen.getByRole("group", { name: "This view" })).getByRole("button", { name: "Save changes to this view" }));
      await waitFor(() => expect(asksOf("change_saved_view")).toHaveLength(1));
      await leaveThenAnswer(held);
      expect(path()).toBe("/advisor/submissions/s1");
      await backToTheQueue(user);
      expect(path()).toBe("/advisor?view=view-1&filter=waiting_on_peo:is:true");
    });

    // Catches: the same for a delete: the address is moved to "all statuses" under a person who is looking at a row.
    it("leaves them on the row they opened when the view they were deleting is deleted", async () => {
      stored = [stored1({ name: "Hot leads" })];
      const held = holdAnswerTo("delete_saved_view");
      const user = userEvent.setup();
      renderWithRows(new QueryClient(), "/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(screen.getByRole("group", { name: "This view" })).getByRole("button", { name: "Delete" }));
      await user.click(within(await screen.findByRole("alertdialog", { name: "Delete the view “Hot leads”?" })).getByRole("button", { name: "Delete view" }));
      await waitFor(() => expect(asksOf("delete_saved_view")).toHaveLength(1));
      await leaveThenAnswer(held);
      expect(path()).toBe("/advisor/submissions/s1");
      await backToTheQueue(user);
    });

    // Catches: the same for stopping to share a colleague's view, which also leaves for "all statuses".
    it("leaves them on the row they opened when they stop sharing a colleague's view", async () => {
      role = "owner";
      stored = [stored1({ name: "Their view", owner: SOMEONE, shared: true })];
      const held = holdAnswerTo("unshare_saved_view");
      const user = userEvent.setup();
      renderWithRows(new QueryClient(), "/advisor?view=view-1");
      await screen.findByRole("link", { name: "Acme" });
      await user.click(within(screen.getByRole("group", { name: "This view" })).getByRole("button", { name: "Stop sharing" }));
      await user.click(within(await screen.findByRole("alertdialog", { name: "Stop sharing “Their view”?" })).getByRole("button", { name: "Stop sharing" }));
      await waitFor(() => expect(asksOf("unshare_saved_view")).toHaveLength(1));
      await leaveThenAnswer(held);
      expect(path()).toBe("/advisor/submissions/s1");
      await backToTheQueue(user);
    });
  });

  describe("a bookmark of a saved view", () => {
    // Catches: a bookmark of a saved view landing on "All statuses" (and asking for the wrong rows first) because the views had not arrived on the first draw.
    it("asks for no rows until the views have arrived, then shows the view's rows and keeps it in the address", async () => {
      stored = [stored1({ name: "Hot leads", filters: [yes("needs_action")] })];
      let arrive!: () => void;
      rpc.mockImplementation((name: string, args: Record<string, unknown>) =>
        name === "list_saved_views" ? new Promise((resolve) => { arrive = () => resolve(database(name, args)); }) : database(name, args));
      renderAt("/advisor?view=view-1");
      expect(await screen.findByText("Loading submissions")).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 60));
      expect(listQueue).not.toHaveBeenCalled();
      expect(countQueueViews).not.toHaveBeenCalled();
      expect(where()).toBe("?view=view-1");
      // Nothing can be saved while it isn't known what the address means: the button stays, and says why.
      expect(screen.getByRole("button", { name: "Save this as a view" })).toHaveAccessibleDescription("Available once the table's views and fields have loaded");
      await act(async () => arrive());
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(listQueue).toHaveBeenCalledTimes(1);
      expect(listQueue).toHaveBeenLastCalledWith(query({ filters: [yes("needs_action")] }));
      expect(where()).toBe("?view=view-1");
    });

    // Catches: a link to a view that was deleted (or never shared with this person) showing an empty or broken table with no word about it.
    it("says the view isn't available, and shows every status, when the view is not one the person may open", async () => {
      stored = [stored1({ name: "Someone's private", owner: SOMEONE })];
      renderAt("/advisor?view=view-1");
      expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
      expect(screen.getByText("That view isn't available, so this shows all statuses.")).toBeInTheDocument();
      expect(listQueue).toHaveBeenLastCalledWith(query());
      await waitFor(() => expect(where()).toBe(""));
      expect(within(tabs()).queryByRole("link", { name: /Someone's private/ })).not.toBeInTheDocument();
    });
  });
});
