import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useIntakeConsent } from "@/hooks/useIntakeConsent";
import {
  INTAKE_CONSENT_AGREEMENT,
  INTAKE_CONSENT_IS_DRAFT,
  INTAKE_CONSENT_SECTIONS,
  INTAKE_CONSENT_VERSION,
} from "@/data/intakeConsent";

const primaryButton =
  "bg-primary text-primary-foreground font-medium px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Nothing of the intake renders, and so nothing about the company or its employees can be typed, said or
 * uploaded, until the signed-in account has agreed to how intake information is used (US-6.2). The database
 * refuses a new intake or document without that agreement too; this is what the prospect sees.
 */
const IntakeConsentGate = ({ children }: { children: ReactNode }) => {
  const { status, agree, agreeing, agreeError, retry } = useIntakeConsent();
  const [checked, setChecked] = useState(false);
  const checkboxId = useId();
  const titleId = useId();

  if (status === "agreed") return <>{children}</>;

  if (status === "checking") {
    return (
      <div className="h-screen flex items-center justify-center bg-background" role="status" aria-label="Loading">
        <Loader2 className="w-6 h-6 text-primary animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
        <div className="text-center max-w-md w-full">
          <h1 className="font-display text-xl font-bold mb-3">We couldn't open your intake</h1>
          <p className="text-muted-foreground mb-6">
            Something went wrong reaching our server. Nothing has been changed. Try again in a moment.
          </p>
          <button type="button" onClick={retry} className={primaryButton}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 flex justify-center" aria-labelledby={titleId}>
      <div className="w-full max-w-2xl">
        <Link to="/" className="font-display text-sm text-foreground hover:text-primary transition-colors">
          Nevermore
        </Link>
        <h1 id={titleId} className="font-display text-3xl font-bold mt-6 mb-2">
          Before you start
        </h1>
        <p className="text-muted-foreground mb-6">
          The intake asks for information about your company and your employees. Here is who we are and what we do
          with it.
        </p>
        {INTAKE_CONSENT_IS_DRAFT && (
          <p className="text-xs font-medium text-warning mb-4">
            Draft wording, pending legal review ({INTAKE_CONSENT_VERSION})
          </p>
        )}
        <div className="space-y-4 mb-6">
          {INTAKE_CONSENT_SECTIONS.map((section) => (
            <section key={section.heading} className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-display text-lg font-bold mb-2">{section.heading}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Read the full{" "}
          <Link to="/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link to="/terms" target="_blank" className="underline underline-offset-2 hover:text-foreground">
            Terms of Use
          </Link>{" "}
          (they open in a new tab).
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (checked && !agreeing) void agree();
          }}
        >
          <div className="flex items-start gap-3 mb-4">
            <input
              id={checkboxId}
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <label htmlFor={checkboxId} className="text-sm leading-relaxed">
              {INTAKE_CONSENT_AGREEMENT}
            </label>
          </div>
          {agreeError && (
            <p role="alert" className="text-sm text-destructive mb-4">
              {agreeError}
            </p>
          )}
          <div className="flex items-center gap-4">
            <button type="submit" disabled={!checked || agreeing} className={primaryButton}>
              {agreeing ? "Recording…" : "Agree and start"}
            </button>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              Not now
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
};

export default IntakeConsentGate;
