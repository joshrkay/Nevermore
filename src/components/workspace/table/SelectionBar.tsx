import type { ReactNode } from "react";
import type { RowSelection } from "./useRowSelection";

/**
 * The bar that replaces a table's toolbar while rows are selected (CRM-S3.6, screen 35): how many, the table's bulk actions (`children`, only ones that
 * work), and "Clear". Absent while nothing is selected.
 */
export function SelectionBar<Row>({ selection, noun, children }: { selection: RowSelection<Row>; noun: { singular: string; plural: string }; children?: ReactNode }) {
  if (selection.count === 0) return null;
  return (
    <div role="region" aria-label="Selected rows" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-2">
      <p role="status" className="px-2 text-sm font-semibold">
        {selection.all ? `All ${selection.count} ${selection.count === 1 ? noun.singular : noun.plural} selected` : `${selection.count} selected`}
      </p>
      {children}
      <button type="button" onClick={selection.clear} className="ml-auto min-h-11 rounded-md border border-border bg-background px-4 text-sm hover:bg-muted">Clear</button>
    </div>
  );
}

/**
 * The line under the views once the whole page is selected: offers every row that matches, and once chosen says so. Drawn by the frame.
 */
export function SelectAllLine<Row>({ selection, noun }: { selection: RowSelection<Row>; noun: { singular: string; plural: string } }) {
  const { all, pageState, total } = selection;
  if (all) {
    return (
      <p className="mb-3 text-sm text-muted-foreground">
        All {total} {total === 1 ? noun.singular : noun.plural} that match are selected.{" "}
        <button type="button" onClick={selection.clear} className="text-primary underline">Clear selection</button>
      </p>
    );
  }
  if (pageState !== "all" || total <= selection.rowsOnPage) return null;
  return (
    <p className="mb-3 text-sm text-muted-foreground">
      All {selection.rowsOnPage} on this page are selected.{" "}
      <button type="button" onClick={selection.selectAllMatching} className="text-primary underline">Select all {total} that match</button>
    </p>
  );
}
