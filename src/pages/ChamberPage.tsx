import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useLenoreVoice } from "@/hooks/useLenoreVoice";
import { useLenoreChat } from "@/hooks/useLenoreChat";
import { useChamberSession } from "@/hooks/useChamberSession";
import VoiceOrb from "@/components/chamber/VoiceOrb";
import type { OrbState } from "@/components/chamber/VoiceOrb";
import TranscriptPanel from "@/components/chamber/TranscriptPanel";
import MobileTranscript from "@/components/chamber/MobileTranscript";
import ChatFailureNotice from "@/components/chamber/ChatFailureNotice";
import SaveStatus from "@/components/chamber/SaveStatus";
import BackupNotice from "@/components/chamber/BackupNotice";
import RecoverIntake from "@/components/chamber/RecoverIntake";
import StartOverButton from "@/components/chamber/StartOverButton";
import LiveWorkspace from "@/components/chamber/workspace/LiveWorkspace";
import LegalLinks from "@/components/LegalLinks";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createChatMessage } from "@/data/chat";
import { isReadyToCertify, READY_MESSAGE, shouldAnnounceReady } from "@/data/followUp";
import { browserStorageWorks } from "@/data/intakeBackup";
import { DRAFT_RETENTION_DAYS } from "@/data/intakeLifecycle";
import { applyExtraction, applyFieldAction, transcriptExtraction, type FieldAction } from "@/data/provenance";
import { voiceContextUpdate } from "@/data/voiceAgent";
import { orbForVoice } from "@/data/voiceSession";

const spokenLine = (text: string) => (text.length > 120 ? text.slice(0, 120) + "..." : text);
const primaryButton = "bg-primary text-primary-foreground font-medium px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors";
const secondaryButton = "border border-border font-medium px-5 py-2.5 rounded-lg hover:bg-muted transition-colors";

/** A full-page message in place of the Chamber, when there is no intake to show. */
const Notice = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
    <div className="text-center max-w-md w-full">
      <h1 className="font-display text-xl font-bold mb-3">{title}</h1>
      {children}
    </div>
  </div>
);

