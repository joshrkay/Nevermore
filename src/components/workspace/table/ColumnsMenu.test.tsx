import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkspaceContext, type Workspace } from "../workspaceContext";
import type { TableDefinition } from "./columns";
import { shownColumns } from "./columnChoice";
import { ColumnsMenu } from "./ColumnsMenu";
import { useMyColumns } from "./useMyColumns";

// The "Columns" control (story CRM-S3.1a): a person shows, hides and reorders a table's columns, and the choice is kept in the database for them
// (`my_table_columns` / `set_my_table_columns`, D-43). The database's own rules are in supabase/tests/table_settings.sql; these are what a person
// sees and does, with the two calls faked.
const fetchMyColumns = vi.fn();
const setMyColumns = vi.fn();
vi.mock("@/lib/tableSettingsApi", () => ({
  fetchMyColumns: (...a: unknown[]) => fetchMyColumns(...a),
  setMyColumns: (...a: unknown[]) => setMyColumns(...a),
}));

type Row = { id: string };
const col = (id: string, header: string, isName = false) => ({ id, header, isName, cell: () => id });
const demo = (over: Record<string, unknown> = {}) =>
  ({
    id: "submissions",
    noun: { singular: "submission", plural: "submissions" },
    fields: {},
    columns: [col("company", "Company", true), col("contact", "Contact"), col("states", "States"), col("status", "Status")],
    rowKey: (r: Row) => r.id,
    ...over,
  }) as unknown as TableDefinition<Record<string, never>, Row, undefined>;

// A page in little: the menu, and the headers of the columns it leaves in the table.
function Harness({ table }: { table: TableDefinition<Record<string, never>, Row, undefined> }) {
  const mine = useMyColumns(table);
  return (
    <>
      <ColumnsMenu table={table} mine={mine} />
      <ul aria-label="Shown">{shownColumns(table, mine.kept).map((c) => <li key={c.id}>{c.header}</li>)}</ul>
    </>
  );
}

const firm = { id: "firm-1", name: "Firm", address: "firm" };
const draw = (table = demo(), firmValue: Workspace["firm"] = firm) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceContext.Provider value={{ firm: firmValue, role: "Owner", isOwner: true, isSupport: false, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: false, person: "Pat" }}>
        <Harness table={table} />
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
const shown = () => within(screen.getByRole("list", { name: "Shown" })).queryAllByRole("listitem").map((li) => li.textContent);
const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Columns" }));
  return screen.getByRole("dialog");
};
const kept = (columns: string[] | null) => fetchMyColumns.mockResolvedValue({ columns, source: columns ? "mine" : "default" });

