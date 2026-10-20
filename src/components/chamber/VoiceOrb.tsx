import { useState } from "react";
import { Mic, MicOff, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

export type OrbState = "idle" | "listening" | "speaking" | "thinking" | "disabled";

interface VoiceOrbProps {
  orbState: OrbState;
  lastSpokenText: string;
  onStartVoice: () => void;
  onTypeInstead: () => void;
  hasAgentId: boolean;
  isVoiceConnected?: boolean;
}

const VoiceOrb = ({ orbState, lastSpokenText, onStartVoice, onTypeInstead, hasAgentId, isVoiceConnected = false }: VoiceOrbProps) => {
  const [showStubModal, setShowStubModal] = useState(false);

  const handleVoiceClick = () => {
    if (!hasAgentId) {
      setShowStubModal(true);
    } else {
      onStartVoice();
    }
  };

  const orbClasses = {
    idle: "orb-idle",
    listening: "orb-listening",
    speaking: "orb-speaking",
    thinking: "orb-thinking",
    disabled: "orb-disabled",
  };

  return (
    <div className="relative w-full flex flex-col items-center justify-center py-8 md:py-12" style={{ background: "#07080D" }}>
      {/* Orb */}
      <div className="relative mb-6">
        {/* Thinking rotating arc */}
        {orbState === "thinking" && (
          <div className="absolute inset-[-12px] rounded-full border-2 border-transparent border-t-primary animate-spin" />
        )}
        {/* Listening outer ring pulse */}
        {orbState === "listening" && (
          <div className="absolute inset-[-8px] rounded-full border-2 border-primary/40 animate-ping" />
        )}
        <div
          className={`w-36 h-36 md:w-44 md:h-44 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center cursor-pointer transition-all duration-500 ${orbClasses[orbState]}`}
          onClick={handleVoiceClick}
        >
          <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-[#07080D] flex items-center justify-center">
            <div className={`w-20 h-20 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-primary/60 to-primary/20 ${orbState === "speaking" ? "animate-pulse" : ""}`} />
          </div>
        </div>
      </div>

      {/* Status indicator */}
      {isVoiceConnected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-2 flex items-center gap-2 text-xs text-primary/80"
        >
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {orbState === "listening" && "Listening..."}
          {orbState === "speaking" && "Lenore is speaking..."}
          {orbState === "thinking" && "Thinking..."}
          {orbState === "idle" && "Connected"}
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
      <div className="flex items-center gap-3">
        <button
          onClick={handleVoiceClick}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-colors ${
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
          ) : (
            <>
              <Mic className="w-4 h-4" />
              Speak with Lenore
            </>
          )}
        </button>
        <button
          onClick={onTypeInstead}
          className="flex items-center gap-2 border border-border text-foreground px-5 py-2.5 rounded-full font-medium text-sm hover:border-primary/40 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Type instead
        </button>
      </div>

      {/* Stub modal when no agent ID */}
      {showStubModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowStubModal(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <Mic className="w-10 h-10 text-warning mx-auto mb-3" />
              <h3 className="font-display text-xl font-bold mb-2">Lenore's Voice Is Being Trained</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                To activate voice:
              </p>
              <ol className="text-sm text-muted-foreground text-left mt-3 space-y-2 list-decimal list-inside">
                <li>Build your agent at <span className="text-primary">elevenlabs.io/app/conversational-ai</span></li>
                <li>Paste the Lenore system prompt from your setup docs</li>
                <li>Add <code className="text-xs bg-muted px-1.5 py-0.5 rounded">VITE_ELEVENLABS_AGENT_ID</code> to Lovable environment</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-3">Recommended voice: Aria or Rachel</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowStubModal(false); onTypeInstead(); }}
                className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Use Text Chat Instead
              </button>
              <button
                onClick={() => setShowStubModal(false)}
                className="flex-1 border border-border py-2.5 rounded-lg text-sm font-medium hover:border-primary/40 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default VoiceOrb;
