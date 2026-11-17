import { useState } from "react";
import { RecordQuoteForm } from "@/components/quotes/RecordQuoteForm";
import type { QuoteRequestRow } from "@/lib/advisorApi";

/** Record the quote (CRM-Q3.3): the button, and the form that records what a PEO quoted. */
export function RecordQuote({ request, mailFiles, onRecorded }: { request: QuoteRequestRow; mailFiles: readonly { id: number; file_name: string }[]; onRecorded: () => void }) {
  const [open, setOpen] = useState(false);
  if (open) return <RecordQuoteForm request={request} mailFiles={mailFiles} onRecorded={() => { setOpen(false); onRecorded(); }} onCancel={() => setOpen(false)} />;
  return <button type="button" onClick={() => setOpen(true)} className="min-h-11 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium">Record the quote</button>;
}
