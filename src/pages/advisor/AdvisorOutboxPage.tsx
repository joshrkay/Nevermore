import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { formatDateTime } from "@/components/advisor/format";
import { EmptyBody, LoadingStatus, NothingMatches, NothingYet, PlaceholderBody, PlaceholderLine, SlowLoadLine, useSlowLoad, type PlaceholderColumn, LoadFailed } from "@/components/workspace/states";
import { failureWords } from "@/components/workspace/form/failureWords";

type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  | { kind: "ready"; events: OutboxEvent[]; summary: OutboxSummaryRow[]; status: OutboxStatus | null };

// The table's columns, listed once and drawn the same for the real rows and the grey ones (story CRM-S2.1), so nothing jumps when the rows arrive.
const COLUMNS: (PlaceholderColumn & { header: ReactNode; headClass?: string })[] = [
  { id: "notification", header: "Notification", width: "name", lines: 2 },
  { id: "status", header: "Status", width: "badge" },
  { id: "attempts", header: "Attempts", headClass: "text-right", width: "number", align: "right" },
  { id: "when", header: "When", width: "date" },
  { id: "error", header: "Last error", width: "text", lines: 2 },
  { id: "actions", header: <span className="sr-only">Actions</span>, width: "badge", align: "right" },
];

const OutboxHead = () => (
  <TableHeader>
    <TableRow>
      {COLUMNS.map((c) => <TableHead key={c.id} className={c.headClass}>{c.header}</TableHead>)}
    </TableRow>
  </TableHeader>
);

