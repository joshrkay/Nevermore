import { useState } from "react";
import { RecordQuoteForm } from "@/components/quotes/RecordQuoteForm";
import { failureWords } from "@/components/workspace/form";
import { readQuoteDocument, type QuoteDocumentReading, type QuoteRequestRow } from "@/lib/advisorApi";

/** What is said when the reading proposed nothing: the form stays as it was and the broker can still record the quote by hand (D-791). */
const NOT_PROPOSED: Record<string, string> = {
  nothing_found: "Nothing could be read from this document, so nothing is suggested. You can still record the quote by hand.",
  unavailable: "Reading documents is not set up, so nothing is suggested. You can still record the quote by hand.",
};

/**
 * Record the quote (CRM-Q3.3): the button, and the form that records what a PEO quoted. Where the current quote names a document (`documentOf` is that quote's id), "Read the
 * document" (N-2.3, D-790) reads it on a click and opens the form for a revised quote, filled with what was read; nothing is recorded until the form is saved.
 */
export function RecordQuote({ request, mailFiles, documentOf, onRecorded }: { request: QuoteRequestRow; mailFiles: readonly { id: number; file_name: string }[]; documentOf?: number; onRecorded: () => void }) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState<QuoteDocumentReading | null>(null);
  const [busy, setBusy] = useState(false);
  const [words, setWords] = useState<string | null>(null);
  const close = () => { setOpen(false); setReading(null); };
  if (open) return <RecordQuoteForm request={request} mailFiles={mailFiles} initial={reading?.draft} sources={reading?.sources} onRecorded={() => { close(); onRecorded(); }} onCancel={close} />;
  const read = async () => {
    setWords(null);
    setBusy(true);
    let result: QuoteDocumentReading;
    try {
      result = await readQuoteDocument(documentOf!);
    } catch (err) {
      setWords(failureWords(err, "The document could not be read. Try again."));
      return;
    } finally {
      setBusy(false);
    }
    if (result.status !== "proposed") {
      setWords(NOT_PROPOSED[result.status] ?? result.message ?? "The document could not be read.");
      return;
    }
    setReading(result);
    setOpen(true);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium">Record the quote</button>
      {documentOf !== undefined && <button type="button" disabled={busy} onClick={() => void read()} className="min-h-11 px-4 rounded-md border border-border text-sm font-medium">Read the document</button>}
      {words && <p role="status" className="basis-full text-sm text-muted-foreground">{words}</p>}
    </>
  );
}
