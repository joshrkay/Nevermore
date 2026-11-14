import { useCallback, useEffect, useState } from "react";
import { fetchMyFirmClosure } from "@/lib/closeFirmApi";

// Whether the firm is closing and when, for the banner in the workspace shell and the Close this firm section of Settings. One answer
// per firm, shared by whoever asks, asked again when the window gets focus and every 60 seconds (D-49), and at once after the owner
// asks or withdraws. It only chooses what to show; the database is what refuses changes.

type Answer = { loaded: boolean; closesAt: string | null };
const answers = new Map<string, Answer>();
const listeners = new Set<() => void>();
const inFlight = new Map<string, Promise<void>>();

function load(firmId: string): Promise<void> {
  const running = inFlight.get(firmId);
  if (running) return running;
  const p = fetchMyFirmClosure(firmId).then((closesAt) => {
    answers.set(firmId, { loaded: true, closesAt });
    listeners.forEach((l) => l());
  }).finally(() => inFlight.delete(firmId));
  inFlight.set(firmId, p);
  return p;
}

/** Asks again now, for everyone who is showing this firm's answer. */
export function refreshFirmClosure(firmId: string): Promise<void> {
  return load(firmId);
}

/** Forgets every answer (a test; a change of firm is already a different key). */
export function clearFirmClosure(): void {
  answers.clear();
}

export function useFirmClosure(firmId: string | null): Answer {
  const [, bump] = useState(0);
  useEffect(() => {
    const listener = () => bump((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  const ask = useCallback(() => { if (firmId) void load(firmId); }, [firmId]);
  useEffect(() => {
    if (!firmId) return;
    ask();
    const timer = window.setInterval(ask, 60_000);
    window.addEventListener("focus", ask);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", ask); };
  }, [firmId, ask]);
  return (firmId ? answers.get(firmId) : undefined) ?? { loaded: false, closesAt: null };
}
