import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { RavenIcon } from "./RavenLogo";
import { useAuth } from "@/hooks/useAuth";
import { AUTH_CALLBACK_PATH, authCallbackUrl, DEFAULT_NEXT, peekInitialAuthRedirect, safeNext } from "@/lib/authRedirect";

/**
 * A page load whose address carries the result of an email link (an error, or a session Supabase
 * granted) but didn't land on /auth/callback goes there first, so the person is told what happened
 * instead of the result being dropped. That happens for links in emails sent before the callback page
 * existed (they point at /start), and when Supabase sends the person to the Site URL because the
 * address the app asked for isn't on its Redirect URLs list.
 *
 * A link carrying a session (#access_token=…) goes there too and is refused: the client never signs in from
 * the address (detectSessionInUrl is off), and moving to the callback page drops the tokens from it.
 *
 * It waits for auth to load, so the callback page knows who, if anyone, this browser is signed in as.
 */
const AuthRedirectGate = ({ children }: { children: ReactNode }) => {
  const { loading } = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState(() => location.pathname !== AUTH_CALLBACK_PATH && peekInitialAuthRedirect() !== null);
  const [arrivedAt] = useState(() => location.pathname);

  useEffect(() => {
    if (location.pathname === AUTH_CALLBACK_PATH) setPending(false);
  }, [location.pathname]);

  if (!pending || location.pathname === AUTH_CALLBACK_PATH) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RavenIcon className="w-10 h-10 text-primary animate-pulse" />
      </div>
    );
  }

  // The site root is where Supabase falls back to; the person was on their way into the Chamber.
  const next = arrivedAt === "/" ? DEFAULT_NEXT : safeNext(arrivedAt);
  const target = authCallbackUrl("", next);
  return <Navigate to={target} replace />;
};

export default AuthRedirectGate;
