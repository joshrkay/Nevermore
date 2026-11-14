import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkspaceContext } from "../workspaceContext";
import type { TableDefinition } from "./columns";
import { shownColumns } from "./columnChoice";
import { ColumnsMenu } from "./ColumnsMenu";
import { useMyColumns } from "./useMyColumns";

// A person's columns on a saved view (story CRM-S3.4a): the database keeps their own choice per view and answers where the columns came from
// (`my_table_columns`' `source`). These are what a person sees through the Columns menu, with the two calls faked.
const fetchMyColumns = vi.fn();
const setMyColumns = vi.fn();
vi.mock("@/lib/tableSettingsApi", () => ({
  fetchMyColumns: (...a: unknown[]) => fetchMyColumns(...a),
  setMyColumns: (...a: unknown[]) => setMyColumns(...a),
}));

type Row = { id: string };
const col = (id: string, header: string, isName = false) => ({ id, header, isName, cell: () => id });
const rights = { mine: true, shared: false, canChange: true, canShare: false, canUnshare: false, updatedAt: "2026-11-01T00:00:00Z" };
const make = (updatedAt = rights.updatedAt) => ({
  id: "submissions",
  noun: { singular: "submission", plural: "submissions" },
  fields: {},
  columns: [col("company", "Company", true), col("contact", "Contact"), col("states", "States"), col("status", "Status")],
  rowKey: (r: Row) => r.id,
  views: [
    { id: "won", label: "Won", filters: [] },
    { id: "saved-1", label: "Mine", filters: [], columns: ["company", "status"], saved: { ...rights, updatedAt } },
    { id: "saved-2", label: "Other", filters: [], columns: ["company", "states"], saved: rights },
  ],
}) as unknown as TableDefinition<Record<string, never>, Row, undefined>;
const demo = make();

