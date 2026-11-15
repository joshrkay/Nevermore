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
  it("has an opaque background, so what scrolls under it is hidden", () => {
    draw();
    expect(screen.getByRole("rowheader", { name: "Acme" }).className).toMatch(/\bbg-card\b/);
    expect(screen.getByRole("columnheader", { name: "Name" }).className).toMatch(/\bbg-card\b/);
  });

  // Catches: the pinned header reading as a darker block, and the pinned cell of a hovered row staying white, because they are painted differently from
  // the row they sit in (the header row is the muted colour at 60% and a hovered row at 50%, over the card).
  it("is tinted the way its row is: the header's tint on the header, the hover's on a hovered row", () => {
    draw();
    const head = screen.getByRole("columnheader", { name: "Name" });
    const header = head.closest("thead")!;
    expect(header.className).toContain("bg-muted/60");
    expect(head.className).toContain("linear-gradient(hsl(var(--muted)/0.6),hsl(var(--muted)/0.6))");
    const cell = screen.getByRole("rowheader", { name: "Acme" });
    expect(cell.closest("tr")!.className).toContain("hover:bg-muted/50");
    expect(cell.closest("tr")!.className).toMatch(/\bgroup\b/);
    expect(cell.className).toContain("group-hover:bg-[image:linear-gradient(hsl(var(--muted)/0.5),hsl(var(--muted)/0.5))]");
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
