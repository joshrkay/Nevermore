import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import LegalLinks from "@/components/LegalLinks";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { acceptInvitation, type FirmRole } from "@/lib/invitationApi";
import { forgetInvitationToken, takeInvitationToken } from "@/lib/invitationLink";
import { notifyMembershipChanged } from "@/lib/membershipChanged";

const button = "min-h-11 px-4 rounded-md border border-primary bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50";

/**
 * Where an invitation's link opens, at the firm's address (story CRM-P1.2): `/join#token=...`. The secret is after the #, which a
 * browser never sends to a server; the page reads it and takes it out of the address bar at once (D-34), and keeps it in this tab
 * only until the person has signed in and joined. A signed-out visitor is sent to sign in or create their account, then comes back
 * here; the signed-in person presses one button to join. The database decides everything: it accepts only the invited email,
 * verified, only at the address of the invitation's firm, and says plainly why a link can't be used (used, expired, withdrawn, or
 * another email). The secret is handed to the call as its hash, and never shown.
 */
const JoinFirmPage = () => {
  // Read once, on the first render: this is what takes it out of the address bar.
  const [token] = useState(takeInvitationToken);
  const firm = useFirmAddress();
  const { user, loading, isAnonymous, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<FirmRole | null>(null);
  const firmName = firm.status === "known" ? firm.name : null;
  const signedIn = Boolean(user) && !isAnonymous;

  const join = async () => {
    if (firm.status !== "known") return;
    setBusy(true);
    setError(null);
    try {
      const result = await acceptInvitation(token, firm.address);
      forgetInvitationToken();
      setJoined(result.role);
      // The firm address gate asked whether this person was a member before they joined; it must ask again.
      notifyMembershipChanged();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  const body = () => {
    if (loading || firm.status === "checking") return <div role="status" aria-label="Checking your sign-in" className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" aria-hidden="true" /></div>;
    if (!firmName) {
      return (
        <>
          <h1 className="font-display text-2xl font-bold">Open your invitation at your firm's address</h1>
          <p className="text-sm text-muted-foreground">This invitation opens at your firm's own address. Use the link from the email you were sent.</p>
        </>
      );
    }
    if (!token && !joined) {
      return (
        <>
          <h1 className="font-display text-2xl font-bold">This invitation link is incomplete</h1>
          <p className="text-sm text-muted-foreground">Use the link from the email you were sent, exactly as it came.</p>
        </>
      );
    }
    if (joined) {
      return (
        <>
          <h1 className="font-display text-2xl font-bold">You've joined {firmName}</h1>
          <p className="text-sm text-muted-foreground">You're now {joined === "lead" ? "a" : "an"} {joined} of {firmName}.</p>
          <Link to="/advisor" className={`${button} inline-flex items-center`}>Continue</Link>
        </>
      );
    }
    if (!signedIn) {
      return (
        <>
          <h1 className="font-display text-2xl font-bold">Join {firmName}</h1>
          <p className="text-sm text-muted-foreground">
            You've been invited to join {firmName}. Sign in or create your account with the email address this invitation was sent to.
          </p>
          <button className={button} onClick={() => navigate("/login", { state: { from: { pathname: location.pathname, search: location.search }, reason: "account_needed" } })}>
            Sign in or create an account
          </button>
        </>
      );
    }
    return (
      <>
        <h1 className="font-display text-2xl font-bold">Join {firmName}</h1>
        <p className="text-sm text-muted-foreground">
          You're signed in as <span className="font-medium text-foreground">{user?.email}</span>. The invitation works only for the email address it was sent to.
        </p>
        {error && (
          <div role="alert" className="text-sm text-destructive space-y-2">
            <p>{error}</p>
            <button className="underline" onClick={() => void signOut()}>Sign out</button>
          </div>
        )}
        <button className={button} onClick={() => void join()} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Joining" /> : `Join ${firmName}`}
        </button>
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

export default JoinFirmPage;
