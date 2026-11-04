import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import type { OrbState } from "@/components/chamber/VoiceOrb";
import type { ChatMessage } from "@/data/chat";
import { createChatMessage } from "@/data/chat";
import { VOICE_CONNECT_TIMEOUT_MS, voiceFailureOf, type VoiceFailure } from "@/data/voiceFailure";

// Read when used, so a build without voice configured offers none (US-2.3c).
const agentId = (): string | undefined => import.meta.env.VITE_ELEVENLABS_AGENT_ID || undefined;

interface UseLenoreVoiceOptions {
  onOrbStateChange: (state: OrbState) => void;
  onNewMessage: (msg: ChatMessage) => void;
  onLastSpokenText: (text: string) => void;
  /** `message` is the prospect's message the extraction answers, when there is one. */
  onExtract: (data: unknown, message: ChatMessage | null) => void;
  /**
   * Which conversation this is (useChamberSession's `conversationEpoch`). When it changes, a voice session
   * still open belongs to the old conversation: it is ended, and nothing more it says is kept.
   */
  epoch?: unknown;
}

type Phase = "idle" | "connecting" | "connected";

// A specific reason beats a general one when two arrive for the same attempt (the SDK can report a refused
// microphone both as a dropped socket and as the error its start threw).
const SPECIFICITY: Record<VoiceFailure, number> = { connect_failed: 0, timeout: 1, dropped: 1, mic_unavailable: 2, mic_denied: 2 };

