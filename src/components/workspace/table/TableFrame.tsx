import { useEffect, type ComponentProps, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import type { TableFields } from "@/lib/tableQuery";
import { hasHeld, type TableAddress } from "./address";
import { TABLE_PAGE_SIZE, type TableDefinition } from "./columns";
import { DataTable } from "./DataTable";
import { Pager } from "./Pager";
import { refusedQueryReason } from "./refusal";
import type { useTableAddress } from "./useTableAddress";
import type { useTableRows } from "./useTableRows";

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  location: ReturnType<typeof useTableAddress<K, Row, Context>>;
  data: ReturnType<typeof useTableRows<K, Row, Context>>;
  /** What the page hands every cell besides its row (a lookup by row, say). */
  context: Context;
  /** Names the table to a screen reader. */
  caption: string;
  /** Above the table: the search box and the controls that change the address. CRM-S3.3a's filter row and CRM-S3.1a's columns menu join here. */
  toolbar?: ReactNode;
  /** The tabs over the table: `ViewTabs`, which CRM-S3.4a extends into the saved-views bar. */
  views?: ReactNode;
  // CRM-S3.6 (D-47): the bar that appears when rows are selected goes here. Nothing selects rows yet.
  /** What shows before the first rows arrive. CRM-S2.1 fills it with grey rows shaped like the columns. */
  loading: ReactNode;
  /** What shows when nothing matches (nothing yet, or nothing matches the filters). CRM-S2.2 fills it. */
  empty: (address: TableAddress<K>) => ReactNode;
  /** What shows when the rows can't be loaded, with the way to try again. CRM-S2.3 fills it. A refused query is the frame's own panel, not this. */
  error: (error: Error, retry: () => void, address: TableAddress<K>) => ReactNode;
  /** A click anywhere on a row, outside its links, opens it. */
  onOpenRow?: (row: Row) => void;
  /** What a column header holds; CRM-S3.2a puts the sort control here. Default: the header's words. */
  renderHeader?: ComponentProps<typeof DataTable<K, Row, Context>>["renderHeader"];
}

/** What a refusal was about, when its reason lets you tell, for the panel's heading; neutral otherwise. */
const refusalHeading = (reason: string, plural: string): string =>
  /to sort by|A sort goes/.test(reason) ? "This sort can't be used."
  : /page number/i.test(reason) ? "This page can't be shown."
  : /filter/i.test(reason) ? "These filters can't be used."
  : `This view of the ${plural} can't be shown.`;

/**
 * The frame every workspace table sits in (CRM-S3.5a): the toolbar and views above, then whichever of loading, error, empty or the table
 * with its pager the data calls for. A page past the end is corrected to the last page (the address is rewritten, not left lying). While
 * the address holds something the table can't judge yet, the loading slot shows and nothing is asked. When the database refuses the
 * query (a filter it doesn't take) the frame says why in the database's words and offers the way back, to the table's bare address (a refused sort or page is not undone by keeping it); it never offers "Try again".
 */
export function TableFrame<K extends TableFields, Row, Context>({ table, location, data, context, caption, toolbar, views, loading, empty, error, onOpenRow, renderHeader }: Props<K, Row, Context>) {
  const { address, hrefFor, bareHref, change, notice } = location;
  const { page } = data;
  const pageSize = page?.pageSize ?? TABLE_PAGE_SIZE;
  const lastPage = page ? Math.max(1, Math.ceil(page.total / pageSize)) : 1;
  // An address names a page the table doesn't have (a bookmark of a longer list): go to the last one.
  const pastTheEnd = !!page && !data.isPlaceholder && address.page > lastPage;
  useEffect(() => {
    if (pastTheEnd) change({ page: lastPage }, { replace: true });
  }, [pastTheEnd, lastPage, change]);

  const refusal = data.error ? refusedQueryReason(data.error) : null;
  return (
    <div>
      {toolbar}
      {views}
      {notice && <p role="status" className="mb-3 text-sm text-muted-foreground">{notice}</p>}
      {data.error ? (
        refusal ? (
          <div role="alert" className="border border-border rounded-xl p-6 text-center">
            <ShieldAlert className="w-6 h-6 text-primary mx-auto mb-2" aria-hidden="true" />
            <p className="font-medium mb-1">{refusalHeading(refusal, table.noun.plural)}</p>
            <p className="text-sm text-muted-foreground mb-3">{refusal}</p>
            <Link to={bareHref} className="text-sm text-primary underline">Show all {table.noun.plural}</Link>
          </div>
        ) : (
          error(data.error, data.retry, address)
        )
      ) : !page || pastTheEnd || hasHeld(address) ? (
        loading
      ) : page.rows.length === 0 ? (
        empty(address)
      ) : (
        <>
          <DataTable table={table} context={context} rows={page.rows} caption={caption} sort={address.sort ?? table.defaultSort} busy={data.isPlaceholder} onOpenRow={onOpenRow} renderHeader={renderHeader} />
          <Pager page={page.page} at={address.page} total={page.total} pageSize={pageSize} hrefFor={(p) => hrefFor({ page: p })} noun={table.noun} search={data.searchOfRows} />
        </>
      )}
    </div>
  );
}
