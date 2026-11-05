import { Loader2, Mic, MicOff, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import VoiceFailureNotice from "@/components/chamber/VoiceFailureNotice";
import { INITIAL_VOICE_STATE, type VoiceState } from "@/data/voiceSession";

export type OrbState = "idle" | "listening" | "speaking" | "thinking" | "disabled";

interface VoiceOrbProps {
  orbState: OrbState;
  lastSpokenText: string;
  /** The voice call (src/data/voiceSession.ts). */
  voice?: VoiceState;
  /** Whether voice is set up (VITE_ELEVENLABS_AGENT_ID). Without it there is no voice button at all. */
  hasAgentId: boolean;
  onStartVoice: () => void;
  onEndVoice: () => void;
  /** Puts the cursor in the text input; also how a voice failure is set aside. */
  onTypeInstead: () => void;
}

/** What the line above Lenore's words says while a call is starting or under way. */
function voiceStatusLine(voice: VoiceState): string | null {
  if (voice.status === "connecting") {
    return voice.phase === "microphone" ? "Waiting for your microphone. If your browser asks, allow access." : "Connecting to Lenore...";
  }
  if (voice.status === "active") return voice.speaking ? "Lenore is speaking..." : "Listening...";
  return null;
}

const orbClasses: Record<OrbState, string> = {
  idle: "orb-idle",
  listening: "orb-listening",
  speaking: "orb-speaking",
  thinking: "orb-thinking",
  disabled: "orb-disabled",
};

const VoiceOrb = ({ orbState, lastSpokenText, voice = INITIAL_VOICE_STATE, hasAgentId, onStartVoice, onEndVoice, onTypeInstead }: VoiceOrbProps) => {
  const connecting = voice.status === "connecting";
  const inCall = voice.status === "active";
  const statusLine = voiceStatusLine(voice);

  // The orb itself starts and ends a call, like the button; while one is starting it does nothing.
  const orbClick = !hasAgentId || connecting ? undefined : inCall ? onEndVoice : onStartVoice;
  const orbClassName = `w-24 h-24 md:w-44 md:h-44 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center transition-all duration-500 ${orbClasses[orbState]}`;
  const orbFace = (
    <span className="w-[4.5rem] h-[4.5rem] md:w-36 md:h-36 rounded-full bg-[#07080D] flex items-center justify-center">
      <span className={`block w-12 h-12 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-primary/60 to-primary/20 ${orbState === "speaking" ? "animate-pulse" : ""}`} />
    </span>
  );

  return (
    <div className="relative w-full flex flex-col items-center justify-center py-4 md:py-12" style={{ background: "#07080D" }}>
      {/* Orb. Smaller on a phone, so the workspace below keeps room on a short screen (I-1.1). */}
      <div className="relative mb-3 md:mb-6">
        {/* Thinking rotating arc */}
        {orbState === "thinking" && (
          <div className="absolute inset-[-12px] rounded-full border-2 border-transparent border-t-primary animate-spin" />
        )}
        {/* Listening outer ring pulse */}
        {orbState === "listening" && (
          <div className="absolute inset-[-8px] rounded-full border-2 border-primary/40 animate-ping" />
        )}
        {hasAgentId ? (
          // A toggle for the call, like the buttons below it. While a call is starting it stays focusable but
          // does nothing (aria-disabled), so a keyboard user's focus isn't dropped.
          <button
            type="button"
            data-testid="voice-orb"
            aria-label="Voice call with Lenore"
            aria-pressed={inCall}
            aria-disabled={connecting || undefined}
            onClick={orbClick}
            className={`${orbClassName} ${connecting ? "cursor-wait" : "cursor-pointer"} focus-visible:outline-offset-4`}
          >
            {orbFace}
          </button>
        ) : (
          // Without voice the orb is only a picture.
          <div data-testid="voice-orb" aria-hidden="true" className={orbClassName}>
            {orbFace}
          </div>
        )}
      </div>

      {/* Status indicator */}
      {statusLine && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          role="status"
          className="mb-2 flex items-center gap-2 text-xs text-primary/80 text-center px-6"
        >
          <span className="w-2 h-2 shrink-0 rounded-full bg-primary animate-pulse" />
          {statusLine}
        </motion.div>
      )}

      {/* Last spoken text: two lines on a phone, where the whole conversation is a tap away (MobileTranscript). */}
      <motion.p
        key={lastSpokenText}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="font-display italic text-base md:text-xl text-foreground/80 text-center max-w-lg px-6 mb-3 md:mb-6 min-h-[2em] line-clamp-2 md:line-clamp-none"
      >
        {lastSpokenText && `"${lastSpokenText}"`}
      </motion.p>

      {voice.status === "failed" && (
        <VoiceFailureNotice failure={voice.failure} onRetry={onStartVoice} onContinueInText={onTypeInstead} />
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-4">
        {/* Voice is offered only when it is set up: a prospect never sees how to set it up. */}
        {hasAgentId && (
          inCall ? (
            <button
              type="button"
              onClick={onEndVoice}
              className="tap-target flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-colors bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <MicOff className="w-4 h-4" />
              End voice call
            </button>
          ) : connecting ? (
            <>
              {/* Disabled, so a second click starts nothing; cancelling is its own, smaller button. */}
              <button
                type="button"
                disabled
                className="tap-target flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm bg-primary/60 text-primary-foreground cursor-wait"
              >
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Connecting...
              </button>
              <button
                type="button"
                onClick={onEndVoice}
                className="tap-target text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStartVoice}
              className="tap-target flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Mic className="w-4 h-4" />
              Speak with Lenore
            </button>
          )
        )}
        <button
          type="button"
          onClick={onTypeInstead}
          className="tap-target flex items-center gap-2 border border-border text-foreground px-5 py-2.5 rounded-full font-medium text-sm hover:border-primary/40 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Type instead
        </button>
      </div>
    </div>
  );
};

export default VoiceOrb;
