import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation, type DisconnectionDetails } from "@elevenlabs/react";
import type { ChatMessage } from "@/data/chat";
import { createChatMessage } from "@/data/chat";
import {
  INITIAL_VOICE_STATE,
  VOICE_CONNECT_TIMEOUT_MS,
  failureFromStartError,
  reduceVoice,
  voiceFailureCode,
  type VoiceEvent,
  type VoiceState,
} from "@/data/voiceSession";
import { errorDetail, reportOpsEvent } from "@/lib/monitoring";

const AGENT_ID: string | undefined = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

// Tags an older voice prompt had Lenore write into her replies (`<extract>{...}</extract>`). They are never read
// (ADR 0001): they are only kept out of the transcript and the orb. One left unclosed runs to the end of the reply.
const EXTRACT_TAGS = /<extract>[\s\S]*?(<\/extract>|$)|<\/extract>/g;

interface UseLenoreVoiceOptions {
  onNewMessage: (msg: ChatMessage) => void;
  onLastSpokenText: (text: string) => void;
  /**
   * Something the prospect finished saying, already handed to onNewMessage, for its answers to be taken through
   * chamber-extract (US-2.3b, ADR 0001: useLenoreChat's `extractSpoken`). The intake update is sent again once it
   * settles, worked or not.
   */
  onSpokenMessage: (msg: ChatMessage) => Promise<unknown> | void;
  /**
   * The intake update for Lenore's voice (`voiceContextUpdate`): the fields to ask about next and those settled, by
   * label only (D24). Sent when a call connects, whenever it changes during the call, and after every spoken message
   * has been through extraction.
   */
  context: string;
  /**
   * Which conversation this is (useChamberSession's `conversationEpoch`). When it changes, a voice call starting
   * or under way belongs to the old conversation: it is ended, and nothing more it says is kept.
   */
  epoch?: unknown;
  /** The intake a failure is reported against (docs/RUNBOOK.md, `voice_failed`). */
  intakeId?: string | null;
}

/** What a failure report carries besides its kind: never anything the prospect said. */
interface FailureInfo {
  detail?: string;
  closeCode?: number;
}

const endQuietly = (end: () => Promise<void>) => {
  // The call is being abandoned; a hang-up that fails or never finishes changes nothing here.
  void end().catch(() => undefined);
};

/**
 * Lenore's voice (ElevenLabs), driven by the state machine in src/data/voiceSession.ts. Every SDK callback is
 * bound to the attempt that opened it and becomes an event of that attempt, so a late callback from an attempt
 * that timed out or was cancelled changes nothing. See docs/VOICE_ISSUES.md for the failures this handles.
 */
