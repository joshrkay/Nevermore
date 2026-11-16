import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LEAD_NOT_FIT_REASON_LABELS } from "@/data/leads";
import { ContactError } from "@/lib/contactApi";
import { LEAD_NOT_FIT_REASONS } from "@/lib/leadsApi";
import { markLeadNotFit, type LeadFields, type LeadNotFitReason } from "@/lib/leadPageApi";

/**
 * Not a fit on a lead's page (stories CRM-L2.1, CRM-L1.3): one reason from the short list, then the database marks it. The lead and its history stay; Reopen on
 * its banner takes it back. A refusal is said in the database's own words and the dialog stays open.
 */
export function NotFitDialog({ firmId, lead, onClose, onMarked }: {
  firmId: string;
  lead: Pick<LeadFields, "id" | "name">;
  onClose: () => void;
  onMarked: (fields: LeadFields) => void;
}) {
  const [reason, setReason] = useState<LeadNotFitReason | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason || saving) return;
    setSaving(true);
    setProblem(null);
    try {
      onMarked(await markLeadNotFit(firmId, lead.id, reason));
    } catch (err) {
      setProblem(err instanceof ContactError && err.kind !== "failed" ? err.message : "Couldn't mark the lead Not a fit. Check your connection and try again.");
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Not a fit</DialogTitle>
          <DialogDescription>Why isn't {lead.name} a fit? The lead and its history stay, and it can be reopened.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="sr-only">Reason</legend>
            {LEAD_NOT_FIT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input type="radio" name="not-fit-reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                {LEAD_NOT_FIT_REASON_LABELS[r]}
              </label>
            ))}
          </fieldset>
          {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={!reason || saving}>{saving ? "Saving…" : "Mark Not a fit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
