import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import type { OrbState } from "@/components/chamber/VoiceOrb";
import type { ChatMessage } from "@/data/mockData";

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID || "agent_3901kmesfvwbev2bf2yavwmc0prs";

interface UseLenoreVoiceOptions {
  onOrbStateChange: (state: OrbState) => void;
  onNewMessage: (msg: ChatMessage) => void;
  onLastSpokenText: (text: string) => void;
  onExtract: (data: Record<string, any>) => void;
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
    onMessage: (message: any) => {
      const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (message.type === "user_transcript") {
        const userText = message.user_transcription_event?.user_transcript;
        if (userText) {
          callbacksRef.current.onNewMessage({
            id: String(Date.now()),
            sender: "user",
            text: userText,
            timestamp: ts,
          });
        }
      } else if (message.type === "agent_response") {
        const agentText = message.agent_response_event?.agent_response;
        if (agentText) {
          callbacksRef.current.onNewMessage({
            id: String(Date.now()),
            sender: "lenore",
            text: agentText,
            timestamp: ts,
          });
          callbacksRef.current.onLastSpokenText(
            agentText.length > 120 ? agentText.slice(0, 120) + "..." : agentText
          );

          // Parse <extract> tags
          const extractMatch = agentText.match(/<extract>([\s\S]*?)<\/extract>/);
          if (extractMatch) {
            try {
              callbacksRef.current.onExtract(JSON.parse(extractMatch[1]));
            } catch (e) {
              console.warn("Failed to parse extract:", e);
            }
          }
        }
      }
    },
    onError: (error: any) => {
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

    try {
      callbacksRef.current.onOrbStateChange("thinking");

      // Check mic permission status first without acquiring the stream
      // This avoids conflicts with the SDK which manages its own audio stream
      const permStatus = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (permStatus.state === "denied") {
        console.error("Microphone permission denied");
        callbacksRef.current.onOrbStateChange("idle");
        return;
      }

      await conversation.startSession({
        agentId: AGENT_ID,
      } as any);
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
