import { toast } from "sonner";
import { isQuoteRequestStatus, QUOTE_REQUEST_LABELS } from "@/data/quoteRequests";
import { DID_NOT_GO_THROUGH, failureWords } from "@/components/workspace/form";
import type { ThreadMessage } from "@/data/mailThread";
import { decideReplySuggestion } from "@/lib/advisorApi";

/**
 * What the AI suggested a PEO's reply means (story N-1.1), under the reply it read. A suggestion only: the agent accepts it (the status is
 * recorded through the same function a hand-set status is) or dismisses it. The record keeps which suggestion it was and what became of it,
 * never the reply's words.
 */
export const ReplySuggestion = ({ message, onSettled }: { message: ThreadMessage; onSettled?: () => void }) => {
  const status = message.suggested_status;
  if (!status || message.direction !== "received") return null;
  const label = isQuoteRequestStatus(status) ? QUOTE_REQUEST_LABELS[status] : status;
  // The database's own words when it refuses (a decline not recorded yet, a suggestion already settled); the suggestion stays to settle.
  const settle = async (decision: "accept" | "dismiss") => {
    try {
      await decideReplySuggestion(message.id, decision);
    } catch (err) {
      toast.error(failureWords(err, DID_NOT_GO_THROUGH));
      return;
    }
    if (decision === "accept") toast.success(status === "question_open" ? `Recorded as ${label}. You can ask the prospect about it: write the question in your own words.` : `Recorded as ${label}.`);
    onSettled?.();
  };
  if (message.suggestion_outcome) {
    return <p className="text-xs text-muted-foreground">{`Suggested: ${label}, ${message.suggestion_outcome}.`}</p>;
  }
  return (
    <div className="border border-border rounded-md p-3 space-y-2 text-sm">
      <p>{`Suggested: ${label}`}</p>
      <p className="text-xs text-muted-foreground">A suggestion only: nothing changes until you accept it.</p>
      <div className="flex gap-2">
        <button onClick={() => void settle("accept")} className="min-h-11 px-4 rounded-md border border-border hover:bg-muted">Accept</button>
        <button onClick={() => void settle("dismiss")} className="min-h-11 px-4 rounded-md border border-border hover:bg-muted">Dismiss</button>
      </div>
    </div>
  );
};
