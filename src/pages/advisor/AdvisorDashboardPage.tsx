import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Inbox, Loader2, RefreshCw, Search, SearchX } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  completenessOf,
  formatStates,
  isPipelineStatus,
  matchesSearch,
  PIPELINE_LABELS,
  PIPELINE_STATUSES,
  referenceOf,
  type Completeness,
  type PipelineStatus,
} from "@/data/advisor";
import { listSubmissions, type SubmissionSummary } from "@/lib/advisorApi";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import { PipelineBadge } from "@/components/advisor/PipelineBadge";

type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  | { kind: "ready"; rows: SubmissionSummary[] };

const COMPLETENESS_CLASS: Record<Completeness["state"], string> = {
  complete: "bg-success/15 text-success",
  needs_review: "bg-warning/15 text-warning",
  missing_required: "bg-destructive/15 text-destructive",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const AdvisorDashboardPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const param = searchParams.get("status");
  const status: PipelineStatus | null = isPipelineStatus(param) ? param : null;
  const query = searchParams.get("q") ?? "";
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    listSubmissions(status)
      .then((rows) => !cancelled && setLoad({ kind: "ready", rows }))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => { cancelled = true; };
  }, [status, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Filter and search live in the URL, so a refresh or a shared link shows the same queue.
  const setParam = (key: "status" | "q", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const rows = useMemo(() => (load.kind === "ready" ? load.rows : []), [load]);
  // Searching narrows what the status filter already returned; it doesn't go back to the server.
  const visible = useMemo(() => rows.filter((r) => matchesSearch(r, query)), [rows, query]);
  const searching = query.trim() !== "";

  // A click anywhere on the row opens it; the company link stays for keyboard and "open in new tab".
  const openRow = (e: MouseEvent, id: string) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    navigate(`/advisor/submissions/${id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <AdvisorHeader />
      <main className="container mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold">Submissions</h1>
            <p className="text-sm text-muted-foreground">
              Certified submissions first, newest first; intakes not yet certified follow, most recently active first.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <label htmlFor="queue-search" className="sr-only">Search</label>
              <input
                id="queue-search"
                type="search"
                value={query}
                onChange={(e) => setParam("q", e.target.value)}
                placeholder="Company, contact or reference"
                className="bg-muted border border-border rounded-md pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground w-64"
              />
            </div>
            <label htmlFor="status-filter" className="text-sm text-muted-foreground">Status</label>
            <select
              id="status-filter"
              value={status ?? ""}
              onChange={(e) => setParam("status", e.target.value)}
              className="bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground"
            >
              <option value="">All statuses</option>
              {PIPELINE_STATUSES.map((s) => (
                <option key={s} value={s}>{PIPELINE_LABELS[s]}</option>
              ))}
            </select>
            <button
              onClick={retry}
              disabled={load.kind === "loading"}
              className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-24 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading submissions…
          </div>
        )}

        {load.kind === "error" && <AdvisorLoadError error={load.error} what="submissions" onRetry={retry} />}

        {load.kind === "ready" && rows.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
            <p className="font-medium">
              {status ? `No submissions are ${PIPELINE_LABELS[status].toLowerCase()}.` : "No submissions yet."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {status ? (
                <button onClick={() => setParam("status", "")} className="text-primary underline">Show all statuses</button>
              ) : (
                "Intakes appear here as soon as a prospect starts one."
              )}
            </p>
          </div>
        )}

        {load.kind === "ready" && rows.length > 0 && visible.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <SearchX className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
            <p className="font-medium">
              No {status ? `${PIPELINE_LABELS[status].toLowerCase()} ` : ""}submissions match “{query.trim()}”.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Search covers company, contact and reference.{" "}
              <button onClick={() => setParam("q", "")} className="text-primary underline">Clear search</button>
            </p>
          </div>
        )}

        {load.kind === "ready" && visible.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground mb-2" aria-live="polite">
              {searching ? `${visible.length} of ${rows.length} submissions match` : `${rows.length} submissions`}
            </p>
            <div className="border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>States</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completeness</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row) => {
                    const completeness = completenessOf(row);
                    return (
                      <TableRow
                        key={row.session_id}
                        onClick={(e) => openRow(e, row.session_id)}
                        className="cursor-pointer"
                      >
                        <TableCell>
                          <Link to={`/advisor/submissions/${row.session_id}`} className="font-medium text-foreground hover:text-primary">
                            {row.company_name ?? "Company not provided"}
                          </Link>
                          <p className="text-xs text-muted-foreground font-mono">{referenceOf(row)}</p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.contact_name ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatStates(row.states) ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.employee_count ?? "—"}</TableCell>
                        <TableCell className="text-sm">
                          {row.submitted_at ? (
                            formatDate(row.submitted_at)
                          ) : (
                            <span className="text-muted-foreground">
                              {row.signer_name ? "Needs re-certification" : "Not certified"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <PipelineBadge status={isPipelineStatus(row.pipeline_status) ? row.pipeline_status : "draft"} />
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${COMPLETENESS_CLASS[completeness.state]}`}>
                            {completeness.label}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">{completeness.detail}</p>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AdvisorDashboardPage;
