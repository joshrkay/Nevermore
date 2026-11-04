import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BellRing, ChevronLeft, ChevronRight, Inbox, Loader2, RefreshCw, Search, SearchX } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  completenessOf,
  formatStates,
  isPipelineStatus,
  NEEDS_ACTION_LABEL,
  PIPELINE_LABELS,
  PIPELINE_STATUSES,
  referenceOf,
  type Completeness,
  type PipelineStatus,
} from "@/data/advisor";
import { emailProblemHelp, emailProblemLabel, emailProblemsBySession } from "@/data/outbox";
import { listEmailProblems, listSubmissions, QUEUE_PAGE_SIZE, type EmailProblem, type SubmissionPage } from "@/lib/advisorApi";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import { PipelineBadge } from "@/components/advisor/PipelineBadge";

type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  | ({ kind: "ready" } & SubmissionPage);

// Drafts the prospect can no longer open (docs/intake-schema.md, "Session lifecycle").
const CLOSED_INTAKE_LABELS: Record<string, string> = {
  expired: "Expired (idle draft)",
  archived: "Archived by prospect",
  revoked: "Revoked",
};

const COMPLETENESS_CLASS: Record<Completeness["state"], string> = {
  complete: "bg-success/15 text-success",
  needs_review: "bg-warning/15 text-warning",
  missing_required: "bg-destructive/15 text-destructive",
};

