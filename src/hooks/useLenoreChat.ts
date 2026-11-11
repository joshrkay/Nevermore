import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { describeInvokeError, type AiFailureKind } from "@/data/aiFailure";
import type { ChamberData } from "@/data/chamberTypes";
import { CHAT_FALLBACK_REPLY, chatRequestBody, type ChatMessage } from "@/data/chat";
import { outstandingRequestedFields, type InformationRequest } from "@/data/informationRequest";
import type { IntakeState, ProvenanceMap } from "@/data/provenance";
import { MAX_CHAT_MESSAGE_CHARS } from "../../supabase/functions/_shared/chatContext.ts";
import { redactForModel } from "@/data/sensitive";
import { errorDetail, reportOpsEvent, unrecordedFunctionFailure } from "@/lib/monitoring";
import type { OrbState } from "@/components/chamber/VoiceOrb";

export interface ChatFailure {
  /** The message Lenore didn't get to answer, kept so "Try again" can resend it. */
  text: string;
  /** Why, as the prospect is told it (see CHAT_FAILURE_MESSAGES). */
  kind: AiFailureKind;
  /** The function's request id, which finds the call's extraction event. */
  requestId?: string;
  /**
   * The message was said aloud in a voice call (US-2.3b). Lenore already answered it aloud, so the notice says only
   * that its answers weren't noted, and "Try again" reads it again without a reply.
   */
  spoken?: true;
}

/** A message Lenore is asked about: its recorded id and text, and whether it was said aloud. */
type AskedMessage = { id: string; text: string; spoken?: boolean };

// The function refuses a longer message. A typed one can't be longer (the input stops at it); a long spoken one is
// cut to fit, and the transcript keeps all of it. A cut between the halves of an emoji would leave a lone surrogate.
const fitMessage = (text: string) =>
  text.length > MAX_CHAT_MESSAGE_CHARS ? text.slice(0, MAX_CHAT_MESSAGE_CHARS).replace(/[\uD800-\uDBFF]$/, "") : text;

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
  /**
   * The answers, their provenance and the conversation as they stand right now (useChamberSession's `readIntake`),
   * read when each call is built. Spoken messages are asked about one after another, and the next is built before the
   * screen has caught up with the answers the last one brought; without this, the values passed in are used.
   */
  readIntake?: () => IntakeState & { messages: readonly ChatMessage[] };
  /** Records the prospect's message and returns it, so extracted values can point back to it. */
  addUserMessage: (text: string) => { id: string; text: string };
  addLenoreMessage: (text: string) => void;
  onOrbStateChange: (state: OrbState) => void;
  /**
   * Merges what Lenore extracted from a message (with her full response, for field status and
   * evidence). The hook never merges on its own, so every value goes through provenance.
   */
  onExtracted: (extracted: Partial<ChamberData>, response: unknown, message: { id: string; text: string; spoken?: boolean }) => void;
  /**
   * An advisor's open request for information: the fields it names that the prospect hasn't answered since go with
   * each call, so Lenore asks about them first (outstandingRequestedFields).
   */
  informationRequest?: InformationRequest | null;
  /**
   * Which conversation this is (useChamberSession's `conversationEpoch`). When it changes, an answer still
   * on its way belongs to the old conversation: it is dropped, and so is a failure notice about it.
   */
  epoch?: unknown;
}

/**
 * Sends the prospect's messages to Lenore. When she can't answer we say so and keep the message,
 * rather than replying as though she understood it.
 */