export function useLenoreVoice({
  onOrbStateChange,
  onNewMessage,
  onLastSpokenText,
  onExtract,
  epoch,
}: UseLenoreVoiceOptions) {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const [failure, setFailure] = useState<VoiceFailure | null>(null);
  const failureRef = useRef<VoiceFailure | null>(null);
  const callbacksRef = useRef({ onOrbStateChange, onNewMessage, onLastSpokenText, onExtract });
  const lastUserMessageRef = useRef<ChatMessage | null>(null);
  // The agent opens each voice session with its own hello. Its first line, if it comes before the prospect
  // says anything, is marked as a greeting so the transcript keeps only one (see useChamberSession).
  const awaitingGreetingRef = useRef(false);
  const epochRef = useRef(epoch);
  // The conversation the open voice session was started in.
  const sessionEpochRef = useRef<unknown>(epoch);
  // Set when the Chamber ends the session itself (the prospect's End, a new conversation, a connect it gave up
  // on), so its disconnect isn't taken for a dropped call.
  const endingRef = useRef(false);
  // Which connect attempt is current: one given up on (timed out) is ignored when it finally answers.
  const attemptRef = useRef(0);

  // Keep refs fresh without re-creating the hook
  useEffect(() => {
    callbacksRef.current = { onOrbStateChange, onNewMessage, onLastSpokenText, onExtract };
  });

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const fail = useCallback((kind: VoiceFailure) => {
    const current = failureRef.current;
    if (current && SPECIFICITY[current] > SPECIFICITY[kind]) return;
    failureRef.current = kind;
    setFailure(kind);
  }, []);

  const dismissFailure = useCallback(() => {
    failureRef.current = null;
    setFailure(null);
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      // A connect the Chamber gave up on (it took too long) answers late: end it rather than start a call.
      if (phaseRef.current !== "connecting") {
        endingRef.current = true;
        void conversationRef.current?.endSession();
        return;
      }
      console.log("Lenore voice connected");
      awaitingGreetingRef.current = true;
      sessionEpochRef.current = epochRef.current;
      setPhase("connected");
      callbacksRef.current.onOrbStateChange("listening");
    },
    onDisconnect: (details) => {
      console.log("Lenore voice disconnected");
      const was = phaseRef.current;
      const endedHere = endingRef.current || details?.reason === "user";
      endingRef.current = false;
      if (was === "idle") return;
      setPhase("idle");
      callbacksRef.current.onOrbStateChange("idle");
      if (endedHere) return;
      // Lenore ending the call herself is how a call finishes, not a failure.
      if (was === "connected" && details?.reason !== "agent") fail("dropped");
      if (was === "connecting") fail("connect_failed");
    },
    onMessage: ({ message, role }) => {
      if (!message) return;
      // Still arriving from a session opened in a conversation that has since been replaced.
      if (!Object.is(sessionEpochRef.current, epochRef.current)) return;

      if (role === "user") {
        awaitingGreetingRef.current = false;
        const msg = createChatMessage("user", message, { spoken: true });
        lastUserMessageRef.current = msg;
        callbacksRef.current.onNewMessage(msg);
        return;
      }

      // Lenore's spoken reply may carry structured data in <extract>{...}</extract>;
      // keep that out of the transcript.
      const extractMatch = message.match(/<extract>([\s\S]*?)<\/extract>/);
      if (extractMatch) {
        try {
          callbacksRef.current.onExtract(JSON.parse(extractMatch[1]), lastUserMessageRef.current);
        } catch (e) {
          console.warn("Failed to parse extract:", e);
        }
      }
      const spoken = message.replace(/<extract>[\s\S]*?<\/extract>/g, "").trim();
      if (!spoken) return;
      const greeting = awaitingGreetingRef.current;
      awaitingGreetingRef.current = false;
      callbacksRef.current.onNewMessage(createChatMessage("lenore", spoken, { kind: greeting ? "greeting" : undefined, spoken: true }));
      callbacksRef.current.onLastSpokenText(
        spoken.length > 120 ? spoken.slice(0, 120) + "..." : spoken
      );
    },
    onError: (error) => {
      // A failed connect is reported here as well as by the start it broke; a call that drops is reported by
      // its disconnect, so an error the call survives changes nothing.
      console.error("Lenore voice error:", error);
      if (phaseRef.current === "connecting") fail("connect_failed");
    },
  });
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  // A new conversation: end a voice session that belongs to the old one.
  useEffect(() => {
    if (Object.is(epochRef.current, epoch)) return;
    epochRef.current = epoch;
    if (conversation.status === "connected") {
      endingRef.current = true;
      void conversation.endSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch]);

  // Sync orb state with isSpeaking
  const isConnected = phase === "connected";
  useEffect(() => {
    if (!isConnected) return;
    callbacksRef.current.onOrbStateChange(conversation.isSpeaking ? "speaking" : "listening");
  }, [conversation.isSpeaking, isConnected]);

  const startVoice = useCallback(async () => {
    // A second click while connecting starts nothing.
    if (phaseRef.current === "connecting") return;
    if (phaseRef.current === "connected" || conversation.status === "connected") {
      endingRef.current = true;
      await conversation.endSession();
      return;
    }

    const id = agentId();
    if (!id) return;

    dismissFailure();
    // A connect given up on may never answer, so its "ended here" must not carry over to this call.
    endingRef.current = false;
    const attempt = ++attemptRef.current;
    setPhase("connecting");
    callbacksRef.current.onOrbStateChange("thinking");
    const giveUp = (kind: VoiceFailure) => {
      setPhase("idle");
      callbacksRef.current.onOrbStateChange("idle");
      fail(kind);
    };
    // Nothing spins for longer than this: the attempt is abandoned, and a session it opens late is ended.
    const timer = setTimeout(() => {
      if (attemptRef.current !== attempt || phaseRef.current !== "connecting") return;
      attemptRef.current += 1;
      endingRef.current = true;
      void Promise.resolve(conversationRef.current.endSession()).catch(() => {});
      giveUp("timeout");
    }, VOICE_CONNECT_TIMEOUT_MS);

    try {
      // Check mic permission without acquiring the stream (the SDK manages its own).
      // Firefox and older Safari reject the "microphone" name, so treat a failed
      // query as "unknown" and let the SDK prompt for access.
      const permState = await navigator.permissions
        ?.query({ name: "microphone" as PermissionName })
        .then((p) => p.state)
        .catch(() => "prompt" as const);
      if (attemptRef.current !== attempt) return;
      if (permState === "denied") {
        console.error("Microphone permission denied");
        giveUp("mic_denied");
        return;
      }

      await conversation.startSession({ agentId: id, connectionType: "websocket" });
    } catch (error) {
      console.error("Failed to start voice:", error);
      // Already given up on, or already over (its disconnect said why): only a more specific reason is kept.
      if (attemptRef.current !== attempt) return;
      // Read through a cast: the checks above narrow the ref's type, but callbacks have moved it since.
      if ((phaseRef.current as Phase) === "connected") return;
      giveUp(voiceFailureOf(error));
    } finally {
      clearTimeout(timer);
    }
  }, [conversation, dismissFailure, fail, setPhase]);

  return {
    startVoice,
    isConnected,
    isConnecting: phase === "connecting",
    /** Why the last call didn't start or didn't last, until the prospect dismisses it or calls again. */
    failure,
    dismissFailure,
    /** Whether this build has a voice agent. Without one, voice isn't offered at all. */
    voiceAvailable: Boolean(agentId()),
  };
}
