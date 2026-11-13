import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { fetchIsMemberOfFirmAddress, recordFirmSignIn } from "@/lib/firmApi";
import NotFound from "@/pages/NotFound";
import { AUTH_CALLBACK_PATH } from "@/lib/authRedirect";
import { BROKER_CALLBACK_PATH } from "@/lib/brokerAuth";
import { JOIN_PATH } from "@/lib/invitationLink";
import { onMembershipChanged } from "@/lib/membershipChanged";

// The pages a sign-in lands on hold no data and finish by redirecting. At an existing firm's address they are left
// alone: hiding one while the new session is checked would unmount it half-way, and its one-time code would be spent
// twice. At an address no firm holds they are not mounted at all (D-27).
const SIGN_IN_LANDING_PATHS: readonly string[] = [AUTH_CALLBACK_PATH, BROKER_CALLBACK_PATH];

type Membership = "checking" | "member" | "not_member" | "error";

// Which sign-ins have been written to the firm's record (CRM-P2.3), so a person is recorded once for each sign-in and not
// once for each page they open. A convenience only: where the browser keeps nothing, the answer lasts until the page is
// reloaded, and the database collapses a repeat within half a minute either way.
const reportedHere = new Set<string>();
const SIGN_IN_REPORTED_PREFIX = "firm-sign-in-reported:";
function signInReported(key: string): boolean {
  if (reportedHere.has(key)) return true;
  try {
    return window.localStorage.getItem(SIGN_IN_REPORTED_PREFIX + key) !== null;
  } catch {
    return false;
  }
}
function markSignInReported(key: string): void {
  reportedHere.add(key);
  try {
    window.localStorage.setItem(SIGN_IN_REPORTED_PREFIX + key, "1");
  } catch {
    // Not remembered beyond this page.
  }
}

/**
 * What a firm's address shows (story CRM-P1.3a, D-17, D-18, D-27). On the bare domain it changes nothing. At an address
 * no firm holds: a plain not-found page for everyone, with a sign-out when a session exists there anyway; no sign-in
 * screen and no callback page. At a firm that exists and is not refused (approved or still waiting; a refused firm is treated as an address no firm holds, D-31): a signed-out visitor reaches the
 * sign-in screens, which name the firm; a signed-in current member reaches the console; a signed-in person who is not a
 * current member sees "You aren't a member of this firm" and a sign-out, and nothing else, whichever firm they do
 * belong to. This decides only what to render: the database refuses the data to a non-member anyway, and no firm is
 * put in the token.
 */
const FirmAddressGate = ({ children }: { children: ReactNode }) => {
  const firm = useFirmAddress();
  const { user, loading, isAnonymous, signOut } = useAuth();
  const { pathname } = useLocation();
  const userId = user?.id;
  // Membership is asked only at an address a firm holds.
  const address = firm.status === "known" ? firm.address : null;
  // The answer belongs to one person at one address: another person's, or another address's, is no answer.
  const asked = `${address}|${userId}`;
  const [answer, setAnswer] = useState<{ asked: string; result: Exclude<Membership, "checking"> } | null>(null);
  const membership: Membership = answer && answer.asked === asked ? answer.result : "checking";
  const [attempt, setAttempt] = useState(0);
  // A guest session is an employer's intake, not a sign-in to a firm.
  const signedIn = Boolean(userId) && !isAnonymous;

  // Joining a firm changes the answer: ask again, or the answer kept from before would refuse them until a reload.
  useEffect(() => onMembershipChanged(() => setAttempt((n) => n + 1)), []);

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

  // One sign-in is one entry: the key is the address, the person and the moment of their sign-in (it doesn't change when
  // the session is refreshed or the page reloaded).
  const signInKey = `${address}|${userId}|${user?.last_sign_in_at ?? ""}`;
  useEffect(() => {
    if (!address || !signedIn || membership !== "member" || signInReported(signInKey)) return;
    // A write that fails is not marked, so the next page tries again (a password sign-in is held back until its second
    // factor is done, for one).
    void recordFirmSignIn(address).then((ok) => {
      if (ok) markSignInReported(signInKey);
    });
  }, [address, signedIn, membership, signInKey, pathname]);

  if (firm.status === "none") return <>{children}</>;
  if (firm.status === "error") {
    return (
      <Message title="We couldn't load this page">
        <button onClick={firm.retry} className="text-primary underline hover:text-primary/90">Try again</button>
      </Message>
    );
  }
  if (firm.status === "checking") return <Checking />;
  if (firm.status === "unknown") {
    if (loading) return <Checking />;
    // A plain not-found page for everyone. A session that exists here anyway can be ended from it.
    return (
      <>
        <NotFound />
        {user && (
          <div className="fixed inset-x-0 bottom-6 text-center">
            <button onClick={() => void signOut()} className="text-primary underline hover:text-primary/90">Sign out</button>
          </div>
        )}
      </>
    );
  }
  if (SIGN_IN_LANDING_PATHS.includes(pathname)) return <>{children}</>;
  // An invitation's link is opened by someone who is not a member yet, to become one. The page holds no firm data and the
  // database decides who may accept (CRM-P1.2); every other page still refuses a person who is not a member.
  if (pathname === JOIN_PATH) return <>{children}</>;
  if (loading) return <Checking />;
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
