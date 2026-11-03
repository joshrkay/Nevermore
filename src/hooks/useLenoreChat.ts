import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { describeInvokeError, type AiFailureKind } from "@/data/aiFailure";
import { mergeChamberData } from "@/data/chamberValidation";
import type { ChamberData } from "@/data/chamberTypes";
import { redactSensitive } from "@/data/sensitive";
import type { OrbState } from "@/components/chamber/VoiceOrb";

export interface ChatFailure {
  /** The message Lenore didn't get to answer, kept so "Try again" can resend it. */
  text: string;
  /** Why, as the prospect is told it (see CHAT_FAILURE_MESSAGES). */
  kind: AiFailureKind;
  /** The function's request id, which finds the call's extraction event. */
  requestId?: string;
}

/**
 * How long the browser waits for Lenore before offering "Try again" (US-2.4a). Longer than the
 * function's worst case (two 20-second attempts and a one-second pause), so a slow answer still lands.
 */
export const CHAT_TIMEOUT_MS = 45_000;

interface UseLenoreChatOptions {
  /** The intake the conversation belongs to; the function checks it is the caller's and records it. */
  intakeId?: string | null;
  chamberData: ChamberData;
  setChamberData: (updater: (prev: ChamberData) => ChamberData) => void;
  /** May return the stored message so extracted values can point back to it. */
  addUserMessage: (text: string) => { id: string; text: string } | void;
  addLenoreMessage: (text: string) => void;
  onOrbStateChange: (state: OrbState) => void;
  /**
   * Handles what Lenore extracted from a message (with her full response, for field status and
   * evidence). Without it, or when the message wasn't recorded, the plain merge is used.
   */
  onExtracted?: (extracted: Partial<ChamberData>, response: unknown, message: { id: string; text: string }) => void;
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
export function useLenoreChat({ intakeId, chamberData, setChamberData, addUserMessage, addLenoreMessage, onOrbStateChange, onExtracted, epoch }: UseLenoreChatOptions) {
  const [failure, setFailure] = useState<ChatFailure | null>(null);
  const [pending, setPending] = useState(false);
  const dataRef = useRef(chamberData);
  dataRef.current = chamberData;
  const intakeIdRef = useRef(intakeId);
  intakeIdRef.current = intakeId;
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

  const ask = useCallback(async (text: string, message: { id: string; text: string } | null): Promise<boolean> => {
    const askedIn = epochRef.current;
    const replaced = () => !Object.is(epochRef.current, askedIn);
    setPending(true);
    onOrbStateChange("thinking");
    // The browser's own limit, so a request that never answers ends in "Try again" rather than waiting forever.
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CHAT_TIMEOUT_MS);
    try {
      // The roster isn't extracted from chat and holds personal details, so leave it out of the context.
      const { census: _census, ...context } = dataRef.current;
      const body: Record<string, unknown> = { message: text, context };
      if (intakeIdRef.current) body.session_id = intakeIdRef.current;
      const { data, error } = await supabase.functions.invoke("chamber-extract", { body, signal: controller.signal });
      // The conversation was replaced while Lenore was answering: her answer belongs to the old one.
      if (replaced()) {
        onOrbStateChange("idle");
        return false;
      }
      if (error) throw error;

      if (data?.extracted) {
        if (onExtracted && message) onExtracted(data.extracted, data, message);
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
      if (replaced()) return false;
      const info = timedOut ? { kind: "timeout" as const } : await describeInvokeError(err);
      if (replaced()) return false;
      failedMessageRef.current = message;
      setFailure({ text, ...info });
      return false;
    } finally {
      clearTimeout(timer);
      setPending(false);
    }
  }, [addLenoreMessage, onOrbStateChange, setChamberData, onExtracted]);

  const send = useCallback(async (text: string) => {
    setFailure(null);
    // The model and the transcript only ever see the message with sensitive numbers removed.
    const clean = redactSensitive(text);
    await ask(clean, addUserMessage(clean) || null);
  }, [addUserMessage, ask]);

  /** Resends the message that failed, without adding it to the conversation a second time. */
  const retry = useCallback(async () => {
    if (!failure) return;
    await ask(failure.text, failedMessageRef.current);
  }, [ask, failure]);

  /** "Continue manually": drop the notice and let the prospect fill in the workspace themselves. */
  const dismissFailure = useCallback(() => setFailure(null), []);

  return { send, retry, dismissFailure, failure, pending };
}
