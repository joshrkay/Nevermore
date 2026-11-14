import { useContext, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Inbox, Loader2, RefreshCw, SearchX, ShieldAlert } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PIPELINE_LABELS, NEEDS_ACTION_LABEL, type PipelineStatus } from "@/data/advisor";
import { emailProblemsBySession } from "@/data/outbox";
import { listEmailProblems, type EmailProblem } from "@/lib/advisorApi";
import { countQueueViews } from "@/lib/queueApi";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import { WorkspaceContext } from "@/components/workspace/workspaceContext";
import {
  SearchBox, TABLE_REFRESH_MS, TableFrame, useTableAddress, useTableRows, type TableAddress,
} from "@/components/workspace/table";
import {
  fetchQueuePage, hasFilter, NEEDS_ACTION_FILTER, NEW_PEO_MAIL_FILTER, queueTable, QUEUE_SORTS, QUEUE_VIEWS, WAITING_FILTER,
} from "@/components/advisor/queueTable";

// The submissions queue (story CRM-S3.5a): the first page on the workspace's table frame (src/components/workspace/table/). The address
// holds the page, sort, filters, view and search; the database cuts the pages (listQueue, D-44). The Inbox link's mail=new is the
// "has new PEO mail" filter, so the menu's Inbox number and the rows it opens agree (D-133).

type Address = TableAddress<ReturnType<typeof queueTable>["fields"]>;

const NO_PROBLEMS = new Map<string, EmailProblem>();

/** Which of today's contacts' confirmations bounced. Read beside the queue, not as part of it: if this fails, the queue still loads. */
function useEmailProblems() {
  const firmId = useContext(WorkspaceContext)?.firm?.id ?? null;
  const { data } = useQuery({
    queryKey: ["email-problems", firmId],
    queryFn: async () => emailProblemsBySession(await listEmailProblems()),
    retry: false,
  });
  return data ?? NO_PROBLEMS;
}

/** How many each status tab holds, under the search and filters the address holds, so a tab's number is what its rows would total. */
function useViewCounts(address: Address) {
  const firmId = useContext(WorkspaceContext)?.firm?.id ?? null;
  const { data } = useQuery({
    queryKey: ["table-view-counts", firmId, "submissions", address.filters, address.search],
    queryFn: () =>
      countQueueViews(
        [{ name: "all", filters: [] }, ...QUEUE_VIEWS.map((v) => ({ name: v.id, filters: v.filters }))].map((v) => ({ ...v, filters: [...v.filters, ...address.filters] })),
        { search: address.search },
      ),
    placeholderData: keepPreviousData,
    refetchInterval: TABLE_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  return useMemo(() => new Map((data ?? []).map((c) => [c.name, c.total])), [data]);
}

const AdvisorDashboardPage = () => {
  const navigate = useNavigate();
  const problems = useEmailProblems();
  const table = useMemo(() => queueTable(problems), [problems]);
  const location = useTableAddress(table);
  const { address, hrefFor, change } = location;
  const data = useTableRows(table, address, fetchQueuePage);
  const counts = useViewCounts(address);

  const needsAction = hasFilter(address, NEEDS_ACTION_FILTER);
  const waiting = hasFilter(address, WAITING_FILTER);
  const newMail = hasFilter(address, NEW_PEO_MAIL_FILTER);
  // The filters a person can add or remove with the page's own controls; anything else came from an address written by hand.
  const toggle = (filter: typeof NEEDS_ACTION_FILTER, on: boolean) =>
    change({ filters: on ? [...address.filters, filter] : address.filters.filter((f) => JSON.stringify(f) !== JSON.stringify(filter)) });
  const viewLabel = address.view ? PIPELINE_LABELS[address.view as PipelineStatus] : null;
  // How the filters read in an empty or no-match message: "under review submissions that need advisor action".
  const filtered = `${viewLabel ? `${viewLabel.toLowerCase()} ` : ""}submissions${needsAction ? " that need advisor action" : ""}${waiting ? " waiting on a PEO" : ""}${newMail ? " with new PEO mail" : ""}`;
  const ownControls = [NEEDS_ACTION_FILTER, WAITING_FILTER, NEW_PEO_MAIL_FILTER];
  const otherFilters = address.filters.some((f) => !ownControls.some((o) => JSON.stringify(o) === JSON.stringify(f)));
  const sortChoice = QUEUE_SORTS.findIndex((s) => (s.sort?.field ?? null) === (address.sort?.field ?? null) && (s.sort?.direction ?? null) === (address.sort?.direction ?? null));

  const toolbar = (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Submissions</h1>
        <p className="text-sm text-muted-foreground">
          Certified submissions first, newest first; intakes not yet certified follow, most recently active first.
        </p>
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
        <button
          onClick={data.retry}
          disabled={data.isRefreshing && !data.page}
          className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Today's status tabs, as the queue's built-in views; CRM-S3.4a turns them into the full saved-views bar.
  const views = (
    <nav aria-label="Views" className="mb-4 flex flex-wrap gap-2">
      {[{ id: null as string | null, label: "All statuses", key: "all" }, ...QUEUE_VIEWS.map((v) => ({ id: v.id as string | null, label: v.label, key: v.id }))].map((v) => {
        const current = address.view === v.id;
        const count = counts.get(v.key);
        return (
          <Link
            key={v.key}
            to={hrefFor({ view: v.id })}
            aria-current={current ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${current ? "border-primary bg-accent font-semibold text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {v.label}
            {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const loading = (
    <div className="flex items-center justify-center py-24 text-muted-foreground" role="status">
      <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading submissions…
    </div>
  );

  const empty = (a: Address) => {
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

  const error = (e: Error, retry: () => void) =>
    // The database refuses a filter it doesn't take, and says why: show that, and the way out.
    (e as { code?: string }).code === "22023" ? (
      <div role="alert" className="border border-border rounded-xl p-6 text-center">
        <ShieldAlert className="w-6 h-6 text-primary mx-auto mb-2" aria-hidden="true" />
        <p className="font-medium mb-1">These filters can't be used.</p>
        <p className="text-sm text-muted-foreground mb-3">{e.message}</p>
        <Link to={hrefFor({ filters: [], view: null })} className="text-sm text-primary underline">Show all submissions</Link>
      </div>
    ) : (
      <AdvisorLoadError error={e} what="submissions" onRetry={retry} />
    );

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8">
        <TableFrame
          table={table}
          location={location}
          data={data}
          caption="Submissions"
          toolbar={toolbar}
          views={views}
          loading={loading}
          empty={empty}
          error={error}
          onOpenRow={(row) => navigate(`/advisor/submissions/${row.session_id}`)}
        />
      </main>
    </div>
  );
};

export default AdvisorDashboardPage;
