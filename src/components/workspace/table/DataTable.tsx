import { useState, type MouseEvent, type ReactNode, type Ref } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortDirection, TableFields, TableSort } from "@/lib/tableQuery";
import { cn } from "@/lib/utils";
import type { RowSelection } from "./useRowSelection";
import { firstSortDirection, type ColumnDefinition, type TableDefinition } from "./columns";

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  /** What the page hands every cell besides its row. */
  context: Context;
  rows: Row[];
  /**
   * The columns to draw, when not all of the definition's (CRM-S3.1a passes the person's visible and ordered ones; the loading state
   * draws the same list so nothing jumps). Default: every column of the definition.
   */
  columns?: ColumnDefinition<Row, keyof K & string, Context>[];
  /** Drawn in the body instead of the rows: the loading state's grey rows (CRM-S2.1), under these very headers. */
  placeholder?: ReactNode;
  /** Names the table to a screen reader; not drawn. */
  caption: string;
  /** The sort the table has now (the address's, or the table's default), shown in the header. */
  sort: TableSort<keyof K & string> | null;
  /**
   * Asked to sort by a column (CRM-S3.2a). When given, a column with a `sortField` has a header button over the whole cell: a first click
   * sorts it in its field's first direction, a click on the sorted column reverses it, and nothing clears it (the way back to the table's own
   * order is the frame's). Left out, the headers only show the sort.
   */
  onSort?: (sort: TableSort<keyof K & string>) => void;
  /** The rows are the previous ones while the next arrive: the body is dimmed and marked busy (never the headers, which stay usable). */
  busy?: boolean;
  /** The scroll box, so the frame can put focus there when a control that was focused goes away. */
  scrollRef?: Ref<HTMLDivElement>;
  /** A click anywhere on a row, outside its links and buttons, opens it. */
  onOpenRow?: (row: Row) => void;
  /** What the last cell of a row holds, under a header that only a screen reader reads (a row's own actions, CRM-A1.1c). Not a column: nobody hides or sorts it. */
  rowActions?: (row: Row) => ReactNode;
  /**
   * What a column header holds, in place of the default (its words, and the sort button when `onSort` is given). CRM-S3.3a puts nothing
   * here (its filters are a row of their own); CRM-S3.1a's columns menu is beside the table, not in it.
   */
  /**
   * Row selection (CRM-S3.6): a checkbox before the first column of each row, named by the row's own words, and one in the header for the page. Left
   * out, the table has no checkboxes and is exactly as it was (the queue).
   */
  selection?: RowSelection<Row>;
  /** The rows on screen answer an earlier question while the next arrives: their checkboxes do nothing, so no row that was not asked for is selected. */
  selectionPaused?: boolean;
  renderHeader?: (column: ColumnDefinition<Row, keyof K & string, Context>, sort: TableSort<keyof K & string> | null) => ReactNode;
}

/**
 * The first column stays in view when the table scrolls sideways (CRM-S3.1a): its header and its cells stick to the left edge, with a solid
 * background so what scrolls under them is hidden, painted to look like the row it is in (the header's tint, and a hovered row's, which is passed
 * on to its pinned cell through `group`). The edge (a shadow)
 * shows only once the table has been scrolled, so a table that fits has no stray line.
 */
const PINNED = "sticky left-0";
// What a pinned cell is painted with must be opaque (cells scroll under it) yet look like the row it is in. The header row is the muted colour at 60%
// over the card and a hovered row the muted colour at 50% over the card, so a pinned cell is the card colour with that same tint laid over it.
const PINNED_HEAD = "bg-card bg-[image:linear-gradient(hsl(var(--muted)/0.6),hsl(var(--muted)/0.6))]";
const PINNED_CELL = "bg-card group-hover:bg-[image:linear-gradient(hsl(var(--muted)/0.5),hsl(var(--muted)/0.5))]";
const EDGE = "shadow-[2px_0_4px_-2px_hsl(var(--foreground)/0.25)]";