/** A status button's count, in room reserved for it, so the buttons don't widen when the numbers arrive. Hidden from a screen reader until there is a number. */
const Count = ({ n }: { n: number | null }) => (
  <span className="ml-1 inline-block min-w-[3.5ch] text-left tabular-nums" aria-hidden={n === null || undefined}>
    <span className={n === null ? "invisible" : undefined}>({n ?? 0})</span>
  </span>
);

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
  if (e.status === "suppressed") return `Held back ${formatDateTime(e.created_at)}`;
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
    // Whatever is on screen stays while the next answer arrives (D-49, D-144): a reload keeps it as it is, and a changed status keeps the events,
    // the counts and the stall alert, dimmed and marked busy, until its own events arrive. Grey rows only when there is nothing to show yet.
    setLoad((prev) => (prev.kind === "ready" || prev.kind === "loading" ? prev : { kind: "loading" }));
    Promise.all([listOutboxEvents(status), outboxSummary()])
      .then(([events, summary]) => !cancelled && setLoad({ kind: "ready", events, summary, status }))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => { cancelled = true; };
  }, [status, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  // Ten seconds with nothing to show (not a reload over events already shown).
  const slowLoad = useSlowLoad(load.kind === "loading", reload);

  // The filter lives in the URL, so a refresh or a shared link shows the same view.
  // A status button replaces the entry (it corrects the same list); the way back out of an empty status is a place to come back to, so it pushes (`push`).
  const setStatus = (next: OutboxStatus | null, options: { push?: boolean } = {}) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("status", next);
    else params.delete("status");
    setSearchParams(params, { replace: !options.push });
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
      toast.error(failureWords(err, "That didn't go through. Check your connection and try again."));
    } finally {
      setBusy(null);
      setRebuilding(null);
    }
  };

  const summary = load.kind === "ready" ? load.summary : [];
  const events = useMemo(() => (load.kind === "ready" ? load.events : []), [load]);
  const total = OUTBOX_STATUSES.reduce((n, s) => n + countFor(summary, s), 0);
  const stalled = stalledMinutes(summary);
  // The events on screen answer another status than the one now chosen: dimmed and marked busy until its own arrive.
  const stale = load.kind === "ready" && load.status !== status;
  const now = Date.now();
  // Empty (CRM-S2.2). The rule: the summary counts every status whatever is chosen, so it says whether the outbox holds anything at all. No notification
  // anywhere is NOTHING YET (even with a status chosen: "No notifications are dead" would suggest others exist). A status with none while others
  // hold some is NOTHING MATCHES, with the way back to all. There is nothing a person can create here: notifications are queued when a prospect certifies.
  const allButton = useRef<HTMLButtonElement>(null);
  // The words are for the status the (empty) answer was FOR, which is the previous one while the next is on its way, never for a question not yet answered.
  const answered = load.kind === "ready" ? load.status : status;
  const emptyState = answered !== null && total > 0 ? (
    <NothingMatches
      plural="notifications"
      by={{ search: false, filters: false, view: true }}
      headline={`No notifications are ${OUTBOX_STATUS_LABELS[answered].toLowerCase()}.`}
      inForce={[`Status: ${OUTBOX_STATUS_LABELS[answered]}`]}
      clearLabel="Show all notifications"
      onClear={() => { setStatus(null, { push: true }); allButton.current?.focus(); }}
      icon={<Inbox className="w-8 h-8 text-muted-foreground mb-3" aria-hidden="true" />}
    />
  ) : (
    <NothingYet sentence="Notifications appear here when a prospect certifies an intake." icon={<Inbox className="w-8 h-8 text-muted-foreground mb-3" aria-hidden="true" />} />
  );

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold">Outbox &amp; Notifications</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              The emails queued when a prospect certifies an intake: the alert to this team and the confirmation to the prospect.
              A failed send is retried automatically (after 1 minute, 5 minutes, 30 minutes and 2 hours); one that gives up is
              <strong className="font-medium"> Dead</strong> and waits here for a retry.
            </p>
            <SlowLoadLine loading={load.kind === "loading"} slow={slowLoad.slow} onTryAgain={slowLoad.tryAgain} />
          </div>
          {/* Not usable until there is something to ask again for: it stays in the tab order, says why, and ignores the click. */}
          <button
            onClick={load.kind === "loading" ? undefined : reload}
            aria-disabled={load.kind === "loading" || undefined}
            aria-describedby={load.kind === "loading" ? "refresh-unavailable" : undefined}
            className={`self-start lg:self-auto p-2 rounded-md border border-border text-muted-foreground ${load.kind === "loading" ? "opacity-50" : "hover:text-foreground"}`}
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {load.kind === "loading" && <span id="refresh-unavailable" className="sr-only">Available when the outbox has loaded</span>}
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
            ref={allButton}
            onClick={() => setStatus(null)}
            aria-pressed={status === null}
            className={`text-sm px-3 py-1.5 rounded-full border ${status === null ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            All<Count n={load.kind === "ready" ? total : null} />
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
                {OUTBOX_STATUS_LABELS[s]}<Count n={load.kind === "ready" ? n : null} />
              </button>
            );
          })}
        </div>

        {load.kind === "error" && <LoadFailed error={load.error} what="the outbox" onRetry={reload} />}

        {load.kind === "loading" && <LoadingStatus name="the outbox" />}

        {(load.kind === "loading" || load.kind === "ready") && (
          <>
            {/* The line above the table is held while loading, so the table doesn't move down a line when the events arrive. */}
            {load.kind === "loading" ? (
              <p aria-hidden="true" className="mb-2 flex h-4 items-center"><PlaceholderLine width="date" className="h-2.5" /></p>
            ) : events.length === 0 ? (
              // Room for the line the rows would have, so the table does not move when the first notification arrives.
              <p aria-hidden="true" className="mb-2 h-4" />
            ) : (
              <p className="text-xs text-muted-foreground mb-2" aria-live="polite">
                {events.length} {events.length === 1 ? "notification" : "notifications"}, newest first
              </p>
            )}
            {/* One table, whether its rows are grey or real, so it is never rebuilt when they arrive. Events that answer another status than the one now
                chosen are dimmed and marked busy until its own arrive. */}
            <div className={`border border-border rounded-xl overflow-hidden ${stale ? "opacity-70" : ""}`} aria-busy={load.kind === "loading" || (stale && events.length > 0) || undefined}>
              <Table>
                <OutboxHead />
                {load.kind === "loading" ? (
                  <PlaceholderBody columns={COLUMNS} cellClassName="p-4 align-middle" />
                ) : events.length === 0 ? (
                  <EmptyBody columns={COLUMNS.length} Body={TableBody} Row={TableRow} Cell={TableCell}>{emptyState}</EmptyBody>
                ) : (
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
                )}
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
