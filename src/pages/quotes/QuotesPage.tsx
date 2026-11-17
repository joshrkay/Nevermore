import { useContext, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, RefreshCw, SearchX } from "lucide-react";
import { useNewQuoteAction } from "@/components/newquote/useNewQuoteAction";
import type { Json } from "@/integrations/supabase/types";
import { browserTimeZone } from "@/lib/accountsApi";
import type { BulkSelection } from "@/lib/bulkChangeApi";
import { QuoteBulkDialog, type QuoteBulkMade } from "@/components/quotes/QuoteBulkDialog";
import { opportunitiesWords, quoteRequestsWords, quotesWords, QUOTE_BULK_KINDS, QUOTE_BULK_TITLES, type QuoteBulkKind } from "@/components/quotes/quoteBulkWords";
import { countQuotesViews, fetchQuotesPage, quoteExportColumnsFor, useQuotesTable } from "@/components/quotes/quotesTable";
import { LoadFailed, NothingMatches, NothingYet } from "@/components/workspace/states";
import { ExportControl } from "@/components/workspace/ExportControl";
import { WorkspaceContext } from "@/components/workspace/workspaceContext";
import {
  ColumnsMenu, FilterRow, hasHeld, inForceInWords, isNarrowed, queryFor, refusedQueryReason, SearchBox, SelectionBar, shownColumns, TableFrame, useFirmReady, useMyColumns,
  useRefreshTable, useRowSelection, useSavedViewsControl, useTableAddress, useTableRows, useTableViewCounts, ViewTabs,
} from "@/components/workspace/table";

// The Quotes page (story CRM-Q4.1, slice 5.11, screen 2): every quote across accounts, one row for each PEO of each opportunity and one for each New quote
// left half done, on the workspace's table frame as the Leads and Accounts pages are.

