import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import type { OrbState } from "@/components/chamber/VoiceOrb";
import type { ChatMessage } from "@/data/chat";
import { createChatMessage } from "@/data/chat";

const AGENT_ID: string | undefined = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

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

export function useLenoreVoice({
  onOrbStateChange,
  onNewMessage,
  onLastSpokenText,
  onExtract,
  epoch,
}: UseLenoreVoiceOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const callbacksRef = useRef({ onOrbStateChange, onNewMessage, onLastSpokenText, onExtract });
  const lastUserMessageRef = useRef<ChatMessage | null>(null);
  // The agent opens each voice session with its own hello. Its first line, if it comes before the prospect
  // says anything, is marked as a greeting so the transcript keeps only one (see useChamberSession).
  const awaitingGreetingRef = useRef(false);
  const epochRef = useRef(epoch);
  // The conversation the open voice session was started in.
  const sessionEpochRef = useRef<unknown>(epoch);

  // Keep refs fresh without re-creating the hook
  useEffect(() => {
    callbacksRef.current = { onOrbStateChange, onNewMessage, onLastSpokenText, onExtract };
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
      if (!Object.is(sessionEpochRef.current, epochRef.current)) return;

      if (role === "user") {
        awaitingGreetingRef.current = false;
        const msg = createChatMessage("user", message);
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
      callbacksRef.current.onNewMessage(createChatMessage("lenore", spoken, greeting ? "greeting" : undefined));
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
