import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { authRateLimit, authRateLimitMessage } from "@/data/authRateLimit";

const inputClass =
  "w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors";
const buttonClass =
  "text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 flex items-center gap-2 shrink-0";

/**
 * Gets someone back to an intake this browser no longer holds the sign-in for (another device, or data
 * cleared): they sign in with a code emailed to the address they verified. The Chamber then opens their
 * intake. A guest who never verified an email has no account to return to, which the copy says.
 *
 * The answer is the same whether or not the address has an account, so the form can't be used to find out.
 */
const RecoverIntake = ({ idPrefix = "recover" }: { idPrefix?: string }) => {
  const { requestSignInCode, verifySignInCode } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sendCode = async () => {
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setMessage(null);
    const { error } = await requestSignInCode(address);
    setBusy(false);
    if (error) {
      const limit = authRateLimit(error);
      setMessage(limit ? authRateLimitMessage(limit) : "We couldn't send a code just now. Check the address and try again.");
      return;
    }
    setSentTo(address);
  };

  const signIn = async () => {
    if (!sentTo) return;
    setBusy(true);
    setMessage(null);
    const { error } = await verifySignInCode(sentTo, code.trim());
    setBusy(false);
    if (error) setMessage("That code didn't work. Check it and try again, or send a new one.");
  };

  return (
    <div className="space-y-3 text-left">
      {!sentTo ? (
        <>
          <label htmlFor={`${idPrefix}-email`} className="text-sm text-muted-foreground block">
            The email you verified
          </label>
          <div className="flex gap-2">
            <input
              id={`${idPrefix}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sendCode()}
              className={inputClass}
            />
            <button type="button" onClick={sendCode} disabled={busy || email.trim() === ""} className={buttonClass}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Email me a code
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            If {sentTo} has an account with us, a 6-digit sign-in code is on its way.
          </p>
          <label htmlFor={`${idPrefix}-code`} className="text-sm text-muted-foreground block">6-digit code</label>
          <div className="flex gap-2">
            <input
              id={`${idPrefix}-code`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && code.trim().length === 6 && void signIn()}
              className={inputClass}
            />
            <button type="button" onClick={signIn} disabled={busy || code.trim().length < 6} className={buttonClass}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Sign in
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setSentTo(null); setCode(""); setMessage(null); }}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Use a different email
          </button>
        </>
      )}
      {message && <p role="alert" className="text-sm text-warning">{message}</p>}
    </div>
  );
};

export default RecoverIntake;
