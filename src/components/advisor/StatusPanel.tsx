import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  isPipelineStatus,
  nextPipelineStatuses,
  PIPELINE_LABELS,
  PROSPECT_STATUS_MESSAGES,
  prospectStatusAfter,
  type PipelineStatus,
} from "@/data/advisor";
import { setStatus, type QuoteRequestRow, type StatusHistoryRow } from "@/lib/advisorApi";
import { PipelineBadge } from "./PipelineBadge";
import { actorName, formatDateTime } from "./format";

interface StatusPanelProps {
  sessionId: string;
  prospectUserId: string;
  status: PipelineStatus;
  /** The intake is certified now. */
  certified: boolean;
  /** The prospect has certified it at least once. Until then it can only be archived. */
  certifiedOnce: boolean;
  history: StatusHistoryRow[];
  /** The submission's quote requests: marking it won names the one whose quote the employer took. */
  quoteRequests: readonly QuoteRequestRow[];
  onChanged: () => void;
}

const label = (s: string | null) => (s && isPipelineStatus(s) ? PIPELINE_LABELS[s] : s ?? "—");

/** How an option reads in the list: reopening an archived file is named as such. */
const optionLabel = (current: PipelineStatus, s: PipelineStatus) =>
  current === "archived" && s === "submitted" ? `${PIPELINE_LABELS[s]} (reopen)` : PIPELINE_LABELS[s];

const StatusPanel = ({ sessionId, prospectUserId, status, certified, certifiedOnce, history, quoteRequests, onChanged }: StatusPanelProps) => {
  // Only the next steps from where the intake is now, as the database allows (one step at a time; a
  // never-certified intake can only be archived).
  const options = nextPipelineStatuses(status, certifiedOnce);
  const [next, setNext] = useState<PipelineStatus>(status);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [winner, setWinner] = useState("");
  const quoted = quoteRequests.filter((q) => q.status === "quoted");
  const needsWinner = next === "won" && winner === "";
  const seen = prospectStatusAfter(next, history);
  const seenMessage = seen ? PROSPECT_STATUS_MESSAGES[seen] : undefined;
  // While withdrawn, the prospect sees it once they certify again, and certifying at "information
  // requested" answers the request (the database returns it to Submitted).
  const afterCertifying = next === "information_requested" ? "submitted" : seen;
  const afterCertifyingMessage = afterCertifying ? PROSPECT_STATUS_MESSAGES[afterCertifying] : undefined;
  const hint = !certifiedOnce
    ? options.length === 0
      ? "Archived before the prospect certified. It returns as Submitted if they certify."
      : "The prospect hasn't certified this intake, so it can only be archived. They see no status until they certify."
    : status === "draft" && next === status
      ? "The prospect withdrew their certification by changing an answer, so it can only be archived until they certify again."
      : !certified
      ? `The prospect sees no status while their certification is withdrawn${afterCertifyingMessage ? `; once they certify again: “${afterCertifyingMessage}”` : ""}.`
      : seenMessage
        ? `The prospect will see: “${seenMessage}”${PROSPECT_STATUS_MESSAGES[next] ? "" : " (the status itself stays internal)"}`
        : "Internal only. The prospect sees no status.";

  const save = async () => {
    if (next === status) return;
    setSaving(true);
    try {
      if (next === "won") await setStatus(sessionId, next, note, Number(winner));
      else await setStatus(sessionId, next, note);
      setNote("");
      toast.success(`Status changed to ${PIPELINE_LABELS[next]}.`);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="status-heading" className="border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 id="status-heading" className="font-display text-lg font-bold">Status</h2>
        <PipelineBadge status={status} />
      </div>

      <div className="space-y-2">
        <label htmlFor="next-status" className="block text-xs text-muted-foreground">Change status to</label>
        <select
          id="next-status"
          value={next}
          onChange={(e) => setNext(e.target.value as PipelineStatus)}
          disabled={options.length === 0}
          aria-describedby="next-status-steps"
          className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value={status}>{PIPELINE_LABELS[status]} (current)</option>
          {options.map((s) => (
            <option key={s} value={s}>{optionLabel(status, s)}</option>
          ))}
        </select>
        <p id="next-status-steps" className="text-xs text-muted-foreground">
          {options.length === 0
            ? "No status change is available."
            : `From ${PIPELINE_LABELS[status]} it can move to ${options.map((s) => optionLabel(status, s)).join(", ")}.`}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {next === "won" && (
          <>
            <label htmlFor="won-quote" className="block text-xs text-muted-foreground pt-1">Which quote did the employer take?</label>
            <select
              id="won-quote"
              value={winner}
              onChange={(e) => setWinner(e.target.value)}
              className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="">Choose a PEO</option>
              {quoted.map((q) => (
                <option key={q.id} value={String(q.id)}>{q.peo_name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Every other open quote request closes.</p>
          </>
        )}
        <label htmlFor="status-note" className="block text-xs text-muted-foreground pt-1">Internal note (optional)</label>
        <textarea
          id="status-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          rows={2}
          className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={save}
          disabled={saving || next === status || needsWinner}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Update status
        </button>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">History</h3>
        <ol className="space-y-2 text-sm" aria-label="Status history">
          {history.map((h) => (
            <li key={h.id} className="border-l-2 border-border pl-3">
              <p>
                {h.from_status && h.from_status !== h.to_status ? `${label(h.from_status)} → ` : ""}
                <span className="font-medium">{label(h.to_status)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {actorName(h.changed_by, h.changed_by_email, prospectUserId)} · {formatDateTime(h.changed_at)}
              </p>
              {h.note && <p className="text-xs text-muted-foreground italic">{h.note}</p>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default StatusPanel;
