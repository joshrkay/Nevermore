import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatDateTime } from "@/components/advisor/format";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { loadMyFirms } from "@/hooks/useOwnedFirms";
import { currentFirm } from "@/lib/currentFirm";
import { fetchFirmMembers, liftSuspension, removeMember, suspendMember, type FirmMember, type MemberRole } from "@/lib/memberApi";
import { LoadFailed } from "@/components/workspace/states";
import { SaveFailed } from "@/components/workspace/form/SaveFailed";

type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  | { kind: "not_allowed" }
  | { kind: "ready"; firm: { id: string; name: string }; members: FirmMember[]; readOnly: boolean };

type Change = { action: "remove" | "suspend" | "lift"; member: FirmMember };

const ROLE_LABELS: Record<MemberRole, string> = { owner: "Owner", lead: "Lead", agent: "Agent" };
const WITH_ARTICLE: Record<MemberRole, string> = { owner: "an owner", lead: "a lead", agent: "an agent" };
const button = "min-h-11 px-3 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";

/** What the owner is asked, in plain words, before each change: what the person loses or gets, and what stays. */
function confirmation(change: Change, firmName: string): { title: string; body: string; action: string } {
  const { email, role } = change.member;
  switch (change.action) {
    case "remove":
      return {
        title: `Remove ${email} from ${firmName}?`,
        body: `They lose access to ${firmName} at once and stop receiving its alerts. Their membership ends today; it stays in the firm's record. What they created stays with the firm. If this is the last firm they belong to, a mailbox they connected is deleted. You can invite them again later.`,
        action: `Remove ${email}`,
      };
    case "suspend":
      return {
        title: `Suspend ${email}?`,
        body: `They lose access at once and stop receiving the firm's alerts, but stay on this list as ${WITH_ARTICLE[role]} until you lift the suspension. A mailbox they connected stays stored but can't be used meanwhile.`,
        action: `Suspend ${email}`,
      };
    case "lift":
      return {
        title: `Lift the suspension of ${email}?`,
        body: `They get access to ${firmName} again at once, as ${WITH_ARTICLE[role]}.`,
        action: "Lift suspension",
      };
  }
}

/**
 * A firm's members (story CRM-P1.5), for its owners: who belongs, in what role, whether they are members or suspended, and a way to
 * remove, suspend or lift a suspension, each after a plain confirmation. At a firm's address it is that firm (the current firm of
 * the console, as the guard and the menu read it). A plain page in today's console look; the Settings screen that replaces it is Epic 9.
 * Only what a person sees is decided here: the database lets only a current owner of the firm do any of it, and keeps its last owner (D-18).
 */
