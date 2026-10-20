import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ChamberData } from "@/data/chamberTypes";
import type { ChatMessage } from "@/data/mockData";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { toast } from "sonner";

interface UseChamberSessionReturn {
  sessionId: string | null;
  chamberData: ChamberData;
  messages: ChatMessage[];
  isLoading: boolean;
  setChamberData: (updater: ChamberData | ((prev: ChamberData) => ChamberData)) => void;
  addMessage: (msg: ChatMessage) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const OPENING_MESSAGE = "Good evening. I'm Lenore — your guide through The Chamber. Before we begin, I want to be transparent: what you see in the workspace beside us is a demonstration. By the time our conversation is complete, it will hold your company's information instead. Shall we begin with something simple — tell me a little about your business and what you do.";

export function useChamberSession(): UseChamberSessionReturn {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chamberData, setChamberDataRaw] = useState<ChamberData>(EMPTY_CHAMBER_DATA);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "lenore",
      text: OPENING_MESSAGE,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(chamberData);
  const messagesRef = useRef(messages);
  const sessionIdRef = useRef(sessionId);

  // Keep refs fresh
  useEffect(() => { dataRef.current = chamberData; }, [chamberData]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Debounced save
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const { error } = await supabase
        .from("chamber_sessions")
        .update({
          chamber_data: dataRef.current as any,
          transcript: messagesRef.current as any,
        })
        .eq("id", sid);
      if (error) console.error("Failed to save session:", error);
    }, 2000);
  }, []);

  // Load or create session
  useEffect(() => {
    if (!user) { setIsLoading(false); return; }

    const init = async () => {
      // Always start a fresh session
      const { data: newSession, error } = await supabase
        .from("chamber_sessions")
        .insert({ user_id: user.id, chamber_data: EMPTY_CHAMBER_DATA as any, transcript: messages as any })
        .select()
        .single();

      if (error) {
        console.error("Failed to create session:", error);
      } else if (newSession) {
        setSessionId(newSession.id);
      }
      setIsLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setChamberData = useCallback((updater: ChamberData | ((prev: ChamberData) => ChamberData)) => {
    setChamberDataRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
    scheduleSave();
  }, [scheduleSave]);

  return { sessionId, chamberData, messages, isLoading, setChamberData, addMessage, setMessages };
}
