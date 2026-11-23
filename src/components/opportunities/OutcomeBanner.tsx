import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { submissionPath } from "@/components/accounts/accountColumns";
import { formatDay, STAGE_LABELS } from "@/data/accountPage";
import { lineOf } from "@/data/lines";
import { changedLine, outcomeBannerWords } from "@/data/opportunityClose";
import { dollarsWords, opportunityFieldLabel } from "@/data/opportunityPage";
import { isConflict } from "@/lib/recordVersion";
import { OpportunityError, reopenOpportunity, type CommissionPayment, type OpportunityOutcome, type OpportunityPage } from "@/lib/opportunityPageApi";
import { DeletePaymentDialog, EditPaymentDialog, RecordPaymentDialog } from "./PaymentDialogs";
import { PlacementCommissionDialog } from "./PlacementCommissionDialog";

// The won or lost banner (CRM-O1.1's "Won or lost" state, D-426, D-472): "Won · <PEO> · from <start> · renews <date>" with the commission line, or "Lost · <reason>".
// Either has Reopen for those allowed (D-462); a win has Record a payment, Edit and Delete on each payment, and Add or Change commission, for whoever may change the
// opportunity (D-466, D-467). The database decides who may and what is refused (D-469: a renewal being worked, payments to delete first) and says why in words.

