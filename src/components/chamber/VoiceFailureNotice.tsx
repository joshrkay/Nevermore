import { MicOff } from "lucide-react";
import { VOICE_FAILURE_MESSAGES, voiceRetryCanHelp, type VoiceFailure } from "@/data/voiceSession";

interface VoiceFailureNoticeProps {
  failure: VoiceFailure;
  onRetry: () => void;
  /** Clears the notice and puts the cursor in the text input. */
  onContinueInText: () => void;
}

/**
 * Shown when a voice call couldn't start or dropped (US-2.3c). Each failure has its own words; "Continue in
 * text" is always offered, and "Try again" when trying again could work without the prospect changing anything.
 */
const VoiceFailureNotice = ({ failure, onRetry, onContinueInText }: VoiceFailureNoticeProps) => {
  const { title, body } = VOICE_FAILURE_MESSAGES[failure];
  return (
    <div role="alert" className="max-w-md rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-left">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <MicOff className="w-3.5 h-3.5 shrink-0 text-warning" aria-hidden="true" />
        {title}
      </p>
      <p className="text-muted-foreground mt-1 mb-2">{body}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onContinueInText}
          className="font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Continue in text
        </button>
        {voiceRetryCanHelp(failure) && (
          <button
            type="button"
            onClick={onRetry}
            className="font-medium px-3 py-1.5 rounded-md border border-border hover:border-primary/40 transition-colors"
          >
            Try voice again
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceFailureNotice;
