import { describe, expect, it } from "vitest";
import type { ColumnDefinition } from "./columns";
import { columnIdsShown, hideColumn, moveColumn, showColumn, shownColumns } from "./columnChoice";

// The columns a person sees (story CRM-S3.1a): the table's own list, or their kept choice of it. The choice is a list of column ids in order.
type Col = ColumnDefinition<{ id: string }, string>;
const col = (id: string, over: Partial<Col> = {}): Col => ({ id, header: id, cell: () => id, ...over });
const table = { columns: [col("company", { isName: true }), col("contact"), col("states"), col("status")] };
const ids = (list: Col[]) => list.map((c) => c.id);

describe("shownColumns", () => {
  // Catches: a person with no kept choice seeing fewer columns than the table's own.
  it("is every column in the table's own order when nothing is kept", () => {
    expect(ids(shownColumns(table, null))).toEqual(["company", "contact", "states", "status"]);
  });

  // Catches: the kept order or the hiding being ignored.
  it("shows the kept columns in the kept order and leaves the others out", () => {
    expect(ids(shownColumns(table, ["company", "status", "contact"]))).toEqual(["company", "status", "contact"]);
  });

  // Catches: a stored list that lacks the name column (or puts it later) leaving the table with no name column in view.
  it("always puts the name column first, even when the kept list leaves it out or puts it later", () => {
    expect(ids(shownColumns(table, ["status", "contact"]))).toEqual(["company", "status", "contact"]);
    expect(ids(shownColumns(table, ["states", "company"]))).toEqual(["company", "states"]);
  });

  // Catches: a column that was renamed or removed since the choice was kept breaking the table.
  it("drops a kept id the table doesn't have, and a repeated one", () => {
    expect(ids(shownColumns(table, ["company", "gone", "status", "status"]))).toEqual(["company", "status"]);
  });

  // Catches: a choice made only of columns that no longer exist leaving a bare name column with no way to tell why.
  it("falls back to every column when none of the kept ones is known", () => {
    expect(ids(shownColumns(table, ["gone", "also_gone"]))).toEqual(["company", "contact", "states", "status"]);
  });

  // Catches: hiding everything but the name being treated as "nothing kept".
  it("keeps a choice of the name column alone", () => {
    expect(ids(shownColumns(table, ["company"]))).toEqual(["company"]);
  });
});

describe("changing the choice", () => {
  const all = ["company", "contact", "states", "status"];

  // Catches: the name column being hidable.
  it("never hides the name column", () => {
    expect(hideColumn(table, all, "company")).toEqual(all);
  });

  it("hides a column and keeps the order of the rest", () => {
    expect(hideColumn(table, all, "states")).toEqual(["company", "contact", "status"]);
  });

  // Catches: a column shown again landing somewhere unseen; it goes last.
  it("shows a hidden column at the end", () => {
    expect(showColumn(table, ["company", "status"], "contact")).toEqual(["company", "status", "contact"]);
    expect(showColumn(table, ["company"], "nope")).toEqual(["company"]);
  });

  it("moves a column one place earlier or later", () => {
    expect(moveColumn(table, all, "status", -1)).toEqual(["company", "contact", "status", "states"]);
    expect(moveColumn(table, all, "contact", 1)).toEqual(["company", "states", "contact", "status"]);
  });

  // Catches: a column going before the name column, or off either end.
  it("keeps the name column first and a column inside the list", () => {
    expect(moveColumn(table, all, "contact", -1)).toEqual(all);
    expect(moveColumn(table, all, "status", 1)).toEqual(all);
    expect(moveColumn(table, all, "company", 1)).toEqual(all);
  });

  it("says the ids shown, in order", () => {
    expect(columnIdsShown(shownColumns(table, ["company", "status"]))).toEqual(["company", "status"]);
  });
});
