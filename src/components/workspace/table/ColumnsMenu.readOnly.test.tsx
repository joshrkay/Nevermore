import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkspaceContext } from "../workspaceContext";
import type { TableDefinition } from "./columns";
import { ColumnsMenu } from "./ColumnsMenu";
import { shownColumns } from "./columnChoice";
import { useMyColumns } from "./useMyColumns";

// A closing firm and a support session can read and change nothing (ADR 0023, ADR 0024), so the database refuses a column choice with PT423 and
// its own words. This runs the real `tableSettingsApi` over a faked database client, so what a person reads is what the whole path says.
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

type Row = { id: string };
const col = (id: string, header: string, isName = false) => ({ id, header, isName, cell: () => id });
const table = {
  id: "submissions",
  noun: { singular: "submission", plural: "submissions" },
  fields: {},
  columns: [col("company", "Company", true), col("contact", "Contact"), col("states", "States")],
  rowKey: (r: Row) => r.id,
} as unknown as TableDefinition<Record<string, never>, Row, undefined>;

function Harness() {
  const mine = useMyColumns(table);
  return (
    <>
      <ColumnsMenu table={table} mine={mine} />
      <ul aria-label="Shown">{shownColumns(table, mine.kept).map((c) => <li key={c.id}>{c.header}</li>)}</ul>
    </>
  );
}

afterEach(cleanup);

describe("the Columns menu in a firm that can't be changed", () => {
  // Catches: "Couldn't keep your columns. Try again." for a refusal that trying again can never get past (D-178).
  it("shows the database's own words when the change is refused as read-only, and puts the columns back", async () => {
    rpc.mockReset().mockImplementation(async (name: string) =>
      name === "my_table_columns"
        ? { data: [], error: null }
        : { data: null, error: { code: "PT423", message: "This firm is closing and can't be changed" } },
    );
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceContext.Provider value={{ firm: { id: "firm-1", name: "Firm", address: "firm" }, role: "Owner", isOwner: true, isSupport: false, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: false, person: "Pat" }}>
          <Harness />
        </WorkspaceContext.Provider>
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Columns" }));
    const menu = screen.getByRole("dialog");
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith("my_table_columns", expect.anything()));
    await user.click(await within(menu).findByRole("checkbox", { name: "Contact", checked: true }));
    expect(await within(menu).findByRole("alert")).toHaveTextContent("This firm is closing and can't be changed");
    expect(within(screen.getByRole("list", { name: "Shown" })).getAllByRole("listitem").map((l) => l.textContent)).toEqual(["Company", "Contact", "States"]);
  });
});
