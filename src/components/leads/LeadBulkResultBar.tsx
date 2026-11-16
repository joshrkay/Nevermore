import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { UNDO_WINDOW_MS } from "@/lib/bulkChangeApi";
import { undoLeadsBulk } from "@/lib/leadsBulkApi";
import type { LeadBulkMade } from "./LeadBulkDialog";
import { LEAD_NOT_FIT_REASON_LABELS, LEAD_STATUS_LABELS } from "@/data/leads";
import { LEAD_FIELD_WORDS, leadsWords } from "./leadBulkWords";

// What a bulk change of leads did, with Undo for the ten minutes the database allows (story CRM-L1.1b, D-202, as the Accounts page's BulkResultBar does): a line
// over the table. It lives with the page, so leaving the page ends it. Every refusal of an undo comes back in the database's words.

const madeWords = ({ action, outcome }: LeadBulkMade): string => {
  const n = leadsWords(outcome.changed);
  switch (action.action) {
    case "delete": return `Moved ${n} to the bin.`;
    case "label_add": return `Put the label ${outcome.label ?? action.name} on ${n}.`;
    case "label_remove": return `Took the label ${outcome.label ?? action.name} off ${n}.`;
    case "field": return `Set ${LEAD_FIELD_WORDS[action.field]} on ${n}.`;
    case "owner": return `Gave ${n} to ${outcome.ownerName ?? "the person chosen"}.`;
    case "status": return `Set ${n} to ${LEAD_STATUS_LABELS[action.status]}.`;
    case "not_fit": return `Marked ${n} Not a fit: ${LEAD_NOT_FIT_REASON_LABELS[action.reason]}.`;
    default: return `Changed ${n}.`;
  }
};

type State = { kind: "made" } | { kind: "undoing" } | { kind: "undone"; restored: number } | { kind: "cannot"; words: string };

export function LeadBulkResultBar({ firmId, made, onUndone, onDismiss }: { firmId: string; made: LeadBulkMade; onUndone: () => void; onDismiss: () => void }) {
  const { outcome } = made;
  const [state, setState] = useState<State>({ kind: "made" });
  const [expired, setExpired] = useState(false);
  const timed = outcome.undoUntil !== null;
  useEffect(() => {
    if (!timed) return;
    const t = setTimeout(() => setExpired(true), UNDO_WINDOW_MS);
    return () => clearTimeout(t);
  }, [timed]);
  const inFlight = useRef(false);
  const canUndo = outcome.changeId !== null && !expired && (state.kind === "made" || state.kind === "undoing");

  const undo = async () => {
    if (inFlight.current || !outcome.changeId) return;
    inFlight.current = true;
    setState({ kind: "undoing" });
    try {
      const done = await undoLeadsBulk(firmId, outcome.changeId);
      setState({ kind: "undone", restored: done.restored });
      onUndone();
    } catch (e) {
      // Expired, already undone, not theirs, a closing firm: in the database's words.
      setState({ kind: "cannot", words: e instanceof Error && e.message ? e.message : "Couldn't undo that change. Try again." });
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <div role="region" aria-label="What the change did" className="mb-3 space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
      <div role="status" className="space-y-1">
        {state.kind === "undone" ? <p className="font-semibold">{`Undone. ${leadsWords(state.restored)} put back.`}</p> : <p className="font-semibold">{madeWords(made)}</p>}
        {state.kind === "cannot" && <p className="text-destructive">{state.words}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canUndo && (
          <Button type="button" variant="outline" className="h-11" disabled={state.kind === "undoing"} aria-busy={state.kind === "undoing"} onClick={() => void undo()}>
            {state.kind === "undoing" ? "Undoing…" : "Undo"}
          </Button>
        )}
        {canUndo && <span className="text-muted-foreground">You can undo this for ten minutes.</span>}
        <Button type="button" variant="ghost" className="ml-auto h-11" disabled={state.kind === "undoing"} onClick={onDismiss}>Dismiss</Button>
      </div>
    </div>
  );
}
