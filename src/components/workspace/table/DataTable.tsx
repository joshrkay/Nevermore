import type { MouseEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortDirection, TableFields, TableSort } from "@/lib/tableQuery";
import { cn } from "@/lib/utils";
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
  /** The rows are the previous ones while the next arrive. */
  busy?: boolean;
  /** A click anywhere on a row, outside its links and buttons, opens it. */
  onOpenRow?: (row: Row) => void;
  /**
   * What a column header holds, in place of the default (its words, and the sort button when `onSort` is given). CRM-S3.3a puts nothing
   * here (its filters are a row of their own); CRM-S3.1a's columns menu is beside the table, not in it.
   */
  renderHeader?: (column: ColumnDefinition<Row, keyof K & string, Context>, sort: TableSort<keyof K & string> | null) => ReactNode;
}

/** The table itself: a real table with a caption, column headers with scope, the first column as each row's header, scrolling inside its own box. */
export function DataTable<K extends TableFields, Row, Context>({ table, context, rows, columns = table.columns, placeholder, caption, sort, onSort, busy, onOpenRow, renderHeader }: Props<K, Row, Context>) {
  const openRow = (e: MouseEvent, row: Row) => {
    if (!onOpenRow || (e.target as HTMLElement).closest("a, button, input, select, label")) return;
    onOpenRow(row);
  };
  return (
    <div
      role="region"
      aria-label={`${caption}, scrolls sideways`}
      tabIndex={0}
      aria-busy={busy || undefined}
      className={cn("overflow-x-auto rounded-xl border border-border bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", busy && "opacity-70")}
    >
      <table className="w-full min-w-max caption-bottom text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-muted/60">
          <tr>
            {columns.map((column) => {
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
                  className={cn("h-11 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground", !renderHeader && onSort && field !== undefined ? "p-0" : "px-4", right && "text-right")}
                >
                  {!renderHeader && onSort && field !== undefined ? (
                    <button
                      type="button"
                      onClick={() => onSort({ field, direction: next })}
                      aria-label={`${column.header}, ${sorted ? `sorted ${word(sorted)}` : "not sorted"}. Sort ${word(next)}`}
                      className={cn("flex h-11 w-full items-center gap-1 px-4 uppercase tracking-wide hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring", right && "flex-row-reverse", sorted && "text-foreground")}
                    >
                      <span>{column.header}</span>
                      {/* A shape, not a colour: an arrow on the sorted column, a faint up-down mark on the others to say they sort. */}
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
          </tr>
        </thead>
        {placeholder ?? (
        <tbody>
          {rows.map((row) => (
            <tr
              key={table.rowKey(row)}
              onClick={onOpenRow ? (e) => openRow(e, row) : undefined}
              className={cn("border-b border-border last:border-0 hover:bg-muted/50", onOpenRow && "cursor-pointer")}
            >
              {/* CRM-S3.6 (D-47): the row's checkbox goes here, before the first column. Nothing selects rows yet. */}
              {columns.map((column, i) => {
                const cell = column.cell(row, context);
                const className = cn("px-4 py-3 align-top", column.align === "right" && "text-right");
                // The first column names the row, so a screen reader reading a cell can say whose it is.
                return i === 0 ? (
                  <th key={column.id} scope="row" className={cn(className, "text-left font-normal")}>{cell}</th>
                ) : (
                  <td key={column.id} className={className}>{cell}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
        )}
      </table>
    </div>
  );
}
