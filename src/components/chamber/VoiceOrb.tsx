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

  return (
    // A compact band, not a hero: the form below it is what the prospect fills in, so it gets the screen. The band
    // clips the orb's glow (overflow-hidden) rather than letting it spill over the bar above and the tabs below.
    <div className="relative w-full flex-shrink-0 overflow-hidden px-4 py-3 md:py-4" style={{ background: "#07080D" }}>
      <div className="mx-auto flex w-full max-w-3xl items-center gap-4 md:gap-6">
        {/* Orb */}
        <div className="relative shrink-0">
          {/* Thinking rotating arc */}
          {orbState === "thinking" && (
            <div className="absolute inset-[-6px] rounded-full border-2 border-transparent border-t-primary animate-spin" />
          )}
          {/* Listening outer ring pulse */}
          {orbState === "listening" && (
            <div className="absolute inset-[-4px] rounded-full border-2 border-primary/40 animate-ping" />
          )}
          <div
            data-testid="voice-orb"
            className={`w-16 h-16 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center transition-all duration-500 ${orbClick ? "cursor-pointer" : ""} ${orbClasses[orbState]}`}
            onClick={orbClick}
          >
            <div className="w-12 h-12 md:w-[4.5rem] md:h-[4.5rem] rounded-full bg-[#07080D] flex items-center justify-center">
              <div className={`w-8 h-8 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-primary/60 to-primary/20 ${orbState === "speaking" ? "animate-pulse" : ""}`} />
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* Status indicator */}
          {statusLine && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              role="status"
              className="mb-1 flex items-center gap-2 text-xs text-primary/80"
            >
              <span className="w-2 h-2 shrink-0 rounded-full bg-primary animate-pulse" />
              {statusLine}
            </motion.div>
          )}

          {/* Last spoken text: the whole of it is in the conversation, so a long line is cut short here. */}
          <motion.p
            key={lastSpokenText}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="font-display italic text-sm md:text-lg leading-snug text-foreground/80 line-clamp-3 mb-2 md:mb-3 min-h-[1.5em]"
          >
            {lastSpokenText && `"${lastSpokenText}"`}
          </motion.p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {/* Voice is offered only when it is set up: a prospect never sees how to set it up. */}
            {hasAgentId && (
              inCall ? (
                <button
                  type="button"
                  onClick={onEndVoice}
                  className="flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-full font-medium text-xs md:text-sm transition-colors bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                    className="flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-full font-medium text-xs md:text-sm bg-primary/60 text-primary-foreground cursor-wait"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Connecting...
                  </button>
                  <button
                    type="button"
                    onClick={onEndVoice}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onStartVoice}
                  className="flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-full font-medium text-xs md:text-sm transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Mic className="w-4 h-4" />
                  Speak with Lenore
                </button>
              )
            )}
            <button
              type="button"
              onClick={onTypeInstead}
              className="flex items-center gap-2 border border-border text-foreground px-4 py-2 md:px-5 md:py-2.5 rounded-full font-medium text-xs md:text-sm hover:border-primary/40 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Type instead
            </button>
          </div>
        </div>
      </div>

      {voice.status === "failed" && (
        <div className="mx-auto mt-3 w-full max-w-3xl">
          <VoiceFailureNotice failure={voice.failure} onRetry={onStartVoice} onContinueInText={onTypeInstead} />
        </div>
      )}
    </div>
  );
};

export default VoiceOrb;
