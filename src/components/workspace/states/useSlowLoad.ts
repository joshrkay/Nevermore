import { useCallback, useEffect, useState } from "react";

/** Ten seconds of waiting with nothing to show is longer than usual. */
export const SLOW_LOAD_MS = 10_000;

/**
 * Whether a load is taking longer than usual (CRM-S2.1). Counted from the moment the page began waiting for data it has nothing to show
 * for (the first draw, or the draw after a failure was retried), continuously: when the data arrives or the load fails the count stops
 * and the line goes, and a later wait counts from nothing again. `tryAgain` asks for the data again (`retry`, the page's own refetch) and
 * starts the ten seconds over. No timer is left once the page is gone.
 */
export function useSlowLoad(loading: boolean, retry: () => void, afterMs = SLOW_LOAD_MS) {
  const [slow, setSlow] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    setSlow(false);
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), afterMs);
    return () => clearTimeout(timer);
  }, [loading, round, afterMs]);
  const tryAgain = useCallback(() => {
    setSlow(false);
    setRound((n) => n + 1);
    retry();
  }, [retry]);
  return { slow: loading && slow, tryAgain };
}
