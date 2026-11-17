import { useState } from "react";
import { Loader2 } from "lucide-react";
import { SaveFailed, useOfflineSave, useSaveFailure } from "@/components/workspace/form";
import { QUOTE_NOTE_MAX } from "@/data/quoteRequests";
import { updateQuoteRequest, type QuoteRequestRow } from "@/lib/advisorApi";

/**
 * Close a quote request (CRM-Q3.2): the PEO's answer "closed" the existing way (`advisor_update_quote_request`, the same call the submission page's answer form makes),
 * with the reason the agent gives as the note. Closing clears any figures a quote held, so it is offered on a quote request still open, not on one that has quoted.
 */
export function CloseQuote({ request, onClosed }: { request: QuoteRequestRow; onClosed: () => void }) {
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState("");
  const [saving, setSaving] = useState(false);
  const failure = useSaveFailure("The quote wasn't closed. Check your connection and try again.");
  const offlineSave = useOfflineSave();
  const close = async () => {
    setSaving(true);
    failure.clear();
    try {
      await updateQuoteRequest(request.id, { status: "closed", receivedOn: null, expiresOn: null, startOn: null, adminFeePepm: null, note: why.trim() || null });
      setAsking(false);
      onClosed();
    } catch (err) {
      failure.failed(err);
    } finally {
      setSaving(false);
    }
  };
  if (!asking) return <button type="button" onClick={() => setAsking(true)} className="min-h-11 px-4 rounded-md border border-border text-sm font-medium hover:bg-muted">Close</button>;
  return (
    <form
      aria-label={`Close the quote from ${request.peo_name}`}
      className="w-full max-w-md space-y-2 border border-border rounded-md p-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        void offlineSave.guard(close)();
      }}
    >
      <label htmlFor={`close-why-${request.id}`} className="block text-xs text-muted-foreground">Why it is closed (optional)</label>
      <textarea id={`close-why-${request.id}`} value={why} onChange={(e) => setWhy(e.target.value)} maxLength={QUOTE_NOTE_MAX} rows={2} className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm" />
      <SaveFailed message={failure.message} className="text-xs" />
      {offlineSave.reason}
      <div className="flex gap-2">
        <button type="submit" {...offlineSave.buttonProps} disabled={saving} className="min-h-11 px-4 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Close this quote
        </button>
        <button type="button" onClick={() => setAsking(false)} disabled={saving} className="min-h-11 px-4 rounded-md border border-border">Cancel</button>
      </div>
    </form>
  );
}
