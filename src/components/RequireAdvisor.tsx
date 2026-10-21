import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchIsAdvisor } from "@/lib/advisorApi";

type Access = "checking" | "allowed" | "denied" | "error";

// Advisor pages need a signed-in (not guest) account that holds the advisor or admin role.
// This only decides what to render: the database refuses advisor data to everyone else anyway.
const RequireAdvisor = ({ children }: { children: ReactNode }) => {
  const { user, loading, isAnonymous, signOut, sessionEnded } = useAuth();
  const location = useLocation();
  const userId = user?.id;
  const [access, setAccess] = useState<Access>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId || isAnonymous) return;
    let cancelled = false;
    setAccess("checking");
    fetchIsAdvisor()
      .then((ok) => !cancelled && setAccess(ok ? "allowed" : "denied"))
      .catch(() => !cancelled && setAccess("error"));
    return () => { cancelled = true; };
  }, [userId, isAnonymous, attempt]);

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
  if (access === "error") {
    return (
      <Message title="We couldn't check your access">
        <button onClick={() => setAttempt((n) => n + 1)} className="text-primary underline hover:text-primary/90">
          Try again
        </button>
      </Message>
    );
  }
  if (access === "denied") {
    return (
      <Message title="Advisor access required">
        <p className="text-muted-foreground mb-4">
          {user.email ?? "This account"} isn't an advisor account. If you should have access, ask an administrator to
          grant it.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/" className="text-primary underline hover:text-primary/90">Home</Link>
          <button onClick={() => void signOut()} className="text-primary underline hover:text-primary/90">
            Sign in with another account
          </button>
        </div>
      </Message>
    );
  }
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

export default RequireAdvisor;
