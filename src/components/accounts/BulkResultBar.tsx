import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BulkChangeError, undoBulkChange, UNDO_WINDOW_MS, type SkippedAccount, type UndoOutcome } from "@/lib/bulkChangeApi";
import type { BulkMade } from "./BulkChangeDialog";
import { differsWords, madeWords, opportunitiesLeftWords, plural, skippedLine, undoneWords, unavailableWords } from "./bulkWords";

// What a bulk change did, and Undo for the ten minutes the database allows (story CRM-S3.7a, D-202): a line over the table that says what changed and which
// accounts were skipped and why, with Undo; after an undo, what it put back and what it left, in words. It lives with the page, so leaving the page ends it
// (the database keeps the undo for its ten minutes; this page does not offer it again). Every refusal of an undo comes back in the database's words.

type State =
  | { kind: "made" }
  | { kind: "undoing" }
  | { kind: "undone"; outcome: UndoOutcome }
  | { kind: "cannot"; words: string };

export function BulkResultBar({ firmId, made, extra, onUndone, onDismiss }: {
  firmId: string;
  made: BulkMade;
  /** A sentence the page adds when it knows something the change doesn't (the Label column is hidden). */
  extra?: string;
  /** After an undo: the table asks again. */
  onUndone: () => void;
  onDismiss: () => void;
}) {
  const { outcome } = made;
  const [state, setState] = useState<State>({ kind: "made" });
  // The ten minutes, counted from the database's answer by this page's own timer, never by its clock against the database's (a clock that is wrong would move
  // the end). The database still refuses a late undo in words.
  const timed = outcome.undoUntil !== null;
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!timed) return;
    const t = setTimeout(() => setExpired(true), UNDO_WINDOW_MS);
    return () => clearTimeout(t);
  }, [timed]);
  const inFlight = useRef(false);
  const [retry, setRetry] = useState<string | null>(null);

  const undo = async () => {
    if (inFlight.current || !outcome.changeId) return;
    inFlight.current = true;
    setState({ kind: "undoing" });
    try {
      const done = await undoBulkChange(firmId, outcome.changeId);
      setState({ kind: "undone", outcome: done });
      onUndone();
    } catch (e) {
      // Expired, already undone, "not yours", a closing firm and "not allowed" can't be tried again; anything else can.
      const final = e instanceof BulkChangeError && (e.kind === "expired" || e.kind === "alreadyUndone" || e.kind === "notFound" || e.kind === "readOnly" || e.kind === "notAllowed");
      const words = e instanceof Error && e.message ? e.message : "Couldn't undo that change. Try again.";
      setState(final ? { kind: "cannot", words } : { kind: "made" });
      if (!final) setRetry(words);
    } finally {
      inFlight.current = false;
    }
  };

  const skipped: SkippedAccount[] = state.kind === "undone" ? state.outcome.skipped : outcome.skipped;
  const canUndo = outcome.changeId !== null && !expired && (state.kind === "made" || state.kind === "undoing");
  const nothing = outcome.changeId === null;

  return (
    <div role="region" aria-label="What the change did" className="mb-3 space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
      <div role="status" className="space-y-1">
        {state.kind === "undone" ? (
          <>
            <p className="font-semibold">Undone.</p>
            {undoneWords(state.outcome).map((line) => <p key={line}>{line}</p>)}
          </>
        ) : (
          <>
            <p className="font-semibold">{nothing ? "Nothing changed." : madeWords(made.action, outcome, made.withOpportunities)}</p>
            {opportunitiesLeftWords(outcome, made.withOpportunities) && <p>{opportunitiesLeftWords(outcome, made.withOpportunities)}</p>}
            {differsWords(made.previewed, outcome) && <p className="font-medium">{differsWords(made.previewed, outcome)}</p>}
            {outcome.unavailable > 0 && <p>{unavailableWords(outcome.unavailable)}</p>}
            {outcome.unchanged > 0 && <p>{plural(outcome.unchanged, "account was", "accounts were")} already as asked and stayed as {outcome.unchanged === 1 ? "it was" : "they were"}.</p>}
            {state.kind === "cannot" && <p className="text-destructive">{state.words}</p>}
            {!nothing && !canUndo && state.kind !== "cannot" && <p className="text-muted-foreground">The ten minutes to undo this have passed.</p>}
            {extra && <p className="text-muted-foreground">{extra}</p>}
          </>
        )}
        {skipped.length > 0 && (
          <div>
            <p className="font-semibold text-warning">
              {skipped.length === 1 ? "1 was skipped" : `${skipped.length.toLocaleString("en-US")} were skipped`}
              {state.kind === "undone" ? " and left as they are" : ""}
            </p>
            <ul className="mt-1 max-h-32 list-disc space-y-1 overflow-y-auto pl-5">
              {skipped.map((s) => <li key={s.id}>{skippedLine(s)}</li>)}
            </ul>
          </div>
        )}
      </div>
      {retry && state.kind === "made" && <p role="alert" className="text-destructive">{retry}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {canUndo && (
          <Button type="button" variant="outline" className="h-11" disabled={state.kind === "undoing"} aria-busy={state.kind === "undoing"} onClick={() => { setRetry(null); void undo(); }}>
            {state.kind === "undoing" ? "Undoing…" : "Undo"}
          </Button>
        )}
        {canUndo && <span className="text-muted-foreground">You can undo this for ten minutes.</span>}
        <Button type="button" variant="ghost" className="ml-auto h-11" disabled={state.kind === "undoing"} onClick={onDismiss}>Dismiss</Button>
      </div>
    </div>
  );
}
