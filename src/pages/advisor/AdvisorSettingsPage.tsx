import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SETTINGS_LINKS } from "@/components/workspace/menu";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { firmUrl } from "@/lib/firmHost";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import { afterLeavingFirm, leaveFirm } from "@/lib/leaveFirmApi";
import { closingDate, requestFirmClosure, withdrawFirmClosure } from "@/lib/closeFirmApi";
import { refreshFirmClosure, useFirmClosure } from "@/hooks/useFirmClosure";

/**
 * Settings (story CRM-S1.1a, D-38): where the pages that have no menu item of their own are reached from. Each is a link to a
 * page that exists today; the tabs of the Settings screen replace them as their epics ship. The activity record is for
 * owners, so it is offered to owners only (the page refuses everyone else anyway).
 */
const Row = ({ link, outside }: { link: (typeof SETTINGS_LINKS)[number]; outside: string | null }) => {
  const className = "flex min-h-14 items-center gap-4 px-4 py-3 hover:bg-muted";
  const body = (
    <>
      <span className="flex-1">
        <span className="block font-semibold">{link.label}</span>
        <span className="block text-sm text-muted-foreground">{link.description}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </>
  );
  // A page that works only at the firm's own address is reached there from the bare domain: a plain link, not the app's router.
  return outside ? <a href={outside} className={className}>{body}</a> : <Link to={link.to} className={className}>{body}</Link>;
};

/** What the person is told, in plain words, before they leave: what they lose, what stays, who is told, and what they keep. */
const leaveBody = (firmName: string) =>
  `You lose access to ${firmName} at once and stop receiving its alerts. Your membership ends today; it stays in the firm's record. ` +
  `What you created stays with the firm. The firm's owners are emailed that you left, and when. ` +
  `If this is the last firm you belong to, a mailbox you connected is deleted. ` +
  `You keep your sign-in, but you will see no firm until an owner invites you again. ` +
  `You can't leave if you are its last owner: make someone else an owner first.`;

/** What an owner is told, in plain words, before asking to close the firm: what happens now, on the day, what stays, and who is told. */
const closeBody = (firmName: string) =>
  `For the next 30 days ${firmName} is read-only: everyone in it can still sign in and read, and nothing can be changed, added, sent or deleted. ` +
  `Any owner can withdraw the request until then, and the firm is exactly as it was. ` +
  `After 30 days the firm's own working data is deleted for good: saved views and column choices, referral partners, invitations, listed organisations and requests to join, and teams. ` +
  `Every member's access ends, and a mailbox a person connected only for this firm is deleted. ` +
  `Submissions that employers started are not deleted: they stay for the employer. ` +
  `The firm's address can't be used by another firm for 12 months. ` +
  `The firm's owners are emailed now. Nevermore keeps a record of what was deleted, when, and on whose request, without any of the content.`;

