import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { firmLabels, type BulkOutcome, type BulkSelection } from "@/lib/bulkChangeApi";
import { applyLeadsBulk, previewLeadsBulk, type LeadBulkAction } from "@/lib/leadsBulkApi";
import { LEAD_NOT_FIT_REASON_LABELS, LEAD_STATUS_LABELS } from "@/data/leads";
import { LEAD_NOT_FIT_REASONS } from "@/lib/leadsApi";
import { listFirmMembers } from "@/lib/accountsApi";
import { Input } from "@/components/ui/input";
import { US_STATE_CODES } from "@/data/chamberValidation";
import { LEAD_BULK_FIELDS } from "@/lib/leadsBulkApi";
import { LEAD_FIELD_WORDS } from "./leadBulkWords";
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

/** The change the choice makes, or null while nothing is chosen (nothing is asked of the database until it is). */
const actionOf = (kind: LeadBulkKind, choice: string, value: string): LeadBulkAction | null => {
  switch (kind) {
    case "delete": return { action: "delete" };
    case "status": return choice === "new" || choice === "working" ? { action: "status", status: choice } : null;
    case "owner": return choice ? { action: "owner", ownerId: choice } : null;
    // For a label the choice is the mode and the value its word.
    case "label": {
      const name = value.trim();
      if (!name) return null;
      return { action: choice === "label_remove" ? "label_remove" : "label_add", name };
    }
    case "field": {
      const field = LEAD_BULK_FIELDS.find((f) => f === choice);
      if (!field) return null;
      const v = value.trim();
      if (field === "employees") {
        if (v === "") return { action: "field", field, value: null };
        return /^\d+$/.test(v) ? { action: "field", field, value: Number(v) } : null;
      }
      return { action: "field", field, value: v === "" ? null : v };
    }
    case "not_fit": {
      const reason = LEAD_NOT_FIT_REASONS.find((r) => r === choice);
      return reason ? { action: "not_fit", reason } : null;
    }
    default: return null;
  }
};

const SELECT = "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm";

const binWords =(n: number) => `This will move ${leadsWords(n)} to the bin. An owner can restore ${n === 1 ? "it" : "them"} for 30 days; after that ${n === 1 ? "it is" : "they are"} removed for good.`;

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
  const [choice, setChoice] = useState("");
  const labels = useQuery({ queryKey: ["bulk-labels", firmId], queryFn: () => firmLabels(firmId), enabled: kind === "label", retry: false, gcTime: 0 });
  const people = useQuery({ queryKey: ["bulk-owner-choices", firmId], queryFn: () => listFirmMembers(firmId), enabled: kind === "owner", retry: false, staleTime: 60_000 });
  const [value, setValue] = useState("");
  const wanted = actionOf(kind, choice, value);
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
        {kind === "status" && (
          <div className="space-y-1">
            <label htmlFor="lead-bulk-status" className="text-sm font-medium">New status</label>
            <select id="lead-bulk-status" className={SELECT} value={choice} onChange={(e) => setChoice(e.target.value)} autoFocus>
              <option value="">Choose a status</option>
              <option value="new">{LEAD_STATUS_LABELS.new}</option>
              <option value="working">{LEAD_STATUS_LABELS.working}</option>
            </select>
          </div>
        )}
        {kind === "owner" && (
          <div className="space-y-1">
            <label htmlFor="lead-bulk-owner" className="text-sm font-medium">New owner</label>
            <select id="lead-bulk-owner" className={SELECT} value={choice} onChange={(e) => setChoice(e.target.value)} disabled={people.isPending} autoFocus>
              <option value="">{people.isPending ? "Loading people" : "Choose a person"}</option>
              {(people.data ?? []).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {people.isError && <p role="alert" className="text-sm text-destructive">Couldn't load the firm's people. Close this and try again.</p>}
          </div>
        )}
        {kind === "field" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="lead-bulk-field" className="text-sm font-medium">Field</label>
              <select id="lead-bulk-field" className={SELECT} value={choice} onChange={(e) => { setChoice(e.target.value); setValue(""); }} autoFocus>
                <option value="">Choose a field</option>
                {LEAD_BULK_FIELDS.map((f) => <option key={f} value={f}>{LEAD_FIELD_WORDS[f]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="lead-bulk-value" className="text-sm font-medium">New value</label>
              {choice === "state" ? (
                <select id="lead-bulk-value" className={SELECT} value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">No state</option>
                  {US_STATE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              ) : (
                <Input id="lead-bulk-value" value={value} onChange={(e) => setValue(e.target.value)} inputMode={choice === "employees" ? "numeric" : undefined}
                  type={choice === "phone" ? "tel" : choice === "email" ? "email" : "text"} aria-describedby="lead-bulk-value-help" />
              )}
              <p id="lead-bulk-value-help" className="text-xs text-muted-foreground">Leave it blank to clear the field.</p>
            </div>
          </div>
        )}
        {kind === "label" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="lead-bulk-mode" className="text-sm font-medium">Change</label>
              <select id="lead-bulk-mode" className={SELECT} value={choice || "label_add"} onChange={(e) => { setChoice(e.target.value); setValue(""); }} autoFocus>
                <option value="label_add">Add a label</option>
                <option value="label_remove">Remove a label</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="lead-bulk-label" className="text-sm font-medium">Label</label>
              {choice === "label_remove" ? (
                <select id="lead-bulk-label" className={SELECT} value={value} onChange={(e) => setValue(e.target.value)} disabled={labels.isPending}>
                  <option value="">{labels.isPending ? "Loading labels" : labels.data?.length === 0 ? "The firm has no labels yet" : "Choose a label"}</option>
                  {(labels.data ?? []).map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              ) : (
                <Input id="lead-bulk-label" value={value} onChange={(e) => setValue(e.target.value)} list="lead-bulk-label-words" autoComplete="off" maxLength={40} />
              )}
              <datalist id="lead-bulk-label-words">{(labels.data ?? []).map((l) => <option key={l.id} value={l.name} />)}</datalist>
            </div>
          </div>
        )}
        {kind === "not_fit" && (
          <div className="space-y-1">
            <label htmlFor="lead-bulk-reason" className="text-sm font-medium">Reason</label>
            <select id="lead-bulk-reason" className={SELECT} value={choice} onChange={(e) => setChoice(e.target.value)} autoFocus>
              <option value="">Choose a reason</option>
              {LEAD_NOT_FIT_REASONS.map((r) => <option key={r} value={r}>{LEAD_NOT_FIT_REASON_LABELS[r]}</option>)}
            </select>
          </div>
        )}
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
