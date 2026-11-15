import { describe, expect, it } from "vitest";
import { shownColumns } from "./columnChoice";

// A table that lists its usual columns (the accounts table, CRM-A1.1a) shows them until a person chooses their own; the rest wait in the Columns menu.
const columns = [{ id: "name", isName: true }, { id: "owner" }, { id: "website" }, { id: "source" }];
const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe("shownColumns on a table with usual columns", () => {
  // Catches: every column shown at once on a table that keeps some for the menu.
  it("shows the usual columns, in their order, while nothing is kept", () => {
    expect(ids(shownColumns({ columns, usual: ["name", "source", "owner"] }, null))).toEqual(["name", "source", "owner"]);
  });
  // Catches: the name column missing or last when the usual list leaves it out.
  it("puts the name column first even when the usual list leaves it out", () => {
    expect(ids(shownColumns({ columns, usual: ["owner"] }, null))).toEqual(["name", "owner"]);
  });
  // Catches: a kept choice with no column the table knows showing nothing, instead of the usual ones.
  it("falls back to the usual columns when nothing kept is known", () => {
    expect(ids(shownColumns({ columns, usual: ["name", "owner"] }, ["gone"]))).toEqual(["name", "owner"]);
  });
  // Catches: the usual list overriding what a person kept.
  it("shows what a person kept, not the usual columns", () => {
    expect(ids(shownColumns({ columns, usual: ["name", "owner"] }, ["name", "website"]))).toEqual(["name", "website"]);
  });
  // Catches: a table with no usual list changing: every column.
  it("shows every column of a table with no usual list", () => {
    expect(ids(shownColumns({ columns }, null))).toEqual(["name", "owner", "website", "source"]);
  });
});
