import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLenoreVoice } from "@/hooks/useLenoreVoice";
import { useChamberSession } from "@/hooks/useChamberSession";
import VoiceOrb from "@/components/chamber/VoiceOrb";
import type { OrbState } from "@/components/chamber/VoiceOrb";
import TranscriptPanel from "@/components/chamber/TranscriptPanel";
import LiveWorkspace from "@/components/chamber/workspace/LiveWorkspace";
import { createChatMessage } from "@/data/chat";
import { mergeChamberData } from "@/data/chamberValidation";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

const ChamberPage = () => {
  const isMobile = useIsMobile();
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [lastSpokenText, setLastSpokenText] = useState("Hi — I'm Lenore. I'll get you through this quickly. Are you here for your own company, or on behalf of a client?");
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const {
    sessionId,
    chamberData,
    messages,
    isLoading: sessionLoading,
    setChamberData,
    addMessage,
    submit,
  } = useChamberSession(searchParams.get("session"));

  // Keep the session in the URL so a refresh or "Back to Review" resumes it.
  useEffect(() => {
    if (sessionId && searchParams.get("session") !== sessionId) {
      setSearchParams({ session: sessionId }, { replace: true });
    }
  }, [sessionId, searchParams, setSearchParams]);

  const addLenoreMessage = useCallback((text: string) => {
    addMessage(createChatMessage("lenore", text));
    setLastSpokenText(text.length > 120 ? text.slice(0, 120) + "..." : text);
  }, [addMessage]);

  const { startVoice, isConnected, hasAgentId } = useLenoreVoice({
    onOrbStateChange: setOrbState,
    onNewMessage: addMessage,
    onLastSpokenText: setLastSpokenText,
    onExtract: (data) => setChamberData((prev) => mergeChamberData(prev, data)),
  });

  const handleSendMessage = useCallback(async (text: string) => {
    addMessage(createChatMessage("user", text));

    setOrbState("thinking");

    try {
      // The roster isn't extracted from chat and can be large, so leave it out of the context.
      const { employees: _employees, ...context } = chamberData;
      const { data: fnData, error: fnError } = await supabase.functions.invoke("chamber-extract", {
        body: { message: text, context },
      });

      if (fnError) throw fnError;

      if (fnData?.extracted) {
        setChamberData((prev) => mergeChamberData(prev, fnData.extracted));
      }

      const reply = (typeof fnData?.reply === "string" && fnData.reply.trim()) || "I've noted that. Could you tell me more about your team?";
      setOrbState("speaking");
      addLenoreMessage(reply);
      setTimeout(() => setOrbState("idle"), 2000);
    } catch (err) {
      console.error("Extraction error:", err);
      setOrbState("idle");
      if (err instanceof FunctionsHttpError && err.context?.status === 429) {
        addLenoreMessage("Let's take a breath — you're writing faster than I can keep up. Give me a minute, then continue.");
        return;
      }
      addLenoreMessage("I caught that. Tell me more — how many employees are you looking to cover?");
    }
  }, [addLenoreMessage, addMessage, chamberData, setChamberData]);

  const handleTypeInstead = () => {
    chatInputRef.current?.focus();
  };

  if (sessionLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="h-12 border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
        <a href="/" className="font-display text-sm text-foreground hover:text-primary transition-colors">
          Edgar Allan Advisory
        </a>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">The Chamber</span>
      </div>

      {/* Voice Orb */}
      <VoiceOrb
        orbState={orbState}
        lastSpokenText={lastSpokenText}
        onStartVoice={startVoice}
        onTypeInstead={handleTypeInstead}
        hasAgentId={hasAgentId}
        isVoiceConnected={isConnected}
      />

      {/* Transcript & Workspace */}
      <div className="flex-1 flex overflow-hidden border-t border-border">
        {/* Transcript panel */}
        <div className={`${isMobile ? "hidden" : "w-[30%] min-w-[280px]"}`}>
          <TranscriptPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            inputRef={chatInputRef}
          />
        </div>

        {/* Live workspace */}
        <div className={`${isMobile ? "w-full" : "flex-1"}`}>
          <LiveWorkspace data={chamberData} isDemo={false} sessionId={sessionId} onSubmit={submit} />
        </div>
      </div>

      {/* Mobile: floating chat input */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-card border-t border-border z-30">
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
            <input
              ref={chatInputRef}
              type="text"
              placeholder="Message Lenore..."
              maxLength={2000}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                  handleSendMessage((e.target as HTMLInputElement).value.trim());
                  (e.target as HTMLInputElement).value = "";
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChamberPage;
