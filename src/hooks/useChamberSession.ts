import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import type { ChamberData } from "@/data/chamberTypes";
import type { ChatMessage } from "@/data/chat";
import { createChatMessage, parseTranscript } from "@/data/chat";
import { parseChamberData } from "@/data/chamberValidation";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import {
  certificationFromRow,
  NO_CERTIFICATION,
  type CertificationState,
  type ChamberSubmission,
} from "@/data/manuscript";

interface UseChamberSessionReturn {
  sessionId: string | null;
  /** True when a requested session couldn't be opened; no replacement is created until startNew(). */
  resumeFailed: boolean;
  /** Abandons the unopenable session id and starts a fresh intake. */
  startNew: () => void;
  chamberData: ChamberData;
  messages: ChatMessage[];
  isLoading: boolean;
  setChamberData: (updater: ChamberData | ((prev: ChamberData) => ChamberData)) => void;
  addMessage: (msg: ChatMessage) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  submit: (submission: ChamberSubmission) => Promise<boolean>;
  /** Whether the answers are certified, or were changed after being certified. */
  certification: CertificationState;
}

const OPENING_MESSAGE = "Good evening. I'm Lenore — your guide through The Chamber. Before we begin, I want to be transparent: what you see in the workspace beside us is a demonstration. By the time our conversation is complete, it will hold your company's information instead. Shall we begin with something simple — tell me a little about your business and what you do.";

const SAVE_DELAY_MS = 2000;
const SAVE_RETRY_MS = 10000;
// Browsers cap the total body size of keepalive requests at 64 KiB.
const KEEPALIVE_MAX_BYTES = 60_000;

/**
 * Resumes `requestedSessionId` when it belongs to the signed-in user, otherwise
 * starts a fresh session. Only the id present on first render is used.
 */
export function useChamberSession(requestedSessionId?: string | null): UseChamberSessionReturn {
  const { user, session } = useAuth();
  // Depend on the id, not the object: token refreshes hand out a new User object.
  const userId = user?.id;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resumeFailed, setResumeFailed] = useState(false);
  const [initRun, setInitRun] = useState(0);
  const [chamberData, setChamberDataRaw] = useState<ChamberData>(EMPTY_CHAMBER_DATA);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createChatMessage("lenore", OPENING_MESSAGE)]);
  const [certification, setCertification] = useState<CertificationState>(NO_CERTIFICATION);
  const certificationRef = useRef(certification);
  useEffect(() => { certificationRef.current = certification; }, [certification]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const mountedRef = useRef(true);
  const accessTokenRef = useRef<string | null>(null);
  useEffect(() => { accessTokenRef.current = session?.access_token ?? null; }, [session]);
  const dataRef = useRef(chamberData);
  const messagesRef = useRef(messages);
  const sessionIdRef = useRef(sessionId);
  const requestedIdRef = useRef(requestedSessionId ?? null);

  // Keep refs fresh
  useEffect(() => { dataRef.current = chamberData; }, [chamberData]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Writes pending changes immediately. Safe to call when nothing is pending.
  // Resolves true once everything captured so far is saved.
  const flush = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    // A save already in flight has cleared the dirty flag; wait for its outcome
    // so callers (e.g. submit) don't treat an unconfirmed write as saved.
    if (inFlightRef.current) await inFlightRef.current;
    const sid = sessionIdRef.current;
    if (!sid || !dirtyRef.current) return true;
    dirtyRef.current = false;
    const save = (async () => {
      const { error } = await supabase
        .from("chamber_sessions")
        .update({
          chamber_data: dataRef.current as unknown as Json,
          transcript: messagesRef.current as unknown as Json,
        })
        .eq("id", sid);
      if (!error) return true;
      dirtyRef.current = true;
      console.error("Failed to save session:", error);
      // Retry later so a transient failure isn't lost when no further edits arrive.
      if (mountedRef.current && !saveTimerRef.current) {
        saveTimerRef.current = setTimeout(flush, SAVE_RETRY_MS);
      }
      return false;
    })();
    inFlightRef.current = save;
    try {
      return await save;
    } finally {
      if (inFlightRef.current === save) inFlightRef.current = null;
    }
  }, []);

  // Debounced save
  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  // Don't lose the last few seconds of edits when leaving the page.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const sid = sessionIdRef.current;
      if (!sid || !dirtyRef.current) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // A normal request can be cancelled as the page unloads; a keepalive one is
      // allowed to finish, so send the pending changes straight to PostgREST.
      const body = JSON.stringify({ chamber_data: dataRef.current, transcript: messagesRef.current });
      const token = accessTokenRef.current;
      if (token && new Blob([body]).size <= KEEPALIVE_MAX_BYTES) {
        dirtyRef.current = false;
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chamber_sessions?id=eq.${encodeURIComponent(sid)}`, {
          method: "PATCH",
          keepalive: true,
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body,
        }).catch(() => {});
        return;
      }
      // Too large for keepalive: start a normal save and ask the browser to
      // confirm leaving, which gives that save time to finish.
      void flush();
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
        .select("id, chamber_data, transcript, status, submission")
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
      const loadedCertification = certificationFromRow(data.status, data.submission);
      certificationRef.current = loadedCertification;
      setCertification(loadedCertification);
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
      if (requested && !resumed) {
        // Don't quietly swap in a blank session: the caller decides what the prospect sees.
        setResumeFailed(true);
        setIsLoading(false);
        return;
      }
      if (!resumed) await create();
      if (!cancelled) setIsLoading(false);
    };

    init();
    return () => { cancelled = true; };
  }, [userId, scheduleSave, initRun]);

  const startNew = useCallback(() => {
    requestedIdRef.current = null;
    setResumeFailed(false);
    setIsLoading(true);
    setInitRun((n) => n + 1);
  }, []);

  const setChamberData = useCallback((updater: ChamberData | ((prev: ChamberData) => ChamberData)) => {
    const prev = dataRef.current;
    const next = typeof updater === "function" ? updater(prev) : updater;
    dataRef.current = next;
    setChamberDataRaw(next);
    // Certification covers the answers as they were signed. The database withdraws it the
    // moment the saved answers differ; mirror that here so the prospect sees it right away.
    const current = certificationRef.current;
    if (current.status === "certified" && JSON.stringify(next) !== JSON.stringify(prev)) {
      const stale: CertificationState = { status: "stale", submission: current.submission };
      certificationRef.current = stale;
      setCertification(stale);
    }
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
      .update({
        status: "submitted",
        submission: { ...submission, chamber_data: dataRef.current } as unknown as Json,
      })
      .eq("id", sid);
    if (error) {
      console.error("Failed to submit session:", error);
      return false;
    }
    const certified: CertificationState = {
      status: "certified",
      submission: { ...submission, chamber_data: dataRef.current },
    };
    certificationRef.current = certified;
    setCertification(certified);
    return true;
  }, [flush]);

  return { sessionId, resumeFailed, startNew, chamberData, messages, isLoading, setChamberData, addMessage, setMessages, submit, certification };
}
