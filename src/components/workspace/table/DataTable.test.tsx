import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { TableDefinition } from "./columns";
import { DataTable } from "./DataTable";

// The table's first column stays in view when the table scrolls sideways (story CRM-S3.1a). jsdom has no layout, so these read what a
// browser is told: the first column's header and cells are sticky at the left edge, and the others are not.
type Row = { id: string; name: string; other: string };
const table = {
  id: "demo",
  fields: {},
  columns: [
    { id: "name", header: "Name", isName: true, cell: (r: Row) => r.name },
    { id: "other", header: "Other", cell: (r: Row) => r.other },
  ],
  rowKey: (r: Row) => r.id,
} as unknown as TableDefinition<Record<string, never>, Row, undefined>;
const rows: Row[] = [{ id: "1", name: "Acme", other: "x" }, { id: "2", name: "Birch", other: "y" }];
const draw = () => render(<DataTable table={table} context={undefined} rows={rows} caption="Demo" sort={null} />);

afterEach(cleanup);

describe("DataTable's first column", () => {
  // Catches: the name column scrolling out of sight so a person reads a row of numbers with no idea whose they are.
  it("is pinned to the left edge in the header and in every row, and no other column is", () => {
    draw();
    for (const cell of [screen.getByRole("columnheader", { name: "Name" }), ...screen.getAllByRole("rowheader")]) {
      expect(cell.className).toMatch(/\bsticky\b/);
      expect(cell.className).toMatch(/\bleft-0\b/);
    }
    expect(screen.getByRole("columnheader", { name: "Other" }).className).not.toMatch(/sticky/);
    expect(screen.getByRole("cell", { name: "x" }).className).not.toMatch(/sticky/);
  });

  // Catches: a pinned cell with no background, so the columns scrolling under it show through and the words overlap.
  it("has a solid background, so what scrolls under it is hidden", () => {
    draw();
    expect(screen.getByRole("rowheader", { name: "Acme" }).className).toMatch(/\bbg-card\b/);
    expect(screen.getByRole("columnheader", { name: "Name" }).className).toMatch(/\bbg-muted\b/);
  });

  // Catches: a pinned column that looks no different from the rest once the others slide under it (nothing says it is a floating edge).
  it("shows an edge only once the table has been scrolled sideways", () => {
    draw();
    const box = screen.getByRole("region", { name: "Demo, scrolls sideways" });
    const head = () => screen.getByRole("columnheader", { name: "Name" });
    expect(head().className).not.toMatch(/shadow/);
    box.scrollLeft = 40;
    fireEvent.scroll(box);
    expect(head().className).toMatch(/shadow/);
    expect(within(screen.getByRole("rowheader", { name: "Acme" }).closest("tr")!).getByRole("rowheader").className).toMatch(/shadow/);
    box.scrollLeft = 0;
    fireEvent.scroll(box);
    expect(head().className).not.toMatch(/shadow/);
  });
});