export function useLenoreChat({ intakeId, ensureIntake, chamberData, provenance, messages, readIntake, addUserMessage, addLenoreMessage, onOrbStateChange, onExtracted, informationRequest = null, epoch }: UseLenoreChatOptions) {
  const [failure, setFailure] = useState<ChatFailure | null>(null);
  // How many calls are out: typed and spoken ones can overlap.
  const [inFlight, setInFlight] = useState(0);
  const pending = inFlight > 0;
  const dataRef = useRef(chamberData);
  dataRef.current = chamberData;
  const provenanceRef = useRef(provenance);
  provenanceRef.current = provenance;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const readIntakeRef = useRef(readIntake);
  readIntakeRef.current = readIntake;
  const requestRef = useRef(informationRequest);
  requestRef.current = informationRequest;
  const intakeIdRef = useRef(intakeId);
  intakeIdRef.current = intakeId;
  const ensureIntakeRef = useRef(ensureIntake);
  ensureIntakeRef.current = ensureIntake;
  // Every message whose answers weren't taken, oldest first, with the text that was sent, so "Try again" reads each one
  // again and still cites it. Several can be waiting: spoken messages keep coming while the call goes on, and one
  // failing never makes an earlier one's answers noted. Each request otherwise carries its own message, so
  // overlapping sends can't be attributed to each other.
  const failedRef = useRef<{ text: string; message: AskedMessage }[]>([]);
  // Spoken messages are asked about in the order they were said, one at a time, so each call carries what the one
  // before it captured.
  const spokenQueue = useRef<Promise<unknown>>(Promise.resolve());
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);
  const epochRef = useRef(epoch);
  useEffect(() => {
    if (Object.is(epochRef.current, epoch)) return;
    epochRef.current = epoch;
    // "Try again" would resend a message from the conversation that was just replaced.
    failedRef.current = [];
    setFailure(null);
  }, [epoch]);

  const ask = useCallback(async (text: string, message: AskedMessage): Promise<boolean> => {
    const askedIn = epochRef.current;
    const replaced = () => !Object.is(epochRef.current, askedIn);
    // A spoken message was answered aloud already: the voice call keeps the orb, and no reply is added.
    const spoken = message.spoken === true;
    const orb = (state: OrbState) => { if (!spoken) onOrbStateChange(state); };
    setInFlight((n) => n + 1);
    orb("thinking");
    // The browser's own limit, so a request that never answers ends in "Try again" rather than waiting forever.
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CHAT_TIMEOUT_MS);
    try {
      // The answers without the roster, their field statuses and the recent conversation (chatRequestBody), as they
      // stand now.
      const latest = readIntakeRef.current?.();
      const body: Record<string, unknown> = {
        ...chatRequestBody(
          { id: message.id, text },
          latest?.data ?? dataRef.current,
          latest ? latest.provenance : provenanceRef.current,
          latest?.messages ?? messagesRef.current ?? [],
        ),
      };
      const requested = outstandingRequestedFields(requestRef.current, latest ? latest.provenance : provenanceRef.current);
      if (requested.length > 0) body.requested = requested;
      const sessionId = intakeIdRef.current ?? (ensureIntakeRef.current ? await ensureIntakeRef.current() : null);
      if (sessionId) body.session_id = sessionId;
      const { data, error } = await supabase.functions.invoke("chamber-extract", { body, signal: controller.signal });
      // The conversation was replaced while Lenore was answering: her answer belongs to the old one.
      if (replaced()) {
        orb("idle");
        return false;
      }
      if (error) throw error;

      if (data?.extracted) onExtracted(data.extracted, data, message);
      if (!spoken) {
        const reply = (typeof data?.reply === "string" && data.reply.trim()) || CHAT_FALLBACK_REPLY;
        onOrbStateChange("speaking");
        addLenoreMessage(reply);
        idleTimer.current = setTimeout(() => onOrbStateChange("idle"), 2000);
      }
      // This message's answers are in. The notice goes once no other message is waiting: a later spoken message
      // working doesn't make an earlier one's answers noted.
      failedRef.current = failedRef.current.filter((f) => f.message.id !== message.id);
      if (failedRef.current.length === 0) setFailure(null);
      return true;
    } catch (err) {
      orb("idle");
      if (replaced()) return false;
      const info = timedOut ? { kind: "timeout" as const } : await describeInvokeError(err);
      if (replaced()) return false;
      // chamber-extract records every call it answers (ai_extraction_events); this covers it never answering.
      const unrecorded = timedOut ? "chat_timeout" : unrecordedFunctionFailure("chat", err, info.requestId);
      if (unrecorded) reportOpsEvent("ai_failed", { code: unrecorded, detail: errorDetail(err) });
      // Kept in its place when it was already waiting (a retry that failed again), so they stay oldest first.
      if (!failedRef.current.some((f) => f.message.id === message.id)) failedRef.current = [...failedRef.current, { text, message }];
      setFailure({ text, ...info, ...(spoken ? { spoken: true as const } : {}) });
      return false;
    } finally {
      clearTimeout(timer);
      setInFlight((n) => n - 1);
    }
  }, [addLenoreMessage, onOrbStateChange, onExtracted]);

  /**
   * Asks about a spoken message once those said before it have been asked about. One queued in a conversation that
   * has since been replaced is never asked about: it belongs to the old one.
   */
  const askSpoken = useCallback((text: string, message: AskedMessage): Promise<boolean> => {
    const queuedIn = epochRef.current;
    const turn = spokenQueue.current.then(() => (Object.is(epochRef.current, queuedIn) ? ask(text, message) : false));
    spokenQueue.current = turn.catch(() => undefined);
    return turn;
  }, [ask]);

  const send = useCallback(async (text: string) => {
    // Something new: the notice about an earlier message goes, as "Continue manually" would.
    failedRef.current = [];
    setFailure(null);
    // The model and the transcript only ever see the message with sensitive numbers removed.
    const clean = redactForModel(text);
    await ask(clean, addUserMessage(clean));
  }, [addUserMessage, ask]);

  /**
   * Takes the answers from something the prospect said in a voice call (US-2.3b, ADR 0001), through the same function
   * as a typed message. The message is already in the transcript (useLenoreVoice records it), and Lenore answered it
   * aloud, so no reply is added. Its answers are merged by onExtracted with the message, which says it was spoken, so
   * none is stored as confirmed (D33). Resolves when it is done, whether or not it worked.
   */
  const extractSpoken = useCallback(
    (message: { id: string; text: string }): Promise<boolean> =>
      askSpoken(fitMessage(redactForModel(message.text)), { id: message.id, text: message.text, spoken: true }),
    [askSpoken],
  );

  /**
   * Resends every message whose answers weren't taken, oldest first, without adding any to the conversation a second
   * time. One that fails again stays waiting, and so does the notice.
   */
  const retry = useCallback(async () => {
    if (!failure) return;
    const retriedIn = epochRef.current;
    for (const { text, message } of [...failedRef.current]) {
      // The conversation was replaced partway: the rest belong to the old one.
      if (!Object.is(epochRef.current, retriedIn)) return;
      await (message.spoken ? askSpoken(text, message) : ask(text, message));
    }
  }, [ask, askSpoken, failure]);

  /** "Continue manually": drop the notice, and what it was waiting on, and let the prospect fill in the workspace themselves. */
  const dismissFailure = useCallback(() => {
    failedRef.current = [];
    setFailure(null);
  }, []);

  return { send, extractSpoken, retry, dismissFailure, failure, pending };
}
