import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, RefreshCw, SearchX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { NEEDS_ACTION_LABEL } from "@/data/advisor";
import { emailProblemsBySession } from "@/data/outbox";
import { listEmailProblems, type EmailProblem } from "@/lib/advisorApi";
import { countQueueViews, type QueueFilter } from "@/lib/queueApi";
import { NothingMatches, NothingYet } from "@/components/workspace/states";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import {
  fetchQueuePage, NEEDS_ACTION_FILTER, NEW_PEO_MAIL_FILTER, useQueueTable, WAITING_FILTER, type QueueContext,
} from "@/components/advisor/queueTable";
import {
  inForceInWords, isNarrowed, SearchBox, TableFrame, useFirmReady, useRefreshTable, useTableAddress, useTableContextKey, useTableRows, useTableViewCounts, ViewTabs,
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

  const hasFilter = (filter: QueueFilter) => address.filters.some((f) => same(f, filter));
  const needsAction = hasFilter(NEEDS_ACTION_FILTER);
  const waiting = hasFilter(WAITING_FILTER);
  const newMail = hasFilter(NEW_PEO_MAIL_FILTER);
  // The filters a person can add or remove with the page's own controls; anything else came from an address written by hand.
  const toggle = (filter: QueueFilter, on: boolean) =>
    change({ filters: on ? [...address.filters, filter] : address.filters.filter((f) => !same(f, filter)) });

  // While the first rows are on their way, what changes the QUERY stays usable (search, the two checkboxes, the sort headers, the tabs: a person can
  // correct a slow search); what needs the rows is not (Refresh, and the pager, which the frame draws only once there are rows).
  const toolbar = ({ loading, slowLine }: { loading: boolean; slowLine: ReactNode }) => (
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
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={needsAction} onChange={(e) => toggle(NEEDS_ACTION_FILTER, e.target.checked)} className="accent-warning" />
          {NEEDS_ACTION_LABEL} only
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={waiting} onChange={(e) => toggle(WAITING_FILTER, e.target.checked)} className="accent-primary" />
          Waiting on a PEO only
        </label>
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
      return <NothingYet icon={<Inbox className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />} sentence="Submissions appear here as soon as a prospect starts an intake." />;
    }
    // The Inbox alone (only "has new PEO mail" in force) has an exact thing to say that is true even if the firm has no submissions at all.
    const inboxOnly = !a.view && !a.search && a.filters.length === 1 && same(a.filters[0], NEW_PEO_MAIL_FILTER);
    return (
      <NothingMatches
        plural={table.noun.plural}
        by={{ search: a.search !== "", filters: a.view !== null || a.filters.length > 0 }}
        inForce={inForceInWords(table, a)}
        headline={inboxOnly ? "No submissions have new PEO mail." : undefined}
        icon={<SearchX className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />}
        // Clears the tab, the search and every filter (the whole list again). The sort stays: it only orders the same rows.
        onClear={() => { change({ view: null, search: "", filters: [] }); focusTable(); }}
      />
    );
  };

  // A refused query is the frame's own panel; this is every other failed load.
  const error = (e: Error, retry: () => void) => <AdvisorLoadError error={e} what="submissions" onRetry={retry} />;

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8">
        <TableFrame
          table={table}
          location={location}
          data={data}
          context={context}
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
