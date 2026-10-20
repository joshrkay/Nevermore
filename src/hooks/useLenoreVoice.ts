import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import type { OrbState } from "@/components/chamber/VoiceOrb";
import type { ChatMessage } from "@/data/mockData";
import { createChatMessage } from "@/data/mockData";

const AGENT_ID: string | undefined = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

interface UseLenoreVoiceOptions {
  onOrbStateChange: (state: OrbState) => void;
  onNewMessage: (msg: ChatMessage) => void;
  onLastSpokenText: (text: string) => void;
  onExtract: (data: unknown) => void;
}

export function useLenoreVoice({
  onOrbStateChange,
  onNewMessage,
  onLastSpokenText,
  onExtract,
}: UseLenoreVoiceOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const callbacksRef = useRef({ onOrbStateChange, onNewMessage, onLastSpokenText, onExtract });

  // Keep refs fresh without re-creating the hook
  useEffect(() => {
    callbacksRef.current = { onOrbStateChange, onNewMessage, onLastSpokenText, onExtract };
  });

  const conversation = useConversation({
    onConnect: () => {
      console.log("Lenore voice connected");
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

      if (role === "user") {
        callbacksRef.current.onNewMessage(createChatMessage("user", message));
        return;
      }

      // Lenore's spoken reply may carry structured data in <extract>{...}</extract>;
      // keep that out of the transcript.
      const extractMatch = message.match(/<extract>([\s\S]*?)<\/extract>/);
      if (extractMatch) {
        try {
          callbacksRef.current.onExtract(JSON.parse(extractMatch[1]));
        } catch (e) {
          console.warn("Failed to parse extract:", e);
        }
      }
      const spoken = message.replace(/<extract>[\s\S]*?<\/extract>/g, "").trim();
      if (!spoken) return;
      callbacksRef.current.onNewMessage(createChatMessage("lenore", spoken));
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
