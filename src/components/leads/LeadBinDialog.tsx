import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatDay } from "@/data/accountPage";
import { listLeadsBin, restoreLeads, type BinnedLead } from "@/lib/leadsBulkApi";

// The bin (story CRM-L1.1b, D-806): the firm's deleted leads, which only its owners see, each with the day the nightly removal takes it for good (30 days
// after it was deleted), and Restore, which puts it back in the views it was in. Opened from the Leads page's "Deleted"; restoring asks the table again.

export function LeadBinDialog({ firmId, onClose, onRestored }: { firmId: string; onClose: () => void; onRestored: () => void }) {
  const queryClient = useQueryClient();
  const bin = useQuery({ queryKey: ["leads-bin", firmId], queryFn: () => listLeadsBin(firmId), retry: false, gcTime: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null);

  const restore = async (lead: BinnedLead) => {
    if (busy) return;
    setBusy(lead.id);
    setSaid(null);
    try {
      const done = await restoreLeads(firmId, [lead.id]);
      setSaid(done.restored === 1 ? { ok: true, words: `${lead.name} is back in the leads.` } : { ok: false, words: `${lead.name} is no longer in the bin.` });
      onRestored();
      void queryClient.invalidateQueries({ queryKey: ["leads-bin", firmId] });
    } catch (e) {
      setSaid({ ok: false, words: e instanceof Error && e.message ? e.message : "Couldn't restore. Try again." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="font-display text-xl font-bold">Deleted leads</DialogTitle>
        <DialogDescription>Deleted leads stay here for 30 days, then they are removed for good with their calls, notes and tasks.</DialogDescription>
        <div aria-live="polite">{said && <p role={said.ok ? "status" : "alert"} className={`text-sm ${said.ok ? "" : "text-destructive"}`}>{said.words}</p>}</div>
        {bin.isPending && <p role="status" className="text-sm text-muted-foreground">Loading the deleted leads…</p>}
        {bin.isError && <p role="alert" className="text-sm text-destructive">{bin.error instanceof Error ? bin.error.message : "Couldn't load the deleted leads."}</p>}
        {bin.isSuccess && bin.data.rows.length === 0 && <p className="text-sm text-muted-foreground">The bin is empty.</p>}
        {bin.isSuccess && bin.data.rows.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {bin.data.rows.map((lead) => (
              <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">{lead.name}</p>
                  {lead.business && <p className="text-xs text-muted-foreground">{lead.business}</p>}
                  <p className="text-xs text-muted-foreground">{`Removed for good on ${formatDay(lead.removed_on)}`}</p>
                </div>
                <Button type="button" variant="outline" className="h-11" aria-label={`Restore ${lead.name}`} disabled={busy !== null} onClick={() => void restore(lead)}>
                  {busy === lead.id ? "Restoring…" : "Restore"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {bin.isSuccess && bin.data.total > bin.data.rows.length && (
          <p className="text-sm text-muted-foreground">{`Showing the ${bin.data.rows.length} deleted most recently of ${bin.data.total}.`}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
