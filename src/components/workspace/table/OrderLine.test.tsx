import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
import { OrderLine } from "./OrderLine";

// The line over the table that says what order the rows are in (CRM-S3.2a), and, from CRM-S3.4a, what order a saved view puts them in.
const table = (over: Record<string, unknown> = {}) =>
  ({
    fields: { company_name: { label: "Company", kind: "text" }, signer_name: { label: "Signer", kind: "text" } },
    columns: [{ id: "company", header: "Company", sortField: "company_name" }],
    views: [],
    defaultSort: null,
    defaultSortLabel: "Newest first",
    defaultSortReset: "Back to newest first",
    ...over,
  }) as never;
const view = (sort: { field: string; direction: "asc" | "desc" } | null) => ({ id: "v", label: "Mine", filters: [], sort });
afterEach(cleanup);

describe("the order line", () => {
  // Catches: a view's order being invisible when no header shows it (the queue's signer has no column), so the rows look arbitrary.
  it("says the order of a view whose sort no column shows", () => {
    render(<OrderLine table={table()} view={view({ field: "signer_name", direction: "asc" })} sort={null} onReset={() => {}} />);
    expect(screen.getByText("Order: Signer, ascending")).toBeInTheDocument();
  });

  // Catches: a line over a table whose header already shows the order, which says it twice.
  it("says nothing for a view whose sort a header shows", () => {
    render(<OrderLine table={table()} view={view({ field: "company_name", direction: "desc" })} sort={null} onReset={() => {}} />);
    expect(screen.queryByText(/Order:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // Catches: "Back to newest first" taking a person out of the view's order into the table's.
  it("offers the way back to the view's own order, not the table's, once a column is sorted", async () => {
    const onReset = vi.fn();
    render(<OrderLine table={table()} view={view({ field: "signer_name", direction: "asc" })} sort={{ field: "company_name", direction: "asc" }} onReset={onReset} />);
    expect(screen.getByText("Sorted by Company, ascending.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to newest first" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to this view's order" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  // Catches: a view with no sort of its own changing the table's words.
  it("keeps the table's own words for no view and for a view with no sort", async () => {
    const { rerender } = render(<OrderLine table={table()} view={undefined} sort={null} onReset={() => {}} />);
    expect(screen.getByText("Order: Newest first")).toBeInTheDocument();
    rerender(<OrderLine table={table()} view={view(null)} sort={{ field: "company_name", direction: "asc" }} onReset={() => {}} />);
    expect(screen.getByRole("button", { name: "Back to newest first" })).toBeInTheDocument();
  });
});