const AdvisorSettingsPage = () => {
  const { isOwner, isSupport, firm } = useWorkspace();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [typed, setTyped] = useState("");
  const [closeProblem, setCloseProblem] = useState<string | null>(null);
  const { closesAt, canAsk, why, loaded: closureKnown, failed: closureFailed, error: closureError } = useFirmClosure(firm?.id ?? null);

  const leave = async () => {
    if (!firm) return;
    setBusy(true);
    setProblem(null);
    try {
      await leaveFirm(firm.id);
    } catch (err) {
      setAsking(false);
      setProblem((err as Error).message);
      setBusy(false);
      return;
    }
    // They have left: the page asks again where they stand. The dialog stays as it is until it does.
    afterLeavingFirm();
  };

  const close = async () => {
    if (!firm) return;
    setBusy(true);
    setCloseProblem(null);
    try {
      await requestFirmClosure(firm.id, typed);
      await refreshFirmClosure(firm.id);
      setClosing(false);
      setTyped("");
      toast.success(`${firm.name} will close in 30 days unless you withdraw the request.`);
    } catch (err) {
      setCloseProblem((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!firm) return;
    setBusy(true);
    setCloseProblem(null);
    try {
      await withdrawFirmClosure(firm.id);
      await refreshFirmClosure(firm.id);
      toast.success(`The request is withdrawn. ${firm.name} is as it was.`);
    } catch (err) {
      setCloseProblem((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const atAddress = useFirmAddress().status === "known";
  // Nevermore support reads the pages an owner reads, and is offered nothing it could not use (story CRM-P2.4).
  const links = SETTINGS_LINKS.filter((l) => !l.ownersOnly || isOwner || isSupport);
  return (
    <main className="container mx-auto px-6 py-8 max-w-3xl">
      <h1 className="font-display text-3xl font-bold mb-6">Settings</h1>
      <ul aria-label="Settings pages" className="divide-y divide-border rounded-lg border border-border bg-card">
        {links.map((l) => (
          <li key={l.to}>
            <Row link={l} outside={l.atFirmAddress && !atAddress && firm ? `${firmUrl(firm.address)}${l.to}` : null} />
          </li>
        ))}
      </ul>

      {firm && !isSupport && (
        <section aria-labelledby="leave-heading" className="mt-8 rounded-lg border border-border bg-card p-4">
          <h2 id="leave-heading" className="font-semibold">Leave this firm</h2>
          <p className="text-sm text-muted-foreground mb-3">Stop being a member of {firm.name}. Your sign-in is kept.</p>
          {problem && <p role="alert" className="text-sm text-destructive mb-3">{problem}</p>}
          <button
            type="button"
            className="min-h-11 px-3 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50"
            onClick={() => { setProblem(null); setAsking(true); }}
          >
            Leave this firm
          </button>
        </section>
      )}

      {firm && isOwner && (
        <section aria-labelledby="close-heading" className="mt-6 rounded-lg border border-destructive/40 bg-card p-4">
          <h2 id="close-heading" className="font-semibold">{closesAt ? "This firm is closing" : "Close this firm"}</h2>
          {closesAt ? (
            <p className="text-sm text-muted-foreground mb-3">
              {firm.name} closes on {closingDate(closesAt)}. Until then it is read-only. Withdraw the request and it is exactly as it was.
            </p>
          ) : (
            canAsk && <p className="text-sm text-muted-foreground mb-3">Ask to close {firm.name}. It stays read-only for 30 days, and you can change your mind until then.</p>
          )}
          {closeProblem && <p role="alert" className="text-sm text-destructive mb-3">{closeProblem}</p>}
          {closesAt ? (
            <button type="button" disabled={busy} onClick={() => void withdraw()} className="min-h-11 px-3 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50">
              Withdraw the request to close
            </button>
          ) : closureFailed && !closureKnown ? (
            <AdvisorLoadError error={closureError ?? new Error("Couldn't check the firm.")} what="whether this firm can be closed" onRetry={() => void refreshFirmClosure(firm.id)} />
          ) : !closureKnown ? null : !canAsk ? (
            <p className="text-sm">
              {why === "default_firm" ? "This firm takes the intakes people start on Nevermore, so it can't be closed."
                : why === "refused" ? "This firm was refused, so there is nothing to close."
                : "You can't close this firm."}
            </p>
          ) : (
            <button type="button" onClick={() => { setCloseProblem(null); setTyped(""); setClosing(true); }}
              className="min-h-11 px-3 rounded-md border border-destructive text-destructive text-sm hover:bg-muted disabled:opacity-50">
              Close this firm
            </button>
          )}
        </section>
      )}

      <AlertDialog open={closing && firm !== null} onOpenChange={(open) => !open && !busy && setClosing(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {firm?.name}?</AlertDialogTitle>
            <AlertDialogDescription>{firm ? closeBody(firm.name) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <label htmlFor="close-confirm" className="text-sm font-medium">Type the firm's name to confirm: {firm?.name}</label>
            <input id="close-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off"
              className="w-full min-h-11 bg-muted border border-border rounded-md px-3 text-sm" />
          </div>
          {closeProblem && <p role="alert" className="text-sm text-destructive">{closeProblem}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep the firm</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !firm || typed.trim().toLowerCase() !== firm.name.trim().toLowerCase()}
              onClick={(e) => {
                // The dialog stays open until the request has been made or refused.
                e.preventDefault();
                void close();
              }}
            >
              Close {firm?.name} in 30 days
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={asking && firm !== null} onOpenChange={(open) => !open && !busy && setAsking(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {firm?.name}?</AlertDialogTitle>
            <AlertDialogDescription>{firm ? leaveBody(firm.name) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                // The dialog closes itself on an action; it stays open until the leaving has been made or refused.
                e.preventDefault();
                void leave();
              }}
            >
              Leave {firm?.name}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

export default AdvisorSettingsPage;
