import { useContext, useEffect, useState } from "react";
import { CloseOpportunityDialog } from "@/components/opportunities/CloseOpportunityDialog";
import { WorkspaceContext } from "@/components/workspace/workspaceContext";
import { STAGE_LABELS } from "@/data/accountPage";
import { lineOf } from "@/data/lines";
import type { TellMessage } from "@/data/opportunityClose";
import { getFirmName, getOpportunityOutcome, getOpportunityPage, type OpportunityOutcome, type OpportunityPage } from "@/lib/opportunityPageApi";

// The console's Won and Lost (CRM-O1.3b, D-470): the submission is on an opportunity, so the stage control opens the opportunity's own Mark won or lost dialog, the
// same one its page opens. The page it needs (the quotes, the version) is read here, as the opportunity's page reads it; nothing is sent until the person marks it.
// What the page opens its dialog for, this opens it for: a person the level rule lets change the opportunity, on an account that is not archived, not in a support
// session, and not already won or lost. For anyone else it says why instead of drawing a dialog the database could only refuse.

const Notice = ({ role = "alert", onClose, children }: { role?: "alert" | "status"; onClose: () => void; children: React.ReactNode }) => (
  <p role={role} className="text-xs text-destructive">
    {children}{" "}
    <button type="button" onClick={onClose} className="underline underline-offset-2">Close</button>
  </p>
);

/** Reads what the dialog needs, then shows it. A read that fails says so beside the control, and the person can close it and try again. */
export function ConsoleCloseDialog({ firmId, opportunityId, initial, mail, onClose, onDone }: {
  firmId: string;
  opportunityId: string;
  initial: "won" | "lost";
  /** The mail on the submission's quote requests, which the console's Status panel has already read: who is still open and was written to is drawn from it. */
  mail: readonly TellMessage[];
  onClose: () => void;
  onDone: () => void;
}) {
  const isSupport = useContext(WorkspaceContext)?.isSupport ?? false;
  const [loaded, setLoaded] = useState<{ page: OpportunityPage; outcome: OpportunityOutcome; broker: string } | "failed" | null>(null);
  useEffect(() => {
    if (isSupport) return;
    let cancelled = false;
    Promise.all([getOpportunityPage(firmId, opportunityId), getOpportunityOutcome(firmId, opportunityId), getFirmName(firmId)])
      .then(([page, outcome, broker]) => !cancelled && setLoaded(page ? { page, outcome, broker } : "failed"))
      .catch(() => !cancelled && setLoaded("failed"));
    return () => { cancelled = true; };
  }, [firmId, opportunityId, isSupport]);

  if (isSupport) return <Notice onClose={onClose}>Nevermore support can read this submission but not change it.</Notice>;
  if (loaded === null) return <p role="status" className="text-xs text-muted-foreground">Opening the opportunity…</p>;
  if (loaded === "failed") {
    return <Notice onClose={onClose}>Couldn't open the opportunity to mark it won or lost. Check your connection and try again.</Notice>;
  }
  const { page, outcome, broker } = loaded;
  const o = page.opportunity;
  if (page.account.archived) return <Notice onClose={onClose}>This account is archived. Nothing on it can be changed.</Notice>;
  if (o.stage === "won" || o.stage === "lost") {
    return <Notice onClose={onClose}>It is already {STAGE_LABELS[o.stage]}. Reopen it on its opportunity's page first.</Notice>;
  }
  if (!page.canChange) {
    return <Notice onClose={onClose}>Only the opportunity's owner, a lead of the owner's team or an owner of the firm can mark it won or lost.</Notice>;
  }
  return (
    <CloseOpportunityDialog
      line={lineOf(o.line)}
      firmId={firmId}
      target={{ id: o.id, version: o.version, name: o.name, targetStart: o.targetStart, employees: o.employees ?? page.intake?.censusSize ?? null }}
      accountName={page.account.name}
      quotes={page.quotes}
      proposedStarts={Object.fromEntries(Object.entries(outcome.quotes).map(([k, v]) => [k, v.proposedStart]))}
      brokerDefault={broker}
      initial={initial}
      mail={{ status: "ready", messages: mail }}
      onClose={onClose}
      onDone={() => onDone()}
    />
  );
}
