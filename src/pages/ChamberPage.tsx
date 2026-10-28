import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLenoreVoice } from "@/hooks/useLenoreVoice";
import { useLenoreChat } from "@/hooks/useLenoreChat";
import { useChamberSession } from "@/hooks/useChamberSession";
import VoiceOrb from "@/components/chamber/VoiceOrb";
import type { OrbState } from "@/components/chamber/VoiceOrb";
import TranscriptPanel from "@/components/chamber/TranscriptPanel";
import ChatFailureNotice from "@/components/chamber/ChatFailureNotice";
import SaveStatus from "@/components/chamber/SaveStatus";
import LiveWorkspace from "@/components/chamber/workspace/LiveWorkspace";
import { createChatMessage } from "@/data/chat";
import { mergeChamberData } from "@/data/chamberValidation";
import { applyExtraction, applyFieldAction, transcriptExtraction, type FieldAction } from "@/data/provenance";

const ChamberPage = () => {
  const isMobile = useIsMobile();
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [lastSpokenText, setLastSpokenText] = useState("Hi — I'm Lenore. I'll get you through this quickly. Are you here for your own company, or on behalf of a client?");
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const {
    sessionId,
    resumeFailed,
    startNew,
    chamberData,
    provenance,
    messages,
    isLoading: sessionLoading,
    setChamberData,
    updateIntake,
    addMessage,
    submit,
    certification,
    saveStatus,
    retrySave,
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
    // Voice extractions with no prospect message to point to keep the old, untracked merge.
    onExtract: (data, message) =>
      message
        ? updateIntake((prev) => applyExtraction(prev, data, transcriptExtraction(message, data)))
        : setChamberData((prev) => mergeChamberData(prev, data)),
  });

  const { send: handleSendMessage, retry, dismissFailure, failure, pending } = useLenoreChat({
    chamberData,
    setChamberData,
    addUserMessage: (text) => {
      const message = createChatMessage("user", text);
      addMessage(message);
      return message;
    },
    addLenoreMessage,
    onOrbStateChange: setOrbState,
    onExtracted: (extracted, response, message) =>
      updateIntake((prev) => applyExtraction(prev, extracted, transcriptExtraction(message, response))),
  });

  const failureNotice = failure && (
    <ChatFailureNotice failure={failure} pending={pending} onRetry={retry} onDismiss={dismissFailure} />
  );

  const handleFieldAction = useCallback(
    (action: FieldAction) => updateIntake((prev) => applyFieldAction(prev, action)),
    [updateIntake],
  );

  const handleTypeInstead = () => {
    chatInputRef.current?.focus();
  };

  if (resumeFailed) {
    return (
      <div className="h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <h1 className="font-display text-xl font-bold mb-3">We couldn't open that intake</h1>
          <p className="text-muted-foreground mb-6">
            The link may be out of date, or it belongs to a different account. Nothing has been changed.
            You can start a new intake, or sign in with the account you started it on.
          </p>
          <button
            onClick={startNew}
            className="bg-primary text-primary-foreground font-medium px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Start a new intake
          </button>
        </div>
      </div>
    );
  }

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
        <SaveStatus status={saveStatus} onRetry={retrySave} />
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
            notice={failureNotice}
          />
        </div>

        {/* Live workspace */}
        {/* On mobile, keep the workspace clear of the fixed chat bar so its last button stays tappable. */}
        <div className={`${isMobile ? "w-full pb-16" : "flex-1"}`}>
          <LiveWorkspace
            data={chamberData}
            isDemo={false}
            sessionId={sessionId}
            onSubmit={submit}
            provenance={provenance}
            onFieldAction={handleFieldAction}
            certification={certification}
            updateIntake={updateIntake}
          />
        </div>
      </div>

      {/* Mobile: floating chat input */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-card border-t border-border z-30">
          {failureNotice}
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
