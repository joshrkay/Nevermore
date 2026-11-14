import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { checkCode } from "@/lib/secondFactor";
import type { StepUp } from "@/lib/stepUp";

const inputClass = "w-full min-h-11 bg-muted border border-border rounded-md px-3 text-sm";
const buttonClass = "min-h-11 px-4 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";

interface Props {
  way: StepUp;
  /** The person proved who they are again: the export goes on. */
  onDone: () => void;
  onCancel: () => void;
  /** For a person with nothing to enter here: ends this device's session and brings them back to the page. */
  onSignInAgain: () => void;
}

/**
 * "Sign in again to export a whole table", in place (story CRM-S3.8a): the person's authenticator code, or their password, or (for someone who signed in
 * with Google or Microsoft) a button that signs them in again from the sign-in page and brings them back. Nothing is exported from here: it only says
 * when the person has proved who they are again, and the export asks the database again.
 */
export function StepUpDialog({ way, onDone, onCancel, onSignInAgain }: Props) {
  const { signIn } = useAuth();
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || way.kind === "sign_in_again") return;
    setProblem(null);
    if (way.kind === "code") {
      const digits = value.replace(/\s/g, "");
      if (!/^\d{6}$/.test(digits)) return setProblem("Enter the 6 digits from your authenticator app.");
      setBusy(true);
      const result = await checkCode(way.factorId, digits);
      setBusy(false);
      if (result === "ok") return onDone();
      return setProblem(result === "wrong_code"
        ? "That code didn't work. Check it, or wait for the next one, and try again."
        : "We couldn't check your code just now. Try again in a minute.");
    }
    if (value === "") return setProblem("Enter your password.");
    setBusy(true);
    const { error } = await signIn(way.email, value);
    setBusy(false);
    if (!error) return onDone();
    return setProblem((error as { code?: string }).code === "invalid_credentials"
      ? "That password didn't work. Check it and try again."
      : "We couldn't check your password just now. Try again in a minute.");
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in again to export a whole table.</DialogTitle>
          <DialogDescription>
            {way.kind === "code" && "Your last sign-in was a while ago. Type the 6-digit code your authenticator app shows for Nevermore, and the export goes on."}
            {way.kind === "password" && "Your last sign-in was a while ago. Type your password, and the export goes on."}
            {way.kind === "sign_in_again" && "Your last sign-in was a while ago. This signs you out on this device only; sign in again and you come back to this page."}
          </DialogDescription>
        </DialogHeader>
        {way.kind === "sign_in_again" ? (
          <DialogFooter>
            <button type="button" onClick={onCancel} className={buttonClass}>Cancel</button>
            <button type="button" onClick={onSignInAgain} className={`${buttonClass} bg-primary text-primary-foreground hover:bg-primary/90`}>Sign in again</button>
          </DialogFooter>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <div>
              <label htmlFor="step-up-value" className="block text-xs text-muted-foreground mb-1.5">
                {way.kind === "code" ? "6-digit code from your authenticator app" : "Password"}
              </label>
              <input
                id="step-up-value"
                type={way.kind === "code" ? "text" : "password"}
                inputMode={way.kind === "code" ? "numeric" : undefined}
                autoComplete={way.kind === "code" ? "one-time-code" : "current-password"}
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? "step-up-problem" : undefined}
                className={inputClass}
              />
              {problem && <p id="step-up-problem" role="alert" className="text-sm text-destructive mt-1.5">{problem}</p>}
            </div>
            <DialogFooter>
              <button type="button" onClick={onCancel} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={`${buttonClass} flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90`}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Confirm and export
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
