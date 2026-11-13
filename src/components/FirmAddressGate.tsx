import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { fetchIsMemberOfFirmAddress } from "@/lib/firmApi";
import NotFound from "@/pages/NotFound";
import { AUTH_CALLBACK_PATH } from "@/lib/authRedirect";
import { BROKER_CALLBACK_PATH } from "@/lib/brokerAuth";

// The pages a sign-in lands on hold no data and finish by redirecting. They are left alone: hiding one while the new
// session is checked would unmount it half-way, and its one-time code would be spent twice.
const SIGN_IN_LANDING_PATHS: readonly string[] = [AUTH_CALLBACK_PATH, BROKER_CALLBACK_PATH];

type Membership = "checking" | "member" | "not_member" | "error";

/**
 * What a firm's address shows (story CRM-P1.3a, D-17, D-18). On the bare domain it changes nothing. At a firm's address:
 * a signed-out visitor reaches the sign-in screens (with no firm name where no approved firm holds the address); a
 * signed-in person at an address no approved firm holds sees a plain not-found page, unless they are a member of the
 * firm waiting for approval there; and
 * a signed-in person who is not a current member of that firm sees "You aren't a member of this firm" and nothing
 * else, whichever firm they do belong to. This decides only what to render: the database refuses the data to a
 * non-member anyway, and no firm is put in the token.
 */
const FirmAddressGate = ({ children }: { children: ReactNode }) => {
  const firm = useFirmAddress();
  const { user, loading, isAnonymous, signOut } = useAuth();
  const { pathname } = useLocation();
  const userId = user?.id;
  // At an address no approved firm holds, a member of the firm waiting for approval is still let in (PRD 8.2: approval
  // blocks sending, not working), so the question is asked there too.
  const address = firm.status === "known" || firm.status === "unknown" ? firm.address : null;
  // The answer belongs to one person at one address: another person's, or another address's, is no answer.
  const asked = `${address}|${userId}`;
  const [answer, setAnswer] = useState<{ asked: string; result: Exclude<Membership, "checking"> } | null>(null);
  const membership: Membership = answer && answer.asked === asked ? answer.result : "checking";
  const [attempt, setAttempt] = useState(0);
  // A guest session is an employer's intake, not a sign-in to a firm.
  const signedIn = Boolean(userId) && !isAnonymous;

  useEffect(() => {
    if (!address || !signedIn) return;
    let cancelled = false;
    setAnswer(null);
    fetchIsMemberOfFirmAddress(address).then(
      (ok) => !cancelled && setAnswer({ asked, result: ok ? "member" : "not_member" }),
      () => !cancelled && setAnswer({ asked, result: "error" }),
    );
    return () => { cancelled = true; };
  }, [address, userId, signedIn, asked, attempt]);

  if (firm.status === "none") return <>{children}</>;
  if (SIGN_IN_LANDING_PATHS.includes(pathname)) return <>{children}</>;
  if (firm.status === "checking" || loading) return <Checking />;
  if (firm.status === "unknown") {
    // A session is kept per address, so the member of a firm waiting for approval has to sign in here. The sign-in
    // screens show no firm name at an unknown address (FirmName), so nothing tells it from an address nobody holds.
    if (!signedIn) return <>{children}</>;
    // Nothing tells a non-member (or a failed check) from a visitor at an address nobody holds.
    return membership === "checking" ? <Checking /> : membership === "member" ? <>{children}</> : <NotFound />;
  }
  if (firm.status === "error") {
    return (
      <Message title="We couldn't load this page">
        <button onClick={firm.retry} className="text-primary underline hover:text-primary/90">Try again</button>
      </Message>
    );
  }
  if (!signedIn) return <>{children}</>;
  if (membership === "checking") return <Checking />;
  if (membership === "error") {
    return (
      <Message title="We couldn't check your access">
        <button onClick={() => setAttempt((n) => n + 1)} className="text-primary underline hover:text-primary/90">Try again</button>
      </Message>
    );
  }
  if (membership === "not_member") {
    return (
      <Message title="You aren't a member of this firm">
        <button onClick={() => void signOut()} className="text-primary underline hover:text-primary/90">Sign out</button>
      </Message>
    );
  }
  return <>{children}</>;
};

const Checking = () => (
  <div className="min-h-screen bg-background flex items-center justify-center" role="status">
    <Loader2 className="w-6 h-6 text-primary animate-spin" aria-hidden="true" />
    <span className="sr-only">Checking access…</span>
  </div>
);

const Message = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="min-h-screen bg-background flex items-center justify-center px-6">
    <div className="text-center max-w-md">
      <ShieldAlert className="w-8 h-8 text-primary mx-auto mb-4" aria-hidden="true" />
      <h1 className="font-display text-2xl font-bold mb-3">{title}</h1>
      {children}
    </div>
  </div>
);

export default FirmAddressGate;
