import { useEffect, useRef, useState } from "react";
import { forget, pressed } from "./retryLanding";

/**
 * A refresh that failed while the rows it was refreshing are still on screen (CRM-S2.4a, D-180, D-181). The rows STAY, because a person reading
 * them has done nothing wrong and a dropped minute is no reason to take them away; this note sits over them and says they may be out of date.
 * It is a polite status, not an alert (nobody asked for this ask), and it is announced once: it is ONE element for as long as refreshes keep
 * failing, so a failed minute after a failed minute does not read it again and a focused "Try again" is never lost. It goes when a refresh works.
 * Never the failure's own text. "Try again" is the page's own retry; when it is pressed the button says "Trying again…" until the answer comes,
 * and if the note goes with the answer, focus goes to the page's `main` (`retryLanding`) rather than falling to the top of the page.
 *
 * `what` is the plural noun with its article ("the submissions"); a page that places this itself gives `retrying` from the query.
 */
export function RefreshFailed({ what, onRetry, retrying, className }: { what: string; onRetry: () => void; retrying: boolean; className?: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const whenGone = useRef<(() => void) | null>(null);
  const [asked, setAsked] = useState(false);
  // "Trying again…" lasts as long as the retry does, and no longer.
  useEffect(() => {
    if (!retrying) setAsked(false);
  }, [retrying]);
  // If the note goes while its button still had focus (the refresh worked), focus goes to what stays.
  useEffect(() => () => whenGone.current?.(), []);
  const trying = asked && retrying;
  return (
    <div role="status" className={className ?? "mb-3 flex flex-wrap items-center gap-x-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"}>
      <span>We couldn't refresh {what}. What's below may be out of date.</span>
      <button
        ref={button}
        type="button"
        aria-disabled={trying || undefined}
        onClick={() => {
          if (trying) return;
          setAsked(true);
          whenGone.current = pressed(button.current!, "main", what);
          onRetry();
          setTimeout(() => { if (button.current?.isConnected) forget(what); }, 0);
        }}
        className="min-h-11 px-2 text-primary underline hover:text-primary/90"
      >
        {trying ? "Trying again…" : "Try again"}
      </button>
    </div>
  );
}
