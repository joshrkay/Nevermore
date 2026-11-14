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
import { EmptyBody } from "../states/EmptyStates";
import { LoadingStatus } from "../states/LoadingStatus";
import { PlaceholderBody } from "../states/PlaceholderBody";
import { RefreshFailed } from "../states/RefreshFailed";
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
  /**
   * What shows in the table's body when no rows come back (CRM-S2.2): "nothing yet" for a bare address, "nothing matches" for a narrowed one (`isNarrowed`).
   * The table stays: its headers and the toolbar do not move. It is given the address the (empty) rows answer, which is the previous one while the next
   * answer is on its way, so the words never describe a question the person has not been answered yet. `focusTable` puts focus on the table's scroll box,
   * for an action that makes the empty state go away ("Clear filters"), so focus is not dropped to the page.
   */
  empty: (address: TableAddress<K>, helpers: { focusTable: () => void }) => ReactNode;
  /** What shows when the rows can't be loaded (every failure but a refused query, which is the frame's own panel): a page fills it with `LoadFailed` (CRM-S2.3, D-175), never the error's own words. */
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
  // Waiting for an answer to a question the person has changed, over the previous answer (dimmed rows, or the dimmed empty words), is a wait too: a request
  // that never arrives must not leave the old question's words on screen for ever. Ten seconds of either shows the line with "Try again" (D-145).
  const waitingNow = loadingNow || (data.isPlaceholder && !data.error);
  const slowLoad = useSlowLoad(waitingNow, refresh);
  const slowLine = (
    <SlowLoadLine
      loading={waitingNow}
      slow={slowLoad.slow}
      onTryAgain={slowLoad.tryAgain}
      // While the address holds what the table can't judge yet, or the firm isn't known, nothing has been asked, so there is nothing to ask again.
      waitingFor={!firmReady ? "Still waiting for your firm's details." : hasHeld(address) ? "Still waiting for the table's views and fields." : undefined}
    />
  );
  // A failed refresh over rows already on screen (CRM-S2.4a, D-181) is a note over the rows, never the panel that replaces them: the rows are the
  // answer to the question on screen, and an ask that failed after them does not make them wrong. Only a failure with nothing to show is the panel.
  const refreshFailed = !!data.error && !!page && !placeholdering;
  const failure = refreshFailed ? null : data.error;
  const refusal = failure ? refusedQueryReason(failure) : null;
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
  // The address the rows on screen answer: it only follows the address once their answer has arrived.
  const settled = useRef(address);
  if (!data.isPlaceholder && !placeholdering) settled.current = address;
  const isEmpty = !placeholdering && !!page && page.rows.length === 0;
  const focusTable = () => scrollBox.current?.focus();
  return (
    <div>
      {typeof toolbar === "function" ? toolbar({ loading: loadingNow, slowLine }) : <>{toolbar}{slowLine}</>}
      {views}
      {notice && <p role="status" className="mb-3 text-sm text-muted-foreground">{notice}</p>}
      {refreshFailed && <RefreshFailed what={`the ${table.noun.plural}`} onRetry={data.retry} retrying={data.isRetrying} />}
      {failure ? (
        refusal ? (
          <div role="alert" className="border border-border rounded-xl p-6 text-center">
            <ShieldAlert className="w-6 h-6 text-primary mx-auto mb-2" aria-hidden="true" />
            <p className="font-medium mb-1">{refusalHeading(refusal, table.noun.plural)}</p>
            <p className="text-sm text-muted-foreground mb-3">{refusal}</p>
            <Link to={bareHref} className="text-sm text-primary underline">Show all {table.noun.plural}</Link>
          </div>
        ) : (
          error(failure, data.retry, address)
        )
      ) : (
        <>
          {placeholdering ? <LoadingStatus name={table.noun.plural} /> : null}
          <OrderLine table={table} sort={address.sort} onReset={resetSort} />
          <DataTable
            table={table}
            context={context}
            columns={columns}
            rows={placeholdering ? [] : page.rows}
            // The grey rows while waiting; when no rows came back, one cell under the real headers with the empty state in it, so it is the same
            // table before and after. Rows that answer another question are dimmed here as elsewhere (no busy mark: the words do not change while it waits).
            placeholder={
              placeholdering ? <PlaceholderBody columns={placeholderColumns(table, columns)} />
              : isEmpty ? (
                <EmptyBody columns={columns.length} dimmed={data.isPlaceholder}>{empty(settled.current, { focusTable })}</EmptyBody>
              ) : undefined
            }
            caption={caption}
            sort={shownSort}
            onSort={sortBy}
            scrollRef={scrollBox}
            // Rows on screen are dimmed and marked busy only while they answer a different question than the address now asks (the next page,
            // tab or filter, D-144); a refresh of the same question changes nothing on screen.
            busy={placeholdering || (data.isPlaceholder && !isEmpty)}
            onOpenRow={onOpenRow}
            renderHeader={renderHeader}
          />
          {!placeholdering && !isEmpty && <Pager page={page.page} at={address.page} total={page.total} pageSize={pageSize} hrefFor={(p) => hrefFor({ page: p })} noun={table.noun} search={data.searchOfRows} />}
        </>
      )}
    </div>
  );
}