beforeEach(() => {
  fetchMyColumns.mockReset();
  kept(null);
  setMyColumns.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("the Columns menu", () => {
  // Catches: the table's own columns not showing when nothing is kept, or the menu asking the database about the wrong firm, person or table.
  it("shows every column when nothing is kept, and asks the database for this firm's choice on this table", async () => {
    draw();
    await waitFor(() => expect(fetchMyColumns).toHaveBeenCalledWith("firm-1", "submissions", null));
    expect(shown()).toEqual(["Company", "Contact", "States", "Status"]);
  });

  // Catches: a person's kept choice being ignored on arrival, so they have to choose again every visit (D-43).
  it("shows the kept columns, in the kept order", async () => {
    kept(["company", "status", "contact"]);
    draw();
    await waitFor(() => expect(shown()).toEqual(["Company", "Status", "Contact"]));
  });

  // Catches: the control being missing, or a hidden column having no way back.
  it("lists every column, the shown ones first in their order and then the hidden ones, each with a box to show it", async () => {
    kept(["company", "status"]);
    const user = userEvent.setup();
    draw();
    await waitFor(() => expect(shown()).toEqual(["Company", "Status"]));
    const menu = await open(user);
    const boxes = within(menu).getAllByRole("checkbox");
    expect(boxes.map((b) => [(b as HTMLInputElement).labels?.[0]?.textContent, (b as HTMLInputElement).checked])).toEqual([
      ["Company", true], ["Status", true], ["Contact", false], ["States", false],
    ]);
  });

  // Catches: the name column being hideable, which leaves a row with no name to say whose it is.
  it("keeps the name column: its box is checked, says it is always shown, and ignores a click", async () => {
    const user = userEvent.setup();
    draw();
    const menu = await open(user);
    const box = within(menu).getByRole("checkbox", { name: "Company" });
    expect(box).toHaveAttribute("aria-disabled", "true");
    expect(box).toHaveAccessibleDescription("Always shown");
    await user.click(box);
    expect(setMyColumns).not.toHaveBeenCalled();
    expect(shown()).toContain("Company");
  });

  // Catches: a hidden column still drawn, or the choice not kept (it would be back at the next visit).
  it("hides a column at once and keeps the list for this person, with the name column in it", async () => {
    const user = userEvent.setup();
    draw();
    await user.click(await screen.findByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("checkbox", { name: "Contact" }));
    expect(shown()).toEqual(["Company", "States", "Status"]);
    await waitFor(() => expect(setMyColumns).toHaveBeenCalledWith("firm-1", "submissions", null, ["company", "states", "status"]));
  });

  // Catches: a column shown again going somewhere a person doesn't look for it.
  it("shows a hidden column again at the end", async () => {
    kept(["company", "status"]);
    const user = userEvent.setup();
    draw();
    await waitFor(() => expect(shown()).toEqual(["Company", "Status"]));
    const menu = await open(user);
    await user.click(within(menu).getByRole("checkbox", { name: "Contact" }));
    expect(shown()).toEqual(["Company", "Status", "Contact"]);
    await waitFor(() => expect(setMyColumns).toHaveBeenCalledWith("firm-1", "submissions", null, ["company", "status", "contact"]));
  });

  // Catches: reordering needing a mouse drag (no way for a keyboard), or the move going the wrong way.
  it("moves a column earlier or later with buttons, and keeps the order", async () => {
    const user = userEvent.setup();
    draw();
    const menu = await open(user);
    await user.click(within(menu).getByRole("button", { name: "Move Status earlier" }));
    expect(shown()).toEqual(["Company", "Contact", "Status", "States"]);
    await user.click(within(menu).getByRole("button", { name: "Move Contact later" }));
    expect(shown()).toEqual(["Company", "Status", "Contact", "States"]);
    await waitFor(() => expect(setMyColumns).toHaveBeenLastCalledWith("firm-1", "submissions", null, ["company", "status", "contact", "states"]));
    expect(screen.getByRole("status")).toHaveTextContent("Contact moved later");
  });

  // Catches: a column going before the name column or off the end, and a button that does nothing saying nothing.
  it("has no move before the name column or past the end: the button says so and ignores the click", async () => {
    const user = userEvent.setup();
    draw();
    const menu = await open(user);
    expect(within(menu).queryByRole("button", { name: /Move Company/ })).toBeNull();
    const first = within(menu).getByRole("button", { name: "Move Contact earlier" });
    const last = within(menu).getByRole("button", { name: "Move Status later" });
    expect(first).toHaveAttribute("aria-disabled", "true");
    expect(last).toHaveAttribute("aria-disabled", "true");
    await user.click(first);
    await user.click(last);
    expect(setMyColumns).not.toHaveBeenCalled();
    expect(shown()).toEqual(["Company", "Contact", "States", "Status"]);
  });

  // Catches: focus dropping to the page when the column it was on moves (a keyboard user loses their place).
  it("keeps focus on the button that was pressed when its column moves", async () => {
    const user = userEvent.setup();
    draw();
    const menu = await open(user);
    await user.click(within(menu).getByRole("button", { name: "Move States earlier" }));
    await waitFor(() => expect(within(menu).getByRole("button", { name: "Move States earlier" })).toHaveFocus());
  });

  // Catches: a choice that can't be undone, or "usual columns" forgetting nothing in the database.
  it("goes back to the usual columns by forgetting the choice, and offers that only when one is kept", async () => {
    kept(["company", "status"]);
    const user = userEvent.setup();
    draw();
    await waitFor(() => expect(shown()).toEqual(["Company", "Status"]));
    const menu = await open(user);
    // The refetch after forgetting finds nothing kept, as the database would answer.
    fetchMyColumns.mockResolvedValue({ columns: null, source: "default" });
    await user.click(within(menu).getByRole("button", { name: "Show the usual columns" }));
    expect(shown()).toEqual(["Company", "Contact", "States", "Status"]);
    expect(setMyColumns).toHaveBeenCalledWith("firm-1", "submissions", null, null);
    await waitFor(() => expect(within(menu).getByRole("button", { name: "Show the usual columns" })).toHaveAttribute("aria-disabled", "true"));
  });

  // Catches: a failed save leaving the screen showing a choice that was not kept, or failing silently.
  it("puts the columns back and says so in words when the choice can't be kept", async () => {
    setMyColumns.mockRejectedValue(new Error("Couldn't keep your columns. Try again."));
    const user = userEvent.setup();
    draw();
    const menu = await open(user);
    await user.click(within(menu).getByRole("checkbox", { name: "Contact" }));
    expect(await within(menu).findByRole("alert")).toHaveTextContent("Couldn't keep your columns. Try again.");
    expect(shown()).toEqual(["Company", "Contact", "States", "Status"]);
    // A later change clears the line.
    setMyColumns.mockResolvedValue(undefined);
    await user.click(within(menu).getByRole("checkbox", { name: "States" }));
    await waitFor(() => expect(within(menu).queryByRole("alert")).toBeNull());
  });

  // Catches: a failed load hiding the table or leaving a person with no word on why their columns are not theirs.
  it("shows the usual columns, and says why, when the kept choice can't be loaded", async () => {
    fetchMyColumns.mockRejectedValue(new Error("Couldn't load your columns."));
    const user = userEvent.setup();
    draw();
    const menu = await open(user);
    expect(await within(menu).findByText("Couldn't load your columns, so this shows the usual ones.")).toBeInTheDocument();
    expect(shown()).toEqual(["Company", "Contact", "States", "Status"]);
  });

  // Catches: a choice kept while the table's custom fields are still loading (CRM-X3.1): the ones not loaded yet would be dropped from the kept list.
  it("changes nothing while the table's fields are still loading, and says why", async () => {
    const user = userEvent.setup();
    draw(demo({ fieldsStatus: "loading" }));
    const menu = await open(user);
    expect(within(menu).getByText("More columns are available once the table's fields have loaded.")).toBeInTheDocument();
    await user.click(within(menu).getByRole("checkbox", { name: "Contact" }));
    expect(setMyColumns).not.toHaveBeenCalled();
    expect(shown()).toEqual(["Company", "Contact", "States", "Status"]);
  });

  // Catches: a request made for no firm (or for the wrong one) before the shell knows which firm it is.
  it("asks and keeps nothing until the firm is known", async () => {
    const user = userEvent.setup();
    draw(demo(), null);
    const menu = await open(user);
    expect(within(menu).getByText("Available once your firm's details have loaded.")).toBeInTheDocument();
    await user.click(within(menu).getByRole("checkbox", { name: "Contact" }));
    expect(setMyColumns).not.toHaveBeenCalled();
    expect(fetchMyColumns).not.toHaveBeenCalled();
  });
});
