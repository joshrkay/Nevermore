import { useEffect, useState } from "react";

/**
 * Whether the support hour is over: true from the moment the time passes, read from this browser's clock only to decide what to show.
 * The database stops the session by its own clock, so the next request is refused whatever this says.
 */
export function useSupportOver(endsAt: string | null): boolean {
  const [over, setOver] = useState(() => endsAt !== null && Date.parse(endsAt) <= Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    const wait = Date.parse(endsAt) - Date.now();
    if (wait <= 0) {
      setOver(true);
      return;
    }
    setOver(false);
    // A timer can't wait longer than this; a session lasts an hour, so it never needs to.
    const timer = window.setTimeout(() => setOver(true), Math.min(wait, 2_000_000_000));
    return () => window.clearTimeout(timer);
  }, [endsAt]);
  return over;
}
