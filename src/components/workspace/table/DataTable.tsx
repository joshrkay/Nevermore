import type { MouseEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { TableFields, TableSort } from "@/lib/tableQuery";
import { cn } from "@/lib/utils";
import type { ColumnDefinition, TableDefinition } from "./columns";

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  /** What the page hands every cell besides its row. */
  context: Context;
  rows: Row[];
  /** Names the table to a screen reader; not drawn. */
  caption: string;
  /** The sort the address holds, shown read-only in the header (CRM-S3.2a adds clicking). */
  sort: TableSort<keyof K & string> | null;
  /** The rows are the previous ones while the next arrive. */
  busy?: boolean;
  /** A click anywhere on a row, outside its links and buttons, opens it. */
  onOpenRow?: (row: Row) => void;
  /**
   * What a column header holds. The default is its words. CRM-S3.2a puts the sort control here; CRM-S3.3a puts nothing here (its
   * filters are a row of their own); CRM-S3.1a's columns menu is beside the table, not in it.
   */
  renderHeader?: (column: ColumnDefinition<Row, keyof K & string, Context>, sort: TableSort<keyof K & string> | null) => ReactNode;
}

/** The table itself: a real table with a caption, column headers with scope, the first column as each row's header, scrolling inside its own box. */
export function DataTable<K extends TableFields, Row, Context>({ table, context, rows, caption, sort, busy, onOpenRow, renderHeader }: Props<K, Row, Context>) {
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
            {table.columns.map((column) => {
              const sorted = sort && column.sortField === sort.field ? sort.direction : null;
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                  className={cn("h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground", column.align === "right" && "text-right")}
                >
                  {renderHeader ? renderHeader(column, sort) : column.header}
                  {sorted && !renderHeader && (
                    <>
                      {sorted === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" aria-hidden="true" /> : <ArrowDown className="ml-1 inline h-3 w-3" aria-hidden="true" />}
                    </>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={table.rowKey(row)}
              onClick={onOpenRow ? (e) => openRow(e, row) : undefined}
              className={cn("border-b border-border last:border-0 hover:bg-muted/50", onOpenRow && "cursor-pointer")}
            >
              {/* CRM-S3.6 (D-47): the row's checkbox goes here, before the first column. Nothing selects rows yet. */}
              {table.columns.map((column, i) => {
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
      </table>
    </div>
  );
}
