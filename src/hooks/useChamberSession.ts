import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import type { ChamberData } from "@/data/chamberTypes";
import type { ChatMessage } from "@/data/chat";
import { createChatMessage, parseTranscript } from "@/data/chat";
import { parseChamberData } from "@/data/chamberValidation";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { ChamberSubmission } from "@/data/manuscript";

interface UseChamberSessionReturn {
  sessionId: string | null;
  chamberData: ChamberData;
  messages: ChatMessage[];
  isLoading: boolean;
  setChamberData: (updater: ChamberData | ((prev: ChamberData) => ChamberData)) => void;
  addMessage: (msg: ChatMessage) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  submit: (submission: ChamberSubmission) => Promise<boolean>;
}

const OPENING_MESSAGE = "Good evening. I'm Lenore — your guide through The Chamber. Before we begin, I want to be transparent: what you see in the workspace beside us is a demonstration. By the time our conversation is complete, it will hold your company's information instead. Shall we begin with something simple — tell me a little about your business and what you do.";

const SAVE_DELAY_MS = 2000;

/**
 * Resumes `requestedSessionId` when it belongs to the signed-in user, otherwise
 * starts a fresh session. Only the id present on first render is used.
 */
export function useChamberSession(requestedSessionId?: string | null): UseChamberSessionReturn {
  const { user } = useAuth();
  // Depend on the id, not the object: token refreshes hand out a new User object.
  const userId = user?.id;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chamberData, setChamberDataRaw] = useState<ChamberData>(EMPTY_CHAMBER_DATA);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createChatMessage("lenore", OPENING_MESSAGE)]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const dataRef = useRef(chamberData);
  const messagesRef = useRef(messages);
  const sessionIdRef = useRef(sessionId);
  const requestedIdRef = useRef(requestedSessionId ?? null);

  // Keep refs fresh
  useEffect(() => { dataRef.current = chamberData; }, [chamberData]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Writes pending changes immediately. Safe to call when nothing is pending.
  const flush = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const sid = sessionIdRef.current;
    if (!sid || !dirtyRef.current) return true;
    dirtyRef.current = false;
    const { error } = await supabase
      .from("chamber_sessions")
      .update({
        chamber_data: dataRef.current as unknown as Json,
        transcript: messagesRef.current as unknown as Json,
      })
      .eq("id", sid);
    if (error) {
      dirtyRef.current = true;
      console.error("Failed to save session:", error);
      return false;
    }
    return true;
  }, []);

  // Debounced save
  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  // Don't lose the last few seconds of edits when leaving the page.
  useEffect(() => {
    const onBeforeUnload = () => { void flush(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flush();
    };
  }, [flush]);

  // Resume or create a session
  useEffect(() => {
    if (!userId) { setIsLoading(false); return; }
    let cancelled = false;

    const resume = async (id: string) => {
      // RLS only returns the user's own sessions.
      const { data, error } = await supabase
        .from("chamber_sessions")
        .select("id, chamber_data, transcript")
        .eq("id", id)
        .maybeSingle();
      if (error) console.error("Failed to load session:", error);
      if (!data) return false;
      const loadedData = parseChamberData(data.chamber_data);
      const loadedMessages = parseTranscript(data.transcript);
      dataRef.current = loadedData;
      setChamberDataRaw(loadedData);
      if (loadedMessages.length > 0) {
        messagesRef.current = loadedMessages;
        setMessages(loadedMessages);
      }
      sessionIdRef.current = data.id;
      setSessionId(data.id);
      return true;
    };

    const create = async () => {
      const { data: newSession, error } = await supabase
        .from("chamber_sessions")
        .insert({
          user_id: userId,
          chamber_data: dataRef.current as unknown as Json,
          transcript: messagesRef.current as unknown as Json,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Failed to create session:", error);
      } else if (newSession && !cancelled) {
        sessionIdRef.current = newSession.id;
        setSessionId(newSession.id);
        // Anything captured while the row was being created still needs saving.
        if (dirtyRef.current) scheduleSave();
      }
    };

    const init = async () => {
      const requested = requestedIdRef.current;
      const resumed = requested ? await resume(requested) : false;
      if (cancelled) return;
      if (!resumed) await create();
      if (!cancelled) setIsLoading(false);
    };

    init();
    return () => { cancelled = true; };
  }, [userId, scheduleSave]);

  const setChamberData = useCallback((updater: ChamberData | ((prev: ChamberData) => ChamberData)) => {
    setChamberDataRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      dataRef.current = next;
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => {
      const next = [...prev, msg];
      messagesRef.current = next;
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  const submit = useCallback(async (submission: ChamberSubmission) => {
    const sid = sessionIdRef.current;
    if (!sid) return false;
    if (!(await flush())) return false;
    const { error } = await supabase
      .from("chamber_sessions")
      .update({ status: "submitted", submission: submission as unknown as Json })
      .eq("id", sid);
    if (error) {
      console.error("Failed to submit session:", error);
      return false;
    }
    return true;
  }, [flush]);

  return { sessionId, chamberData, messages, isLoading, setChamberData, addMessage, setMessages, submit };
}
