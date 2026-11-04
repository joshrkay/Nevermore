import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ADVISOR_SETTABLE_STATUSES,
  isPipelineStatus,
  PIPELINE_LABELS,
  PROSPECT_STATUS_MESSAGES,
  prospectStatusAfter,
  type PipelineStatus,
} from "@/data/advisor";
import { setStatus, type StatusHistoryRow } from "@/lib/advisorApi";
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
  onChanged: () => void;
}

const label = (s: string | null) => (s && isPipelineStatus(s) ? PIPELINE_LABELS[s] : s ?? "—");

const StatusPanel = ({ sessionId, prospectUserId, status, certified, certifiedOnce, history, onChanged }: StatusPanelProps) => {
  // The database refuses anything but Archived for an intake that was never certified.
  const options = certifiedOnce ? ADVISOR_SETTABLE_STATUSES : (["archived"] as const);
  const [next, setNext] = useState<PipelineStatus>(
    !certifiedOnce ? "archived" : status === "draft" ? "under_review" : status,
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const seen = prospectStatusAfter(next, history);
  const seenMessage = seen ? PROSPECT_STATUS_MESSAGES[seen] : undefined;
  const hint = !certifiedOnce
    ? "The prospect hasn't certified this intake, so it can only be archived. They see no status until they certify."
    : !certified
      ? `The prospect sees no status while their certification is withdrawn${seenMessage ? `; once they certify again: “${seenMessage}”` : ""}.`
      : seenMessage
        ? `The prospect will see: “${seenMessage}”${PROSPECT_STATUS_MESSAGES[next] ? "" : " (the status itself stays internal)"}`
        : "Internal only. The prospect sees no status.";

  const save = async () => {
    if (next === status) return;
    setSaving(true);
    try {
      await setStatus(sessionId, next, note);
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
          className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
        >
          {options.map((s) => (
            <option key={s} value={s}>{PIPELINE_LABELS[s]}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{hint}</p>
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
          disabled={saving || next === status}
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
