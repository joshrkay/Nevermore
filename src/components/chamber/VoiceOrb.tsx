import { Mic, MicOff, MessageSquare, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { VOICE_FAILURE_MESSAGES, type VoiceFailure } from "@/data/voiceFailure";

export type OrbState = "idle" | "listening" | "speaking" | "thinking" | "disabled";

interface VoiceOrbProps {
  orbState: OrbState;
  lastSpokenText: string;
  onStartVoice: () => void;
  /** Focuses the text input. */
  onTypeInstead: () => void;
  /** Whether voice is offered at all: without a voice agent, the prospect sees text only, and no setup steps. */
  voiceAvailable: boolean;
  isVoiceConnected?: boolean;
  isConnecting?: boolean;
  /** Why the last call didn't start or didn't last (US-2.3c). */
  failure?: VoiceFailure | null;
  /** "Continue in text" after a failure: puts the message away and focuses the text input. */
  onContinueInText?: () => void;
}

const VoiceOrb = ({
  orbState,
  lastSpokenText,
  onStartVoice,
  onTypeInstead,
  voiceAvailable,
  isVoiceConnected = false,
  isConnecting = false,
  failure = null,
  onContinueInText,
}: VoiceOrbProps) => {
  const canClickOrb = voiceAvailable && !isConnecting;

  const orbClasses = {
    idle: "orb-idle",
    listening: "orb-listening",
    speaking: "orb-speaking",
    thinking: "orb-thinking",
    disabled: "orb-disabled",
  };

  return (
    <div className="relative w-full flex flex-col items-center justify-center py-8 md:py-12" style={{ background: "#07080D" }}>
      {/* Orb: the buttons below are the controls, so it is hidden from assistive technology. */}
      <div className="relative mb-6" aria-hidden="true">
        {/* Thinking rotating arc */}
        {orbState === "thinking" && (
          <div className="absolute inset-[-12px] rounded-full border-2 border-transparent border-t-primary animate-spin" />
        )}
        {/* Listening outer ring pulse */}
        {orbState === "listening" && (
          <div className="absolute inset-[-8px] rounded-full border-2 border-primary/40 animate-ping" />
        )}
        <div
          data-testid="voice-orb"
          className={`w-36 h-36 md:w-44 md:h-44 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center transition-all duration-500 ${canClickOrb ? "cursor-pointer" : ""} ${orbClasses[orbState]}`}
          onClick={canClickOrb ? onStartVoice : undefined}
        >
          <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-[#07080D] flex items-center justify-center">
            <div className={`w-20 h-20 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-primary/60 to-primary/20 ${orbState === "speaking" ? "animate-pulse" : ""}`} />
          </div>
        </div>
      </div>

      {/* Status indicator */}
      {(isVoiceConnected || isConnecting) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          role="status"
          className="mb-2 flex items-center gap-2 text-xs text-primary/80"
        >
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {isConnecting && "Connecting..."}
          {isVoiceConnected && orbState === "listening" && "Listening..."}
          {isVoiceConnected && orbState === "speaking" && "Lenore is speaking..."}
          {isVoiceConnected && orbState === "thinking" && "Thinking..."}
          {isVoiceConnected && orbState === "idle" && "Connected"}
        </motion.div>
      )}

      {/* Last spoken text */}
      <motion.p
        key={lastSpokenText}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="font-display italic text-lg md:text-xl text-foreground/80 text-center max-w-lg px-6 mb-6 min-h-[2em]"
      >
        {lastSpokenText && `"${lastSpokenText}"`}
      </motion.p>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-4">
        {voiceAvailable && (
          <button
            type="button"
            onClick={onStartVoice}
            disabled={isConnecting}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-colors disabled:opacity-70 disabled:cursor-wait ${
              isVoiceConnected
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {isVoiceConnected ? (
              <>
                <MicOff className="w-4 h-4" />
                End Voice Call
              </>
            ) : isConnecting ? (
              <>
                <Mic className="w-4 h-4" />
                Connecting...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Speak with Lenore
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onTypeInstead}
          className="flex items-center gap-2 border border-border text-foreground px-5 py-2.5 rounded-full font-medium text-sm hover:border-primary/40 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          {voiceAvailable ? "Type instead" : "Message Lenore"}
        </button>
      </div>

      {/* Why the call didn't start or didn't last, with the way on in text. */}
      {failure && (
        <div
          role="alert"
          className="mt-4 mx-4 max-w-lg flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
        >
          <p className="flex items-start gap-2 text-foreground">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            {VOICE_FAILURE_MESSAGES[failure]}
          </p>
          <button
            type="button"
            onClick={onContinueInText ?? onTypeInstead}
            className="shrink-0 self-start sm:self-center rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            Continue in text
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceOrb;
