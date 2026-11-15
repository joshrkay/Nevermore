import type { TableFields, TableSort } from "@/lib/tableQuery";
import type { TableDefinition, TableView } from "./columns";

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  /** The view the address is on, if the table lists it: its own sort is the order while the address holds none (CRM-S3.4a). */
  view?: TableView<K>;
  /** The sort the address holds, or null when it holds none. */
  sort: TableSort<keyof K & string> | null;
  onReset: () => void;
}

/**
 * The one short line over the table that says what order the rows are in (CRM-S3.2a), for the places a header cannot:
 *  - the address holds no sort and the order is no column's (the queue's own, or a view's sort on a field no column shows): "Order: Newest first";
 *  - the address holds a sort: "Sorted by Company, ascending." with the one small button back to the order the rows are in without it: the
 *    table's own ("Back to newest first") or, on a view that has a sort, the view's ("Back to this view's order"). It clears the sort from the
 *    address and nothing else. Clicking a header never clears a sort, so this is the only way back.
 * A table whose default (or a view whose sort) is one column shows it in that column's header, so it has no line until the address holds another sort.
 * It is plain text, not a live region: the headers' `aria-sort` already says the state, so a screen reader hears one change, not three.
 */
export function OrderLine<K extends TableFields, Row, Context>({ table, view, sort, onReset }: Props<K, Row, Context>) {
  const own = view?.sort ?? null;
  const wording = (s: TableSort<keyof K & string>) => {
    const column = table.columns.find((c) => c.sortField === s.field);
    return { name: column?.header ?? table.fields[s.field]?.label ?? s.field, shownByAHeader: !!column };
  };
  if (!sort && !own && table.defaultSort) return null;
  if (!sort && own && wording(own).shownByAHeader) return null;
  const sortWords = (s: TableSort<keyof K & string>) => `${wording(s).name}, ${s.direction === "asc" ? "ascending" : "descending"}`;
  return (
    <p className="mb-2 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
      {sort ? (
        <>
          <span>{`Sorted by ${sortWords(sort)}.`}</span>
          <button type="button" onClick={onReset} className="text-primary underline">{own ? "Back to this view's order" : table.defaultSortReset}</button>
        </>
      ) : (
        <span>{`Order: ${own ? sortWords(own) : table.defaultSortLabel}`}</span>
      )}
    </p>
  );
}
