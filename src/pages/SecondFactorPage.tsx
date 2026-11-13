import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import LegalLinks from "@/components/LegalLinks";
import { useAuth } from "@/hooks/useAuth";
import { fetchNeedsSecondFactor } from "@/lib/advisorApi";
import { beginEnrolment, checkCode, verifiedAuthenticatorId, type Enrolment } from "@/lib/secondFactor";

type Step =
  | { kind: "checking" }
  | { kind: "not_needed" }
  | { kind: "enter"; factorId: string }
  | { kind: "set_up"; enrolment: Enrolment }
  | { kind: "failed"; message: string };

const inputClass =
  "w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground font-mono tracking-widest outline-none focus:border-primary/50 transition-colors";

/**
 * The second step of an advisor's password sign-in (story CRM-P1.3b, decision D-19): set up an authenticator app the
 * first time, then enter its code at each later sign-in. Shown only to someone whose role is held back by the missing
 * second factor; a Google or Microsoft sign-in relies on that provider and never reaches it. The database enforces
 * the rule (has_role); this screen only lets the person meet it.
 */
const SecondFactorPage = () => {
  const { user, loading, isAnonymous } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ kind: "checking" });
  const [attempt, setAttempt] = useState(0);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fromState = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
  const from = fromState ? `${fromState.pathname}${fromState.search ?? ""}` : "/advisor";
  const userId = user?.id;
  const signedIn = Boolean(userId) && !isAnonymous;

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    const show = (next: Step) => {
      if (!cancelled) setStep(next);
    };
    setStep({ kind: "checking" });
    void (async () => {
      let needed: boolean;
      try {
        needed = await fetchNeedsSecondFactor();
      } catch {
        return show({ kind: "failed", message: "We couldn't check your sign-in." });
      }
      if (!needed) return show({ kind: "not_needed" });
      try {
        const factorId = await verifiedAuthenticatorId();
        show(factorId ? { kind: "enter", factorId } : { kind: "set_up", enrolment: await beginEnrolment() });
      } catch {
        show({ kind: "failed", message: "We couldn't start setting up your second step." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, userId, attempt]);

  if (loading) return <Checking />;
  if (!signedIn) return <Navigate to="/login" replace state={{ from: fromState, audience: "advisor" }} />;
  if (step.kind === "not_needed") return <Navigate to={from} replace />;

  const factorId = step.kind === "enter" ? step.factorId : step.kind === "set_up" ? step.enrolment.factorId : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    const digits = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(digits)) return setCodeError("Enter the 6 digits from your authenticator app.");
    setBusy(true);
    setCodeError(null);
    const result = await checkCode(factorId, digits);
    setBusy(false);
    if (result === "ok") return navigate(from, { replace: true });
    setCodeError(
      result === "wrong_code"
        ? "That code didn't work. Check it, or wait for the next one, and try again."
        : "We couldn't check your code just now. Try again in a minute.",
    );
  };

  const codeField = (submitLabel: string) => (
    <>
      <div>
        <label htmlFor="second-factor-code" className="block text-xs text-muted-foreground mb-1.5">6-digit code (required)</label>
        <input
          id="second-factor-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={codeError ? true : undefined}
          aria-describedby={codeError ? "second-factor-error" : undefined}
          className={inputClass}
        />
        {codeError && <p id="second-factor-error" role="alert" className="text-sm text-warning mt-1.5">{codeError}</p>}
      </div>
      <button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
        {submitLabel}
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-10">
          <BrandMark className="w-9 h-9 text-primary" />
          <Wordmark className="text-3xl" />
        </Link>
        <div className="bg-card border border-border rounded-xl p-8">
          {step.kind === "checking" && <Checking inline />}
          {step.kind === "failed" && (
            <div className="space-y-4 text-center">
              <p role="alert" className="text-sm">{step.message}</p>
              <button onClick={() => setAttempt((n) => n + 1)} className="text-primary underline hover:text-primary/90">Try again</button>
            </div>
          )}
          {step.kind === "enter" && (
            <form onSubmit={submit} className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-center">Enter your code</h1>
              <p className="text-sm text-muted-foreground text-center">Open your authenticator app and type the 6-digit code it shows for Nevermore.</p>
              {codeField("Continue")}
            </form>
          )}
          {step.kind === "set_up" && (
            <form onSubmit={submit} className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-center">Add a second step to your sign-in</h1>
              <p className="text-sm text-muted-foreground text-center">
                Signing in with a password needs a code from an authenticator app as well. Until you add one, nothing of the advisor console opens.
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                <li>Install an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator or 1Password.</li>
                <li>
                  In the app, scan this code.
                  <img src={step.enrolment.qrCode} alt="Scan this code with your authenticator app" className="mx-auto my-3 w-44 h-44 bg-white rounded-lg p-2" />
                  Can't scan it? Type this key into the app instead: <span className="font-mono break-all">{step.enrolment.secret}</span>
                </li>
                <li>Type the 6-digit code the app now shows.</li>
              </ol>
              {codeField("Turn on and continue")}
            </form>
          )}
        </div>
        <LegalLinks copyright className="text-center mt-6" />
      </div>
    </div>
  );
};

const Checking = ({ inline = false }: { inline?: boolean }) => (
  <div className={inline ? "flex justify-center" : "min-h-screen bg-background flex items-center justify-center"} role="status">
    <Loader2 className="w-6 h-6 text-primary animate-spin" aria-hidden="true" />
    <span className="sr-only">Checking your sign-in…</span>
  </div>
);

export default SecondFactorPage;
