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
  /** The slim bar the prospect folded the stage into: a small orb, her latest line and the voice button on one row. */
  compact?: boolean;
  /** The orb's diameter while the stage is open (src/data/stageLayout.ts). */
  orbSize?: number;
  /** The id the stage's handle points at. */
  id?: string;
  /** It sits in the conversation's column, not across the page: her words get a third line instead of a wider
   * measure, and the folded bar's voice button is an icon. */
  narrow?: boolean;
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

// The glows above are sized for a big orb; a small one gets the same states with small glows.
const smallOrbClasses: Record<OrbState, string> = {
  idle: "orb-small-idle",
  listening: "orb-small-listening",
  speaking: "orb-small-speaking",
  thinking: "orb-small-thinking",
  disabled: "orb-small-disabled",
};
const SMALL_ORB = 96;

const DEFAULT_ORB_SIZE = 120;
const COMPACT_ORB_SIZE = 32;

interface OrbProps {
  size: number;
  orbState: OrbState;
  onClick?: () => void;
}

/** The orb, at any size: its rings and the dark core scale with the diameter. */
const Orb = ({ size, orbState, onClick }: OrbProps) => {
  const thinkingInset = Math.max(3, Math.round(size * 0.07));
  const listeningInset = Math.max(2, Math.round(size * 0.045));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Thinking rotating arc */}
      {orbState === "thinking" && (
        <div
          className="absolute rounded-full border-2 border-transparent border-t-primary animate-spin"
          style={{ inset: -thinkingInset }}
        />
      )}
      {/* Listening outer ring pulse */}
      {orbState === "listening" && (
        <div className="absolute rounded-full border-2 border-primary/40 animate-ping" style={{ inset: -listeningInset }} />
      )}
      <div
        data-testid="voice-orb"
        className={`w-full h-full rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center transition-all duration-500 ${onClick ? "cursor-pointer" : ""} ${(size < SMALL_ORB ? smallOrbClasses : orbClasses)[orbState]}`}
        onClick={onClick}
      >
        <div className="rounded-full bg-[#07080D] flex items-center justify-center" style={{ width: size * 0.82, height: size * 0.82 }}>
          <div
            className={`rounded-full bg-gradient-to-br from-primary/60 to-primary/20 ${orbState === "speaking" ? "animate-pulse" : ""}`}
            style={{ width: size * 0.64, height: size * 0.64 }}
          />
        </div>
      </div>
    </div>
  );
};

const VoiceOrb = ({
  orbState,
  lastSpokenText,
  voice = INITIAL_VOICE_STATE,
  hasAgentId,
  onStartVoice,
  onEndVoice,
  onTypeInstead,
  compact = false,
  orbSize = DEFAULT_ORB_SIZE,
  id,
  narrow = false,
}: VoiceOrbProps) => {
  const connecting = voice.status === "connecting";
  const inCall = voice.status === "active";
  const statusLine = voiceStatusLine(voice);

  // The orb itself starts and ends a call, like the button; while one is starting it does nothing.
  const orbClick = !hasAgentId || connecting ? undefined : inCall ? onEndVoice : onStartVoice;

  const failureNotice = voice.status === "failed" && (
    <VoiceFailureNotice failure={voice.failure} onRetry={onStartVoice} onContinueInText={onTypeInstead} />
  );

  if (compact) {
    // One row. Voice is offered only when it is set up, and the words on its buttons fold into their icons when
    // there is no room; they stay as the buttons' names.
    const label = narrow ? "sr-only" : "max-sm:sr-only";
    // An icon alone is a square-ish pill; with its words (wide screens) it is a longer one.
    const pill = narrow ? "px-3" : "px-3 sm:px-4";
    return (
      <div id={id} className="w-full" style={{ background: "#07080D" }}>
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="p-1">
            <Orb size={COMPACT_ORB_SIZE} orbState={orbState} onClick={orbClick} />
          </div>
          <div className="min-w-0 flex-1">
            {statusLine && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                role="status"
                className="flex items-center gap-2 text-xs text-primary/80"
              >
                <span className="w-2 h-2 shrink-0 rounded-full bg-primary animate-pulse" />
                <span className={narrow ? "line-clamp-2" : "truncate"}>{statusLine}</span>
              </motion.p>
            )}
            <motion.p
              key={lastSpokenText}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              title={lastSpokenText}
              className={`${narrow ? "line-clamp-2" : "truncate"} font-display italic text-sm text-foreground/80`}
            >
              {lastSpokenText && `"${lastSpokenText}"`}
            </motion.p>
          </div>
          {hasAgentId &&
            (inCall ? (
              <button
                type="button"
                onClick={onEndVoice}
                title="End voice call"
                className={`shrink-0 flex items-center gap-2 ${pill} py-2 rounded-full font-medium text-sm transition-colors bg-destructive text-destructive-foreground hover:bg-destructive/90`}
              >
                <MicOff className="w-4 h-4" />
                <span className={label}>End voice call</span>
              </button>
            ) : connecting ? (
              <>
                <button
                  type="button"
                  disabled
                  className={`shrink-0 flex items-center gap-2 ${pill} py-2 rounded-full font-medium text-sm bg-primary/60 text-primary-foreground cursor-wait`}
                >
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span className={label}>Connecting...</span>
                  </button>
                <button
                  type="button"
                  onClick={onEndVoice}
                  className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onStartVoice}
                title="Speak with Lenore"
                className={`shrink-0 flex items-center gap-2 ${pill} py-2 rounded-full font-medium text-sm transition-colors bg-primary text-primary-foreground hover:bg-primary/90`}
              >
                <Mic className="w-4 h-4" />
                <span className={label}>Speak with Lenore</span>
              </button>
            ))}
        </div>
        {failureNotice}
      </div>
    );
  }

  return (
    <div id={id} className="relative w-full flex flex-col items-center justify-center py-5" style={{ background: "#07080D" }}>
      <div className="mb-4">
        <Orb size={orbSize} orbState={orbState} onClick={orbClick} />
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

      {/* Last spoken text. Two lines (three in a column) whatever its length, so a longer reply doesn't move what is below. */}
      <motion.p
        key={lastSpokenText}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        title={lastSpokenText}
        className={`font-display italic text-foreground/80 text-center mb-3 ${
          narrow ? "text-base leading-6 px-5 min-h-[4.5rem] line-clamp-3" : "text-base md:text-lg leading-[1.625rem] max-w-xl px-6 min-h-[3.25rem] line-clamp-2"
        }`}
      >
        {lastSpokenText && `"${lastSpokenText}"`}
      </motion.p>

      {failureNotice}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-4">
        {/* Voice is offered only when it is set up: a prospect never sees how to set it up. */}
        {hasAgentId && (
          inCall ? (
            <button
              type="button"
              onClick={onEndVoice}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-colors bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm bg-primary/60 text-primary-foreground cursor-wait"
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Mic className="w-4 h-4" />
              Speak with Lenore
            </button>
          )
        )}
        <button
          type="button"
          onClick={onTypeInstead}
          className="flex items-center gap-2 border border-border text-foreground px-5 py-2.5 rounded-full font-medium text-sm hover:border-primary/40 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Type instead
        </button>
      </div>
    </div>
  );
};

export default VoiceOrb;