const QuotesPage = () => {
  const { table, names } = useQuotesTable();
  const { firmId } = useFirmReady();
  const location = useTableAddress(table);
  const { address, hrefFor, change } = location;
  const fetchPage = useMemo(() => fetchQuotesPage(firmId), [firmId]);
  const countViews = useMemo(() => countQuotesViews(firmId), [firmId]);
  const data = useTableRows(table, address, fetchPage);
  const counts = useTableViewCounts(table, address, countViews);
  const refresh = useRefreshTable(table);
  const mine = useMyColumns(table, address.view);
  const columns = useMemo(() => shownColumns(table, mine.kept), [table, mine.kept]);

  const onScreen = mine.kept ?? (mine.status === "ready" ? columns.map((c) => c.id) : null);
  // What Export asks for: the filters and search in force, as the table's own call takes them (the database applies the visibility). Offered once the rows on screen answer the address.
  const rowsSettled = !hasHeld(address) && !data.isPlaceholder && (data.page !== null || data.error !== null);
  const asked = queryFor(table, address);
  const timeZone = browserTimeZone();
  const exportFilters: Record<string, Json> = { filters: asked.filters as unknown as Json, ...(address.search ? { search: address.search } : {}), time_zone: timeZone };
  const savedViews = useSavedViewsControl(table, location, { columns: onScreen, columnsStatus: mine.status, refused: !!data.error && refusedQueryReason(data.error) !== null, rowsSettled });
  const hasRows = rowsSettled && !data.error && !!data.page && data.page.total > 0;
  // Selecting rows (CRM-S3.6) and the bulk actions (CRM-Q4.1): change owner, close, export. Nevermore support is offered none of the changes (ADR 0024).
  const selection = useRowSelection(table, address, data.page, (row) => `${row.account_name}${row.peo ? `, ${row.peo}` : ""}`);
  const [asking, setAsking] = useState<{ kind: QuoteBulkKind; selected: BulkSelection; count: number } | null>(null);
  const [made, setMade] = useState<QuoteBulkMade | null>(null);
  const ask = (kind: QuoteBulkKind) => setAsking({ kind, count: selection.count, selected: selection.all ? { filters: exportFilters as unknown as Extract<BulkSelection, { filters: unknown }>["filters"] } : { ids: selection.ids } });
  const addFilterRef = useRef<HTMLButtonElement>(null);
  // New quote (CRM-Q2.1) is the way to the first quote: offered to a person of the firm, never to Nevermore support, who can only look (ADR 0024).
  const workspace = useContext(WorkspaceContext);
  const newQuote = useNewQuoteAction();
  const canMake = !!firmId && !workspace?.isSupport;
  const canBulk = canMake;

  // Nothing yet, or nothing matches (CRM-S2.2): a bare address with no rows means the firm has no quotes; a narrowed one is worded to be true either way.
  const empty = (a: typeof address, { focusTable }: { focusTable: () => void }) => {
    if (!isNarrowed(a)) {
      return (
        <NothingYet
          icon={<FileText className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          sentence="Your quotes will be listed here"
          primary={canMake ? newQuote : undefined}
        />
      );
    }
    const by = { search: a.search !== "", filters: a.filters.length > 0, view: a.view !== null };
    return (
      <NothingMatches
        plural={table.noun.plural}
        by={by}
        inForce={inForceInWords(table, a, names)}
        showAll={`Show ${table.allViewLabel.toLowerCase()}`}
        hint={table.searchHint}
        icon={<SearchX className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />}
        onClear={() => {
          change(by.search || by.filters ? { search: "", filters: [] } : { view: null }, { push: true });
          if (by.filters) addFilterRef.current?.focus();
          else focusTable();
        }}
      />
    );
  };

  const toolbar = ({ loading, slowLine }: { loading: boolean; slowLine: React.ReactNode }) => (
    <>
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Quotes</h1>
        {slowLine}
      </div>
      {/* The queue the menu's Quotes opened until this page (D-1707): it stays until it is retired. */}
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/advisor" className="text-sm text-primary underline underline-offset-2 hover:text-foreground">Submissions</Link>
        {firmId && hasRows && <ExportControl firmId={firmId} table="quotes" columns={quoteExportColumnsFor(columns)} filters={exportFilters} />}
      </div>
    </div>
    <SelectionBar selection={selection} noun={table.noun}>
      {canBulk && QUOTE_BULK_KINDS.map((kind) => (
        <button key={kind} type="button" onClick={() => ask(kind)} className="min-h-11 rounded-md border border-border bg-background px-4 text-sm hover:bg-muted">
          {QUOTE_BULK_TITLES[kind]}
        </button>
      ))}
      {firmId && <ExportControl firmId={firmId} table="quotes" columns={quoteExportColumnsFor(columns)} filters={selection.all ? exportFilters : { time_zone: timeZone }} {...(selection.all ? {} : { ids: selection.ids })} />}
    </SelectionBar>
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 mb-3">
      <SearchBox value={address.search} minChars={table.searchMinChars} placeholder="Search accounts, PEOs, File IDs" onSearch={(term) => change({ search: term })} />
      <div className="flex items-center gap-3">
        <button
          onClick={loading ? undefined : refresh}
          aria-disabled={loading || undefined}
          aria-describedby={loading ? "refresh-unavailable" : undefined}
          className={`p-2 rounded-md border border-border text-muted-foreground ${loading ? "opacity-50" : "hover:text-foreground"}`}
          aria-label="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <ColumnsMenu table={table} mine={mine} />
        {loading && <span id="refresh-unavailable" className="sr-only">Available when the list has loaded</span>}
      </div>
    </div>
    <FilterRow table={table} location={location} names={names} addFilterRef={addFilterRef} />
    </>
  );

  const views = <ViewTabs table={table} address={address} hrefFor={hrefFor} counts={counts} saved={savedViews} />;

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8">
        {made && (
          <div role="region" aria-label="What the change did" className="mb-3 space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
            <p role="status" className="font-semibold">{made.action.action === "owner" ? `Gave ${opportunitiesWords(made.outcome.changed)} to ${made.ownerName ?? "the person chosen"}.` : `Closed ${quoteRequestsWords(made.outcome.changed)}.`}</p>
            {made.outcome.skipped.length > 0 && (
              <div className="text-warning">
                <p className="font-semibold">{made.outcome.skipped.length === 1 ? "1 was skipped" : `${made.outcome.skipped.length.toLocaleString("en-US")} were skipped`}</p>
                <ul className="mt-1 max-h-40 list-disc space-y-1 overflow-y-auto pl-5">
                  {made.outcome.skipped.map((s) => <li key={s.key}>{`${s.name ?? "A quote"}: ${s.reason}`}</li>)}
                </ul>
              </div>
            )}
            {made.outcome.unavailable > 0 && <p className="text-muted-foreground">{`${quotesWords(made.outcome.unavailable)} you can no longer see ${made.outcome.unavailable === 1 ? "was" : "were"} left out.`}</p>}
            <button type="button" onClick={() => setMade(null)} className="min-h-11 rounded-md px-4 text-sm hover:bg-muted">Dismiss</button>
          </div>
        )}
        <TableFrame
          table={table}
          location={location}
          data={data}
          context={undefined}
          columns={columns}
          caption="Quotes"
          toolbar={toolbar}
          views={views}
          selection={selection}
          empty={empty}
          error={(e, retry) => <LoadFailed error={e} what="the quotes" onRetry={retry} />}
        />
        {asking && firmId && (
          <QuoteBulkDialog
            firmId={firmId}
            kind={asking.kind}
            selection={asking.selected}
            count={asking.count}
            onClose={() => setAsking(null)}
            onMade={(m) => {
              setAsking(null);
              setMade(m);
              selection.clear();
              refresh();
            }}
          />
        )}
      </main>
    </div>
  );
};

export default QuotesPage;
