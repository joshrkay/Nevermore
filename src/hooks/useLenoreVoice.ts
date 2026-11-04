import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import type { OrbState } from "@/components/chamber/VoiceOrb";
import type { ChatMessage } from "@/data/chat";
import { createChatMessage } from "@/data/chat";

const AGENT_ID: string | undefined = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

// Tags an older voice prompt had Lenore write into her replies (`<extract>{...}</extract>`). They are never read
// (ADR 0001): they are only kept out of the transcript and the orb. One left unclosed runs to the end of the reply.
const EXTRACT_TAGS = /<extract>[\s\S]*?(<\/extract>|$)|<\/extract>/g;

interface UseLenoreVoiceOptions {
  onOrbStateChange: (state: OrbState) => void;
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
   * Which conversation this is (useChamberSession's `conversationEpoch`). When it changes, a voice session
   * still open belongs to the old conversation: it is ended, and nothing more it says is kept.
   */
  epoch?: unknown;
}

export function useLenoreVoice({
  onOrbStateChange,
  onNewMessage,
  onLastSpokenText,
  onSpokenMessage,
  context,
  epoch,
}: UseLenoreVoiceOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const callbacksRef = useRef({ onOrbStateChange, onNewMessage, onLastSpokenText, onSpokenMessage });
  // The agent opens each voice session with its own hello. Its first line, if it comes before the prospect
  // says anything, is marked as a greeting so the transcript keeps only one (see useChamberSession).
  const awaitingGreetingRef = useRef(false);
  const epochRef = useRef(epoch);
  // The conversation the open voice session was started in.
  const sessionEpochRef = useRef<unknown>(epoch);
  // Lenore hears the update after every spoken message's extraction. When nothing was sent since the message arrived
  // (its answers changed nothing, or it failed), this is raised to send the same update again.
  const [resend, setResend] = useState(0);
  // The update last sent in this call, and for which resend: nothing is sent twice for the same moment.
  const lastSentRef = useRef<{ text: string; resend: number } | null>(null);
  // How many updates have gone, so a settling extraction can tell whether one went since its message arrived.
  const sentCountRef = useRef(0);

  // Keep refs fresh without re-creating the hook
  useEffect(() => {
    callbacksRef.current = { onOrbStateChange, onNewMessage, onLastSpokenText, onSpokenMessage };
  });

  const conversation = useConversation({
    onConnect: () => {
      console.log("Lenore voice connected");
      awaitingGreetingRef.current = true;
      sessionEpochRef.current = epochRef.current;
      setIsConnected(true);
      callbacksRef.current.onOrbStateChange("listening");
    },
    onDisconnect: () => {
      console.log("Lenore voice disconnected");
      setIsConnected(false);
      callbacksRef.current.onOrbStateChange("idle");
    },
    onMessage: ({ message, role }) => {
      if (!message) return;
      // Still arriving from a session opened in a conversation that has since been replaced.
      const sessionEpoch = sessionEpochRef.current;
      if (!Object.is(sessionEpoch, epochRef.current)) return;

      if (role === "user") {
        awaitingGreetingRef.current = false;
        const msg = createChatMessage("user", message, { spoken: true });
        callbacksRef.current.onNewMessage(msg);
        // Its answers go through chamber-extract like a typed message's, then Lenore hears what is still open. When
        // they changed the update, it has gone already (the change sends it); otherwise it goes again now.
        const sentBefore = sentCountRef.current;
        void Promise.resolve(callbacksRef.current.onSpokenMessage(msg))
          .catch((e) => console.error("Couldn't take the answers from a spoken message:", e))
          .finally(() => {
            if (Object.is(sessionEpoch, epochRef.current) && sentCountRef.current === sentBefore) setResend((n) => n + 1);
          });
        return;
      }

      const spoken = message.replace(EXTRACT_TAGS, "").trim();
      if (!spoken) return;
      const greeting = awaitingGreetingRef.current;
      awaitingGreetingRef.current = false;
      callbacksRef.current.onNewMessage(createChatMessage("lenore", spoken, { kind: greeting ? "greeting" : undefined, spoken: true }));
      callbacksRef.current.onLastSpokenText(
        spoken.length > 120 ? spoken.slice(0, 120) + "..." : spoken
      );
    },
    onError: (error) => {
      console.error("Lenore voice error:", error);
      setIsConnected(false);
      callbacksRef.current.onOrbStateChange("idle");
    },
  });
  const sendUpdateRef = useRef(conversation.sendContextualUpdate);
  sendUpdateRef.current = conversation.sendContextualUpdate;

  // Tell Lenore's voice what is open: when the call connects, when it changes, and after each spoken message.
  useEffect(() => {
    if (!isConnected) {
      lastSentRef.current = null;
      return;
    }
    const last = lastSentRef.current;
    if (last && last.text === context && last.resend === resend) return;
    lastSentRef.current = { text: context, resend };
    try {
      sendUpdateRef.current(context);
      sentCountRef.current += 1;
    } catch (e) {
      // The call carries on; the next change or spoken message sends it again.
      console.warn("Couldn't send Lenore the intake update:", e);
      lastSentRef.current = null;
    }
  }, [isConnected, context, resend]);

  // A new conversation: end a voice session that belongs to the old one.
  useEffect(() => {
    if (Object.is(epochRef.current, epoch)) return;
    epochRef.current = epoch;
    if (conversation.status === "connected") void conversation.endSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch]);

  // Sync orb state with isSpeaking
  useEffect(() => {
    if (!isConnected) return;
    callbacksRef.current.onOrbStateChange(conversation.isSpeaking ? "speaking" : "listening");
  }, [conversation.isSpeaking, isConnected]);

  const startVoice = useCallback(async () => {
    if (conversation.status === "connected") {
      await conversation.endSession();
      return;
    }

    if (!AGENT_ID) return;

    try {
      callbacksRef.current.onOrbStateChange("thinking");

      // Check mic permission without acquiring the stream (the SDK manages its own).
      // Firefox and older Safari reject the "microphone" name, so treat a failed
      // query as "unknown" and let the SDK prompt for access.
      const permState = await navigator.permissions
        ?.query({ name: "microphone" as PermissionName })
        .then((p) => p.state)
        .catch(() => "prompt" as const);
      if (permState === "denied") {
        console.error("Microphone permission denied");
        callbacksRef.current.onOrbStateChange("idle");
        return;
      }

      await conversation.startSession({ agentId: AGENT_ID, connectionType: "websocket" });
    } catch (error) {
      console.error("Failed to start voice:", error);
      callbacksRef.current.onOrbStateChange("idle");
    }
  }, [conversation]);

  return {
    startVoice,
    isConnected,
    hasAgentId: !!AGENT_ID,
  };
}
