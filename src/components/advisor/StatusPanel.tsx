import { useContext, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SaveFailed, useOfflineSave, useSaveFailure } from "@/components/workspace/form";
import { WorkspaceContext } from "@/components/workspace/workspaceContext";
import {
  isPipelineStatus,
  nextPipelineStatuses,
  PIPELINE_LABELS,
  PROSPECT_STATUS_MESSAGES,
  prospectStatusAfter,
  type PipelineStatus,
} from "@/data/advisor";
import { setStatus, type StatusHistoryRow } from "@/lib/advisorApi";
import { getOpportunityOfSubmission } from "@/lib/opportunityPageApi";
import { ConsoleCloseDialog } from "./ConsoleCloseDialog";
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
  /** An opportunity was won or lost from here: the page asks again what holds its outcome (the accounts table, the opportunity's own page, the submission's read) for this firm. */
  onOutcomeChanged?: (firmId: string) => void;
}

const label = (s: string | null) => (s && isPipelineStatus(s) ? PIPELINE_LABELS[s] : s ?? "—");

/** How an option reads in the list: reopening an archived file is named as such. */
const optionLabel = (current: PipelineStatus, s: PipelineStatus) =>
  current === "archived" && s === "submitted" ? `${PIPELINE_LABELS[s]} (reopen)` : PIPELINE_LABELS[s];

const StatusPanel = ({ sessionId, prospectUserId, status, certified, certifiedOnce, history, onChanged, onOutcomeChanged }: StatusPanelProps) => {
  // Only the next steps from where the intake is now, as the database allows (one step at a time; a
  // never-certified intake can only be archived).
  const options = nextPipelineStatuses(status, certifiedOnce);
  const [next, setNext] = useState<PipelineStatus>(status);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const failure = useSaveFailure("The status wasn't changed. Check your connection and try again. What you typed is still here.");
  const offlineSave = useOfflineSave();
  const updateButton = useRef<HTMLButtonElement>(null);
  // The opportunity the submission is on (D-470): there, Won and Lost are the opportunity's to close, in its own dialog, not this panel's to move. Every certified
  // submission is on one, so there is no console way to win or lose one without it: while it is read, when it could not be, or when it is not one the person can open
  // (its account is not theirs to see), the database would refuse the move, and the panel says why instead of offering one.
  type Lookup = { state: "loading" } | { state: "found"; id: string; firmId: string } | { state: "none" } | { state: "failed" };
  const [lookup, setLookup] = useState<Lookup>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [closing, setClosing] = useState<"won" | "lost" | null>(null);
  // A support session reads the firm's data and changes none of it (ADR 0024).
  const isSupport = useContext(WorkspaceContext)?.isSupport ?? false;
  useEffect(() => {
    let cancelled = false;
    setLookup({ state: "loading" });
    getOpportunityOfSubmission(sessionId).then(
      (found) => !cancelled && setLookup(found ? { state: "found", ...found } : { state: "none" }),
      () => !cancelled && setLookup({ state: "failed" }),
    );
    return () => { cancelled = true; };
  }, [sessionId, attempt]);
  const closesOnOpportunity = next === "won" || next === "lost";
  const opportunity = lookup.state === "found" ? lookup : null;
  const closeBlocked = !closesOnOpportunity ? null
    : isSupport ? "Nevermore support can read this submission but not change it."
    : lookup.state === "loading" ? "Checking this submission's opportunity…"
    : lookup.state === "failed" ? "Couldn't read this submission's opportunity, so it can't be marked won or lost from here."
    : lookup.state === "none" ? "This submission's opportunity isn't one you can open (it may belong to an account you can't see), so it can't be marked won or lost from here. Ask its owner or an owner of the firm."
    : null;
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
    if (closesOnOpportunity) {
      if (opportunity && !closeBlocked) setClosing(next as "won" | "lost");
      return;
    }
    setSaving(true);
    failure.clear();
    try {
      await setStatus(sessionId, next, note);
      setNote("");
      toast.success(`Status changed to ${PIPELINE_LABELS[next]}.`);
      onChanged();
    } catch (err) {
      failure.failed(err);
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
        {closesOnOpportunity && closeBlocked && (
          <p role={lookup.state === "loading" ? "status" : "alert"} className="text-xs text-muted-foreground">
            {closeBlocked}
            {!isSupport && lookup.state === "failed" && (
              <>{" "}<button type="button" onClick={() => setAttempt((n) => n + 1)} className="underline underline-offset-2">Try again</button></>
            )}
          </p>
        )}
        {closesOnOpportunity && !closeBlocked && <p className="text-xs text-muted-foreground">Marking it {next} opens its opportunity's dialog, where you choose how it ended.</p>}
        <label htmlFor="status-note" className="block text-xs text-muted-foreground pt-1">Internal note (optional)</label>
        <textarea
          id="status-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          rows={2}
          className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
        />
        {closing && opportunity && (
          <ConsoleCloseDialog
            firmId={opportunity.firmId}
            opportunityId={opportunity.id}
            initial={closing}
            onClose={() => setClosing(null)}
            onDone={() => {
              onOutcomeChanged?.(opportunity.firmId);
              onChanged();
            }}
          />
        )}
        <SaveFailed message={failure.message} returnFocusTo={updateButton} />
        {offlineSave.reason}
        <button
          ref={updateButton}
          onClick={offlineSave.guard(save)}
          {...offlineSave.buttonProps}
          disabled={saving || next === status || closeBlocked !== null}
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
