import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { describeInvokeError, type AiFailureKind } from "@/data/aiFailure";
import type { ChamberData } from "@/data/chamberTypes";
import type { ChatMessage } from "@/data/chat";
import type { ProvenanceMap } from "@/data/provenance";
import { redactSensitive } from "@/data/sensitive";
import { chatContext } from "../../supabase/functions/_shared/chatContext.ts";
import { censusSummary } from "@/data/followUp";
import { errorDetail, reportOpsEvent, unrecordedFunctionFailure } from "@/lib/monitoring";
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
  /**
   * Creates the intake when the prospect hasn't started one yet (their first message does), so the call can
   * carry its id and its extraction event can be found by intake.
   */
  ensureIntake?: () => Promise<string | null>;
  chamberData: ChamberData;
  /** Each answer's field status, sent so Lenore knows what is settled (D22). */
  provenance?: ProvenanceMap;
  /** The conversation so far: the last few messages go with each call, so a short answer can be placed (D22). */
  messages?: readonly ChatMessage[];
  setChamberData: (updater: (prev: ChamberData) => ChamberData) => void;
  /** May return the stored message so extracted values can point back to it. */
  addUserMessage: (text: string) => { id: string; text: string } | void;
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

// chamber-extract always replies (when the model doesn't, it asks about the next unsettled field). This covers a
// function from before it did.
const FALLBACK_REPLY = "Thank you, I've noted that.";

/**
 * Sends the prospect's messages to Lenore. When she can't answer we say so and keep the message,
 * rather than replying as though she understood it.
 */
export function useLenoreChat({ intakeId, ensureIntake, chamberData, provenance, messages, setChamberData, addUserMessage, addLenoreMessage, onOrbStateChange, onExtracted, epoch }: UseLenoreChatOptions) {
  const [failure, setFailure] = useState<ChatFailure | null>(null);
  const [pending, setPending] = useState(false);
  const dataRef = useRef(chamberData);
  dataRef.current = chamberData;
  const provenanceRef = useRef(provenance);
  provenanceRef.current = provenance;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const intakeIdRef = useRef(intakeId);
  intakeIdRef.current = intakeId;
  const ensureIntakeRef = useRef(ensureIntake);
  ensureIntakeRef.current = ensureIntake;
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
    // The browser's own limit, so a request that never answers ends in "Try again" rather than waiting forever.
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CHAT_TIMEOUT_MS);
    try {
      // The roster isn't extracted from chat and holds personal details, so leave it out of the context.
      const { census: _census, ...answers } = dataRef.current;
      const statuses = Object.fromEntries(Object.entries(provenanceRef.current ?? {}).flatMap(([field, p]) => (p ? [[field, p.status]] : [])));
      const census = censusSummary(dataRef.current);
      const body: Record<string, unknown> = {
        message: text,
        ...chatContext(answers, statuses, messagesRef.current ?? [], message?.id),
        census: { rows: census.rows, work_states: census.workStates },
      };
      const sessionId = intakeIdRef.current ?? (ensureIntakeRef.current ? await ensureIntakeRef.current() : null);
      if (sessionId) body.session_id = sessionId;
      const { data, error } = await supabase.functions.invoke("chamber-extract", { body, signal: controller.signal });
      // The conversation was replaced while Lenore was answering: her answer belongs to the old one.
      if (replaced()) {
        onOrbStateChange("idle");
        return false;
      }
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
      const info = timedOut ? { kind: "timeout" as const } : await describeInvokeError(err);
      if (replaced()) return false;
      // chamber-extract records every call it answers (ai_extraction_events); this covers it never answering.
      const unrecorded = timedOut ? "chat_timeout" : unrecordedFunctionFailure("chat", err, info.requestId);
      if (unrecorded) reportOpsEvent("ai_failed", { code: unrecorded, detail: errorDetail(err) });
      failedMessageRef.current = message;
      setFailure({ text, ...info });
      return false;
    } finally {
      clearTimeout(timer);
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
