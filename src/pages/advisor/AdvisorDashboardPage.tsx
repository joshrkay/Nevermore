import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  completenessOf,
  isPipelineStatus,
  PIPELINE_LABELS,
  PIPELINE_STATUSES,
  type Completeness,
  type PipelineStatus,
} from "@/data/advisor";
import { listSubmissions, type SubmissionSummary } from "@/lib/advisorApi";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import { PipelineBadge } from "@/components/advisor/PipelineBadge";

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
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
  const param = searchParams.get("status");
  const status: PipelineStatus | null = isPipelineStatus(param) ? param : null;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    listSubmissions(status)
      .then((rows) => !cancelled && setLoad({ kind: "ready", rows }))
      .catch((err: Error) => !cancelled && setLoad({ kind: "error", message: err.message }));
    return () => { cancelled = true; };
  }, [status, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const setStatus = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("status", value);
    else next.delete("status");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <AdvisorHeader />
      <main className="container mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold">Submissions</h1>
            <p className="text-sm text-muted-foreground">Intake packets from prospects, newest first.</p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="status-filter" className="text-sm text-muted-foreground">Status</label>
            <select
              id="status-filter"
              value={status ?? ""}
              onChange={(e) => setStatus(e.target.value)}
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

        {load.kind === "error" && (
          <div role="alert" className="border border-destructive/40 bg-destructive/5 rounded-xl p-6 text-center">
            <AlertTriangle className="w-6 h-6 text-destructive mx-auto mb-2" aria-hidden="true" />
            <p className="font-medium mb-1">We couldn't load submissions.</p>
            <p className="text-sm text-muted-foreground mb-4">{load.message}</p>
            <button onClick={retry} className="text-primary underline hover:text-primary/90">Try again</button>
          </div>
        )}

        {load.kind === "ready" && load.rows.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
            <p className="font-medium">
              {status ? `No submissions are ${PIPELINE_LABELS[status].toLowerCase()}.` : "No submissions yet."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {status ? (
                <button onClick={() => setStatus("")} className="text-primary underline">Show all statuses</button>
              ) : (
                "Intakes appear here as soon as a prospect starts one."
              )}
            </p>
          </div>
        )}

        {load.kind === "ready" && load.rows.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Completeness</TableHead>
                  <TableHead className="text-right">Employees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {load.rows.map((row) => {
                  const completeness = completenessOf(row);
                  return (
                    <TableRow key={row.session_id}>
                      <TableCell>
                        <Link to={`/advisor/submissions/${row.session_id}`} className="font-medium text-foreground hover:text-primary">
                          {row.company_name ?? "Company not provided"}
                        </Link>
                        {row.contact_name && <p className="text-xs text-muted-foreground">{row.contact_name}</p>}
                      </TableCell>
                      <TableCell>
                        <PipelineBadge status={isPipelineStatus(row.pipeline_status) ? row.pipeline_status : "draft"} />
                      </TableCell>
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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${COMPLETENESS_CLASS[completeness.state]}`}>
                          {completeness.label}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">{completeness.detail}</p>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{row.employee_count ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdvisorDashboardPage;
