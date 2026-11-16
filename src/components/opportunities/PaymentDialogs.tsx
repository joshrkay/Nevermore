import { useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { dateRule, Field, FormActions, SaveRefused, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { formatDay, today } from "@/data/accountPage";
import { changedLine, paymentFieldLabel } from "@/data/opportunityClose";
import { dollarsWords } from "@/data/opportunityPage";
import {
  deleteCommissionPayment, OpportunityError, recordCommissionPayment, updateCommissionPayment, type CommissionPayment, type PaymentConflict, type PaymentInput,
} from "@/lib/opportunityPageApi";

// Commission received against the placement a win made (D-467): record one, edit one, delete one. Each edit and delete is made from the version the payment had when its
// dialog opened (D-46), and a stale one is answered with who changed what: nothing is saved or deleted, the person reads it, and only then does the dialog start from the
// version it named. Whoever may change the opportunity may do all three; the database decides, and says why in words.

const paymentSchema = z.object({
  received_on: dateRule().refine((v) => v !== "", "Enter the day it was received, like 2027-02-10."),
  amount: z.string().trim().refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Enter an amount above zero, like 1500."),
  note: z.string().trim().max(500, "Keep the note to 500 characters."),
});

const inputOf = (v: { received_on?: string; amount?: string; note?: string }): PaymentInput => ({ receivedOn: v.received_on ?? "", amount: Number(v.amount), note: v.note ?? "" });

/** What a conflict over a payment says: who changed which field, in the page's words. */
const conflictWords = (c: PaymentConflict, nothing: string, tail: string): string =>
  `Someone else changed this payment first. ${nothing} ${c.changed.map((x) => changedLine(x, paymentFieldLabel)).join("; ")}${c.changed.length > 0 ? ". " : ""}${tail}`;

function PaymentFields() {
  return (
    <>
      <Field name="received_on" label="Received on" required>{(field) => <Input {...field} type="date" />}</Field>
      <Field name="amount" label="Amount" required>{(field) => <Input {...field} inputMode="decimal" />}</Field>
      <Field name="note" label="Note">{(field) => <Textarea {...field} rows={2} />}</Field>
    </>
  );
}

/** Record a payment (D-467): the day it was received, an amount above zero and a note, against the placement the win made. */
export function RecordPaymentDialog({ firmId, placementId, onClose, onChanged }: { firmId: string; placementId: string; onClose: () => void; onChanged: () => void }) {
  const api = useWorkspaceForm({
    schema: paymentSchema,
    defaultValues: { received_on: today(), amount: "", note: "" },
    save: async (v) => {
      try {
        return await recordCommissionPayment(firmId, placementId, inputOf(v));
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
          <PaymentFields />
        </WorkspaceForm>
      </DialogContent>
    </Dialog>
  );
}

/** Edit a payment: its day, amount and note, from the version it was opened at. */
export function EditPaymentDialog({ firmId, payment, onClose, onChanged }: { firmId: string; payment: CommissionPayment; onClose: () => void; onChanged: () => void }) {
  // Taken once, when the dialog opens: a reload of the payments underneath never changes what this save starts from. A conflict answer moves it, once it has been shown.
  const version = useRef(payment.version);
  const [conflicted, setConflicted] = useState(false);
  const leave = () => {
    if (conflicted) onChanged();
    onClose();
  };
  const api = useWorkspaceForm({
    schema: paymentSchema,
    defaultValues: { received_on: payment.receivedOn, amount: String(payment.amount), note: payment.note ?? "" },
    save: async (v) => {
      try {
        const done = await updateCommissionPayment(firmId, payment.id, inputOf(v), version.current);
        if (done.conflict) {
          version.current = done.currentVersion;
          setConflicted(true);
          throw new SaveRefused(conflictWords(done, "Nothing was saved.", "Check it, and save again to keep your change."));
        }
        return done;
      } catch (e) {
        if (e instanceof OpportunityError && e.kind !== "failed") throw new SaveRefused(e.message);
        throw e;
      }
    },
    onSaved: () => {
      toast.success("Payment saved");
      onChanged();
      onClose();
    },
    failureMessage: "Couldn't save the payment. Check your connection and try again.",
    onCancel: leave,
  });
  return (
    <Dialog open onOpenChange={(open) => { if (!open) api.cancel?.(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit payment</DialogTitle>
          <DialogDescription>The {dollarsWords(payment.amount)} received {formatDay(payment.receivedOn)}.</DialogDescription>
        </DialogHeader>
        <WorkspaceForm api={api} aria-label="Edit payment" actions={<FormActions submitLabel="Save payment" savingLabel="Saving…" />}>
          <PaymentFields />
        </WorkspaceForm>
      </DialogContent>
    </Dialog>
  );
}

/** Delete a payment: asks first, and deletes from the version it was opened at. */
export function DeletePaymentDialog({ firmId, payment, onClose, onChanged }: { firmId: string; payment: CommissionPayment; onClose: () => void; onChanged: () => void }) {
  const version = useRef(payment.version);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const leave = () => {
    if (conflicted) onChanged();
    onClose();
  };
  const remove = async () => {
    setBusy(true);
    setRefused(null);
    try {
      const done = await deleteCommissionPayment(firmId, payment.id, version.current);
      if (done.conflict) {
        version.current = done.currentVersion;
        setConflicted(true);
        setRefused(conflictWords(done, "Nothing was deleted.", "Delete it again if you still want to."));
        return;
      }
      toast.success("Payment deleted");
      onChanged();
      onClose();
    } catch (e) {
      setRefused(e instanceof OpportunityError && e.kind !== "failed" ? e.message : "Couldn't delete the payment. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !busy) leave(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
          <AlertDialogDescription>
            The payment of {dollarsWords(payment.amount)} received {formatDay(payment.receivedOn)} is removed from the placement and from what is received to date. The history keeps it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {refused && <p role="alert" className="text-sm text-destructive">{refused}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>Delete payment</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
