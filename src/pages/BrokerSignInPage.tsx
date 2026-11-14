import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import FirmName from "@/components/FirmName";
import LegalLinks from "@/components/LegalLinks";
import { useAuth } from "@/hooks/useAuth";
import { BROKER_PROVIDER_LABELS, BROKER_PROVIDERS, type BrokerProvider } from "@/data/mailboxScopes";
import { brokerNext, startBrokerSignIn } from "@/lib/brokerAuth";

/**
 * Where a broker signs in with their Google or Microsoft account, which also lets the product send a submission to a
 * PEO from their own address (story M-4.1; docs/adr/0005). It is not the prospect's sign-in: no employer is ever asked
 * to let the product send as them. A broker who declines the send permission still gets an account and the console,
 * and sends by hand with the thread's address in CC.
 */
const BrokerSignInPage = () => {
  const { user, loading, isAnonymous } = useAuth();
  const location = useLocation();
  const [starting, setStarting] = useState<BrokerProvider | null>(null);
  const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
  const next = brokerNext(from ? `${from.pathname}${from.search ?? ""}` : null);

  if (!loading && user && !isAnonymous) return <Navigate to={next} replace />;

  const start = async (provider: BrokerProvider) => {
    setStarting(provider);
    try {
      await startBrokerSignIn(provider, next);
    } catch {
      toast.error(`We couldn't start signing in with ${BROKER_PROVIDER_LABELS[provider]}. Try again in a minute.`);
      setStarting(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-10">
          <BrandMark className="w-9 h-9 text-primary" />
          <Wordmark className="text-3xl" />
        </Link>
        <div className="bg-card border border-border rounded-xl p-8 space-y-5">
          <div>
            <FirmName />
            <h1 className="font-display text-2xl font-bold text-center">Advisor and broker sign in</h1>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Use your work account. Signing in lets Nevermore send submissions to PEOs from your own address, so they reach your contacts as you.
            </p>
          </div>
          <div className="space-y-3">
            {BROKER_PROVIDERS.map((provider) => (
              <button
                key={provider}
                onClick={() => start(provider)}
                disabled={starting !== null}
                className="w-full min-h-12 border border-border rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {starting === provider && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {`Sign in with ${BROKER_PROVIDER_LABELS[provider]}`}
              </button>
            ))}
          </div>
          <div className="bg-muted border border-border rounded-lg p-4 space-y-2 text-sm">
            <p className="font-semibold">What you are agreeing to</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nevermore can <strong>send email as you</strong>, only when you send a submission or a reply.</li>
              <li>It <strong>never reads your mail</strong>: no inbox, no contacts, no drafts.</li>
              <li>You can disconnect at any time, and sending stops.</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            If you untick the send permission on {BROKER_PROVIDER_LABELS.google}'s or {BROKER_PROVIDER_LABELS.microsoft}'s screen you still get an account. You then send from your own mail with the thread address in CC.
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 mt-4 space-y-2">
          <h2 className="font-semibold">Already have a password?</h2>
          <p className="text-sm text-muted-foreground">
            Sign in with it as before. If you later use Google or Microsoft with the same email address, it joins this account: same role, same history.
          </p>
          <Link to="/login" state={{ audience: "advisor", from }} className="inline-block py-2 text-sm text-primary underline hover:text-primary/90">
            Sign in with email and password
          </Link>
        </div>
        <LegalLinks className="text-center mt-6" />
      </div>
    </div>
  );
};

export default BrokerSignInPage;
