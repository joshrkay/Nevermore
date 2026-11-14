import { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { choiceRule, emailRule, Field, FormActions, SelectInput, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { formatDateTime } from "@/components/advisor/format";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import {
  cancelInvitation, fetchMyFirm, fetchPendingInvitations, inviteMember, resendInvitation,
  type Delivery, type FirmRole, type PendingInvitation,
} from "@/lib/invitationApi";
import { AskedToJoinSection, OrganisationsSection } from "@/components/workspace/FirmJoinSections";

const button = "min-h-11 px-4 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";
const ROLE_LABELS: Record<FirmRole, string> = { agent: "Agent", lead: "Lead", owner: "Owner" };
const ROLES: readonly FirmRole[] = ["agent", "lead", "owner"];

const inviteSchema = z.object({
  email: emailRule("Enter the email address to invite.").pipe(z.string().max(254, "Use an email address of 254 characters or fewer.")),
  role: choiceRule(ROLES, "Choose a role."),
});

/** The refusals about the address itself (already a member, already invited) belong to the email field; the rest to the form. */
const explainInvite = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  return /already (a member|has a pending invitation)/i.test(message) ? { message, field: "email" } : undefined;
};

/** The form that invites someone: an email and a role (story CRM-S4.1 rules). It keeps what was typed when a send is refused. */
const InviteForm = ({ firmId, onInvited }: { firmId: string; onInvited: () => Promise<void> }) => {
  const api = useWorkspaceForm({
    schema: inviteSchema,
    defaultValues: { email: "", role: "agent" },
    save: async (v) => {
      const result = await inviteMember({ firmId, email: v.email, role: v.role as FirmRole });
      tellDelivery(result.delivery, v.email, `Invitation sent to ${v.email}.`, "The invitation is saved but the email didn't go out. Resend it from the list.");
    },
    onSaved: () => void onInvited(),
    explain: explainInvite,
    failureMessage: "Couldn't send the invitation. Check your connection and try again.",
  });
  return (
    <WorkspaceForm api={api} aria-label="Invite someone" className="border border-border rounded-xl p-4" actions={<FormActions submitLabel="Send invitation" savingLabel="Sending…" />}>
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Field name="email" label="Email address" required>
          {(field) => <Input {...field} className="h-11" type="email" maxLength={254} autoComplete="off" autoCapitalize="none" spellCheck={false} />}
        </Field>
        <Field name="role" label="Role">
          {(field) => (
            <SelectInput {...field} className="h-11">
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </SelectInput>
          )}
        </Field>
      </div>
    </WorkspaceForm>
  );
};

/**
 * What an owner is told once an invitation's email has been tried. "Unknown" is its own answer: the mail provider may have accepted
 * the message, so it is not said to have failed, and the owner is told that sending again replaces the first link.
 */
function tellDelivery(delivery: Delivery, email: string, sentWords: string, failedWords: string) {
  if (delivery === "sent") toast.success(sentWords);
  else if (delivery === "unknown") {
    toast.warning(`We couldn't confirm the email to ${email} was delivered. It may have arrived. Sending again makes a new link, and the first one then stops working.`);
  } else toast.error(failedWords);
}

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "not_owner" }
  | { kind: "ready"; firm: { id: string; name: string }; invitations: PendingInvitation[] };

/**
 * A firm's invitations (story CRM-P1.2): an owner invites an email address with a role, sees who is still pending and resends or
 * withdraws an invitation. A page inside the workspace shell (reached from Settings); the Settings screen that replaces it is Epic 9. Only what a
 * person sees is decided here: the database lets only a current owner of the firm do any of it (D-18).
 */
const FirmInvitationsPage = () => {
  const { user, loading: authLoading, isAnonymous } = useAuth();
  const firm = useFirmAddress();
  const location = useLocation();
  const address = firm.status === "known" ? firm.address : null;
  const signedIn = Boolean(user) && !isAnonymous;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState<string | null>(null);

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

  const resend = async (i: PendingInvitation) => {
    setBusy(i.id);
    try {
      const result = await resendInvitation(i.id);
      tellDelivery(result.delivery, i.email, `Invitation sent again to ${i.email}.`, "The invitation is saved but the email didn't go out. Try again.");
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
    i.expired ? `Expired ${formatDateTime(i.expiresAt)}`
      : i.delivery === "failed" ? "The email did not go out"
      : i.delivery === "unknown" || i.delivery === null ? "Not sure the email was delivered. If it didn't arrive, resend: the new link replaces this one."
      : `Expires ${formatDateTime(i.expiresAt)}`;

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8 max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">Invitations</h1>
          <p className="text-sm text-muted-foreground">
            Invite people by email. Each link works once, for seven days, and only for the person who signs in with that email address. Or list
            your firm's Google domain or Microsoft tenant, and approve the people who sign in from it.
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
            <InviteForm firmId={load.firm.id} onInvited={refresh} />
            {load.invitations.length === 0 ? (
              <p role="status" className="text-sm text-muted-foreground">No invitations are waiting.</p>
            ) : (
              <ul aria-label="Pending invitations" className="space-y-3">
                {load.invitations.map((i) => (
                  <li key={i.id} className="border border-border rounded-xl p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="font-semibold break-all">{i.email}</span>
                    <span className="text-xs border border-border rounded px-1.5 py-0.5">{ROLE_LABELS[i.role]}</span>
                    <span className={`text-xs ${i.expired || i.delivery === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{status(i)}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <button className={button} disabled={busy !== null} onClick={() => void resend(i)} aria-label={`Resend invitation to ${i.email}`}>Resend</button>
                      <button className={button} disabled={busy !== null} onClick={() => void withdraw(i)} aria-label={`Withdraw invitation to ${i.email}`}>Withdraw</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <OrganisationsSection firmId={load.firm.id} />
            <AskedToJoinSection firmId={load.firm.id} firmName={load.firm.name} />
          </>
        )}
      </main>
    </div>
  );
};

export default FirmInvitationsPage;
