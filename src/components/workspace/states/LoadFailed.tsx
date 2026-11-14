import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { AdvisorApiError } from "@/lib/advisorApi";
import { reportOpsEvent } from "@/lib/monitoring";
import { pressed, tookFocusBack } from "./retryLanding";

// What every page shows in its data area when it could not load (CRM-S2.3, D-175), in place of the data. One set of pieces for the queue, the
// activity page, the outbox, the members, the partners and the submission record, and for a panel of a record.
//
// The words are ours, never the database's or the network's: an error's own text ("canceling statement due to statement timeout", "TypeError:
// Failed to fetch") is not for a person and is never shown. What a person is told is what failed and what they can do, which depends on the
// cause: the session lapsed (sign in again), the role is gone (nothing to retry) or anything else (try again).

/** A "Try again" button that keeps focus sensible (see `retryLanding`). */
function TryAgain({ onRetry, within, refocus }: { onRetry: () => void; within: "section" | "main"; refocus: boolean }) {
  const button = useRef<HTMLButtonElement>(null);
  const whenGone = useRef<(() => void) | null>(null);
  // The failure drawn again after a "Try again": the old button went with the old failure, so focus goes to this one.
  useEffect(() => {
    if (refocus) button.current?.focus({ preventScroll: true });
  }, [refocus]);
  // If the button is removed while it still had focus, focus goes to what stays.
  useEffect(() => () => whenGone.current?.(), []);
  return (
    <button
      ref={button}
      type="button"
      onClick={() => {
        whenGone.current = pressed(button.current!, within);
        onRetry();
      }}
      className="min-h-11 px-2 text-primary underline hover:text-primary/90"
    >
      Try again
    </button>
  );
}

// Decided once, when the failure is first drawn.
const useRefocus = () => useState(() => tookFocusBack())[0];

interface Props {
  /** What could not be loaded, with its article, for "We couldn't load …": "the submissions", "this submission". */
  what: string;
  /** Read only for what KIND of failure it is (an ended session, a refused role); its text is never shown. */
  error?: Error;
  onRetry: () => void;
}

/**
 * A failed load, in the data area of a page. A table's `error` slot, a list page or a record page puts it where the data would be, under
 * its own title, toolbar and tabs, which stay (so a table's filters, sort and view are kept: nothing here touches the address).
 */
export function LoadFailed({ what, error, onRetry }: Props) {
  const { signOut } = useAuth();
  // Read the flags rather than the class, so any caller's error is classified the same way.
  const { unauthenticated: ended, forbidden } = (error ?? {}) as Partial<AdvisorApiError>;
  const refocus = useRefocus();

  // The server no longer accepts this session, so end it here too: the route guard then sends the person to sign in, and back to this page afterwards.
  useEffect(() => {
    if (ended) void signOut("expired");
  }, [ended, signOut]);

  // The database refused a read (42501): the role was revoked, or a page was reached without one.
  useEffect(() => {
    if (forbidden) reportOpsEvent("auth_denied", { code: "advisor_forbidden", detail: what });
  }, [forbidden, what]);

  if (ended) {
    return (
      <div role="alert" className="border border-border rounded-xl p-6 text-center">
        <ShieldAlert className="w-6 h-6 text-primary mx-auto mb-2" aria-hidden="true" />
        <p className="font-medium mb-1">Your session has expired.</p>
        <p className="text-sm text-muted-foreground">Taking you to sign in again…</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div role="alert" className="border border-border rounded-xl p-6 text-center">
        <ShieldAlert className="w-6 h-6 text-primary mx-auto mb-2" aria-hidden="true" />
        <p className="font-medium mb-1">You no longer have access to this firm's records.</p>
        <p className="text-sm text-muted-foreground mb-4">If you should still have it, ask an administrator to grant it again.</p>
        <div className="flex gap-4 justify-center">
          <Link to="/" className="text-primary underline hover:text-primary/90">Home</Link>
          <button type="button" onClick={() => void signOut()} className="text-primary underline hover:text-primary/90">Sign in with another account</button>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="border border-destructive/40 bg-destructive/5 rounded-xl p-6 text-center">
      <AlertTriangle className="w-6 h-6 text-destructive mx-auto mb-2" aria-hidden="true" />
      <p className="font-medium mb-1">We couldn't load {what}.</p>
      <p className="text-sm text-muted-foreground mb-3">This is usually a dropped connection or a problem on our side, not something you did.</p>
      <TryAgain onRetry={onRetry} within="main" refocus={refocus} />
    </div>
  );
}

/**
 * A failed panel of a record: the panel keeps its own heading and says, in its body, what it could not load, with its own "Try again". The
 * rest of the record is untouched. A small alert, announced once as it appears.
 */
export function PanelFailed({ what, message, onRetry, className }: { what: string; message?: string; onRetry: () => void; className?: string }) {
  const refocus = useRefocus();
  return (
    <div role="alert" className={className ?? "text-sm space-y-1"}>
      <p>{message ?? `We couldn't load ${what}.`}</p>
      <TryAgain onRetry={onRetry} within="section" refocus={refocus} />
    </div>
  );
}
