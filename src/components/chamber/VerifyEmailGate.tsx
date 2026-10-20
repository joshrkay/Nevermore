import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const inputClass =
  "w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors";

/**
 * Guests can fill in the whole intake; certifying needs an identified signer, so a guest
 * attaches and verifies an email here. Verification upgrades the same user in place, so
 * everything entered so far stays theirs.
 */
const VerifyEmailGate = () => {
  const { requestEmailCode, verifyEmailCode } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sendCode = async () => {
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setMessage(null);
    const { error, emailInUse } = await requestEmailCode(address);
    setBusy(false);
    if (emailInUse) {
      setMessage(
        "That email already has an account. Use a different email for now; we can't yet move your answers into an existing account.",
      );
    } else if (error) {
      setMessage("We couldn't send a code. Check the address and try again.");
    } else {
      setEmail(address);
      setCodeSent(true);
    }
  };

  const verify = async () => {
    setBusy(true);
    setMessage(null);
    const { error } = await verifyEmailCode(email, code.trim());
    setBusy(false);
    if (error) setMessage("That code didn't work. Check it and try again, or send a new one.");
  };

  return (
    <div className="border border-border rounded-xl p-6 space-y-4">
      <div>
        <h3 className="font-display text-xl font-bold mb-1">Verify your email to certify</h3>
        <p className="text-sm text-muted-foreground">
          Your answers are saved. To sign and generate The Manuscript, confirm an email so we know who certified it.
        </p>
      </div>

      {!codeSent ? (
        <div className="space-y-3">
          <label htmlFor="gate-email" className="text-sm text-muted-foreground block">Work email</label>
          <div className="flex gap-2">
            <input
              id="gate-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <button
              onClick={sendCode}
              disabled={busy || email.trim() === ""}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 flex items-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send code
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">We sent a code to {email}.</p>
          <label htmlFor="gate-code" className="text-sm text-muted-foreground block">6-digit code</label>
          <div className="flex gap-2">
            <input
              id="gate-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputClass}
            />
            <button
              onClick={verify}
              disabled={busy || code.trim().length < 6}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 flex items-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify
            </button>
          </div>
        </div>
      )}

      {message && <p role="alert" className="text-sm text-warning">{message}</p>}
    </div>
  );
};

export default VerifyEmailGate;
