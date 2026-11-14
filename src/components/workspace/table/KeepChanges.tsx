import { useId, useState } from "react";
import type { TableFields } from "@/lib/tableQuery";
import type { TableView } from "./columns";
import { wordsOf } from "./wordsOf";

interface Props<K extends TableFields> {
  view: TableView<K>;
  /** Keeps what is on screen as the view's own. Rejects with the words to show. */
  onKeep: () => Promise<void>;
  /** Why it can't be done now, in words (the database refuses what is on screen): the button stays in the tab order, says why, and ignores the click. */
  blocked?: string | null;
}

/**
 * The line under the tabs when the open saved view has been changed on screen (filters over it, or a sort of its own): "Changed on screen, not kept."
 * The person who may change the view (`canChange`: their own, or a shared one of theirs while they are an owner) can keep the change as the view's own;
 * anyone else can only save the screen as a view of their own, from "Save this as a view".
 */
export function KeepChanges<K extends TableFields>({ view, onKeep, blocked = null }: Props<K>) {
  const [problem, setProblem] = useState<string | null>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const keep = async () => {
    if (busy || blocked) return;
    setBusy(true);
    setProblem(null);
    try {
      await onKeep();
    } catch (error) {
      setProblem(wordsOf(error, "Couldn't keep the changes. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="-mt-2 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span>Changed on screen, not kept.</span>
      {view.saved?.canChange && (
        <>
          <button type="button" onClick={keep} aria-disabled={busy || blocked ? true : undefined} aria-describedby={blocked ? `${id}-blocked` : undefined} className={`text-primary underline ${blocked ? "opacity-50" : ""}`}>
            {`Keep the changes to ${view.label}`}
          </button>
          {blocked && <span id={`${id}-blocked`} className="sr-only">{blocked}</span>}
        </>
      )}
      {problem && <span role="alert" className="text-destructive">{problem}</span>}
    </div>
  );
}
