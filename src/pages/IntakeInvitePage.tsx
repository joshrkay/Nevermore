import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import LegalLinks from "@/components/LegalLinks";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { acceptIntakeInvite, peekIntakeInvite } from "@/lib/brokerIntake";
import { forgetInvitationToken, takeInvitationToken } from "@/lib/invitationLink";

const button = "min-h-11 px-4 rounded-md border border-primary bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50";

/**
 * Where the link in a broker's invitation opens, at the firm's address (slice 5.3; D-1703, D-1711, D-1713): `/intake-invite#token=...`. The secret is after the #, which a browser never sends
 * to a server; the page reads it and takes it out of the address bar at once (D-34), and keeps it in this tab only until the person has signed in and opened their intake. A visitor is told
 * which firm invited them (and that opening the link is recorded, for the broker's step 3), then signs in or creates their account; the signed-in person presses one button and the intake
 * becomes theirs, which the database allows only for the email the link was sent to, never for a member of the firm. Counsel's wording of the agreement and of "the firm will see your answers"
 * is shown by the intake's own consent screen (D-12, D-1744), which the intake opens on.
 */
const IntakeInvitePage = () => {
  // Read once, on the first render: this is what takes it out of the address bar.
  const [token] = useState(takeInvitationToken);
  const firm = useFirmAddress();
  const { user, loading, isAnonymous, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<{ firmName: string; contactName: string | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const address = firm.status === "known" ? firm.address : null;
  const signedIn = Boolean(user) && !isAnonymous;

  // Opening the link is the one thing that reads it: the firm's name and who it is for, and the broker's step 3 learns it was opened.
  useEffect(() => {
    if (!address || !token) return;
    let cancelled = false;
    peekIntakeInvite(token, address).then(
      (found) => !cancelled && setInvite(found),
      (err: Error) => !cancelled && setProblem(err.message),
    );
    return () => { cancelled = true; };
  }, [address, token]);

  const open = async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      await acceptIntakeInvite(token, address);
      forgetInvitationToken();
      navigate("/start", { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const body = () => {
    if (loading || firm.status === "checking") return <div role="status" aria-label="Checking your sign-in" className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" aria-hidden="true" /></div>;
    if (!address) {
      return (
        <>
          <h1 className="font-display text-2xl font-bold">Open your invitation at your broker's address</h1>
          <p className="text-sm text-muted-foreground">This invitation opens at your broker's own address. Use the link from the email you were sent.</p>
        </>
      );
    }
    if (!token) {
      return (
        <>
          <h1 className="font-display text-2xl font-bold">This invitation link is incomplete</h1>
          <p className="text-sm text-muted-foreground">Use the link from the email you were sent, exactly as it came.</p>
        </>
      );
    }
    if (problem) return <div role="alert" className="text-sm text-destructive"><p>{problem}</p></div>;
    if (!invite) return <div role="status" aria-label="Opening your invitation" className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" aria-hidden="true" /></div>;
    return (
      <>
        <h1 className="font-display text-2xl font-bold">You were invited by {invite.firmName}</h1>
        <p className="text-sm text-muted-foreground">
          {invite.firmName} started this PEO intake{invite.contactName ? ` for ${invite.contactName}` : ""} and asks you to review it, finish it and certify it.
        </p>
        {signedIn ? (
          <>
            <p className="text-sm text-muted-foreground">
              You're signed in as <span className="font-medium text-foreground">{user?.email}</span>. The invitation works only for the email address it was sent to.
            </p>
            {error && (
              <div role="alert" className="text-sm text-destructive space-y-2">
                <p>{error}</p>
                <button className="underline" onClick={() => void signOut()}>Sign out</button>
              </div>
            )}
            <button className={button} onClick={() => void open()} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Opening" /> : "Open your intake"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Sign in or create your account with the email address this invitation was sent to.</p>
            <button className={button} onClick={() => navigate("/login", { state: { from: { pathname: location.pathname, search: location.search }, reason: "account_needed" } })}>
              Sign in or create an account
            </button>
          </>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-10">
          <BrandMark className="w-9 h-9 text-primary" />
          <Wordmark className="text-3xl" />
        </div>
        <div className="bg-card border border-border rounded-xl p-8 space-y-5">{body()}</div>
        <div className="mt-6 flex justify-center"><LegalLinks compact /></div>
      </div>
    </div>
  );
};

export default IntakeInvitePage;
