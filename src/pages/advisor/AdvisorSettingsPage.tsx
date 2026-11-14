import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SETTINGS_LINKS } from "@/components/workspace/menu";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { firmUrl } from "@/lib/firmHost";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { afterLeavingFirm, leaveFirm } from "@/lib/leaveFirmApi";

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

const AdvisorSettingsPage = () => {
  const { isOwner, firm } = useWorkspace();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

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

  const atAddress = useFirmAddress().status === "known";
  const links = SETTINGS_LINKS.filter((l) => !l.ownersOnly || isOwner);
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

      {firm && (
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
