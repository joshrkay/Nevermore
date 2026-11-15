import { useEffect, useRef, type ReactNode } from "react";
import type { RowSelection } from "./useRowSelection";

/**
 * The bar that replaces a table's toolbar while rows are selected (CRM-S3.6, screen 35): how many, the table's bulk actions (`children`, only ones that
 * work), and "Clear". Absent while nothing is selected.
 */
export function SelectionBar<Row>({ selection, noun, children }: { selection: RowSelection<Row>; noun: { singular: string; plural: string }; children?: ReactNode }) {
  const words = selection.count === 0 ? "" : selection.all ? `All ${selection.count} ${selection.count === 1 ? noun.singular : noun.plural} selected` : `${selection.count} selected`;
  return (
    <>
      {/* Always on the page, so that what fills it is announced (a status that arrives with its words is often missed). */}
      <p role="status" className="sr-only">{words}</p>
      {selection.count > 0 && (
        <div role="region" aria-label="Selected rows" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-2">
          <p className="px-2 text-sm font-semibold">{words}</p>
          {children}
          <button type="button" onClick={selection.clear} className="ml-auto min-h-11 rounded-md border border-border bg-background px-4 text-sm hover:bg-muted">Clear</button>
        </div>
      )}
    </>
  );
}

/**
 * The line under the views once the whole page is selected: offers every row that matches, and once chosen says so. Drawn by the frame.
 */
export function SelectAllLine<Row>({ selection, noun }: { selection: RowSelection<Row>; noun: { singular: string; plural: string } }) {
  const { all, pageState, total } = selection;
  // Pressing "Select all N that match" replaces that button with "Clear selection": focus follows to it, not to the page.
  const clearRef = useRef<HTMLButtonElement>(null);
  const chose = useRef(false);
  useEffect(() => {
    if (all && chose.current) clearRef.current?.focus();
    chose.current = false;
  }, [all]);
  if (all) {
    return (
      <p className="mb-3 text-sm text-muted-foreground">
        All {total} {total === 1 ? noun.singular : noun.plural} that match are selected.{" "}
        <button type="button" ref={clearRef} onClick={selection.clear} className="text-primary underline">Clear selection</button>
      </p>
    );
  }
  if (pageState !== "all" || total <= selection.rowsOnPage) return null;
  return (
    <p className="mb-3 text-sm text-muted-foreground">
      All {selection.rowsOnPage} on this page are selected.{" "}
      <button type="button" onClick={() => { chose.current = true; selection.selectAllMatching(); }} className="text-primary underline">Select all {total} that match</button>
    </p>
  );
}
