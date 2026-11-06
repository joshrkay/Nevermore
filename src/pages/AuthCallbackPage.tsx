import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RavenIcon } from "@/components/RavenLogo";
import LegalLinks from "@/components/LegalLinks";
import { useAuth } from "@/hooks/useAuth";
import { authErrorMessage } from "@/data/authRateLimit";
import { parseAuthRedirect, safeNext, takeInitialAuthRedirect, type AuthRedirect } from "@/lib/authRedirect";

const inputClass =
  "w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors";
const primaryButton =
  "w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2";

/**
 * Whether Supabase looked at the token and refused it, as opposed to a request that never got an
 * answer (offline, a 5xx, a rate limit), after which the same token can be tried again.
 */
function tokenRefused(error: Error): boolean {
  const { status, code } = error as { status?: number; code?: string };
  if (code === "otp_expired") return true;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 429;
}

/** Says which account a link signed in to: someone else's link would sign this browser in as them. */
const confirmedToast = (email: string | null | undefined) =>
  toast.success(email ? `Email confirmed. You're signed in as ${email}.` : "Email confirmed. You're signed in.");

/**
 * What the person reads when Supabase refused the link. Always our own words: anyone can put an
 * error_description in a link to this site, so showing it would let them write on our page.
 */
function failureMessage(code: string): string {
  if (code === "otp_expired" || code === "access_denied") {
    return "This link has expired or was already used. Each link works once, and some email security tools open links before you do. If your email is already confirmed, sign in. Otherwise, send yourself a new link.";
  }
  return "We couldn't confirm your email with this link. Sign in, or send yourself a new link.";
}

const Card = ({ title, children }: { title: string; children: ReactNode }) => {
  // Each outcome replaces the last in the same place, sometimes under the button that had focus:
  // move focus to the new heading so it is announced and focus isn't left on nothing.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [title]);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 noise-overlay">
      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="flex items-center justify-center gap-2 mb-10">
          <RavenIcon className="w-8 h-8 text-primary" />
          <span className="font-display text-lg">Edgar Allan Advisory</span>
        </Link>
        <div className="bg-card border border-border rounded-xl p-8 space-y-5">
          <h1 ref={heading} tabIndex={-1} className="font-display text-2xl font-bold text-center outline-none">{title}</h1>
          {children}
        </div>
        <LegalLinks className="text-center mt-6" />
      </div>
    </div>
  );
};

/** Sends a new confirmation link to an address the person types. */
const ResendForm = ({ next }: { next: string }) => {
  const { resendConfirmation } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setError(null);
    const { error } = await resendConfirmation(address, next);
    setBusy(false);
    if (error) setError(authErrorMessage(error, "We couldn't send a new link. Try again in a minute."));
    else setSentTo(address);
  };

  if (sentTo) {
    return (
      <p role="status" className="text-sm text-center bg-muted border border-border rounded-lg px-4 py-2.5">
        If {sentTo} has an account waiting to be confirmed, a new email is on its way. Open its link, or
        sign in and enter its code.
      </p>
    );
  }
  return (
    <form onSubmit={send} className="space-y-3">
      <label htmlFor="resend-email" className="block text-xs text-muted-foreground">Email you signed up with</label>
      <input
        id="resend-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className={inputClass}
      />
      <button type="submit" disabled={busy || email.trim() === ""} className={primaryButton}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send a new link
      </button>
      {error && <p role="alert" className="text-sm text-warning text-center">{error}</p>}
    </form>
  );
};

/**
 * Where links in sign-up and email-change emails land (useAuth sends them here). It says whether the
 * link worked and goes on to `next` once the person is signed in. App also sends a page load that
 * arrived anywhere else with an auth result in its address here, e.g. a link Supabase sent to the
 * Site URL because the requested address wasn't on its Redirect URLs list.
 */
