import { useCallback, useEffect, useRef, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ChamberData } from "@/data/chamberTypes";
import { chatContext } from "@/data/chat";
import { redactSensitive } from "@/data/sensitive";
import type { OrbState } from "@/components/chamber/VoiceOrb";

export interface ChatFailure {
  /** The message Lenore didn't get to answer, kept so "Try again" can resend it. */
  text: string;
  kind: "rate_limited" | "failed";
}

interface UseLenoreChatOptions {
  chamberData: ChamberData;
  /** Records the prospect's message and returns it, so extracted values can point back to it. */
  addUserMessage: (text: string) => { id: string; text: string };
  addLenoreMessage: (text: string) => void;
  onOrbStateChange: (state: OrbState) => void;
  /**
   * Merges what Lenore extracted from a message (with her full response, for field status and
   * evidence). The hook never merges on its own, so every value goes through provenance.
   */
  onExtracted: (extracted: Partial<ChamberData>, response: unknown, message: { id: string; text: string }) => void;
  /**
   * Which conversation this is (useChamberSession's `conversationEpoch`). When it changes, an answer still
   * on its way belongs to the old conversation: it is dropped, and so is a failure notice about it.
   */
  epoch?: unknown;
}

const FALLBACK_REPLY = "I've noted that. Could you tell me more about your team?";

/**
 * Sends the prospect's messages to Lenore. When she can't answer we say so and keep the message,
 * rather than replying as though she understood it.
 */
export function useLenoreChat({ chamberData, addUserMessage, addLenoreMessage, onOrbStateChange, onExtracted, epoch }: UseLenoreChatOptions) {
  const [failure, setFailure] = useState<ChatFailure | null>(null);
  const [pending, setPending] = useState(false);
  const dataRef = useRef(chamberData);
  dataRef.current = chamberData;
  // The recorded message behind the current failure, so a retry still cites it. Each request
  // otherwise carries its own message, so overlapping sends can't be attributed to each other.
  const failedMessageRef = useRef<{ id: string; text: string } | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);
  const epochRef = useRef(epoch);
  useEffect(() => {
    if (Object.is(epochRef.current, epoch)) return;
    epochRef.current = epoch;
    // "Try again" would resend a message from the conversation that was just replaced.
    failedMessageRef.current = null;
    setFailure(null);
  }, [epoch]);

  const ask = useCallback(async (text: string, message: { id: string; text: string }): Promise<boolean> => {
    const askedIn = epochRef.current;
    const replaced = () => !Object.is(epochRef.current, askedIn);
    setPending(true);
    onOrbStateChange("thinking");
    try {
      const { data, error } = await supabase.functions.invoke("chamber-extract", {
        body: { message: text, context: chatContext(dataRef.current) },
      });
      if (error) throw error;

      if (data?.extracted) onExtracted(data.extracted, data, message);
      const reply = (typeof data?.reply === "string" && data.reply.trim()) || FALLBACK_REPLY;
      onOrbStateChange("speaking");
      addLenoreMessage(reply);
      idleTimer.current = setTimeout(() => onOrbStateChange("idle"), 2000);
      setFailure(null);
      return true;
    } catch (err) {
      onOrbStateChange("idle");
      if (replaced()) return false;
      const rateLimited = err instanceof FunctionsHttpError && err.context?.status === 429;
      failedMessageRef.current = message;
      setFailure({ text, kind: rateLimited ? "rate_limited" : "failed" });
      return false;
    } finally {
      setPending(false);
    }
  }, [addLenoreMessage, onOrbStateChange, onExtracted]);

  const send = useCallback(async (text: string) => {
    setFailure(null);
    // The model and the transcript only ever see the message with sensitive numbers removed.
    const clean = redactSensitive(text);
    await ask(clean, addUserMessage(clean));
  }, [addUserMessage, ask]);

  /** Resends the message that failed, without adding it to the conversation a second time. */
  const retry = useCallback(async () => {
    if (!failure || !failedMessageRef.current) return;
    await ask(failure.text, failedMessageRef.current);
  }, [ask, failure]);

  /** "Continue manually": drop the notice and let the prospect fill in the workspace themselves. */
  const dismissFailure = useCallback(() => setFailure(null), []);

  return { send, retry, dismissFailure, failure, pending };
}