const ChamberPage = () => {
  const isMobile = useIsMobile();
  const { isAnonymous } = useAuth();
  // What the text chat shows on the orb (thinking, then speaking). A voice call starting or under way shows its
  // own state instead (orbForVoice), so the orb follows the call's state machine alone (I-5.1).
  const [chatOrbState, setChatOrbState] = useState<OrbState>("idle");
  // What Lenore last said, under the orb: her latest line in the conversation, or one she just spoke.
  const [lastSpokenText, setLastSpokenText] = useState("");
  const chatInputRef = useRef<HTMLInputElement>(null);
  // Checked once: whether this browser keeps site data, which is what lets the prospect come back.
  const [storageWorks] = useState(browserStorageWorks);

  const [searchParams, setSearchParams] = useSearchParams();
  const {
    sessionId,
    fileId,
    resumeFailed,
    startNew,
    loadFailed,
    retryLoad,
    expired,
    startOver,
    backupOffer,
    restoreBackup,
    discardBackup,
    restoredThrough,
    conversationEpoch,
    chamberData,
    provenance,
    verifiedFields,
    messages,
    isLoading: sessionLoading,
    setChamberData,
    updateIntake,
    addMessage,
    readIntake,
    ensureIntake,
    submit,
    certification,
    chosenPeo,
    choosePeo,
    saveStatus,
    retrySave,
    loadLatest,
    keepMine,
    discardChanges,
    invalidField,
  } = useChamberSession(searchParams.get("session"));

  // Keep the session in the URL so a refresh or "Back to Review" resumes it.
  useEffect(() => {
    if (sessionId && searchParams.get("session") !== sessionId) {
      setSearchParams({ session: sessionId }, { replace: true });
    }
  }, [sessionId, searchParams, setSearchParams]);

  // No intake exists until the prospect starts one (A-1). Once there is deliberately none on screen (after
  // Start over, or a new intake asked for), the address mustn't name the old one, or a reload would try to open
  // it. While a link is being opened, couldn't be, or turned out to have expired, it stays.
  useEffect(() => {
    if (!sessionId && !sessionLoading && !resumeFailed && !loadFailed && !expired && searchParams.get("session")) {
      setSearchParams({}, { replace: true });
    }
  }, [sessionId, sessionLoading, resumeFailed, loadFailed, expired, searchParams, setSearchParams]);

  // The orb repeats Lenore's latest line, so a restored conversation doesn't open with a second hello.
  const latestLenore = [...messages].reverse().find((m) => m.sender === "lenore");
  useEffect(() => {
    if (latestLenore) setLastSpokenText(spokenLine(latestLenore.text));
    // Only when her latest message changes; a line the voice agent spoke in between stays until then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestLenore?.id]);

  const addLenoreMessage = useCallback((text: string) => {
    addMessage(createChatMessage("lenore", text));
    setLastSpokenText(spokenLine(text));
  }, [addMessage]);

  const { send: handleSendMessage, extractSpoken, retry, dismissFailure, failure, pending } = useLenoreChat({
    epoch: conversationEpoch,
    intakeId: sessionId,
    ensureIntake,
    chamberData,
    provenance,
    messages,
    readIntake,
    addUserMessage: (text) => {
      const message = createChatMessage("user", text);
      addMessage(message);
      return message;
    },
    addLenoreMessage,
    onOrbStateChange: setChatOrbState,
    // Typed and spoken alike, every value cites the message it came from; a spoken one is never stored as confirmed
    // (transcriptExtraction, D33).
    onExtracted: (extracted, response, message) =>
      updateIntake((prev) => applyExtraction(prev, extracted, transcriptExtraction(message, response))),
  });

  // What Lenore's voice is told is still open, by label only (D24).
  const voiceContext = useMemo(() => voiceContextUpdate(chamberData, provenance), [chamberData, provenance]);
  // A voice call only holds the conversation: what the prospect says goes through chamber-extract like a typed
  // message (US-2.3b, ADR 0001), and Lenore's own answer is the one she speaks.
  const { voice, startVoice, endVoice, dismissFailure: dismissVoiceFailure, isConnected, hasAgentId } = useLenoreVoice({
    epoch: conversationEpoch,
    intakeId: sessionId,
    onNewMessage: addMessage,
    onLastSpokenText: setLastSpokenText,
    onSpokenMessage: extractSpoken,
    context: voiceContext,
  });

  // The transcript notes when a voice call starts and ends, so whoever reads it can tell which part was
  // spoken. A call still connected when the conversation was replaced (Start over) belongs to the old one.
  const callRef = useRef<{ epoch: unknown } | null>(null);
  useEffect(() => {
    if (isConnected && !callRef.current) {
      callRef.current = { epoch: conversationEpoch };
      addMessage(createChatMessage("system", "Voice call started"));
    } else if (!isConnected && callRef.current) {
      const sameConversation = Object.is(callRef.current.epoch, conversationEpoch);
      callRef.current = null;
      if (sameConversation) addMessage(createChatMessage("system", "Voice call ended"));
    }
  }, [isConnected, conversationEpoch, addMessage]);

  // Lenore says once, when the intake first becomes ready to certify, that it is (US-2.3a, D29), after her own
  // answer to the message that made it so. An intake that was ready when it opened is left alone.
  const ready = isReadyToCertify(chamberData, provenance, verifiedFields);
  const readyBeforeRef = useRef<{ epoch: number; ready: boolean } | null>(null);
  useEffect(() => {
    if (sessionLoading) return;
    const before = readyBeforeRef.current;
    if (!before || before.epoch !== conversationEpoch) {
      readyBeforeRef.current = { epoch: conversationEpoch, ready };
      return;
    }
    if (pending) return;
    readyBeforeRef.current = { epoch: conversationEpoch, ready };
    if (shouldAnnounceReady(before.ready, ready, pending, messages)) addLenoreMessage(READY_MESSAGE);
  }, [ready, pending, sessionLoading, conversationEpoch, messages, addLenoreMessage]);

  // "Continue manually": the prospect fills the intake in themselves, in Review, where every answer can be added.
  const [reviewRequest, setReviewRequest] = useState(0);
  const continueManually = useCallback(() => {
    dismissFailure();
    setReviewRequest((n) => n + 1);
  }, [dismissFailure]);

  const failureNotice = failure && (
    <ChatFailureNotice failure={failure} pending={pending} onRetry={retry} onDismiss={continueManually} />
  );

  const handleFieldAction = useCallback(
    (action: FieldAction) => updateIntake((prev) => applyFieldAction(prev, action)),
    [updateIntake],
  );

  const orbState = orbForVoice(voice) ?? chatOrbState;

  // "Type instead", and "Continue in text" after a voice failure: the notice goes, and the cursor is in the input.
  const handleTypeInstead = () => {
    dismissVoiceFailure();
    chatInputRef.current?.focus();
  };

  if (resumeFailed) {
    // Most often this browser no longer holds the sign-in the intake was started under: another device,
    // a private window, or site data that was cleared. A verified email gets them back to it.
    return (
      <Notice title="We couldn't open that intake">
        <p className="text-muted-foreground mb-6">
          {isAnonymous
            ? "This browser doesn't hold the sign-in it was started with. That happens on another device, in a private window, or after the browser's data is cleared. If you verified your email on it, sign in with that email to get it back."
            : "It belongs to a different account, or it's no longer available. If you started it with another email, sign in with that one."}
          {" "}Nothing has been changed.
        </p>
        <div className="border border-border rounded-xl p-5 mb-6">
          <RecoverIntake idPrefix="recover-linked" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          An intake that never had an email verified can't be recovered from another browser.
        </p>
        <button onClick={startNew} className={secondaryButton}>
          Start a new intake
        </button>
      </Notice>
    );
  }

  if (expired) {
    return (
      <Notice title="This intake has expired">
        <p className="text-muted-foreground mb-6">
          Intakes that haven't been certified are kept for {DRAFT_RETENTION_DAYS} days after the last change.
          {expired.at && ` This one expired on ${new Date(expired.at).toLocaleDateString([], { dateStyle: "long" })}.`}
          {" "}Its answers can no longer be opened. You can start a new intake whenever you're ready.
        </p>
        <button onClick={startNew} className={primaryButton}>
          Start a new intake
        </button>
      </Notice>
    );
  }

  if (loadFailed) {
    return (
      <Notice title="We couldn't load your intake">
        <p className="text-muted-foreground mb-6">
          Something went wrong reaching your saved answers. Nothing has been changed. Try again in a moment,
          or start a new intake.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={retryLoad} className={primaryButton}>
            Try again
          </button>
          <button onClick={startNew} className={secondaryButton}>
            Start a new intake
          </button>
        </div>
      </Notice>
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
      <div className="min-h-12 py-2 border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
        <a href="/" className="font-display text-sm text-foreground hover:text-primary transition-colors">
          Edgar Allan Advisory
        </a>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">The Chamber</span>
        {isAnonymous && !messages.some((m) => m.sender === "user") && (
          // A guest on a fresh intake may be someone back from another browser: offer them their own.
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
                Continue an earlier intake
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Continue an earlier intake</DialogTitle>
                <DialogDescription>
                  Started an intake on another device, or before this browser's data was cleared? If you verified
                  your email on it, sign in with that email and we'll open it.
                </DialogDescription>
              </DialogHeader>
              <RecoverIntake idPrefix="recover-earlier" />
            </DialogContent>
          </Dialog>
        )}
        {sessionId && <StartOverButton onStartOver={startOver} certifiedBefore={certification.status !== "none"} />}
        {ready && certification.status !== "certified" && (
          <span role="status" className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
            Ready for your review
          </span>
        )}
        <SaveStatus
          status={saveStatus}
          onRetry={retrySave}
          onLoadLatest={loadLatest}
          onKeepMine={keepMine}
          onDiscard={discardChanges}
          onStartNew={startNew}
          invalidField={invalidField}
        />
        <LegalLinks compact className="shrink-0" />
      </div>

      {backupOffer && <BackupNotice offer={backupOffer} onRestore={restoreBackup} onDiscard={discardBackup} />}
      {!storageWorks && (
        <div role="alert" className="flex items-center gap-1.5 border-b border-border bg-warning/10 px-4 py-2 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-warning" aria-hidden="true" />
          This browser isn't keeping site data, so you won't be able to come back to this intake after closing the
          tab. Allow site data for this site, or verify your email before you leave.
        </div>
      )}

      {/* Voice Orb */}
      <VoiceOrb
        orbState={orbState}
        lastSpokenText={lastSpokenText}
        voice={voice}
        hasAgentId={hasAgentId}
        onStartVoice={startVoice}
        onEndVoice={endVoice}
        onTypeInstead={handleTypeInstead}
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
            restoredThrough={restoredThrough}
          />
        </div>

        {/* Live workspace */}
        {/* On mobile, keep the workspace clear of the fixed chat bar so its last button stays tappable. */}
        <div className={`${isMobile ? "w-full pb-16" : "flex-1"}`}>
          <LiveWorkspace
            data={chamberData}
            isDemo={false}
            sessionId={sessionId}
            fileId={fileId}
            onSubmit={submit}
            provenance={provenance}
            verified={verifiedFields}
            onFieldAction={handleFieldAction}
            certification={certification}
            updateIntake={updateIntake}
            chosenPeo={chosenPeo}
            onChoosePeo={choosePeo}
            openReview={reviewRequest}
            ensureIntake={ensureIntake}
          />
        </div>
      </div>

      {/* Mobile: floating chat input, and the whole conversation a tap away (the transcript panel has no room) */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-card border-t border-border z-30">
          {failureNotice}
          <div className="flex items-center gap-2">
            <MobileTranscript
              messages={messages}
              onSendMessage={handleSendMessage}
              notice={failureNotice}
              restoredThrough={restoredThrough}
            />
            <div className="flex-1 flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
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
        </div>
      )}
    </div>
  );
};

export default ChamberPage;
