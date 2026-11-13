import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchNeedsSecondFactor } from "@/lib/advisorApi";
import { reportOpsEvent } from "@/lib/monitoring";

type Access = "checking" | "allowed" | "denied" | "second_factor" | "error" | "ended";

interface RequireAccessProps {
  children: ReactNode;
  /** Whether the signed-in person may see this page: asked of the database, never of what the browser holds. */
  check: () => Promise<boolean>;
  /** What the person is told when they may not, given their email. */
  denied: (email: string | undefined) => ReactNode;
  /** Reported with auth_denied when a signed-in account reaches the page without access. */
  deniedCode: string;
}

// A page that needs a signed-in (not guest) account that the database says may see it, and the second factor a password
// sign-in owes. This only decides what to render: the database refuses the data to everyone else anyway.
const RequireAccess = ({ children, check, denied, deniedCode }: RequireAccessProps) => {
  const { user, loading, isAnonymous, signOut, sessionEnded } = useAuth();
  const location = useLocation();
  const userId = user?.id;
  const [access, setAccess] = useState<Access>("checking");
  const [attempt, setAttempt] = useState(0);
  // signOut changes identity on every render; the effect below must not re-run (and re-check) for it.
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;
  // The caller's functions change identity on every render; the check below runs again only for a new person or a retry.
  const checkRef = useRef(check);
  checkRef.current = check;

  useEffect(() => {
    if (!userId || isAnonymous) return;
    let cancelled = false;
    setAccess("checking");
    checkRef.current()
      .then(async (ok) => {
        if (ok) return "allowed" as const;
        // A person who signed in with a password is held back until they add or enter a second factor.
        if (await fetchNeedsSecondFactor()) return "second_factor" as const;
        // A signed-in account the check refuses.
        reportOpsEvent("auth_denied", { code: deniedCode });
        return "denied" as const;
      })
      .then((next) => {
        if (!cancelled) setAccess(next);
      })
      .catch((err: { unauthenticated?: boolean }) => {
        if (cancelled) return;
        // The server won't accept this session, so a retry can't help: end it, and the redirect
        // below sends the advisor to sign in.
        if (err.unauthenticated) {
          setAccess("ended");
          void signOutRef.current("expired");
        } else {
          setAccess("error");
        }
      });
    return () => { cancelled = true; };
  }, [userId, isAnonymous, attempt, deniedCode]);

  if (loading) return <Checking />;
  if (!user || isAnonymous) {
    // After a deliberate sign-out, don't remember the page: whoever signs in next may be someone else.
    const state =
      sessionEnded === "signed_out"
        ? { audience: "advisor", reason: sessionEnded }
        : { from: location, audience: "advisor", reason: sessionEnded ?? undefined };
    return <Navigate to="/login" replace state={state} />;
  }
  if (access === "checking") return <Checking />;
  if (access === "ended") {
    return (
      <Message title="Your session has expired.">
        <p className="text-muted-foreground">Taking you to sign in again…</p>
      </Message>
    );
  }
  if (access === "second_factor") {
    return <Navigate to="/advisor/second-factor" replace state={{ from: location }} />;
  }
  if (access === "error") {
    return (
      <Message title="We couldn't check your access">
        <button onClick={() => setAttempt((n) => n + 1)} className="text-primary underline hover:text-primary/90">
          Try again
        </button>
      </Message>
    );
  }
  if (access === "denied") return <>{denied(user.email)}</>;
  return <>{children}</>;
};

const Checking = () => (
  <div className="min-h-screen bg-background flex items-center justify-center" role="status">
    <Loader2 className="w-6 h-6 text-primary animate-spin" aria-hidden="true" />
    <span className="sr-only">Checking access…</span>
  </div>
);

const Message = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="min-h-screen bg-background flex items-center justify-center px-6">
    <div className="text-center max-w-md">
      <ShieldAlert className="w-8 h-8 text-primary mx-auto mb-4" aria-hidden="true" />
      <h1 className="font-display text-2xl font-bold mb-3">{title}</h1>
      {children}
    </div>
  </div>
);

export const AccessMessage = Message;

export default RequireAccess;
