import { useState } from "react";
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { RavenIcon } from "@/components/RavenLogo";
import LegalLinks from "@/components/LegalLinks";
import { useAuth } from "@/hooks/useAuth";
import { authErrorMessage } from "@/data/authRateLimit";
import { toast } from "sonner";

const AuthPage = () => {
  const location = useLocation();
  // Sent here because guest sessions aren't available: most such visitors are new, so offer an account first.
  const [isSignUp, setIsSignUp] = useState(() => (location.state as { reason?: string } | null)?.reason === "account_needed");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  // The address a confirmation email went to: after sign-up, or after a sign-in refused until it's
  // confirmed (`unconfirmed`), so the code from that email can be entered either way.
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const { user, loading: authLoading, isAnonymous, signIn, signUp, resendConfirmation, verifySignupCode } = useAuth();
  const navigate = useNavigate();
  const routeState = location.state as {
    from?: { pathname: string; search?: string };
    audience?: string;
    reason?: string;
  } | null;
  const fromLocation = routeState?.from;
  // Advisors are given accounts; they don't sign up here.
  const forAdvisor = routeState?.audience === "advisor";
  const from = fromLocation ? `${fromLocation.pathname}${fromLocation.search ?? ""}` : forAdvisor ? "/advisor" : "/start";
  const notice =
    routeState?.reason === "expired"
      ? "Your session expired. Sign in again to continue."
      : routeState?.reason === "signed_out"
        ? "You've been signed out."
        : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setAlreadyRegistered(false);
    setUnconfirmed(false);
    const address = email.trim();

    if (isSignUp) {
      const { error, alreadyRegistered } = await signUp(address, password, companyName.trim() || undefined, from);
      if (error) {
        toast.error(authErrorMessage(error));
      } else if (alreadyRegistered) {
        // Supabase sends no link for an address that has an account; sign in instead.
        setIsSignUp(false);
        setAlreadyRegistered(true);
      } else {
        setLinkSentTo(address);
      }
    } else {
      const { error } = await signIn(address, password);
      if (!error) {
        navigate(from, { replace: true });
      } else if ((error as { code?: string }).code === "email_not_confirmed" || /email not confirmed/i.test(error.message)) {
        setUnconfirmed(true);
        setLinkSentTo(address);
      } else {
        toast.error(authErrorMessage(error));
      }
    }
    setLoading(false);
  };

  const resend = async (address: string) => {
    setResending(true);
    const { error } = await resendConfirmation(address, from);
    setResending(false);
    if (error) toast.error(authErrorMessage(error));
    else toast.success(`We sent a new email to ${address}.`);
  };

  // The code in the email confirms the account here, so it works even when the link doesn't: a link
  // opened on another device, or one a mail scanner opened first.
  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkSentTo) return;
    setVerifying(true);
    setCodeError(null);
    const { error } = await verifySignupCode(linkSentTo, code.trim());
    setVerifying(false);
    if (error) setCodeError("That code didn't work. Check it, or send a new email and use the newest one.");
    else navigate(from, { replace: true });
  };

  // A guest session isn't a sign-in: let the guest sign in properly (advisor pages send guests here).
  if (!authLoading && user && !isAnonymous) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 noise-overlay">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <Link to="/" className="flex items-center justify-center gap-2 mb-10">
          <RavenIcon className="w-8 h-8 text-primary" />
          <span className="font-display text-lg">Edgar Allan Advisory</span>
        </Link>

        <div className="bg-card border border-border rounded-xl p-8">
          <h1 className="font-display text-2xl font-bold text-center mb-2">
            {linkSentTo ? "Check your email" : forAdvisor ? "Advisor Sign In" : isSignUp ? "Enter The Chamber" : "Welcome Back"}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            {linkSentTo
              ? "One more step to finish your account."
              : forAdvisor
                ? "Sign in with your advisor account to continue."
                : isSignUp
                  ? "Create your account to begin underwriting."
                  : "Sign in to continue your session."}
          </p>

          {notice && (
            <p role="status" className="text-sm text-center bg-muted border border-border rounded-lg px-4 py-2.5 mb-6">
              {notice}
            </p>
          )}

          {alreadyRegistered && (
            <p role="status" className="text-sm text-center bg-muted border border-border rounded-lg px-4 py-2.5 mb-6">
              That email already has an account. Sign in with it below.
            </p>
          )}

          {linkSentTo ? (
            <div className="space-y-4 text-center">
              <p role="status" className="text-sm">
                {unconfirmed && "Confirm your email first. "}
                We sent a confirmation email to <span className="font-medium">{linkSentTo}</span>
                {unconfirmed && " when you signed up"}. Open the link in it, or enter its 6-digit code here
                if it has one.
              </p>
              <form onSubmit={verifyCode} className="space-y-3 text-left">
                <label htmlFor="signup-code" className="block text-xs text-muted-foreground">6-digit code</label>
                <div className="flex gap-2">
                  <input
                    id="signup-code"
                    // The form that had focus is gone; put it where the next step is.
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground font-mono tracking-widest outline-none focus:border-primary/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={verifying || code.trim().length < 6}
                    className="text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
                  >
                    {verifying ? "…" : "Confirm"}
                  </button>
                </div>
                {codeError && <p role="alert" className="text-sm text-warning">{codeError}</p>}
              </form>
              <p className="text-xs text-muted-foreground">
                Nothing after a few minutes? Check spam, or send a new email. Only the newest one works.
              </p>
              <button
                type="button"
                onClick={() => resend(linkSentTo)}
                disabled={resending}
                className="w-full border border-border text-foreground font-medium py-3 rounded-lg hover:border-primary/50 transition-colors disabled:opacity-50"
              >
                {resending ? "Sending…" : "Send a new email"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkSentTo(null);
                  setUnconfirmed(false);
                  setCode("");
                  setCodeError(null);
                }}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company's legal name"
                  className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
            </button>
            {isSignUp && (
              <p className="text-xs text-muted-foreground text-center">
                By creating an account you agree to the{" "}
                <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">Terms of Use</Link>{" "}
                and acknowledge the{" "}
                <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
              </p>
            )}
          </form>
          )}

          {!forAdvisor && !linkSentTo && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAlreadyRegistered(false);
                  setUnconfirmed(false);
                }}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                {isSignUp ? "Sign in" : "Create one"}
              </button>
            </p>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © Edgar Allan Advisory. All nightmares are optional.
        </p>
        <LegalLinks className="text-center mt-2" />
      </motion.div>
    </div>
  );
};

export default AuthPage;
