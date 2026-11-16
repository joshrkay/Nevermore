import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { BulkOutcome, BulkSelection } from "@/lib/bulkChangeApi";
import { applyLeadsBulk, previewLeadsBulk, type LeadBulkAction } from "@/lib/leadsBulkApi";
import { LEAD_BULK_TITLES, leadsWords, type LeadBulkKind } from "./leadBulkWords";

// The dialog that says exactly what a bulk change of leads will do, from the database's own preview, before anything changes (story CRM-L1.1b, as CRM-S3.7's
// dialog does for accounts): how many will change, those already as asked, and every skipped lead by name with the reason. Its button makes the change only
// for what the preview showed. Delete asks "Delete N leads?" and says where they go: to the bin, which an owner can restore from for 30 days (CRM-L1.1).

/** What the dialog tells the page when a change has been made, so the page can say what happened and offer Undo. */
export interface LeadBulkMade {
  action: LeadBulkAction;
  outcome: BulkOutcome;
}

const ASKS: Record<LeadBulkKind, string> = {
  owner: "Choose who will own these leads.",
  status: "Choose New or Working. A lead that is Not a fit is reopened.",
  not_fit: "Choose one reason for them all.",
  field: "Choose the field to set. A blank value clears it.",
  label: "Add a label to these leads, or take one off.",
  delete: "Deleted leads go to the bin, in no view but Deleted.",
};

const binWords = (n: number) => `This will move ${leadsWords(n)} to the bin. An owner can restore ${n === 1 ? "it" : "them"} for 30 days; after that ${n === 1 ? "it is" : "they are"} removed for good.`;

export function LeadBulkDialog({ firmId, kind, selection, count, onClose, onMade }: {
  firmId: string;
  kind: LeadBulkKind;
  /** What was selected when the dialog opened: the ids, or the table's filters for "all that match". */
  selection: BulkSelection;
  /** How many the person selected, as the table counts them. */
  count: number;
  onClose: () => void;
  onMade: (made: LeadBulkMade) => void;
}) {
  const wanted: LeadBulkAction | null = kind === "delete" ? { action: "delete" } : null;
  const key = JSON.stringify(wanted);
  const preview = useQuery({
    queryKey: ["lead-bulk-preview", firmId, key, "ids" in selection ? selection.ids : selection.filters],
    queryFn: () => previewLeadsBulk(firmId, wanted as LeadBulkAction, selection),
    enabled: wanted !== null,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const showing = preview.isSuccess ? preview.data : null;
  const many = showing && !showing.tooMany && showing.changed > 0 ? leadsWords(showing.changed) : null;
  const confirm = kind === "delete" ? (many ? `Delete ${many}` : "Delete leads") : many ? `Change ${many}` : "Change leads";
  const title = kind === "delete" ? `Delete ${leadsWords(count)}?` : `${LEAD_BULK_TITLES[kind]}: ${leadsWords(count)}`;

  const make = async () => {
    if (!wanted || !showing || saving) return;
    if (showing.tooMany || showing.changed === 0) {
      setRefused(showing.tooMany ? tooManyWords(showing.selected) : "Nothing would change, so there is nothing to do.");
      return;
    }
    setSaving(true);
    setRefused(null);
    try {
      const made = await applyLeadsBulk(firmId, wanted, selection);
      onMade({ action: wanted, outcome: made });
    } catch (e) {
      setRefused(e instanceof Error && e.message ? e.message : "Couldn't make that change. Try again.");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle className="font-display text-xl font-bold">{title}</DialogTitle>
        <DialogDescription>{ASKS[kind]}</DialogDescription>
        <div aria-live="polite" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {wanted !== null && preview.isPending && <p role="status" className="text-muted-foreground">Checking what this will do…</p>}
          {preview.isError && <p role="alert" className="text-destructive">{preview.error instanceof Error ? preview.error.message : "Couldn't check that change. Try again."}</p>}
          {showing && <WhatWillHappen outcome={showing} kind={kind} />}
        </div>
        {refused && <p role="alert" className="text-sm text-destructive">{refused}</p>}
        <p className="text-sm text-muted-foreground">You can undo this for ten minutes. It is recorded in each lead's history.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="h-11" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="button" className="h-11" variant={kind === "delete" ? "destructive" : "default"} aria-busy={saving || undefined} disabled={saving} onClick={() => void make()}>
            {saving ? "Changing…" : confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const tooManyWords = (n: number) => `That is ${n.toLocaleString("en-US")} leads. A bulk change takes at most 1,000: narrow the selection and try again.`;

/** The preview's answer in words: how many change, how many stay as they are, and every skipped lead by name and why. */
function WhatWillHappen({ outcome, kind }: { outcome: BulkOutcome; kind: LeadBulkKind }) {
  if (outcome.tooMany) return <p role="alert" className="font-medium text-destructive">{tooManyWords(outcome.selected)}</p>;
  return (
    <div className="space-y-2">
      <p className="font-semibold">{outcome.changed === 0 ? "Nothing will change." : kind === "delete" ? binWords(outcome.changed) : `This will change ${leadsWords(outcome.changed)}.`}</p>
      {outcome.skipped.length > 0 && (
        <div className="text-warning">
          <p className="font-semibold">{outcome.skipped.length === 1 ? "1 will be skipped" : `${outcome.skipped.length.toLocaleString("en-US")} will be skipped`}</p>
          <ul className="mt-1 max-h-40 list-disc space-y-1 overflow-y-auto pl-5">
            {outcome.skipped.map((s) => <li key={s.id}>{`${s.name ?? "A lead"}: ${s.reason}`}</li>)}
          </ul>
        </div>
      )}
      {outcome.unavailable > 0 && <p className="text-muted-foreground">{`${leadsWords(outcome.unavailable)} you can no longer see will be left out.`}</p>}
    </div>
  );
}
