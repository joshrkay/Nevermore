import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import LegalLinks from "@/components/LegalLinks";
import { brokerNext, finishBrokerSignIn } from "@/lib/brokerAuth";

/**
 * Where Google or Microsoft sends a broker back (story M-4.1). It redeems the code it brought, which signs the broker
 * in, and then loads the console afresh so the whole app sees the new session. A refusal at the provider (the broker
 * cancelled, or their organisation doesn't allow the app) or a code that no longer works is told in our own words:
 * anyone can put an error_description in a link to this page.
 */
const BrokerCallbackPage = () => {
  const [params] = useSearchParams();
  const code = params.get("code");
  const refused = params.get("error") !== null || params.get("error_description") !== null || params.get("error_code") !== null;
  const next = brokerNext(params.get("next"));
  const [failed, setFailed] = useState(refused || !code);
  const started = useRef(false);

  useEffect(() => {
    if (refused || !code || started.current) return;
    // A code works once, and React may run an effect twice in development.
    started.current = true;
    finishBrokerSignIn(code)
      .then((result) => {
        // A mailbox that couldn't be connected is explained where it can be tried again, not lost on a reload.
        if (result.ok) window.location.assign(result.mailbox === "failed" ? "/advisor/mailbox?connect=failed" : next);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [code, refused, next]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="flex items-center justify-center gap-2 mb-10">
          <BrandMark className="w-9 h-9 text-primary" />
          <Wordmark className="text-3xl" />
        </Link>
        {failed ? (
          <div className="bg-card border border-border rounded-xl p-8 space-y-4">
            <h1 className="font-display text-2xl font-bold">We couldn't sign you in</h1>
            <p className="text-sm text-muted-foreground">
              The sign-in was cancelled, was refused by your organisation, or the link has already been used. Try again, or sign in with your email and password.
            </p>
            <div className="flex justify-center gap-4 text-sm">
              <Link to="/broker/sign-in" className="text-primary underline hover:text-primary/90">Try again</Link>
              <Link to="/login" state={{ audience: "advisor" }} className="text-primary underline hover:text-primary/90">Use a password</Link>
            </div>
          </div>
        ) : (
          <div role="status" className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Signing you in and connecting your mailbox…
          </div>
        )}
        <LegalLinks className="text-center mt-6" />
      </div>
    </div>
  );
};

export default BrokerCallbackPage;