const AuthCallbackPage = () => {
  const { user, loading, isAnonymous, confirmEmailToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next") ?? (location.state as { next?: string } | null)?.next);
  // The address the page opened with (supabase-js clears its hash), or this one when we came here later.
  const [redirect] = useState<AuthRedirect | null>(() => takeInitialAuthRedirect() ?? parseAuthRedirect(window.location.href));
  const [tokenState, setTokenState] = useState<"idle" | "busy" | "failed">("idle");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [retryNote, setRetryNote] = useState<string | null>(null);

  const signedIn = !!user && !isAnonymous;

  useEffect(() => {
    if (redirect?.kind === "error") console.warn("Email link refused:", redirect.code, redirect.description);
  }, [redirect]);

  const confirm = async () => {
    if (redirect?.kind !== "token") return;
    setTokenState("busy");
    setRetryNote(null);
    const { error, email } = await confirmEmailToken(redirect.tokenHash, redirect.type);
    if (error && !tokenRefused(error)) {
      // The token wasn't spent, and the address bar may no longer hold it: keep the button.
      setTokenState("idle");
      setRetryNote("We couldn't reach the server. Check your connection and try again.");
      return;
    }
    if (error) {
      setTokenState("failed");
      setTokenError(failureMessage((error as { code?: string }).code ?? ""));
      return;
    }
    confirmedToast(email);
    navigate(next, { replace: true });
  };

  const signInLink = (
    <Link
      to="/login"
      state={{ from: { pathname: next } }}
      className="block text-center text-sm font-medium border border-border rounded-lg py-3 hover:border-primary/50 transition-colors"
    >
      Sign in
    </Link>
  );
  const continueLink = (
    <button type="button" onClick={() => navigate(next, { replace: true })} className={primaryButton}>
      Continue
    </button>
  );

  if (loading) {
    return (
      <Card title="Confirming your email">
        <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> One moment…
        </p>
      </Card>
    );
  }

  if (redirect?.kind === "token" && tokenState !== "failed") {
    return (
      <Card title="Confirm your email">
        <p className="text-sm text-muted-foreground text-center">One click and your account is ready.</p>
        <button type="button" onClick={confirm} disabled={tokenState === "busy"} className={primaryButton}>
          {tokenState === "busy" && <Loader2 className="w-4 h-4 animate-spin" />} Confirm my email
        </button>
        {retryNote && <p role="alert" className="text-sm text-warning text-center">{retryNote}</p>}
      </Card>
    );
  }

  // A refused link reads as refused even when this browser is signed in: the error doesn't say whose
  // link it was, and the account signed in here may be another one (an advisor testing a sign-up).
  // A link carrying a session is refused the same way: nobody is signed in from tokens in the address.
  if (redirect?.kind === "error" || tokenState === "failed" || redirect?.kind === "session") {
    const message =
      redirect?.kind === "error"
        ? failureMessage(redirect.code)
        : tokenError ?? "We couldn't sign you in with this link. Sign in, or send yourself a new link.";
    return (
      <Card title="This link didn't work">
        <p role="alert" className="text-sm text-muted-foreground text-center">{message}</p>
        {isAnonymous && user ? (
          // A guest's link is an email change: it has no password to sign in with and no sign-up to resend.
          <>
            <p className="text-sm text-center">Your intake is saved. Go back to it and ask for a new code where you verify your email.</p>
            <Link to="/start" className={primaryButton}>Back to your intake</Link>
          </>
        ) : signedIn ? (
          <>
            <p className="text-sm text-center">This browser is signed in as {user.email}.</p>
            {continueLink}
          </>
        ) : (
          signInLink
        )}
        {!(isAnonymous && user) && (
          <div className="border-t border-border pt-5">
            <ResendForm next={next} />
          </div>
        )}
      </Card>
    );
  }

  // Opened with no link, already signed in.
  if (signedIn && user.email_confirmed_at) {
    return (
      <Card title="Your email is confirmed">
        <p className="text-sm text-muted-foreground text-center">You're signed in as {user.email}.</p>
        {continueLink}
      </Card>
    );
  }

  return (
    <Card title="Nothing to confirm here">
      <p className="text-sm text-muted-foreground text-center">
        This page finishes email confirmation. Open the link in your confirmation email, or sign in.
      </p>
      {signInLink}
    </Card>
  );
};

export default AuthCallbackPage;