function Harness({ viewId, table }: { viewId: string | null; table: typeof demo }) {
  const mine = useMyColumns(table, viewId);
  return (
    <>
      <ColumnsMenu table={table} mine={mine} />
      <ul aria-label="Shown">{shownColumns(table, mine.kept).map((c) => <li key={c.id}>{c.header}</li>)}</ul>
    </>
  );
}
const page = (viewId: string | null, table = demo) => (
  <QueryClientProvider client={client}>
    <WorkspaceContext.Provider value={{ firm: { id: "firm-1", name: "Firm", address: "firm" }, role: "Owner", isOwner: true, isSupport: false, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: false, person: "Pat" }}>
      <Harness viewId={viewId} table={table} />
    </WorkspaceContext.Provider>
  </QueryClientProvider>
);
let client: QueryClient;
const shown = () => within(screen.getByRole("list", { name: "Shown" })).queryAllByRole("listitem").map((li) => li.textContent);
const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Columns" }));
  return screen.getByRole("dialog");
};
beforeEach(() => {
  client = new QueryClient();
  fetchMyColumns.mockReset().mockResolvedValue({ columns: null, source: "default" });
  setMyColumns.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("the columns on a saved view", () => {
  // Catches: the view's id never reaching the database, so every view shows the table's choice.
  it("asks for the person's columns on the view that is open, and on no view for a built-in one", async () => {
    const { rerender } = render(page("saved-1"));
    await waitFor(() => expect(fetchMyColumns).toHaveBeenCalledWith("firm-1", "submissions", "saved-1"));
    rerender(page("won"));
    await waitFor(() => expect(fetchMyColumns).toHaveBeenLastCalledWith("firm-1", "submissions", null));
    rerender(page(null));
    expect(fetchMyColumns).not.toHaveBeenCalledWith("firm-1", "submissions", "won");
  });

  // Catches: the view's own columns, which the database answers as source "view", not being drawn.
  it("draws the columns the view was saved with", async () => {
    fetchMyColumns.mockResolvedValue({ columns: ["company", "status"], source: "view" });
    render(page("saved-1"));
    await waitFor(() => expect(shown()).toEqual(["Company", "Status"]));
  });

  // Catches: a change on a view being kept as the person's choice for the whole table.
  it("keeps a change on a view as the person's own choice for that view", async () => {
    fetchMyColumns.mockResolvedValue({ columns: ["company", "status"], source: "view" });
    const user = userEvent.setup();
    render(page("saved-1"));
    await waitFor(() => expect(shown()).toEqual(["Company", "Status"]));
    const menu = await open(user);
    await user.click(within(menu).getByRole("checkbox", { name: "Contact" }));
    expect(shown()).toEqual(["Company", "Status", "Contact"]);
    await waitFor(() => expect(setMyColumns).toHaveBeenCalledWith("firm-1", "submissions", "saved-1", ["company", "status", "contact"]));
  });

  // Catches: moving to another view showing the last view's columns as this one's, or letting a change be made before this view's answer.
  it("shows no change as possible until the next view's columns have arrived, and then draws them", async () => {
    let arrive: (v: unknown) => void = () => {};
    fetchMyColumns.mockImplementation((_f: string, _t: string, view: string | null) =>
      view ? new Promise((r) => { arrive = r; }) : Promise.resolve({ columns: ["company", "contact"], source: "mine" }));
    const user = userEvent.setup();
    const { rerender } = render(page(null));
    await waitFor(() => expect(shown()).toEqual(["Company", "Contact"]));
    rerender(page("saved-1"));
    // The last columns stay while the next are on their way, rather than the table jumping to the usual ones and back.
    expect(shown()).toEqual(["Company", "Contact"]);
    const menu = await open(user);
    await user.click(within(menu).getByRole("checkbox", { name: "States" }));
    expect(setMyColumns).not.toHaveBeenCalled();
    arrive({ columns: ["company", "states"], source: "mine_for_view" });
    await waitFor(() => expect(shown()).toEqual(["Company", "States"]));
  });

  // Catches: "forget" on a view being offered when the person has no choice of their own on it (the columns would not change), or being offered for the view's.
  it("offers to go back to the view's columns only when the person has a choice of their own on it", async () => {
    fetchMyColumns.mockResolvedValue({ columns: ["company", "status"], source: "view" });
    const user = userEvent.setup();
    render(page("saved-1"));
    await waitFor(() => expect(shown()).toEqual(["Company", "Status"]));
    const menu = await open(user);
    expect(within(menu).getByRole("button", { name: "Go back to this view's columns" })).toHaveAttribute("aria-disabled", "true");
    expect(within(menu).queryByRole("button", { name: "Show the usual columns" })).toBeNull();
  });

  // Catches: forgetting the person's choice on a view leaving what was drawn (their choice), instead of what the database now answers (the view's columns).
  it("asks again after forgetting, and draws what the database then says (the view's own columns)", async () => {
    fetchMyColumns.mockResolvedValue({ columns: ["company", "states"], source: "mine_for_view" });
    const user = userEvent.setup();
    render(page("saved-1"));
    await waitFor(() => expect(shown()).toEqual(["Company", "States"]));
    const menu = await open(user);
    fetchMyColumns.mockResolvedValue({ columns: ["company", "status"], source: "view" });
    await user.click(within(menu).getByRole("button", { name: "Go back to this view's columns" }));
    expect(setMyColumns).toHaveBeenCalledWith("firm-1", "submissions", "saved-1", null);
    await waitFor(() => expect(shown()).toEqual(["Company", "Status"]));
    await waitFor(() => expect(within(menu).getByRole("button", { name: "Go back to this view's columns" })).toHaveAttribute("aria-disabled", "true"));
  });

  // Catches: a closing firm or a support session being told "try again" for a change that can never be kept (D-217, ADR 0023, ADR 0024).
  it("shows the database's own words when the firm is closing or the session is support's", async () => {
    setMyColumns.mockRejectedValue(new Error("This firm is closing, so nothing in it can be changed."));
    const user = userEvent.setup();
    render(page("saved-1"));
    const menu = await open(user);
    await waitFor(() => expect(within(menu).queryByText("Available once your columns have loaded.")).toBeNull());
    await user.click(within(menu).getByRole("checkbox", { name: "Contact" }));
    expect(await within(menu).findByRole("alert")).toHaveTextContent("This firm is closing, so nothing in it can be changed.");
  });

  // Catches: a failed save on one view's words staying on screen over another view.
  it("drops a failed save's line when another view opens", async () => {
    setMyColumns.mockRejectedValue(new Error("Couldn't keep your columns. Try again."));
    const user = userEvent.setup();
    const { rerender } = render(page("saved-1"));
    const menu = await open(user);
    await waitFor(() => expect(within(menu).queryByText("Available once your columns have loaded.")).toBeNull());
    await user.click(within(menu).getByRole("checkbox", { name: "Contact" }));
    await within(menu).findByRole("alert");
    rerender(page(null));
    await waitFor(() => expect(within(screen.getByRole("dialog")).queryByRole("alert")).toBeNull());
  });
});

describe("writes and answers on more than one view", () => {
  const later = () => { let release: (error?: Error) => void = () => {}; const p = new Promise<void>((res, rej) => { release = (e) => (e ? rej(e) : res()); }); return { p, release }; };

  // Catches: a refusal of a write on one view being lost because the person moved to another view and wrote there (the first view then shows rejected columns as kept).
  it("rolls back and says so on a view whose write is refused after the person wrote on another view", async () => {
    fetchMyColumns.mockImplementation(async (_f: string, _t: string, view: string | null) => ({ columns: view === "saved-2" ? ["company", "states"] : ["company", "status"], source: "view" }));
    const first = later();
    setMyColumns.mockReset().mockImplementation((_f: string, _t: string, view: string | null) => (view === "saved-1" ? first.p : Promise.resolve()));
    const user = userEvent.setup();
    const { rerender } = render(page("saved-1"));
    await waitFor(() => expect(shown()).toEqual(["Company", "Status"]));
    let menu = await open(user);
    await user.click(within(menu).getByRole("checkbox", { name: "Contact" }));
    expect(shown()).toEqual(["Company", "Status", "Contact"]);
    rerender(page("saved-2"));
    await waitFor(() => expect(shown()).toEqual(["Company", "States"]));
    menu = screen.getByRole("dialog");
    await user.click(within(menu).getByRole("checkbox", { name: "Status" }));
    await waitFor(() => expect(setMyColumns).toHaveBeenCalledWith("firm-1", "submissions", "saved-2", ["company", "states", "status"]));
    first.release(new Error("This firm is closing, so nothing in it can be changed."));
    await waitFor(() => expect(setMyColumns).toHaveBeenCalledTimes(2));
    rerender(page("saved-1"));
    await waitFor(() => expect(shown()).toEqual(["Company", "Status"]));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("This firm is closing, so nothing in it can be changed.");
  });

  // Catches: a shared view's new own columns, arriving with the next refresh of the views, never replacing the cached ones (new filters, old columns).
  it("asks again for the columns when the view's definition has changed", async () => {
    fetchMyColumns.mockResolvedValue({ columns: ["company", "status"], source: "view" });
    const { rerender } = render(page("saved-1"));
    await waitFor(() => expect(shown()).toEqual(["Company", "Status"]));
    expect(fetchMyColumns).toHaveBeenCalledTimes(1);
    fetchMyColumns.mockResolvedValue({ columns: ["company", "contact"], source: "view" });
    rerender(page("saved-1", make("2026-11-02T09:00:00Z")));
    await waitFor(() => expect(shown()).toEqual(["Company", "Contact"]));
    expect(fetchMyColumns).toHaveBeenCalledTimes(2);
  });

  // Catches: a write finishing under the revision it started under while the view moved to a new revision mid-write, so the new revision keeps showing the answer the
  // database gave before the write landed (the person's change gone from the screen until some later refresh).
  it("shows a kept change under the view's new revision when the view's definition moved while the write was on its way", async () => {
    let server = ["company", "status"];
    fetchMyColumns.mockImplementation(async () => ({ columns: server, source: "mine_for_view" }));
    const write = later();
    setMyColumns.mockReset().mockImplementation(async (_f: string, _t: string, _v: string | null, columns: string[]) => {
      await write.p;
      server = columns;
    });
    const user = userEvent.setup();
    const { rerender } = render(page("saved-1"));
    await waitFor(() => expect(shown()).toEqual(["Company", "Status"]));
    const menu = await open(user);
    await user.click(within(menu).getByRole("checkbox", { name: "Contact" }));
    expect(shown()).toEqual(["Company", "Status", "Contact"]);
    // The view's definition moves while the write is on its way; its columns are asked for under the new revision and the database still answers the old.
    rerender(page("saved-1", make("2026-11-02T09:00:00Z")));
    await waitFor(() => expect(fetchMyColumns).toHaveBeenCalledTimes(2));
    write.release();
    await waitFor(() => expect(shown()).toEqual(["Company", "Status", "Contact"]));
    await new Promise((r) => setTimeout(r, 30));
    expect(shown()).toEqual(["Company", "Status", "Contact"]);
    // And a fresh look at the new revision agrees with what the database now holds.
    expect(fetchMyColumns.mock.calls.length).toBeGreaterThan(2);
  });

  // Catches: a refused write rolling the screen back to the columns of ANOTHER revision of the view (the baseline was kept per view, the answers per revision).
  it("rolls a refused write back to the columns of its own revision, not the last confirmed on an earlier one", async () => {
    fetchMyColumns.mockImplementation(async () => ({ columns: ["company", "status"], source: "mine_for_view" }));
    const first = later();
    const second = later();
    setMyColumns.mockReset().mockImplementation((_f: string, _t: string, _v: string | null, columns: string[]) => (columns.includes("contact") ? first.p : second.p));
    const user = userEvent.setup();
    const { rerender } = render(page("saved-1"));
    await waitFor(() => expect(shown()).toEqual(["Company", "Status"]));
    let menu = await open(user);
    await user.click(within(menu).getByRole("checkbox", { name: "Contact" }));
    // A new revision of the view, whose own answer differs.
    fetchMyColumns.mockImplementation(async () => ({ columns: ["company", "states"], source: "mine_for_view" }));
    rerender(page("saved-1", make("2026-11-02T09:00:00Z")));
    await waitFor(() => expect(shown()).toEqual(["Company", "States"]));
    menu = screen.getByRole("dialog");
    await user.click(within(menu).getByRole("checkbox", { name: "Status" }));
    expect(shown()).toEqual(["Company", "States", "Status"]);
    first.release();
    await waitFor(() => expect(setMyColumns).toHaveBeenCalledTimes(2));
    second.release(new Error("This firm is closing, so nothing in it can be changed."));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("This firm is closing");
    // Back to what the database confirmed for THIS revision (Company, States), not the first revision's kept choice.
    await waitFor(() => expect(shown()).toEqual(["Company", "States"]));
  });
});

