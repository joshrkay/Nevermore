import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Inbox, RefreshCw, SearchX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PIPELINE_LABELS, NEEDS_ACTION_LABEL, type PipelineStatus } from "@/data/advisor";
import { emailProblemsBySession } from "@/data/outbox";
import { listEmailProblems, type EmailProblem } from "@/lib/advisorApi";
import { countQueueViews, type QueueFilter } from "@/lib/queueApi";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import {
  fetchQueuePage, NEEDS_ACTION_FILTER, NEW_PEO_MAIL_FILTER, QUEUE_SORTS, useQueueTable, WAITING_FILTER, type QueueContext,
} from "@/components/advisor/queueTable";
import {
  SearchBox, TableFrame, useFirmReady, useRefreshTable, useTableAddress, useTableContextKey, useTableRows, useTableViewCounts, ViewTabs,
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
  const viewLabel = address.view ? PIPELINE_LABELS[address.view as PipelineStatus] : null;
  // How the filters read in an empty or no-match message: "under review submissions that need advisor action".
  const filtered = `${viewLabel ? `${viewLabel.toLowerCase()} ` : ""}submissions${needsAction ? " that need advisor action" : ""}${waiting ? " waiting on a PEO" : ""}${newMail ? " with new PEO mail" : ""}`;
  const ownControls = [NEEDS_ACTION_FILTER, WAITING_FILTER, NEW_PEO_MAIL_FILTER];
  const otherFilters = address.filters.some((f) => !ownControls.some((o) => same(o, f)));
  const sortChoice = QUEUE_SORTS.findIndex((s) => (s.sort?.field ?? null) === (address.sort?.field ?? null) && (s.sort?.direction ?? null) === (address.sort?.direction ?? null));

  // While the first rows are on their way, what changes the QUERY stays usable (search, the two checkboxes, Sort, the tabs: a person can
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
        <label htmlFor="queue-sort" className="text-sm text-muted-foreground">Sort</label>
        <select
          id="queue-sort"
          value={sortChoice === -1 ? "other" : String(sortChoice)}
          onChange={(e) => change({ sort: QUEUE_SORTS[Number(e.target.value)].sort ? { ...QUEUE_SORTS[Number(e.target.value)].sort! } : null })}
          className="bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground"
        >
          {QUEUE_SORTS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
          {sortChoice === -1 && <option value="other" disabled>Sorted by the address</option>}
        </select>
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

  const empty = (a: typeof address) => {
    if (a.search) {
      return (
        <div className="border border-dashed border-border rounded-xl p-12 text-center">
          <SearchX className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
          <p className="font-medium">No {filtered} match “{a.search}”.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Search covers company, contact and File ID.{" "}
            <Link to={hrefFor({ search: "" })} className="text-primary underline">Clear search</Link>
          </p>
        </div>
      );
    }
    const narrowed = needsAction || waiting || newMail || otherFilters;
    return (
      <div className="border border-dashed border-border rounded-xl p-12 text-center">
        <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
        <p className="font-medium">
          {otherFilters ? "No submissions match these filters." : narrowed ? `No ${filtered}.` : viewLabel ? `No submissions are ${viewLabel.toLowerCase()}.` : "No submissions yet."}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {narrowed ? (
            <Link to={hrefFor({ view: null, filters: [] })} className="text-primary underline">Show all submissions</Link>
          ) : viewLabel ? (
            <Link to={hrefFor({ view: null })} className="text-primary underline">Show all statuses</Link>
          ) : (
            "Intakes appear here as soon as a prospect starts one."
          )}
        </p>
      </div>
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
