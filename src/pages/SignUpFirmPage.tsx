import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import LegalLinks from "@/components/LegalLinks";
import { SITE_DOMAIN } from "@/data/site";
import { useAuth } from "@/hooks/useAuth";
import { firmUrl } from "@/lib/firmHost";
import { signUpFirm } from "@/lib/firmApi";

const input = "w-full min-h-11 bg-muted border border-border rounded-md px-3 text-sm";

/**
 * Where a person signs their firm up (story CRM-P1.1): a name and an address, from a signed-in account whose email is
 * verified (the sign-in screens verify it). They become the firm's owner; the firm waits for a platform admin's approval
 * and cannot send to a PEO until then. The database applies every rule and says why it refuses one.
 */
const SignUpFirmPage = () => {
  const { user, loading, isAnonymous } = useAuth();
  const location = useLocation();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; url: string } | null>(null);

  if (loading) return <div className="min-h-screen bg-background" role="status" aria-label="Checking your sign-in" />;
  if (!user || isAnonymous) {
    return <Navigate to="/login" replace state={{ from: location, reason: "account_needed" }} />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signUpFirm(name, address);
      setDone({ name: name.trim(), url: firmUrl(address) });
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-10">
          <BrandMark className="w-9 h-9 text-primary" />
          <Wordmark className="text-3xl" />
        </Link>
        <div className="bg-card border border-border rounded-xl p-8 space-y-5">
          {done ? (
            <>
              <h1 className="font-display text-2xl font-bold">{done.name} is set up</h1>
              <p className="text-sm text-muted-foreground">
                Your firm is waiting for approval by a Nevermore admin. You can work in it now; it can't send to a PEO until it is approved.
              </p>
              <p className="text-sm">
                Your firm's address is{" "}
                <a href={done.url} className="text-primary underline break-all">{done.url}</a>. Sign in there.
              </p>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-4" aria-label="Sign up your firm">
              <div>
                <h1 className="font-display text-2xl font-bold">Sign up your firm</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  You'll be the firm's owner, signed in as {user.email}. Your firm can work at once, but can't send to a PEO until a Nevermore admin approves it.
                </p>
              </div>
              <div>
                <label htmlFor="firm-name" className="text-xs text-muted-foreground">Firm name</label>
                <input id="firm-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={input} autoComplete="organization" />
              </div>
              <div>
                <label htmlFor="firm-address" className="text-xs text-muted-foreground">Firm address</label>
                <div className="flex items-center gap-2">
                  <input id="firm-address" value={address} onChange={(e) => setAddress(e.target.value)} required className={`${input} font-mono`}
                    autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="firm-address-rule" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.{SITE_DOMAIN}</span>
                </div>
                <p id="firm-address-rule" className="text-xs text-muted-foreground mt-1">3 to 40 letters, digits or hyphens.</p>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={busy || !name.trim() || !address.trim()}
                className="min-h-11 px-4 rounded-md border border-primary bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Signing up" /> : "Sign up your firm"}
              </button>
            </form>
          )}
        </div>
        <div className="mt-6 flex justify-center"><LegalLinks compact /></div>
      </div>
    </div>
  );
};

export default SignUpFirmPage;