// Searching waits for a pause in typing, so the database isn't asked once per keystroke.
const SEARCH_DELAY_MS = 300;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const AdvisorDashboardPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const param = searchParams.get("status");
  const status: PipelineStatus | null = isPipelineStatus(param) ? param : null;
  const query = searchParams.get("q") ?? "";
  // Only the submissions an advisor marked as needing advisor action (F-4.3).
  const needsAction = searchParams.get("action") === "1";
  const pageParam = Number(searchParams.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1;
  // What's typed; the URL (and the search) follow it after a pause.
  const [typed, setTyped] = useState(query);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [problems, setProblems] = useState<Map<string, EmailProblem>>(new Map());

  // Read beside the queue, not as part of it: if this fails, the queue still loads.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => listEmailProblems())
      .then((rows) => !cancelled && setProblems(emailProblemsBySession(rows)))
      .catch(() => !cancelled && setProblems(new Map()));
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    listSubmissions({ status, search: query, page, needsAction })
      .then((result) => !cancelled && setLoad({ kind: "ready", ...result }))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => { cancelled = true; };
  }, [status, query, page, needsAction, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Filters, search and page live in the URL, so a refresh or a shared link shows the same queue.
  // Changing a filter or the search starts again from the first page.
  const setParams = useCallback(
    (changes: Partial<Record<"status" | "q" | "page" | "action", string>>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          if (!("page" in changes)) next.delete("page");
          return next;
        },
        // Moving between pages is a step Back should undo; filtering and typing replace the entry.
        { replace: !("page" in changes) },
      );
    },
    [setSearchParams],
  );
  const setParam = (key: "status" | "q" | "action", value: string) => setParams({ [key]: value });

  // Follow the URL when it changes from outside (Back, a shared link), but not when it only caught up
  // with what's being typed: that would drop a space typed just before a pause.
  useEffect(() => setTyped((t) => (t.trim() === query.trim() ? t : query)), [query]);
  useEffect(() => {
    if (typed.trim() === query.trim()) return;
    const timer = setTimeout(() => setParams({ q: typed.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed, query, setParams]);

  const rows = load.kind === "ready" ? load.rows : [];
  const total = load.kind === "ready" ? load.total : 0;
  const searching = query.trim() !== "";
  // How the filters read in an empty or no-match message: "under review submissions that need advisor action".
  const filtered = `${status ? `${PIPELINE_LABELS[status].toLowerCase()} ` : ""}submissions${needsAction ? " that need advisor action" : ""}`;
  const firstShown = (page - 1) * QUEUE_PAGE_SIZE + 1;
  const lastShown = firstShown + rows.length - 1;
  const hasNext = lastShown < total;

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
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Company, contact or File ID"
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
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={needsAction}
                onChange={(e) => setParam("action", e.target.checked ? "1" : "")}
                className="accent-warning"
              />
              {NEEDS_ACTION_LABEL} only
            </label>
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

        {load.kind === "ready" && rows.length === 0 && page > 1 && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <p className="font-medium">There's nothing on page {page}.</p>
            <p className="text-sm text-muted-foreground mt-1">
              <button onClick={() => setParams({ page: "" })} className="text-primary underline">Go to the first page</button>
            </p>
          </div>
        )}

        {load.kind === "ready" && rows.length === 0 && page === 1 && !searching && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
            <p className="font-medium">
              {needsAction
                ? `No ${filtered}.`
                : status
                  ? `No submissions are ${PIPELINE_LABELS[status].toLowerCase()}.`
                  : "No submissions yet."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {needsAction ? (
                <button onClick={() => setParams({ status: "", action: "" })} className="text-primary underline">Show all submissions</button>
              ) : status ? (
                <button onClick={() => setParam("status", "")} className="text-primary underline">Show all statuses</button>
              ) : (
                "Intakes appear here as soon as a prospect starts one."
              )}
            </p>
          </div>
        )}

        {load.kind === "ready" && rows.length === 0 && page === 1 && searching && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <SearchX className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
            <p className="font-medium">
              No {filtered} match “{query.trim()}”.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Search covers company, contact and File ID.{" "}
              <button onClick={() => { setTyped(""); setParam("q", ""); }} className="text-primary underline">Clear search</button>
            </p>
          </div>
        )}

        {load.kind === "ready" && rows.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground mb-2" aria-live="polite">
              {total <= QUEUE_PAGE_SIZE && page === 1
                ? `${total} submission${total === 1 ? "" : "s"}${searching ? ` match “${query.trim()}”` : ""}`
                : `${firstShown}–${lastShown} of ${total} submissions${searching ? ` matching “${query.trim()}”` : ""}`}
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
                  {rows.map((row) => {
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
                          <p className="text-xs text-muted-foreground font-mono">{referenceOf(row) ?? "No File ID yet"}</p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.contact_name ?? <span className="text-muted-foreground">—</span>}
                          {problems.get(row.session_id) && (
                            <p className="mt-1">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive whitespace-nowrap">
                                {emailProblemLabel(problems.get(row.session_id)!.reason)}
                                <span className="sr-only">. {emailProblemHelp(problems.get(row.session_id)!.reason)}</span>
                              </span>
                            </p>
                          )}
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
                              {CLOSED_INTAKE_LABELS[row.intake_status ?? ""]
                                ?? (row.intake_status === "submitted"
                                  ? "Date not recorded"
                                  : row.signer_name
                                    ? "Needs re-certification"
                                    : "Not certified")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <PipelineBadge status={isPipelineStatus(row.pipeline_status) ? row.pipeline_status : "draft"} />
                          {row.needs_action && (
                            <div className="mt-1 max-w-[14rem]" data-testid={`needs-action-${row.session_id}`}>
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning whitespace-nowrap">
                                <BellRing className="w-3 h-3" aria-hidden="true" /> {NEEDS_ACTION_LABEL}
                              </span>
                              {row.needs_action_note && (
                                <p className="text-xs text-muted-foreground mt-1 truncate" title={row.needs_action_note}>
                                  {row.needs_action_note}
                                </p>
                              )}
                            </div>
                          )}
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
            {(page > 1 || hasNext) && (
              <nav aria-label="Pages" className="flex items-center justify-end gap-2 mt-3">
                <button
                  onClick={() => setParams({ page: page - 1 > 1 ? String(page - 1) : "" })}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-border disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE))}
                </span>
                <button
                  onClick={() => setParams({ page: String(page + 1) })}
                  disabled={!hasNext}
                  className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-border disabled:opacity-50"
                >
                  Next <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AdvisorDashboardPage;