export function useLenoreVoice({ onNewMessage, onLastSpokenText, onSpokenMessage, context, epoch, intakeId }: UseLenoreVoiceOptions) {
  const callbacksRef = useRef({ onNewMessage, onLastSpokenText, onSpokenMessage, intakeId });
  // The state is read synchronously by callbacks (a second click, a late SDK event) as well as rendered.
  const stateRef = useRef<VoiceState>(INITIAL_VOICE_STATE);
  const [state, setState] = useState<VoiceState>(INITIAL_VOICE_STATE);
  // The agent opens each voice session with its own hello. Its first line, if it comes before the prospect
  // says anything, is marked as a greeting so the transcript keeps only one (see useChamberSession).
  const awaitingGreetingRef = useRef(false);
  // The attempt whose words are kept: the last one that connected, until the conversation is replaced. Words
  // still arriving from it after the prospect hung up are kept; an attempt that never connected is never heard.
  const heardAttemptRef = useRef<number | null>(null);
  const epochRef = useRef(epoch);
  // Lenore hears the update after every spoken message's extraction. When nothing was sent since the message arrived
  // (its answers changed nothing, or it failed), this is raised to send the same update again.
  const [resend, setResend] = useState(0);
  // The update last sent in this call, and for which resend: nothing is sent twice for the same moment.
  const lastSentRef = useRef<{ text: string; resend: number } | null>(null);
  // How many updates have gone, so a settling extraction can tell whether one went since its message arrived.
  const sentCountRef = useRef(0);

  // Keep refs fresh without re-creating the hook
  useEffect(() => {
    callbacksRef.current = { onNewMessage, onLastSpokenText, onSpokenMessage, intakeId };
  });

  // No hook-level callbacks: each attempt passes its own to startSession.
  const conversation = useConversation();
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  /** Applies an event. Returns whether it changed the state; a failure it causes is logged and reported. */
  const dispatch = useCallback((event: VoiceEvent, info: FailureInfo = {}): boolean => {
    const before = stateRef.current;
    const after = reduceVoice(before, event);
    if (after === before) return false;
    stateRef.current = after;
    setState(after);
    if (after.status === "failed") {
      console.warn(`Lenore voice failed: ${after.failure}`, info.detail ?? "");
      const code = voiceFailureCode(after.failure, info.closeCode);
      if (code) reportOpsEvent("voice_failed", { code, detail: info.detail, sessionId: callbacksRef.current.intakeId });
    }
    return true;
  }, []);

  const handleMessage = useCallback((attempt: number, message: string, role: string) => {
    if (!message || heardAttemptRef.current !== attempt) return;

    if (role === "user") {
      awaitingGreetingRef.current = false;
      const msg = createChatMessage("user", message, { spoken: true });
      callbacksRef.current.onNewMessage(msg);
      // Its answers go through chamber-extract like a typed message's, then Lenore hears what is still open. When
      // they changed the update, it has gone already (the change sends it); otherwise it goes again now. Not for a
      // call the conversation has since left behind.
      const sentBefore = sentCountRef.current;
      void Promise.resolve(callbacksRef.current.onSpokenMessage(msg))
        .catch((e) => console.error("Couldn't take the answers from a spoken message:", e))
        .finally(() => {
          if (heardAttemptRef.current === attempt && sentCountRef.current === sentBefore) setResend((n) => n + 1);
        });
      return;
    }

    const spoken = message.replace(EXTRACT_TAGS, "").trim();
    if (!spoken) return;
    const greeting = awaitingGreetingRef.current;
    awaitingGreetingRef.current = false;
    callbacksRef.current.onNewMessage(createChatMessage("lenore", spoken, { kind: greeting ? "greeting" : undefined, spoken: true }));
    callbacksRef.current.onLastSpokenText(spoken.length > 120 ? spoken.slice(0, 120) + "..." : spoken);
  }, []);

  /** Starts a call. Does nothing while one is starting or under way, or when voice isn't set up. */
  const startVoice = useCallback(async () => {
    if (!AGENT_ID) return;
    if (!dispatch({ type: "start" })) return;
    const attempt = stateRef.current.attempt;
    const stillConnecting = () => stateRef.current.status === "connecting" && stateRef.current.attempt === attempt;

    // 1. The microphone. Asked for here, before any connection, so the permission prompt isn't timed; the
    // voice service asks again when it connects, and is then answered at once.
    const media = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    if (typeof media?.getUserMedia !== "function") {
      dispatch({ type: "failed", attempt, failure: "unsupported" });
      return;
    }
    try {
      const stream = await media.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      dispatch({ type: "failed", attempt, failure: failureFromStartError(error, "microphone") }, { detail: errorDetail(error) });
      return;
    }
    // Cancelled while the browser asked, or the conversation was replaced: connect nothing.
    if (!stillConnecting()) return;
    dispatch({ type: "microphone_ready", attempt });

    // 2. The connection, which the effect below times out.
    try {
      await conversationRef.current.startSession({
        agentId: AGENT_ID,
        connectionType: "websocket",
        onConnect: () => {
          if (!dispatch({ type: "connected", attempt })) return;
          heardAttemptRef.current = attempt;
          awaitingGreetingRef.current = true;
        },
        onDisconnect: (details: DisconnectionDetails) => {
          const info: FailureInfo = details.reason === "user" ? {} : { closeCode: details.closeCode, detail: details.reason === "error" ? details.message : details.closeReason };
          dispatch({ type: "disconnected", attempt, reason: details.reason }, info);
        },
        onModeChange: ({ mode }) => dispatch({ type: "mode", attempt, speaking: mode === "speaking" }),
        onMessage: ({ message, role }) => handleMessage(attempt, message, role),
        // An error the service reports during a call doesn't end it (a close does, through onDisconnect), so
        // the call carries on; it is reported, because a run of them is how a degrading service shows.
        onError: (message: string) => {
          if (stateRef.current.status !== "active" || stateRef.current.attempt !== attempt) return;
          console.warn("Lenore voice error:", message);
          reportOpsEvent("voice_failed", { code: "voice_error", detail: message, sessionId: callbacksRef.current.intakeId });
        },
      });
    } catch (error) {
      // After a timeout or a cancel the attempt is already settled, and this changes nothing.
      dispatch({ type: "failed", attempt, failure: failureFromStartError(error, "server") }, { detail: errorDetail(error) });
    }
  }, [dispatch, handleMessage]);

  /** Hangs up a call, or cancels one that is starting. */
  const endVoice = useCallback(() => {
    const s = stateRef.current;
    if (s.status === "connecting") {
      dispatch({ type: "cancel" });
      if (s.phase === "server") endQuietly(conversationRef.current.endSession);
    } else if (s.status === "active") {
      // The button answers at once; the service's own hang-up then finds the call already ended.
      dispatch({ type: "disconnected", attempt: s.attempt, reason: "user" });
      endQuietly(conversationRef.current.endSession);
    }
  }, [dispatch]);

  /** Clears a failure (or a finished call) so the orb is plain again, e.g. when the prospect carries on in text. */
  const dismissFailure = useCallback(() => {
    dispatch({ type: "dismiss" });
  }, [dispatch]);

  // Tell Lenore's voice what is open (D24): when the call connects, when it changes, and after each spoken message.
  const callActive = state.status === "active";
  useEffect(() => {
    if (!callActive) {
      lastSentRef.current = null;
      return;
    }
    const last = lastSentRef.current;
    if (last && last.text === context && last.resend === resend) return;
    lastSentRef.current = { text: context, resend };
    try {
      conversationRef.current.sendContextualUpdate(context);
      sentCountRef.current += 1;
    } catch (e) {
      // The call carries on; the next change or spoken message sends it again.
      console.warn("Couldn't send Lenore the intake update:", e);
      lastSentRef.current = null;
    }
  }, [callActive, context, resend]);

  // Connecting is bounded: if the connection hasn't opened 15 seconds after the microphone was ready, the
  // attempt fails and the pending connection is abandoned.
  const timedAttempt = state.status === "connecting" && state.phase === "server" ? state.attempt : null;
  useEffect(() => {
    if (timedAttempt === null) return;
    const timer = setTimeout(() => {
      if (dispatch({ type: "failed", attempt: timedAttempt, failure: "connect_timeout" }, { detail: `no connection after ${VOICE_CONNECT_TIMEOUT_MS / 1000}s` })) {
        endQuietly(conversationRef.current.endSession);
      }
    }, VOICE_CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [timedAttempt, dispatch]);

  // Leaving the Chamber settles the attempt, so a microphone prompt answered after the page has gone connects
  // nothing (the SDK ends a connection already opening when it unmounts).
  useEffect(
    () => () => {
      stateRef.current = reduceVoice(stateRef.current, { type: "cancel" });
      heardAttemptRef.current = null;
    },
    [],
  );

  // A new conversation: end a voice call that belongs to the old one, and keep nothing more it says.
  useEffect(() => {
    if (Object.is(epochRef.current, epoch)) return;
    epochRef.current = epoch;
    heardAttemptRef.current = null;
    const s = stateRef.current;
    dispatch({ type: "cancel" });
    const connectionOpen = s.status === "active" || (s.status === "connecting" && s.phase === "server");
    if (connectionOpen || conversationRef.current.status === "connected") endQuietly(conversationRef.current.endSession);
  }, [epoch, dispatch]);

  return {
    /** The call's state (src/data/voiceSession.ts). */
    voice: state,
    startVoice,
    endVoice,
    dismissFailure,
    isConnected: state.status === "active",
    hasAgentId: !!AGENT_ID,
  };
}
