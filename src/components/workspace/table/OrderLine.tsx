import type { TableFields, TableSort } from "@/lib/tableQuery";
import type { TableDefinition } from "./columns";

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  /** The sort the address holds, or null when it holds none. */
  sort: TableSort<keyof K & string> | null;
  onReset: () => void;
}

/**
 * The one short line over the table that says what order the rows are in (CRM-S3.2a), for the places a header cannot:
 *  - the address holds no sort and the table's own order is no column's (the queue's): "Order: Newest first";
 *  - the address holds a sort: "Sorted by Company, ascending." with the one small button back to the table's own order ("Back to newest
 *    first"), which clears the sort from the address and nothing else. Clicking a header never clears a sort, so this is the only way back.
 * A table whose default is one column shows it in that column's header, so it has no line until the address holds another sort.
 */
export function OrderLine<K extends TableFields, Row, Context>({ table, sort, onReset }: Props<K, Row, Context>) {
  if (!sort && table.defaultSort) return null;
  const column = sort ? table.columns.find((c) => c.sortField === sort.field) : undefined;
  const name = column?.header ?? (sort ? table.fields[sort.field]?.label ?? sort.field : "");
  return (
    <p aria-live="polite" className="mb-2 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
      {sort ? (
        <>
          <span>{`Sorted by ${name}, ${sort.direction === "asc" ? "ascending" : "descending"}.`}</span>
          <button type="button" onClick={onReset} className="text-primary underline">{`Back to ${table.defaultSortLabel.charAt(0).toLowerCase()}${table.defaultSortLabel.slice(1)}`}</button>
        </>
      ) : (
        <span>{`Order: ${table.defaultSortLabel}`}</span>
      )}
    </p>
  );
}
