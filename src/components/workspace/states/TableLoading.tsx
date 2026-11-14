import type { TableFields, TableSort } from "@/lib/tableQuery";
import { cn } from "@/lib/utils";
import { DataTable } from "../table/DataTable";
import type { ColumnDefinition, TableDefinition } from "../table/columns";
import { PLACEHOLDER_ROWS, placeholderColumns, type PlaceholderColumn } from "./placeholderShapes";
import { LoadingStatus } from "./LoadingStatus";
import { PlaceholderLine } from "./Placeholder";

/**
 * The grey rows themselves: a `tbody` hidden from assistive technology, each row as tall as a real row (the same cell padding and text
 * height). `cellClassName` is the real table's own cell padding where a page's table differs from the table frame's.
 */
export function PlaceholderBody({ columns, rows = PLACEHOLDER_ROWS, cellClassName = "px-4 py-3 align-top" }: { columns: PlaceholderColumn[]; rows?: number; cellClassName?: string }) {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-border last:border-0">
          {columns.map((column) => (
            <td key={column.id} className={cellClassName}>
              {Array.from({ length: column.lines ?? 1 }, (_, line) => (
                <span key={line} className={cn("flex h-5 items-center", column.align === "right" && "justify-end", line > 0 && "mt-1")}>
                  <PlaceholderLine width={line > 0 ? "date" : column.width ?? "text"} />
                </span>
              ))}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  /** The columns to draw: the table's, or the person's visible and ordered ones (CRM-S3.1a only passes a different list). */
  columns?: ColumnDefinition<Row, keyof K & string, Context>[];
  caption: string;
  /** The sort the real header shows, so the header is the same before and after. */
  sort?: TableSort<keyof K & string> | null;
}

/**
 * What the table frame's `loading` slot holds (CRM-S2.1): the real table with its real column headers and eight grey rows shaped like
 * the columns (the same table, header and cell padding the rows will have, so nothing jumps when they arrive), one status for a screen
 * reader that says "Loading submissions", and nothing else.
 */
export function TableLoading<K extends TableFields, Row, Context>({ table, columns = table.columns, caption, sort = null }: Props<K, Row, Context>) {
  return (
    <>
      <LoadingStatus name={table.noun.plural} />
      <DataTable
        table={table}
        context={undefined as Context}
        rows={[]}
        columns={columns}
        caption={caption}
        sort={sort}
        busy
        placeholder={<PlaceholderBody columns={placeholderColumns(table, columns)} />}
      />
    </>
  );
}
