import { AlertTriangle, Check, Loader2 } from "lucide-react";
import type { SaveStatus as Status } from "@/hooks/useChamberSession";

interface SaveStatusProps {
  status: Status;
  onRetry: () => void;
}

/** Tells the prospect whether their latest answers are saved, and offers a retry when they aren't. */
const SaveStatus = ({ status, onRetry }: SaveStatusProps) => (
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
        <button
          type="button"
          onClick={onRetry}
          className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors"
        >
          Retry
        </button>
      </>
    )}
  </div>
);

export default SaveStatus;
