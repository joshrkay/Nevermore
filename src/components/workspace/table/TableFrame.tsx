import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import type { TableFields } from "@/lib/tableQuery";
import { hasHeld, type TableAddress } from "./address";
import { TABLE_PAGE_SIZE, type ColumnDefinition, type TableDefinition } from "./columns";
import { DataTable } from "./DataTable";
import { OrderLine } from "./OrderLine";
import { Pager } from "./Pager";
import { refusedQueryReason } from "./refusal";
import { tableIsLoading } from "./tableIsLoading";
import type { useTableAddress } from "./useTableAddress";
import { useFirmReady, useRefreshTable, type useTableRows } from "./useTableRows";
import { LoadingStatus } from "../states/LoadingStatus";
import { PlaceholderBody } from "../states/PlaceholderBody";
import { placeholderColumns } from "../states/placeholderShapes";
import { SlowLoadLine } from "../states/SlowLoadLine";
import { useSlowLoad } from "../states/useSlowLoad";

interface Props<K extends TableFields, Row, Context> {
  table: TableDefinition<K, Row, Context>;
  location: ReturnType<typeof useTableAddress<K, Row, Context>>;
  data: ReturnType<typeof useTableRows<K, Row, Context>>;
  /** What the page hands every cell besides its row (a lookup by row, say). */
  context: Context;
  /** Names the table to a screen reader. */
  caption: string;
  /** The columns to draw: the table's own (the default), or the person's visible and ordered ones (CRM-S3.1a). The grey loading rows use the same list. */
  columns?: ColumnDefinition<Row, keyof K & string, Context>[];
  /**
   * Above the table: the search box and the controls that change the address. CRM-S3.3a's filter row and CRM-S3.1a's columns menu join
   * here. Given as a function, it is told whether the rows are still on their way (`loading`, CRM-S2.1), so it can disable what needs the
   * rows (Refresh, anything acting on rows); controls that change the QUERY (search, filters, tabs, sort) stay usable, so a person can
   * correct a slow search. The pager is not in the toolbar: the frame draws none until there are rows. `slowLine` is the frame's
   * slow-load line ("This is taking longer than usual", "Try again"), for the page to place under its title; a toolbar that is not a
   * function gets it after it.
   */
  toolbar?: ReactNode | ((state: { loading: boolean; slowLine: ReactNode }) => ReactNode);
  /** The tabs over the table: `ViewTabs`, which CRM-S3.4a extends into the saved-views bar. */
  views?: ReactNode;
  // CRM-S3.6 (D-47): the bar that appears when rows are selected goes here. Nothing selects rows yet.
  /** What shows when nothing matches (nothing yet, or nothing matches the filters). CRM-S2.2 fills it. */
  empty: (address: TableAddress<K>) => ReactNode;
  /** What shows when the rows can't be loaded, with the way to try again. CRM-S2.3 fills it. A refused query is the frame's own panel, not this. */
  error: (error: Error, retry: () => void, address: TableAddress<K>) => ReactNode;
  /** A click anywhere on a row, outside its links, opens it. */
  onOpenRow?: (row: Row) => void;
  /** What a column header holds, in place of the sort button (CRM-S3.2a: every column with a `sortField` gets one by itself). Default: the header's words and that button. */
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
export function TableFrame<K extends TableFields, Row, Context>({ table, location, data, context, caption, columns = table.columns, toolbar, views, empty, error, onOpenRow, renderHeader }: Props<K, Row, Context>) {
  const { address, hrefFor, bareHref, change, notice } = location;
  const { page } = data;
  const pageSize = page?.pageSize ?? TABLE_PAGE_SIZE;
  const lastPage = page ? Math.max(1, Math.ceil(page.total / pageSize)) : 1;
  // An address names a page the table doesn't have (a bookmark of a longer list): go to the last one.
  const pastTheEnd = !!page && !data.isPlaceholder && address.page > lastPage;
  useEffect(() => {
    if (pastTheEnd) change({ page: lastPage }, { replace: true });
  }, [pastTheEnd, lastPage, change]);

  // Nothing to show yet (CRM-S2.1): the real table is drawn with grey rows in its body, under its real headers, and the same element
  // takes the rows when they arrive, so focus and the sideways scroll survive. The frame owns the slow-load line for this wait.
  const loadingNow = tableIsLoading(address, data);
  const placeholdering = !page || pastTheEnd || hasHeld(address);
  const { ready: firmReady } = useFirmReady();
  const refresh = useRefreshTable(table);
  const slowLoad = useSlowLoad(loadingNow, refresh);
  const slowLine = (
    <SlowLoadLine
      loading={loadingNow}
      slow={slowLoad.slow}
      onTryAgain={slowLoad.tryAgain}
      // While the address holds what the table can't judge yet, or the firm isn't known, nothing has been asked, so there is nothing to ask again.
      waitingFor={!firmReady ? "Still waiting for your firm's details." : hasHeld(address) ? "Still waiting for the table's views and fields." : undefined}
    />
  );
  const refusal = data.error ? refusedQueryReason(data.error) : null;
  // The sort the headers show: the address's, or else the table's own when one column shows it. With neither, no header is marked and the
  // line over the table says what the order is.
  const shownSort = address.sort ?? table.defaultSort;
  // A sort that puts a new column in the address is a place a person comes back to (Back undoes it, as it does a page): it pushes a history
  // entry. Reversing the column already in the address only corrects it, so it replaces the entry and asc, desc, asc is one Back.
  const sortBy = (sort: NonNullable<typeof shownSort>) => change({ sort }, address.sort?.field === sort.field ? { replace: true } : { push: true });
  // "Back to newest first" is gone once pressed (the line only offers it while a sort is set), which would drop focus to the page: it goes to
  // the table's scroll box, which is always there.
  const scrollBox = useRef<HTMLDivElement>(null);
  const resetSort = () => {
    change({ sort: null }, { push: true });
    scrollBox.current?.focus();
  };
  return (
    <div>
      {typeof toolbar === "function" ? toolbar({ loading: loadingNow, slowLine }) : <>{toolbar}{slowLine}</>}
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
      ) : placeholdering || page.rows.length > 0 ? (
        <>
          {placeholdering ? <LoadingStatus name={table.noun.plural} /> : null}
          <OrderLine table={table} sort={address.sort} onReset={resetSort} />
          <DataTable
            table={table}
            context={context}
            columns={columns}
            rows={placeholdering ? [] : page.rows}
            placeholder={placeholdering ? <PlaceholderBody columns={placeholderColumns(table, columns)} /> : undefined}
            caption={caption}
            sort={shownSort}
            onSort={sortBy}
            scrollRef={scrollBox}
            // Rows on screen are dimmed and marked busy only while they answer a different question than the address now asks (the next page,
            // tab or filter, D-144); a refresh of the same question changes nothing on screen.
            busy={placeholdering || data.isPlaceholder}
            onOpenRow={onOpenRow}
            renderHeader={renderHeader}
          />
          {!placeholdering && <Pager page={page.page} at={address.page} total={page.total} pageSize={pageSize} hrefFor={(p) => hrefFor({ page: p })} noun={table.noun} search={data.searchOfRows} />}
        </>
      ) : (
        empty(address)
      )}
    </div>
  );
}