const AdvisorMembersPage = () => {
  const { user, session } = useAuth();
  const userId = user?.id ?? "";
  const sessionKey = session?.access_token ?? "";
  const firmAddress = useFirmAddress();
  const address = firmAddress.status === "known" ? firmAddress.address : null;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [asking, setAsking] = useState<Change | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<Load> => {
    const here = currentFirm(await loadMyFirms(userId, sessionKey), address);
    // Nevermore support, on a support session, reads the list as an owner does and is offered none of the changes (story CRM-P2.4).
    if (!("firm" in here) || (here.firm.role !== "owner" && here.firm.role !== "support")) return { kind: "not_allowed" };
    const firm = { id: here.firm.firm_id, name: here.firm.name };
    return { kind: "ready", firm, members: await fetchFirmMembers(firm.id), readOnly: here.firm.role === "support" };
  }, [userId, sessionKey, address]);

  useEffect(() => {
    let cancelled = false;
    setLoad((prev) => (prev.kind === "ready" ? prev : { kind: "loading" }));
    refresh()
      .then((next) => !cancelled && setLoad(next))
      .catch((error: Error & { forbidden?: boolean }) => !cancelled && setLoad(error.forbidden ? { kind: "not_allowed" } : { kind: "error", error }));
    return () => {
      cancelled = true;
    };
  }, [refresh, attempt]);

  const confirm = async () => {
    if (!asking || load.kind !== "ready") return;
    const { action, member } = asking;
    const { firm } = load;
    setBusy(true);
    setProblem(null);
    setDone(null);
    try {
      await (action === "remove" ? removeMember : action === "suspend" ? suspendMember : liftSuspension)(firm.id, member.userId);
    } catch (err) {
      setAsking(null);
      const failed = err as Error & { forbidden?: boolean; unauthenticated?: boolean };
      // An expired session is the load error's to handle (it signs the person out); a refusal means they are no longer an owner.
      if (failed.unauthenticated) setLoad({ kind: "error", error: failed });
      else if (failed.forbidden) setLoad({ kind: "not_allowed" });
      else setProblem(failed.message);
      setBusy(false);
      return;
    }
    // The change is made. Reloading the list is a separate matter: if it fails, the list says so and offers to try again, and the
    // change is still reported as made.
    setDone(
      action === "remove" ? `${member.email} was removed from ${firm.name}.`
        : action === "suspend" ? `${member.email} is suspended.`
        : `${member.email}'s suspension is lifted.`,
    );
    setAsking(null);
    try {
      setLoad(await refresh());
    } catch (err) {
      const failed = err as Error & { forbidden?: boolean };
      setLoad(failed.forbidden ? { kind: "not_allowed" } : { kind: "error", error: failed });
    }
    setBusy(false);
  };

  const ask = asking && load.kind === "ready" ? confirmation(asking, load.firm.name) : null;
  const others = load.kind === "ready" ? load.members.filter((m) => !m.isYou) : [];

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8 max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">Members</h1>
          <p className="text-sm text-muted-foreground">
            The people who belong to your firm. Removing someone ends their access at once; suspending keeps them on this list, without access, until you
            lift it. What they created stays with the firm, and every change is written to the firm's record. Only your firm's owners can see this.
          </p>
        </div>

        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-12 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading…
          </div>
        )}
        {load.kind === "error" && <LoadFailed error={load.error} what="the members" onRetry={() => setAttempt((n) => n + 1)} />}
        {load.kind === "not_allowed" && <p role="status" className="text-sm">Only a firm's owners can see and change its members.</p>}
        <SaveFailed message={problem} className="font-normal" />
        {done && !problem && <p role="status" className="text-sm">{done}</p>}

        {load.kind === "ready" && (
          <>
            <p className="text-sm text-muted-foreground">
              Firm: <span className="font-medium text-foreground">{load.firm.name}</span>
            </p>
            {others.length === 0 && (
              <p role="status" className="text-sm text-muted-foreground">No one else belongs to your firm yet. People you invite appear here once they accept.</p>
            )}
            {load.members.length > 0 && (
              <div className="overflow-x-auto border border-border rounded-xl">
                <table aria-label="Members" className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-medium">Person</th>
                      <th scope="col" className="px-4 py-2 font-medium">Role</th>
                      <th scope="col" className="px-4 py-2 font-medium">State</th>
                      <th scope="col" className="px-4 py-2 font-medium">Since</th>
                      <th scope="col" className="px-4 py-2 font-medium"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {load.members.map((m) => (
                      <tr key={m.userId} className="border-t border-border align-middle">
                        <td className="px-4 py-2 break-all">{m.email}</td>
                        <td className="px-4 py-2">{ROLE_LABELS[m.role]}</td>
                        <td className="px-4 py-2">{m.state === "suspended" ? "Suspended" : "Member"}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(m.since)}</td>
                        <td className="px-4 py-2">
                          {m.isYou ? (
                            <span className="text-muted-foreground">You</span>
                          ) : load.readOnly ? null : (
                            <div className="flex flex-wrap gap-2">
                              {m.state === "suspended" ? (
                                <button type="button" className={button} aria-label={`Lift the suspension of ${m.email}`} onClick={() => setAsking({ action: "lift", member: m })}>Lift suspension</button>
                              ) : (
                                <button type="button" className={button} aria-label={`Suspend ${m.email}`} onClick={() => setAsking({ action: "suspend", member: m })}>Suspend</button>
                              )}
                              <button type="button" className={button} aria-label={`Remove ${m.email}`} onClick={() => setAsking({ action: "remove", member: m })}>Remove</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      <AlertDialog open={ask !== null} onOpenChange={(open) => !open && !busy && setAsking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ask?.title}</AlertDialogTitle>
            <AlertDialogDescription>{ask?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                // The dialog closes itself on an action; it stays open until the change has been made or refused.
                e.preventDefault();
                void confirm();
              }}
            >
              {ask?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdvisorMembersPage;
