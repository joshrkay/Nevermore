import { useCallback, useEffect, useRef, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { mergeChamberData } from "@/data/chamberValidation";
import type { ChamberData } from "@/data/chamberTypes";
import type { OrbState } from "@/components/chamber/VoiceOrb";

export interface ChatFailure {
  /** The message Lenore didn't get to answer, kept so "Try again" can resend it. */
  text: string;
  kind: "rate_limited" | "failed";
}

/** The prospect's message as it was recorded in the transcript, for pointing extracted values back to it. */
export interface SourceMessage {
  id: string;
  text: string;
}

interface UseLenoreChatOptions {
  chamberData: ChamberData;
  /** Merges extracted values with no record of where they came from; used when `onExtract` isn't given. */
  setChamberData: (updater: (prev: ChamberData) => ChamberData) => void;
  /** Records the message in the transcript; returning it lets extracted values cite it as their source. */
  addUserMessage: (text: string) => SourceMessage | undefined;
  /** Applies what Lenore extracted, with the full response and the message it answers (null if unknown). */
  onExtract?: (extracted: unknown, response: unknown, source: SourceMessage | null) => void;
  addLenoreMessage: (text: string) => void;
  onOrbStateChange: (state: OrbState) => void;
}

const FALLBACK_REPLY = "I've noted that. Could you tell me more about your team?";

/**
 * Sends the prospect's messages to Lenore. When she can't answer we say so and keep the message,
 * rather than replying as though she understood it.
 */
export function useLenoreChat({ chamberData, setChamberData, addUserMessage, addLenoreMessage, onOrbStateChange, onExtract }: UseLenoreChatOptions) {
  const [failure, setFailure] = useState<ChatFailure | null>(null);
  const [pending, setPending] = useState(false);
  const dataRef = useRef(chamberData);
  dataRef.current = chamberData;
  // The message behind the last send, so a retry cites it too rather than the prospect's latest.
  const sourceRef = useRef<SourceMessage | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  const ask = useCallback(async (text: string): Promise<boolean> => {
    setPending(true);
    onOrbStateChange("thinking");
    try {
      // The roster isn't extracted from chat and can be large, so leave it out of the context.
      const { employees: _employees, ...context } = dataRef.current;
      const { data, error } = await supabase.functions.invoke("chamber-extract", { body: { message: text, context } });
      if (error) throw error;

      if (data?.extracted) {
        if (onExtract) onExtract(data.extracted, data, sourceRef.current);
        else setChamberData((prev) => mergeChamberData(prev, data.extracted));
      }
      const reply = (typeof data?.reply === "string" && data.reply.trim()) || FALLBACK_REPLY;
      onOrbStateChange("speaking");
      addLenoreMessage(reply);
      idleTimer.current = setTimeout(() => onOrbStateChange("idle"), 2000);
      setFailure(null);
      return true;
    } catch (err) {
      onOrbStateChange("idle");
      const rateLimited = err instanceof FunctionsHttpError && err.context?.status === 429;
      setFailure({ text, kind: rateLimited ? "rate_limited" : "failed" });
      return false;
    } finally {
      setPending(false);
    }
  }, [addLenoreMessage, onExtract, onOrbStateChange, setChamberData]);

  const send = useCallback(async (text: string) => {
    setFailure(null);
    sourceRef.current = addUserMessage(text) ?? null;
    await ask(text);
  }, [addUserMessage, ask]);

  /** Resends the message that failed, without adding it to the conversation a second time. */
  const retry = useCallback(async () => {
    if (!failure) return;
    await ask(failure.text);
  }, [ask, failure]);

  /** "Continue manually": drop the notice and let the prospect fill in the workspace themselves. */
  const dismissFailure = useCallback(() => setFailure(null), []);

  return { send, retry, dismissFailure, failure, pending };
}