export function OutcomeBanner({ firmId, page, outcome, loading, failed, onRetry, canReopen, canChange, onChanged }: {
  firmId: string;
  page: OpportunityPage;
  outcome: OpportunityOutcome | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** Whoever D-462 allows, on an account that is not archived. */
  canReopen: boolean;
  /** Whoever may change the opportunity (D-209), on an account that is not archived and not in a support session: payments and the commission. */
  canChange: boolean;
  /** Something changed: the page and the outcome are asked again. */
  onChanged: () => void;
}) {
  const stage = page.opportunity.stage as "won" | "lost";
  const [reopening, setReopening] = useState(false);
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState<CommissionPayment | null>(null);
  const [deleting, setDeleting] = useState<CommissionPayment | null>(null);
  const [commissioning, setCommissioning] = useState(false);
  const placement = outcome?.placement ?? null;
  const commission = placement?.commission ?? null;
  const received = outcome?.receivedToDate ?? 0;
  const submissionId = page.opportunity.submissionId;
  // A submission archived from a stage other than Won or Lost reads as Lost but has no lost reason, and nothing to undo: the database refuses a reopen of it ("Restore it
  // from the archive"), so it is not offered. Until the outcome says there is a reason, it cannot be known that a Reopen of a Lost with an intake can work.
  const archivedNotLost = stage === "lost" && submissionId !== null && outcome !== undefined && outcome.lostReason === null;
  const reopenable = canReopen && !archivedNotLost && (stage === "won" || submissionId === null || outcome !== undefined);
  // The admin fee of the quote that was won, which a later commission is worked from (the placement's PEO, by name ignoring case, D-424).
  const wonQuote = placement ? page.quotes.find((q) => q.peoName.toLowerCase() === placement.peoName.toLowerCase()) : undefined;
  return (
    <section role="region" aria-label="Outcome" className="mb-6 rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {outcome ? (
            <p className="font-medium break-words">
              {outcomeBannerWords({
                stage, peoName: placement?.peoName ?? null, startDate: placement?.startDate ?? null, renewsOn: placement?.renewsOn ?? null,
                lostReason: outcome.lostReason, lostNote: outcome.lostNote, line: lineOf(page.opportunity.line),
              })}
            </p>
          ) : failed ? (
            <p className="text-sm" role="alert">
              Couldn't load how this opportunity ended.{" "}
              <button type="button" onClick={onRetry} className="text-primary underline underline-offset-2">Try again</button>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{loading ? "Loading how this opportunity ended…" : STAGE_LABELS[stage]}</p>
          )}
          {archivedNotLost && submissionId && (
            <p className="text-sm text-muted-foreground">
              It was archived, not lost. Restore it from <Link to={submissionPath(submissionId)} className="text-primary underline underline-offset-2">the submission's page</Link>.
            </p>
          )}
          {outcome && stage === "won" && placement && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm text-muted-foreground">
                {commission?.expectedYearly != null
                  ? `Commission: ${dollarsWords(commission.expectedYearly)} expected a year · ${dollarsWords(received)} received so far`
                  : commission
                    ? `Commission: expected figure not set · ${dollarsWords(received)} received so far`
                    : received > 0
                      ? `Commission: none expected recorded · ${dollarsWords(received)} received so far`
                      : "Commission: none expected recorded"}
              </p>
              {canChange && (
                <button type="button" onClick={() => setCommissioning(true)} className="text-sm text-primary underline underline-offset-2">
                  {commission ? "Change commission" : "Add commission"}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {stage === "won" && placement && canChange && (
            <Button type="button" variant="outline" onClick={() => setPaying(true)}>Record a payment</Button>
          )}
          {reopenable && <Button type="button" variant="outline" onClick={() => setReopening(true)}>Reopen</Button>}
        </div>
      </div>
      {outcome && stage === "won" && placement && outcome.payments.length > 0 && (
        <ul aria-label="Payments received" className="mt-3 divide-y divide-border rounded-md border border-border bg-background text-sm">
          {outcome.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 break-words">
                {formatDay(p.receivedOn)} · {dollarsWords(p.amount)}{p.note ? ` · ${p.note}` : ""}
              </span>
              {canChange && (
                <span className="flex gap-3">
                  <button type="button" onClick={() => setEditing(p)} aria-label={`Edit the payment of ${dollarsWords(p.amount)} received ${formatDay(p.receivedOn)}`} className="text-primary underline underline-offset-2">Edit</button>
                  <button type="button" onClick={() => setDeleting(p)} aria-label={`Delete the payment of ${dollarsWords(p.amount)} received ${formatDay(p.receivedOn)}`} className="text-destructive underline underline-offset-2">Delete</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {reopening && <ReopenDialog firmId={firmId} page={page} onClose={() => setReopening(false)} onChanged={onChanged} />}
      {paying && placement && (
        <RecordPaymentDialog firmId={firmId} placementId={placement.id} onClose={() => setPaying(false)} onChanged={onChanged} />
      )}
      {editing && <EditPaymentDialog firmId={firmId} payment={editing} onClose={() => setEditing(null)} onChanged={onChanged} />}
      {deleting && <DeletePaymentDialog firmId={firmId} payment={deleting} onClose={() => setDeleting(null)} onChanged={onChanged} />}
      {commissioning && placement && (
        <PlacementCommissionDialog
          firmId={firmId}
          placement={placement}
          adminFeePepm={wonQuote?.adminFeePepm ?? null}
          employees={page.opportunity.employees ?? page.intake?.censusSize ?? null}
          onClose={() => setCommissioning(false)}
          onChanged={onChanged}
        />
      )}
    </section>
  );
}

/**
 * Reopening (ADR 0027) undoes what the win made, so it asks first and says what it undoes. It reopens from the version the opportunity had when this dialog opened
 * (D-46), never the page's live one, which a background reload moves: a Reopen opened from an older view must not pass the check and undo a newer win. A conflict
 * answer is shown, and only then does the dialog start from the version it named, so the next press is made knowing it.
 */
function ReopenDialog({ firmId, page, onClose, onChanged }: { firmId: string; page: OpportunityPage; onClose: () => void; onChanged: () => void }) {
  const { opportunity } = page;
  const version = useRef(opportunity.version);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const won = opportunity.stage === "won";
  const leave = () => {
    // The page is asked again once the person has seen the conflict (the banner may go: someone else already reopened it).
    if (conflicted) onChanged();
    onClose();
  };
  const reopen = async () => {
    setBusy(true);
    setRefused(null);
    try {
      const done = await reopenOpportunity(firmId, opportunity.id, version.current);
      if (isConflict(done)) {
        version.current = done.currentVersion;
        setConflicted(true);
        setRefused(
          `Someone else changed this opportunity first. It is now ${STAGE_LABELS[done.stage]}. Nothing was reopened. ${done.changed.map((c) => changedLine(c, opportunityFieldLabel)).join("; ")}${done.changed.length > 0 ? ". " : ""}Reopen again if you still want to.`,
        );
        return;
      }
      toast.success("Reopened");
      onChanged();
      onClose();
    } catch (e) {
      setRefused(e instanceof OpportunityError && e.kind !== "failed" ? e.message : "Couldn't reopen. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !busy) leave(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reopen this opportunity?</AlertDialogTitle>
          <AlertDialogDescription>
            {won
              ? "It goes back to Quoted and the quote is no longer chosen. The placement and the renewal made with the win are deleted. Quotes the win closed stay closed."
              : "It goes back to the stage it was lost from, or to Qualifying if it had no intake. Its reason is cleared here and kept in the history. Quotes the loss closed stay closed."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {refused && <p role="alert" className="text-sm text-destructive">{refused}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button type="button" disabled={busy} onClick={() => void reopen()}>Reopen</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
