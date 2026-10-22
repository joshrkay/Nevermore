import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { AdvisorApiError } from "@/lib/advisorApi";

interface Props {
  error: Error;
  /** What was being loaded, for "We couldn't load …". */
  what: string;
  onRetry: () => void;
}

/**
 * A failed advisor load. The three causes read differently because the advisor's next step does:
 * the session lapsed (sign in again), the role is gone (nothing to retry), or something else went
 * wrong (try again).
 */
const AdvisorLoadError = ({ error, what, onRetry }: Props) => {
  const { signOut } = useAuth();
  // Read the flags rather than the class, so any caller's error is classified the same way.
  const { unauthenticated: ended, forbidden } = error as Partial<AdvisorApiError>;

  // The server no longer accepts this session, so end it here too: the route guard then sends
  // the advisor to sign in, and brings them back to this page afterwards.
  useEffect(() => {
    if (ended) void signOut("expired");
  }, [ended, signOut]);

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
        <p className="font-medium mb-1">You no longer have advisor access.</p>
        <p className="text-sm text-muted-foreground mb-4">
          If you should still have it, ask an administrator to grant it again.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/" className="text-primary underline hover:text-primary/90">Home</Link>
          <button onClick={() => void signOut()} className="text-primary underline hover:text-primary/90">
            Sign in with another account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="border border-destructive/40 bg-destructive/5 rounded-xl p-6 text-center">
      <AlertTriangle className="w-6 h-6 text-destructive mx-auto mb-2" aria-hidden="true" />
      <p className="font-medium mb-1">We couldn't load {what}.</p>
      <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
      <button onClick={onRetry} className="text-primary underline hover:text-primary/90">Try again</button>
    </div>
  );
};

export default AdvisorLoadError;
