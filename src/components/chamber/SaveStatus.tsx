import { AlertTriangle, Check, Loader2 } from "lucide-react";
import type { SaveStatus as Status } from "@/hooks/useChamberSession";

interface SaveStatusProps {
  status: Status;
  onRetry: () => void;
  /** Conflict: show what was saved elsewhere instead of the prospect's unsaved changes. */
  onLoadLatest?: () => void;
  /** Conflict: save the prospect's version over what was saved elsewhere. */
  onKeepMine?: () => void;
  /** Invalid: drop the unsaved changes and reload what was saved. */
  onDiscard?: () => void;
  /** Missing: begin a new intake from what's on screen. */
  onStartNew?: () => void;
  /** Invalid: the answer the server refused, in words. */
  invalidField?: string | null;
}

const linkButton = "font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors";

/** Tells the prospect whether their latest answers are saved, and what to do when they aren't. */
const SaveStatus = ({ status, onRetry, onLoadLatest, onKeepMine, onDiscard, onStartNew, invalidField }: SaveStatusProps) => {
  // These need the prospect's decision, so they interrupt rather than wait politely.
  if (status === "conflict" || status === "invalid" || status === "missing") {
    return (
      <div role="alert" className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 text-destructive">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {status === "conflict" && "Not saved: this intake was changed in another tab or device."}
          {status === "invalid" && `Not saved: ${invalidField ?? "an answer"} isn't valid.`}
          {status === "missing" && "Not saved: this intake can no longer be saved."}
        </span>
        {status === "conflict" && (
          <>
            <button type="button" onClick={onLoadLatest} className={linkButton}>Load latest</button>
            <button type="button" onClick={onKeepMine} className={linkButton}>Keep my changes</button>
          </>
        )}
        {status === "invalid" && (
          <button type="button" onClick={onDiscard} className={linkButton}>Discard my changes</button>
        )}
        {status === "missing" && (
          <button type="button" onClick={onStartNew} className={linkButton}>Start a new intake</button>
        )}
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" className="ml-auto flex items-center gap-2 text-xs">
      {status === "saving" && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          Saving…
        </span>
      )}
      {status === "saved" && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Check className="w-3.5 h-3.5 text-success" aria-hidden="true" />
          Saved
        </span>
      )}
      {status === "failed" && (
        <>
          <span className="flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            Not saved
          </span>
          <button type="button" onClick={onRetry} className={linkButton}>
            Retry
          </button>
        </>
      )}
    </div>
  );
};

export default SaveStatus;
