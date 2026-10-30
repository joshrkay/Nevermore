import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Inbox, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  canRetry,
  countFor,
  explainOutboxError,
  isOutboxStatus,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_STATUS_HELP,
  OUTBOX_STATUS_LABELS,
  OUTBOX_STATUSES,
  outboxKindLabel,
  stalledMinutes,
  type OutboxStatus,
} from "@/data/outbox";
import { listOutboxEvents, outboxSummary, requeueOutboxEvent, type OutboxEvent, type OutboxSummaryRow } from "@/lib/advisorApi";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import { formatDateTime } from "@/components/advisor/format";

type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  | { kind: "ready"; events: OutboxEvent[]; summary: OutboxSummaryRow[] };

const STATUS_CLASS: Record<OutboxStatus, string> = {
  dead: "bg-destructive/15 text-destructive",
  pending: "bg-warning/15 text-warning",
  // Neutral, not the theme's red: a claim in progress is not a problem (a lapsed one says so separately).
  claimed: "bg-muted text-foreground",
  sent: "bg-success/15 text-success",
  suppressed: "bg-warning/15 text-warning",
};

const StatusBadge = ({ status }: { status: string }) =>
  isOutboxStatus(status) ? (
    <span title={OUTBOX_STATUS_HELP[status]} className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_CLASS[status]}`}>
      {OUTBOX_STATUS_LABELS[status]}
    </span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{status}</span>
  );

/** When the next thing happens to the event, in words. */
function timing(e: OutboxEvent, now: number): string {
  if (e.status === "sent") return e.sent_at ? `Sent ${formatDateTime(e.sent_at)}` : "Sent";
  if (e.status === "claimed") return e.claimed_at ? `Claimed ${formatDateTime(e.claimed_at)}` : "Claimed";
  if (e.status === "suppressed") return `Queued ${formatDateTime(e.created_at)}`;
  if (e.status === "pending") {
    return Date.parse(e.next_attempt_at) <= now ? "Due now" : `Next attempt ${formatDateTime(e.next_attempt_at)}`;
  }
  return `Queued ${formatDateTime(e.created_at)}`;
}

const AdvisorOutboxPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("status");
  const status: OutboxStatus | null = isOutboxStatus(param) ? param : null;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState<OutboxEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    Promise.all([listOutboxEvents(status), outboxSummary()])
      .then(([events, summary]) => !cancelled && setLoad({ kind: "ready", events, summary }))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => { cancelled = true; };
  }, [status, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  // The filter lives in the URL, so a refresh or a shared link shows the same view.
  const setStatus = (next: OutboxStatus | null) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("status", next);
    else params.delete("status");
    setSearchParams(params, { replace: true });
  };

  const retry = async (event: OutboxEvent, rebuild: boolean) => {
    setBusy(event.id);
    try {
      if (await requeueOutboxEvent(event.id, rebuild)) {
        toast.success("Queued again. It will be sent on the next run, within about a minute.");
      } else {
        toast.message("That notification is no longer dead, so nothing was changed.");
      }
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
      setRebuilding(null);
    }
  };

  const summary = load.kind === "ready" ? load.summary : [];
  const events = useMemo(() => (load.kind === "ready" ? load.events : []), [load]);
  const total = OUTBOX_STATUSES.reduce((n, s) => n + countFor(summary, s), 0);
  const stalled = stalledMinutes(summary);
  const now = Date.now();

  return (
    <div className="min-h-screen bg-background">
      <AdvisorHeader />
      <main className="container mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold">Outbox &amp; Notifications</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              The emails queued when a prospect certifies an intake: the alert to this team and the confirmation to the prospect.
              A failed send is retried automatically (after 1 minute, 5 minutes, 30 minutes and 2 hours); one that gives up is
              <strong className="font-medium"> Dead</strong> and waits here for a retry.
            </p>
          </div>
          <button
            onClick={reload}
            disabled={load.kind === "loading"}
            className="self-start lg:self-auto p-2 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {stalled !== null && (
          <div role="alert" className="mb-4 flex gap-3 border border-warning/40 bg-warning/10 rounded-xl p-4 text-sm">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0" aria-hidden="true" />
            <p>
              <strong className="font-medium">Nothing has picked up the queue for {stalled} minutes.</strong> The every-minute
              schedule may be down, or a setting the email needs is missing. Engineering can check{" "}
              <code className="text-xs">docs/NOTIFICATIONS.md</code>.
            </p>
          </div>
        )}

        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setStatus(null)}
            aria-pressed={status === null}
            className={`text-sm px-3 py-1.5 rounded-full border ${status === null ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            All{load.kind === "ready" ? ` (${total})` : ""}
          </button>
          {OUTBOX_STATUSES.map((s) => {
            const n = countFor(summary, s);
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                title={OUTBOX_STATUS_HELP[s]}
                className={`text-sm px-3 py-1.5 rounded-full border ${status === s ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"} ${s === "dead" && n > 0 ? "text-destructive" : ""}`}
              >
                {OUTBOX_STATUS_LABELS[s]}
                {load.kind === "ready" ? ` (${n})` : ""}
              </button>
            );
          })}
        </div>

        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-24 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading the outbox…
          </div>
        )}

        {load.kind === "error" && <AdvisorLoadError error={load.error} what="the outbox" onRetry={reload} />}

        {load.kind === "ready" && events.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
            <p className="font-medium">
              {status ? `No ${OUTBOX_STATUS_LABELS[status].toLowerCase()} notifications.` : "No notifications yet."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {status ? (
                <button onClick={() => setStatus(null)} className="text-primary underline">Show all</button>
              ) : (
                "They appear here when a prospect certifies an intake."
              )}
            </p>
          </div>
        )}

        {load.kind === "ready" && events.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground mb-2" aria-live="polite">
              {events.length} {events.length === 1 ? "notification" : "notifications"}, newest first
            </p>
            <div className="border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Notification</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Last error</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => {
                    const gloss = explainOutboxError(e.last_error);
                    const what = `${outboxKindLabel(e.kind)} for ${e.company_name ?? "a company with no name"}`;
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <p className="text-sm font-medium">
                            {outboxKindLabel(e.kind)}
                            {e.resubmission && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">Updated intake</span>
                            )}
                          </p>
                          <Link to={`/advisor/submissions/${e.session_id}`} className="text-sm text-primary hover:underline">
                            {e.company_name ?? "Company not provided"}
                          </Link>
                          {e.reference && <p className="text-xs text-muted-foreground font-mono">{e.reference}</p>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={e.status} />
                          {e.claim_lapsed && (
                            <p className="text-xs text-warning mt-1">Claim lapsed: its worker is gone; the next run takes it over.</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {e.attempts} / {OUTBOX_MAX_ATTEMPTS}
                          {e.requeue_count > 0 && (
                            <p className="text-xs text-muted-foreground font-sans">
                              Retried {e.requeue_count} {e.requeue_count === 1 ? "time" : "times"}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{timing(e, now)}</TableCell>
                        <TableCell className="text-sm max-w-sm">
                          {e.last_error ? (
                            <>
                              {gloss && <p>{gloss}</p>}
                              <p className="text-xs text-muted-foreground font-mono break-words">{e.last_error}</p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {canRetry(e) && (
                            <div className="flex flex-col items-end gap-1">
                              <button
                                onClick={() => void retry(e, false)}
                                disabled={busy !== null}
                                aria-label={`Retry send: ${what}`}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm px-3 py-1.5 rounded-md border border-border hover:border-primary hover:text-primary disabled:opacity-50"
                              >
                                {busy === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />}
                                Retry send
                              </button>
                              {e.frozen && (
                                <button
                                  onClick={() => setRebuilding(e)}
                                  disabled={busy !== null}
                                  aria-label={`Rebuild and retry: ${what}`}
                                  className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
                                >
                                  Rebuild and retry…
                                </button>
                              )}
                            </div>
                          )}
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

      <AlertDialog open={rebuilding !== null} onOpenChange={(open) => !open && setRebuilding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rebuild this email and retry?</AlertDialogTitle>
            <AlertDialogDescription>
              An email was already written for this notification and may have been delivered. <strong>Retry send</strong> resends
              that same email under the same key, which the email provider recognises as a repeat. <strong>Rebuild</strong> throws it
              away and builds a new one from the current settings (use it after fixing the sender, recipient or link). If the
              first one was delivered, the recipient gets a second copy. Check the provider&apos;s log first if unsure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => rebuilding && void retry(rebuilding, true)}>Rebuild and retry</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdvisorOutboxPage;
