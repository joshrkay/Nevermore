import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import LegalLinks from "@/components/LegalLinks";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { acceptIntakeInvite, peekIntakeInvite } from "@/lib/brokerIntake";
import { forgetInvitationToken, takeInvitationToken } from "@/lib/invitationLink";

const button = "min-h-11 px-4 rounded-md border border-primary bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50";

// Where the link in a broker's invitation opens, at the firm's address: `/intake-invite#token=...` (slice 5.3; D-1703, D-1711, D-1757).
const IntakeInvitePage = () => {
  const [token] = useState(takeInvitationToken);
  const firm = useFirmAddress();
  const [invite, setInvite] = useState<{ firmName: string; contactName: string | null } | null>(null);
  const { user, loading, isAnonymous, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const address = firm.status === "known" ? firm.address : null;

  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      await acceptIntakeInvite(token, address!);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      return;
    }
    forgetInvitationToken();
    navigate("/start", { replace: true });
  };

  useEffect(() => {
    if (!address || !token) return;
    peekIntakeInvite(token, address).then(setInvite, (err: Error) => setProblem(err.message));
  }, [address, token]);

  const body = () => {
    if (loading || firm.status === "checking") return <div role="status" aria-label="Checking your sign-in">Checking your sign-in</div>;
    if (!address) return <><h1 className="font-display text-2xl font-bold">Open your invitation at your broker's address</h1><p className="text-sm text-muted-foreground">This invitation opens at your broker's own address. Use the link from the email you were sent.</p></>;
    if (!token) return <><h1 className="font-display text-2xl font-bold">This invitation link is incomplete</h1><p className="text-sm text-muted-foreground">Use the link from the email you were sent, exactly as it came.</p></>;
    if (problem) return <div role="alert" className="text-sm text-destructive space-y-2"><p>{problem}</p></div>;
    if (!invite) return <div role="status" aria-label="Opening your invitation">Opening your invitation</div>;
    return (
      <>
        <h1 className="font-display text-2xl font-bold">You were invited by {invite.firmName}</h1>
        <p className="text-sm text-muted-foreground">
          {invite.firmName} started this PEO intake{invite.contactName ? ` for ${invite.contactName}` : ""} and asks you to review it, finish it and certify it.
        </p>
        {user && !isAnonymous ? (
          <>
            <p className="text-sm text-muted-foreground">You're signed in as <span className="font-medium text-foreground">{user.email}</span>. The invitation works only for the email address it was sent to.</p>
            {error && <div role="alert" className="text-sm text-destructive space-y-2"><p>{error}</p><button className={button} onClick={() => void signOut()}>Sign out</button></div>}
            <button className={button} onClick={() => void open()} disabled={busy}>Open your intake</button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Sign in or create your account with the email address this invitation was sent to.</p>
            <button className={button} onClick={() => navigate("/login", { state: { from: { pathname: location.pathname, search: location.search }, reason: "account_needed" } })}>Sign in or create an account</button>
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
