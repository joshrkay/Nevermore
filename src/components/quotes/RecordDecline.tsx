import { useState } from "react";
import { AnswerForm } from "@/components/advisor/QuoteRequestsPanel";
import type { QuoteRequestRow } from "@/lib/advisorApi";

/** Record a decline (N-1.4) from the quote's page: the submission page's own answer form, offering the one answer, so the reason picker and the call are the same ones. */
export function RecordDecline({ request, onRecorded }: { request: QuoteRequestRow; onRecorded: () => void }) {
  const [open, setOpen] = useState(false);
  if (open) return <div className="w-full max-w-xl"><AnswerForm request={request} only="declined" onCancel={() => setOpen(false)} onSaved={() => { setOpen(false); onRecorded(); }} /></div>;
  return <button type="button" onClick={() => setOpen(true)} className="min-h-11 px-4 rounded-md border border-border text-sm font-medium hover:bg-muted">Record a decline</button>;
}
