import { useCallback, useEffect, useRef, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ChamberData } from "@/data/chamberTypes";
import type { ChatMessage } from "@/data/chat";
import { applyExtraction, transcriptExtraction, type IntakeState } from "@/data/provenance";
import type { OrbState } from "@/components/chamber/VoiceOrb";

export interface ChatFailure {
  /** The message Lenore didn't get to answer, kept so "Try again" can resend it. */
  text: string;
  kind: "rate_limited" | "failed";
}

interface UseLenoreChatOptions {
  chamberData: ChamberData;
  /** Applies an update to the intake; extractions go through here so each field records its source. */
  updateIntake: (updater: (prev: IntakeState) => IntakeState) => void;
  /** Adds the prospect's message to the transcript and returns it, so extracted fields can cite it. */
  addUserMessage: (text: string) => ChatMessage;
  addLenoreMessage: (text: string) => void;
  onOrbStateChange: (state: OrbState) => void;
}

const FALLBACK_REPLY = "I've noted that. Could you tell me more about your team?";

/**
 * Sends the prospect's messages to Lenore. When she can't answer we say so and keep the message,
 * rather than replying as though she understood it.
 */
export function useLenoreChat({ chamberData, updateIntake, addUserMessage, addLenoreMessage, onOrbStateChange }: UseLenoreChatOptions) {
  const [failure, setFailure] = useState<ChatFailure | null>(null);
  const [pending, setPending] = useState(false);
  const dataRef = useRef(chamberData);
  dataRef.current = chamberData;
  const failedMessage = useRef<ChatMessage | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  const ask = useCallback(async (message: ChatMessage): Promise<boolean> => {
    const text = message.text;
    setPending(true);
    onOrbStateChange("thinking");
    try {
      // The roster isn't extracted from chat and can be large, so leave it out of the context.
      const { employees: _employees, ...context } = dataRef.current;
      const { data, error } = await supabase.functions.invoke("chamber-extract", { body: { message: text, context } });
      if (error) throw error;

      if (data?.extracted) {
        updateIntake((prev) => applyExtraction(prev, data.extracted, transcriptExtraction(message, data)));
      }
      const reply = (typeof data?.reply === "string" && data.reply.trim()) || FALLBACK_REPLY;
      onOrbStateChange("speaking");
      addLenoreMessage(reply);
      idleTimer.current = setTimeout(() => onOrbStateChange("idle"), 2000);
      failedMessage.current = null;
      setFailure(null);
      return true;
    } catch (err) {
      onOrbStateChange("idle");
      const rateLimited = err instanceof FunctionsHttpError && err.context?.status === 429;
      failedMessage.current = message;
      setFailure({ text, kind: rateLimited ? "rate_limited" : "failed" });
      return false;
    } finally {
      setPending(false);
    }
  }, [addLenoreMessage, onOrbStateChange, updateIntake]);

  const send = useCallback(async (text: string) => {
    setFailure(null);
    await ask(addUserMessage(text));
  }, [addUserMessage, ask]);

  /** Resends the message that failed, without adding it to the conversation a second time. */
  const retry = useCallback(async () => {
    if (!failure || !failedMessage.current) return;
    await ask(failedMessage.current);
  }, [ask, failure]);

  /** "Continue manually": drop the notice and let the prospect fill in the workspace themselves. */
  const dismissFailure = useCallback(() => setFailure(null), []);

  return { send, retry, dismissFailure, failure, pending };
}
