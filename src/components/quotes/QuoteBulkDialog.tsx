import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { listFirmMembers } from "@/lib/accountsApi";
import type { BulkSelection } from "@/lib/bulkChangeApi";
import { WITHDRAWAL_REASONS, WITHDRAWAL_REASON_LABELS } from "@/data/quoteRequests";
import { applyQuotesBulk, type QuoteBulkAction, type QuoteBulkOutcome } from "@/lib/quotesBulkApi";
import { QUOTE_BULK_TITLES, quotesWords, type QuoteBulkKind } from "./quoteBulkWords";

// The dialog for a bulk change of quotes (story CRM-Q4.1; the database is bulk_quotes_change). It asks for the one thing the change needs and makes it; the
// database decides which rows the person may change, and says which it skipped and why, which the page's result line then reads out.

/** What the dialog tells the page when a change has been made. */
export interface QuoteBulkMade {
  action: QuoteBulkAction;
  outcome: QuoteBulkOutcome;
  /** The new owner's name, for the words. */
  ownerName: string | null;
}

const ASKS: Record<QuoteBulkKind, string> = {
  owner: "Choose who will own these quotes. The owner of a quote's opportunity changes, once however many of its quotes are chosen.",
  close: "Choose one reason for them all. Each quote request closes and its PEO's link stops working; no PEO is written to.",
};
const CONFIRM: Record<QuoteBulkKind, string> = { owner: "Change owner", close: "Close quotes" };

const SELECT = "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm";

export function QuoteBulkDialog({ firmId, kind, selection, count, onClose, onMade }: {
  firmId: string;
  kind: QuoteBulkKind;
  /** What was selected when the dialog opened: the keys, or the table's filters for "all that match". */
  selection: BulkSelection;
  /** How many the person selected, as the table counts them. */
  count: number;
  onClose: () => void;
  onMade: (made: QuoteBulkMade) => void;
}) {
  const [choice, setChoice] = useState("");
  const people = useQuery({ queryKey: ["bulk-owner-choices", firmId], queryFn: () => listFirmMembers(firmId), enabled: kind === "owner", retry: false, staleTime: 60_000 });
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const reason = WITHDRAWAL_REASONS.find((r) => r === choice);
  const action: QuoteBulkAction | null = kind === "owner" ? (choice ? { action: "owner", ownerId: choice } : null) : reason ? { action: "close", reason } : null;

  const make = async () => {
    if (!action || saving) return;
    setSaving(true);
    setRefused(null);
    try {
      const outcome = await applyQuotesBulk(firmId, action, selection);
      onMade({ action, outcome, ownerName: people.data?.find((p) => p.value === choice)?.label ?? null });
    } catch (e) {
      setRefused(e instanceof Error && e.message ? e.message : "Couldn't make that change. Try again.");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle className="font-display text-xl font-bold">{`${QUOTE_BULK_TITLES[kind]}: ${quotesWords(count)}`}</DialogTitle>
        <DialogDescription>{ASKS[kind]}</DialogDescription>
        {kind === "close" && (
          <div className="space-y-1">
            <label htmlFor="quote-bulk-reason" className="text-sm font-medium">Why they close</label>
            <select id="quote-bulk-reason" className={SELECT} value={choice} onChange={(e) => setChoice(e.target.value)} autoFocus>
              <option value="">Choose a reason</option>
              {WITHDRAWAL_REASONS.map((r) => <option key={r} value={r}>{WITHDRAWAL_REASON_LABELS[r]}</option>)}
            </select>
          </div>
        )}
        {kind === "owner" && (
        <div className="space-y-1">
          <label htmlFor="quote-bulk-owner" className="text-sm font-medium">New owner</label>
          <select id="quote-bulk-owner" className={SELECT} value={choice} onChange={(e) => setChoice(e.target.value)} disabled={people.isPending} autoFocus>
            <option value="">{people.isPending ? "Loading people" : "Choose a person"}</option>
            {(people.data ?? []).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {people.isError && <p role="alert" className="text-sm text-destructive">Couldn't load the firm's people. Close this and try again.</p>}
        </div>
        )}
        {refused && <p role="alert" className="text-sm text-destructive">{refused}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="h-11" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="button" className="h-11" aria-busy={saving || undefined} disabled={saving || !action} onClick={() => void make()}>
            {saving ? "Changing…" : CONFIRM[kind]}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
