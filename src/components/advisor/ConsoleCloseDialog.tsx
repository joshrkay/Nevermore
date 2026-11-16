import { useEffect, useState } from "react";
import { CloseOpportunityDialog } from "@/components/opportunities/CloseOpportunityDialog";
import { getFirmName, getOpportunityOutcome, getOpportunityPage, type OpportunityOutcome, type OpportunityPage } from "@/lib/opportunityPageApi";

// The console's Won and Lost (CRM-O1.3b, D-470): the submission is on an opportunity, so the stage control opens the opportunity's own Mark won or lost dialog, the
// same one its page opens. The page it needs (the quotes, the version) is read here, as the opportunity's page reads it; nothing is sent until the person marks it.

/** Reads what the dialog needs, then shows it. A read that fails says so beside the control, and the person can close it and try again. */
export function ConsoleCloseDialog({ firmId, opportunityId, submissionId, initial, onClose, onDone }: {
  firmId: string;
  opportunityId: string;
  submissionId: string;
  initial: "won" | "lost";
  onClose: () => void;
  onDone: () => void;
}) {
  const [loaded, setLoaded] = useState<{ page: OpportunityPage; outcome: OpportunityOutcome; broker: string } | "failed" | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getOpportunityPage(firmId, opportunityId), getOpportunityOutcome(firmId, opportunityId, submissionId), getFirmName(firmId)])
      .then(([page, outcome, broker]) => !cancelled && setLoaded(page ? { page, outcome, broker } : "failed"))
      .catch(() => !cancelled && setLoaded("failed"));
    return () => { cancelled = true; };
  }, [firmId, opportunityId, submissionId]);

  if (loaded === null) return null;
  if (loaded === "failed") {
    return (
      <p role="alert" className="text-xs text-destructive">
        Couldn't open the opportunity to mark it won or lost. Check your connection and try again.{" "}
        <button type="button" onClick={onClose} className="underline underline-offset-2">Close</button>
      </p>
    );
  }
  const { page, outcome, broker } = loaded;
  const o = page.opportunity;
  return (
    <CloseOpportunityDialog
      firmId={firmId}
      target={{ id: o.id, version: o.version, name: o.name, targetStart: o.targetStart, employees: o.employees ?? page.intake?.censusSize ?? null }}
      accountName={page.account.name}
      quotes={page.quotes}
      proposedStarts={Object.fromEntries(Object.entries(outcome.quotes).map(([k, v]) => [k, v.proposedStart]))}
      brokerDefault={broker}
      initial={initial}
      onClose={onClose}
      onDone={() => onDone()}
    />
  );
}
