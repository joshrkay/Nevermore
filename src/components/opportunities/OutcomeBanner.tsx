import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { dateRule, Field, FormActions, SaveRefused, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { STAGE_LABELS, today } from "@/data/accountPage";
import { outcomeBannerWords } from "@/data/opportunityClose";
import { dollarsWords } from "@/data/opportunityPage";
import { isConflict } from "@/lib/recordVersion";
import { OpportunityError, recordCommissionPayment, reopenOpportunity, type OpportunityOutcome, type OpportunityPage } from "@/lib/opportunityPageApi";

// The won or lost banner (CRM-O1.1's "Won or lost" state, D-426, D-472): "Won · <PEO> · from <start> · renews <date>" with the commission line, or "Lost · <reason>".
// Either has Reopen for those allowed (D-462); a win has Record a payment for whoever may change the opportunity (D-467). The database decides who may and what is
// refused (D-469: a renewal being worked, payments to delete first) and says why in words.

export function OutcomeBanner({ firmId, page, outcome, loading, failed, onRetry, canReopen, onChanged }: {
  firmId: string;
  page: OpportunityPage;
  outcome: OpportunityOutcome | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** Whoever D-462 allows, on an account that is not archived. */
  canReopen: boolean;
  /** Something changed: the page and the outcome are asked again. */
  onChanged: () => void;
}) {
  const stage = page.opportunity.stage as "won" | "lost";
  const [reopening, setReopening] = useState(false);
  const [paying, setPaying] = useState(false);
  const placement = outcome?.placement ?? null;
  const commission = placement?.commission ?? null;
  const received = outcome?.receivedToDate ?? 0;
  return (
    <section role="region" aria-label="Outcome" className="mb-6 rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {outcome ? (
            <p className="font-medium break-words">
              {outcomeBannerWords({
                stage, peoName: placement?.peoName ?? null, startDate: placement?.startDate ?? null, renewsOn: placement?.renewsOn ?? null,
                lostReason: outcome.lostReason, lostNote: outcome.lostNote,
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
          {outcome && stage === "won" && placement && (
            <p className="text-sm text-muted-foreground">
              {commission?.expectedYearly != null
                ? `Commission: ${dollarsWords(commission.expectedYearly)} expected a year · ${dollarsWords(received)} received so far`
                : commission
                  ? `Commission: expected figure not set · ${dollarsWords(received)} received so far`
                  : received > 0
                    ? `Commission: none expected recorded · ${dollarsWords(received)} received so far`
                    : "Commission: none expected recorded"}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {stage === "won" && placement && page.canChange && (
            <Button type="button" variant="outline" onClick={() => setPaying(true)}>Record a payment</Button>
          )}
          {canReopen && <Button type="button" variant="outline" onClick={() => setReopening(true)}>Reopen</Button>}
        </div>
      </div>
      {reopening && <ReopenDialog firmId={firmId} page={page} onClose={() => setReopening(false)} onChanged={onChanged} />}
      {paying && placement && (
        <RecordPaymentDialog firmId={firmId} placementId={placement.id} onClose={() => setPaying(false)} onChanged={onChanged} />
      )}
    </section>
  );
}

/** Reopening (ADR 0027) undoes what the win made, so it asks first and says what it undoes. */
function ReopenDialog({ firmId, page, onClose, onChanged }: { firmId: string; page: OpportunityPage; onClose: () => void; onChanged: () => void }) {
  const { opportunity } = page;
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const won = opportunity.stage === "won";
  const reopen = async () => {
    setBusy(true);
    setRefused(null);
    try {
      const done = await reopenOpportunity(firmId, opportunity.id, opportunity.version);
      if (isConflict(done)) {
        setRefused(`Someone else changed this opportunity first. It is now ${STAGE_LABELS[done.stage]}. Nothing was reopened.`);
        onChanged();
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
    <AlertDialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
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

const paymentSchema = z.object({
  received_on: dateRule().refine((v) => v !== "", "Enter the day it was received, like 2027-02-10."),
  amount: z.string().trim().refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Enter an amount above zero, like 1500."),
  note: z.string().trim().max(500, "Keep the note to 500 characters."),
});

/** Record a payment (D-467): the day it was received, an amount above zero and a note, against the placement the win made. */
function RecordPaymentDialog({ firmId, placementId, onClose, onChanged }: { firmId: string; placementId: string; onClose: () => void; onChanged: () => void }) {
  const api = useWorkspaceForm({
    schema: paymentSchema,
    defaultValues: { received_on: today(), amount: "", note: "" },
    save: async (v) => {
      try {
        return await recordCommissionPayment(firmId, placementId, { receivedOn: v.received_on, amount: Number(v.amount), note: v.note });
      } catch (e) {
        if (e instanceof OpportunityError && e.kind !== "failed") throw new SaveRefused(e.message);
        throw e;
      }
    },
    onSaved: () => {
      toast.success("Payment recorded");
      onChanged();
      onClose();
    },
    failureMessage: "Couldn't record the payment. Check your connection and try again.",
    onCancel: onClose,
  });
  return (
    <Dialog open onOpenChange={(open) => { if (!open) api.cancel?.(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>Commission the firm received for this placement.</DialogDescription>
        </DialogHeader>
        <WorkspaceForm api={api} aria-label="Record a payment" actions={<FormActions submitLabel="Record payment" savingLabel="Recording…" />}>
          <Field name="received_on" label="Received on" required>{(field) => <Input {...field} type="date" />}</Field>
          <Field name="amount" label="Amount" required>{(field) => <Input {...field} inputMode="decimal" />}</Field>
          <Field name="note" label="Note">{(field) => <Textarea {...field} rows={2} />}</Field>
        </WorkspaceForm>
      </DialogContent>
    </Dialog>
  );
}