/** The table itself: a real table with a caption, column headers with scope, the first column as each row's header, scrolling inside its own box. */
export function DataTable<K extends TableFields, Row, Context>({ table, context, rows, columns = table.columns, placeholder, caption, sort, onSort, busy, scrollRef, onOpenRow, rowActions, renderHeader, selection, selectionPaused }: Props<K, Row, Context>) {
  // Whether the table has been scrolled sideways: only then does the pinned column need an edge.
  const [scrolled, setScrolled] = useState(false);
  // With a checkbox column the name is pinned after it (the checkbox column is one 2.75rem cell).
  const pinned = selection ? "sticky left-11" : PINNED;
  const openRow = (e: MouseEvent, row: Row) => {
    if (!onOpenRow || (e.target as HTMLElement).closest("a, button, input, select, label")) return;
    onOpenRow(row);
  };
  return (
    <div
      role="region"
      aria-label={`${caption}, scrolls sideways`}
      tabIndex={0}
      ref={scrollRef}
      onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}
      className="overflow-x-auto rounded-xl border border-border bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      <table className="w-full min-w-max caption-bottom text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-muted/60">
          <tr>
            {selection && (
              <th scope="col" className={cn("sticky left-0 z-20 h-11 w-11 min-w-11 p-0", PINNED_HEAD)}>
                <label className="flex h-11 w-11 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    aria-label={`Select all ${table.noun.plural} on this page`}
                    checked={selection.pageState === "all"}
                    ref={(el) => {
                      selection.pageBox.current = el;
                      if (el) el.indeterminate = selection.pageState === "some";
                    }}
                    // With no rows there is nothing to select (D-143): still in the tab order, saying why, and doing nothing.
                    aria-disabled={rows.length === 0 || selectionPaused || undefined}
                    aria-describedby={rows.length === 0 ? "select-page-unavailable" : undefined}
                    onChange={rows.length === 0 || selectionPaused ? () => {} : selection.togglePage}
                    className="h-4 w-4"
                  />
                </label>
                {rows.length === 0 && <span id="select-page-unavailable" className="sr-only">Available when the list has rows</span>}
              </th>
            )}
            {columns.map((column, index) => {
              const field = column.sortField;
              const sorted = sort && field !== undefined && field === sort.field ? sort.direction : null;
              const right = column.align === "right";
              const mark = sorted === "asc" ? <ArrowUp className="h-3 w-3 shrink-0" aria-hidden="true" /> : sorted === "desc" ? <ArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" /> : null;
              const word = (d: SortDirection) => (d === "asc" ? "ascending" : "descending");
              // What a click does: the opposite of the direction it is sorted in, or the field's first direction.
              const next: SortDirection = sorted ? (sorted === "asc" ? "desc" : "asc") : field !== undefined ? firstSortDirection(table.fields[field]) : "asc";
              return (
                <th
                  key={column.id}
                  scope="col"
                  // Every sortable column says where it stands ("none" on the unsorted ones); a column with no sort says nothing.
                  aria-sort={field === undefined ? undefined : sorted ? word(sorted) : "none"}
                  className={cn("h-11 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground", index === 0 && cn(pinned, "z-20", PINNED_HEAD, scrolled && EDGE), !renderHeader && onSort && field !== undefined ? "p-0" : "px-4", right && "text-right")}
                >
                  {!renderHeader && onSort && field !== undefined ? (
                    // The name is the header's words and nothing else; `aria-sort` on the cell says the state, and the title says what a click does
                    // (read as the button's description, not as part of the column's name that is read at every cell).
                    <button
                      type="button"
                      onClick={() => onSort({ field, direction: next })}
                      title={`Sort ${word(next)}`}
                      className={cn("flex h-11 w-full items-center gap-1 px-4 uppercase tracking-wide hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring", right && "flex-row-reverse", sorted && "text-foreground")}
                    >
                      <span>{column.header}</span>
                      {/* A shape, not a colour, and decorative: an arrow on the sorted column, a faint up-down mark on the others to say they sort. */}
                      {mark ?? <ArrowUpDown className="h-3 w-3 shrink-0 opacity-40" aria-hidden="true" />}
                    </button>
                  ) : (
                    <>
                      {renderHeader ? renderHeader(column, sort) : column.header}
                      {sorted && !renderHeader && <span className="ml-1 inline-block align-middle">{mark}</span>}
                    </>
                  )}
                </th>
              );
            })}
            {rowActions && <th scope="col" className="h-11 w-12 px-2"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        {placeholder ?? (
        <tbody aria-busy={busy || undefined} className={cn(busy && "opacity-70")}>
          {rows.map((row) => (
            <tr
              key={table.rowKey(row)}
              onClick={onOpenRow ? (e) => openRow(e, row) : undefined}
              className={cn("group border-b border-border last:border-0 hover:bg-muted/50", onOpenRow && "cursor-pointer")}
            >
              {selection && (
                <td className={cn("sticky left-0 z-10 w-11 min-w-11 p-0 align-top", PINNED_CELL)}>
                  <label className="flex h-11 w-11 cursor-pointer items-center justify-center">
                    <input type="checkbox" aria-label={`Select ${selection.rowLabel(row)}`} checked={selection.isSelected(row)} aria-disabled={selectionPaused || undefined} onChange={selectionPaused ? () => {} : () => selection.toggle(row)} className="h-4 w-4" />
                  </label>
                </td>
              )}
              {columns.map((column, i) => {
                const cell = column.cell(row, context);
                const className = cn("px-4 py-3 align-top", column.align === "right" && "text-right");
                // The first column names the row, so a screen reader reading a cell can say whose it is.
                return i === 0 ? (
                  <th key={column.id} scope="row" className={cn(className, "text-left font-normal", pinned, "z-10", PINNED_CELL, scrolled && EDGE)}>{cell}</th>
                ) : (
                  <td key={column.id} className={className}>{cell}</td>
                );
              })}
              {/* The menu and its dialogs are drawn in a portal, whose clicks still reach the row through React's tree: none of them opens the row. */}
              {rowActions && <td onClick={(e) => e.stopPropagation()} className="px-2 py-2 align-top text-right">{rowActions(row)}</td>}
            </tr>
          ))}
        </tbody>
        )}
      </table>
    </div>
  );
}
