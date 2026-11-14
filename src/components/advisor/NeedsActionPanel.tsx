import { useRef, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SaveFailed, useSaveFailure } from "@/components/workspace/form";
import { NEEDS_ACTION_LABEL, NEEDS_ACTION_NOTE_MAX } from "@/data/advisor";
import { setNeedsAction, type NeedsAction } from "@/lib/advisorApi";
import { actorName, formatDateTime } from "./format";

interface NeedsActionPanelProps {
  sessionId: string;
  prospectUserId: string;
  needsAction: NeedsAction;
  onChanged: () => void;
}

/**
 * Raises or clears Needs advisor action on the whole submission (F-4.3), with an optional note. The queue shows it
 * and can be filtered to it; each change is in the status history. Internal: the prospect never sees it.
 */
const NeedsActionPanel = ({ sessionId, prospectUserId, needsAction, onChanged }: NeedsActionPanelProps) => {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const failure = useSaveFailure(`The change wasn't saved. Check your connection and try again. What you typed is still here.`);
  const saveButton = useRef<HTMLButtonElement>(null);
  const on = needsAction.on;

  const save = async () => {
    setSaving(true);
    failure.clear();
    try {
      await setNeedsAction(sessionId, !on, note);
      setNote("");
      toast.success(on ? "Cleared: no longer needs advisor action." : "Marked as needing advisor action.");
      onChanged();
    } catch (err) {
      failure.failed(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="needs-action-heading"
      className={`border rounded-xl p-5 space-y-3 ${on ? "border-warning/50 bg-warning/5" : "border-border"}`}
    >
      <h2 id="needs-action-heading" className="font-display text-lg font-bold flex items-center gap-2">
        <BellRing className={`w-4 h-4 ${on ? "text-warning" : "text-muted-foreground"}`} aria-hidden="true" />
        {NEEDS_ACTION_LABEL}
      </h2>
      {on ? (
        <div className="text-sm space-y-1" role="status">
          <p className="font-medium">Someone on the team needs to act on this submission.</p>
          {needsAction.note && <p className="whitespace-pre-wrap">{needsAction.note}</p>}
          {needsAction.at && (
            <p className="text-xs text-muted-foreground">
              Marked by {actorName(needsAction.by, needsAction.byEmail, prospectUserId)} · {formatDateTime(needsAction.at)}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Mark the submission when someone on the team has to act on it. The queue shows it, and can list only these.
          Internal: the prospect never sees it.
        </p>
      )}
      <label htmlFor="needs-action-note" className="block text-xs text-muted-foreground">
        {on ? "What was done (optional)" : "What needs doing (optional)"}
      </label>
      <textarea
        id="needs-action-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={NEEDS_ACTION_NOTE_MAX}
        rows={2}
        className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
      />
      <SaveFailed message={failure.message} returnFocusTo={saveButton} />
      <button
        ref={saveButton}
        onClick={save}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-md disabled:opacity-50 ${
          on ? "border border-border hover:bg-muted" : "bg-warning text-warning-foreground hover:bg-warning/90"
        }`}
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {on ? "Clear" : "Mark as needing advisor action"}
      </button>
    </section>
  );
};

export default NeedsActionPanel;
