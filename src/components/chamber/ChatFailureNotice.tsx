import { Loader2 } from "lucide-react";
import type { ChatFailure } from "@/hooks/useLenoreChat";

interface ChatFailureNoticeProps {
  failure: ChatFailure;
  pending: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

/** Shown when Lenore couldn't answer. The prospect's message stays in the conversation. */
const ChatFailureNotice = ({ failure, pending, onRetry, onDismiss }: ChatFailureNoticeProps) => (
  <div role="alert" className="mx-2 mb-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
    <p className="text-foreground mb-2">
      {failure.kind === "rate_limited"
        ? "You're writing faster than Lenore can keep up. Give her a minute, then try again."
        : "Lenore couldn't respond. Your message is saved."}
    </p>
    <div className="flex gap-2">
      <button
        onClick={onRetry}
        disabled={pending}
        className="font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1.5"
      >
        {pending && <Loader2 className="w-3 h-3 animate-spin" />} Try again
      </button>
      <button
        onClick={onDismiss}
        className="font-medium px-3 py-1.5 rounded-md border border-border hover:border-primary/40 transition-colors"
      >
        Continue manually
      </button>
    </div>
  </div>
);

export default ChatFailureNotice;
