import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { RavenIcon } from "./RavenLogo";
import TurnstileWidget from "./TurnstileWidget";
import { useAuth } from "@/hooks/useAuth";

// Signed-out visitors get an anonymous guest session so they can fill in the intake without an
// account; an email-verified account is required later, at certification. If guest sessions
// aren't available, fall back to /login, remembering where they were headed.
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading, signInAnonymously } = useAuth();
  const location = useLocation();
  const [guestFailed, setGuestFailed] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const requestedGuest = useRef(false);
  // Guest sessions are free to create, so when a Turnstile site key is configured the
  // visitor must pass the challenge before one is issued.
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  useEffect(() => {
    if (loading || user || requestedGuest.current) return;
    if (siteKey && !captchaToken) return;
    requestedGuest.current = true;
    signInAnonymously(captchaToken ?? undefined).then(({ error }) => {
      if (error) setGuestFailed(true);
    });
  }, [loading, user, signInAnonymously, siteKey, captchaToken]);

  if (loading || (!user && !guestFailed)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RavenIcon className="w-10 h-10 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-sm text-muted-foreground">Entering The Chamber...</p>
          {!loading && !user && siteKey && !captchaToken && (
            <div className="mt-6 flex justify-center">
              <TurnstileWidget siteKey={siteKey} onToken={setCaptchaToken} onError={() => setGuestFailed(true)} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default RequireAuth;
