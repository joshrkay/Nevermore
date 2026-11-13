import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import { formatDateTime } from "@/components/advisor/format";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import {
  cancelInvitation, fetchMyFirm, fetchPendingInvitations, inviteMember, resendInvitation,
  type FirmRole, type PendingInvitation,
} from "@/lib/invitationApi";

const input = "w-full min-h-11 bg-muted border border-border rounded-md px-3 text-sm";
const button = "min-h-11 px-4 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";
const ROLE_LABELS: Record<FirmRole, string> = { agent: "Agent", lead: "Lead", owner: "Owner" };

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "not_owner" }
  | { kind: "ready"; firm: { id: string; name: string }; invitations: PendingInvitation[] };

/**
 * A firm's invitations (story CRM-P1.2): an owner invites an email address with a role, sees who is still pending and resends or
 * withdraws an invitation. A plain page in today's console look; the Settings screen that replaces it is Epic 9. Only what a
 * person sees is decided here: the database lets only a current owner of the firm do any of it (D-18).
 */
const FirmInvitationsPage = () => {
  const { user, loading: authLoading, isAnonymous } = useAuth();
  const firm = useFirmAddress();
  const location = useLocation();
  const address = firm.status === "known" ? firm.address : null;
  const signedIn = Boolean(user) && !isAnonymous;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<FirmRole>("agent");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!address) return;
    try {
      const mine = await fetchMyFirm(address);
      if (!mine || mine.role !== "owner") return setLoad({ kind: "not_owner" });
      const invitations = await fetchPendingInvitations(mine.id);
      setLoad({ kind: "ready", firm: { id: mine.id, name: mine.name }, invitations });
    } catch (err) {
      setLoad({ kind: "error", message: (err as Error).message });
    }
  }, [address]);

  useEffect(() => {
    if (!signedIn || !address) return;
    setLoad({ kind: "loading" });
    void refresh();
  }, [signedIn, address, refresh]);

  if (authLoading || firm.status === "checking") return <div className="min-h-screen bg-background" role="status" aria-label="Checking your sign-in" />;
  if (!signedIn) return <Navigate to="/login" replace state={{ from: location, reason: "account_needed" }} />;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || load.kind !== "ready") return;
    setBusy("invite");
    setError(null);
    try {
      const typed = email.trim();
      const result = await inviteMember({ firmId: load.firm.id, email: typed, role });
      if (result.emailed) toast.success(`Invitation sent to ${typed}.`);
      else toast.error("The invitation is saved but the email didn't go out. Resend it from the list.");
      setEmail("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(null);
  };

  const resend = async (i: PendingInvitation) => {
    setBusy(i.id);
    try {
      const result = await resendInvitation(i.id);
      if (result.emailed) toast.success(`Invitation sent again to ${i.email}.`);
      else toast.error("The invitation is saved but the email didn't go out. Try again.");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(null);
  };

  const withdraw = async (i: PendingInvitation) => {
    setBusy(i.id);
    try {
      await cancelInvitation(i.id);
      toast.success(`Invitation to ${i.email} withdrawn.`);
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(null);
  };

  const status = (i: PendingInvitation) =>
    i.expired ? `Expired ${formatDateTime(i.expiresAt)}` : !i.emailSent ? "The email did not go out" : `Expires ${formatDateTime(i.expiresAt)}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 min-h-14 py-2 flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark className="w-7 h-7 text-primary" />
            <Wordmark className="text-xl whitespace-nowrap" />
          </Link>
          <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5 ml-1">{firm.status === "known" ? firm.name : "Firm"}</span>
        </div>
      </header>
      <main className="container mx-auto px-6 py-8 max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">Invitations</h1>
          <p className="text-sm text-muted-foreground">
            Invite people by email. Each link works once, for seven days, and only for the person who signs in with that email address.
          </p>
        </div>
        {!address && <p role="status" className="text-sm">Open this page at your firm's own address.</p>}
        {address && load.kind === "loading" && (
          <div className="flex items-center justify-center py-12 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading…
          </div>
        )}
        {address && load.kind === "error" && (
          <div role="alert" className="text-sm space-y-2">
            <p className="text-destructive">{load.message}</p>
            <button className={button} onClick={() => { setLoad({ kind: "loading" }); void refresh(); }}>Try again</button>
          </div>
        )}
        {address && load.kind === "not_owner" && <p role="status" className="text-sm">Only an owner of the firm can invite people.</p>}
        {address && load.kind === "ready" && (
          <>
            <form onSubmit={send} aria-label="Invite someone" className="border border-border rounded-xl p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                <div>
                  <label htmlFor="invite-email" className="text-xs text-muted-foreground">Email address</label>
                  <input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254}
                    className={input} autoComplete="off" autoCapitalize="none" spellCheck={false} />
                </div>
                <div>
                  <label htmlFor="invite-role" className="text-xs text-muted-foreground">Role</label>
                  <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as FirmRole)} className={input}>
                    <option value="agent">{ROLE_LABELS.agent}</option>
                    <option value="lead">{ROLE_LABELS.lead}</option>
                    <option value="owner">{ROLE_LABELS.owner}</option>
                  </select>
                </div>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={busy !== null || !email.trim()}
                className={`${button} bg-primary text-primary-foreground border-primary hover:bg-primary/90`}>
                {busy === "invite" ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Sending" /> : "Send invitation"}
              </button>
            </form>
            {load.invitations.length === 0 ? (
              <p role="status" className="text-sm text-muted-foreground">No invitations are waiting.</p>
            ) : (
              <ul aria-label="Pending invitations" className="space-y-3">
                {load.invitations.map((i) => (
                  <li key={i.id} className="border border-border rounded-xl p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="font-semibold break-all">{i.email}</span>
                    <span className="text-xs border border-border rounded px-1.5 py-0.5">{ROLE_LABELS[i.role]}</span>
                    <span className={`text-xs ${i.expired || !i.emailSent ? "text-destructive" : "text-muted-foreground"}`}>{status(i)}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <button className={button} disabled={busy !== null} onClick={() => void resend(i)} aria-label={`Resend invitation to ${i.email}`}>Resend</button>
                      <button className={button} disabled={busy !== null} onClick={() => void withdraw(i)} aria-label={`Withdraw invitation to ${i.email}`}>Withdraw</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default FirmInvitationsPage;
