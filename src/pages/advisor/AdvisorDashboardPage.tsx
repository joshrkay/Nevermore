import { useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, RefreshCw, SearchX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { emailProblemsBySession } from "@/data/outbox";
import { listEmailProblems, type EmailProblem } from "@/lib/advisorApi";
import { countQueueViews } from "@/lib/queueApi";
import { NothingMatches, NothingYet, LoadFailed } from "@/components/workspace/states";
import {
  fetchQueuePage, NEW_PEO_MAIL_FILTER, useQueueTable, type QueueContext,
} from "@/components/advisor/queueTable";
import {
  ColumnsMenu, FilterRow, inForceInWords, isNarrowed, SearchBox, TableFrame, useFirmReady, useRefreshTable, useTableAddress, useTableColumns, useTableContextKey, useTableRows, useTableViewCounts, ViewTabs,
} from "@/components/workspace/table";

// The submissions queue (story CRM-S3.5a): the first page on the workspace's table frame (src/components/workspace/table/). The address
// holds the page, sort, filters, view and search; the database cuts the pages (listQueue, D-44). The Inbox link's mail=new is the
// "has new PEO mail" filter, so the menu's Inbox number and the rows it opens agree (D-133).

const NO_PROBLEMS = new Map<string, EmailProblem>();
const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

const AdvisorDashboardPage = () => {
  const navigate = useNavigate();
  const table = useQueueTable();
  const { ready } = useFirmReady();
  // Read beside the queue, not as part of it: if this fails, the queue still loads and no row is marked.
  const problemsQuery = useQuery({
    queryKey: useTableContextKey(table, "email-problems"),
    queryFn: async () => emailProblemsBySession(await listEmailProblems()),
    enabled: ready,
    retry: false,
  });
  const context: QueueContext = { problems: problemsQuery.data ?? NO_PROBLEMS };
  const location = useTableAddress(table);
  const { address, hrefFor, change } = location;
  const data = useTableRows(table, address, fetchQueuePage);
  const counts = useTableViewCounts(table, address, countQueueViews);
  const refresh = useRefreshTable(table);
  const shownColumns = useTableColumns(table);
  // The row's "Add filter": where focus goes when filters are cleared, from the row or from the empty state (D-170).
  const addFilterRef = useRef<HTMLButtonElement>(null);

  // While the first rows are on their way, what changes the QUERY stays usable (search, the filter row, the sort headers, the tabs: a person can
  // correct a slow search); what needs the rows is not (Refresh, and the pager, which the frame draws only once there are rows).
  const toolbar = ({ loading, slowLine }: { loading: boolean; slowLine: ReactNode }) => (
    <>
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Submissions</h1>
        <p className="text-sm text-muted-foreground">
          Certified submissions first, newest first; intakes not yet certified follow, most recently active first.
        </p>
        {slowLine}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-6">
        <SearchBox value={address.search} minChars={table.searchMinChars} placeholder="Company, contact or File ID" onSearch={(term) => change({ search: term })} />
        <ColumnsMenu table={table} columns={shownColumns} />
        {/* Not usable until there are rows to ask again for. It stays in the tab order, says why, and ignores the click. */}
        <button
          onClick={loading ? undefined : refresh}
          aria-disabled={loading || undefined}
          aria-describedby={loading ? "refresh-unavailable" : undefined}
          className={`p-2 rounded-md border border-border text-muted-foreground ${loading ? "opacity-50" : "hover:text-foreground"}`}
          aria-label="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        {loading && <span id="refresh-unavailable" className="sr-only">Available when the list has loaded</span>}
      </div>
    </div>
    <FilterRow table={table} location={location} addFilterRef={addFilterRef} />
    </>
  );

  // Today's status tabs, as the queue's built-in views; CRM-S3.4a turns them into the full saved-views bar.
  const views = <ViewTabs table={table} address={address} hrefFor={hrefFor} counts={counts} />;

  // Empty (story CRM-S2.2). The rule that tells the two kinds apart: a bare address (no tab, search or filter) that comes back with no rows is NOTHING YET,
  // because the firm has no submissions to show; a narrowed one is NOTHING MATCHES. The queue does not know how many submissions the firm has without
  // narrowing (the tabs' numbers are counted under the search and filters on screen, D-137), so a narrowed empty is worded to be true either way
  // ("No submissions match these filters") and never claims some exist. Nothing here offers to create a submission: a member cannot make one yet
  // (New quote arrives with CRM-Q2.1), and a narrowed question is never answered with "make a new one".
  const empty = (a: typeof address, { focusTable }: { focusTable: () => void }) => {
    if (!isNarrowed(a)) {
      return <NothingYet icon={<Inbox className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />} sentence="Submissions appear here once a prospect has started filling in an intake." />;
    }
    // The Inbox alone (only "has new PEO mail" in force) has an exact thing to say that is true even if the firm has no submissions at all.
    const inboxOnly = !a.view && !a.search && a.filters.length === 1 && same(a.filters[0], NEW_PEO_MAIL_FILTER);
    const by = { search: a.search !== "", filters: a.filters.length > 0, view: a.view !== null };
    return (
      <NothingMatches
        plural={table.noun.plural}
        by={by}
        inForce={inForceInWords(table, a)}
        headline={inboxOnly ? "No submissions have new PEO mail." : undefined}
        showAll={`Show ${table.allViewLabel.toLowerCase()}`}
        hint={table.searchHint}
        icon={<SearchX className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />}
        // Each button does the one thing its label names, and is a step Back undoes (as a tab and a new sort column are). "Clear search", "Clear filters" and
        // "Clear filters and search" clear those and KEEP the tab and the sort; when only the tab narrows the list the button is "Show all statuses" and leaves it.
        onClear={() => {
          change(by.search || by.filters ? { search: "", filters: [] } : { view: null }, { push: true });
          // Clearing filters sends focus where the row's own "Clear filters" does; clearing a search or leaving a tab, which has no such button, goes to the table.
          if (by.filters) addFilterRef.current?.focus();
          else focusTable();
        }}
      />
    );
  };

  // A refused query is the frame's own panel; this is every other failed load.
  const error = (e: Error, retry: () => void) => <LoadFailed error={e} what="the submissions" onRetry={retry} />;

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8">
        <TableFrame
          table={table}
          location={location}
          data={data}
          context={context}
          columns={shownColumns.columns}
          columnsLoading={shownColumns.loading}
          caption="Submissions"
          toolbar={toolbar}
          views={views}
          empty={empty}
          error={error}
          onOpenRow={(row) => navigate(`/advisor/submissions/${row.session_id}`)}
        />
      </main>
    </div>
  );
};

export default AdvisorDashboardPage;
