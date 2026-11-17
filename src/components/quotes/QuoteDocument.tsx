import { useState } from "react";
import { toast } from "sonner";
import { describeAttachment } from "@/data/mailThread";
import { mailAttachmentUrl, recordActivity, type QuoteRecord } from "@/lib/advisorApi";
import { failureWords, DID_NOT_GO_THROUGH } from "@/components/workspace/form";
import { Button } from "@/components/ui/button";

/**
 * The quote document (N-2.2, D-730): the file the PEO sent, kept with the quote. It is a mail attachment already stored and scanned on the quote request's thread, so it opens
 * through the same 60-second signed link the thread's files do.
 */
export function QuoteDocument({ quoteRequestId, quote }: { quoteRequestId: number; quote: QuoteRecord }) {
  const [opening, setOpening] = useState(false);
  const doc = quote.document;
  const open = async () => {
    if (!doc) return;
    setOpening(true);
    try {
      const url = await mailAttachmentUrl(doc);
      void recordActivity("document_downloaded", "quote_request", String(quoteRequestId));
      window.location.assign(url);
    } catch (err) {
      toast.error(failureWords(err, DID_NOT_GO_THROUGH));
    } finally {
      setOpening(false);
    }
  };
  return (
    <section aria-labelledby="quote-document-heading" className="border border-border rounded-xl p-5 space-y-3">
      <h2 id="quote-document-heading" className="font-display text-lg font-bold">Quote document</h2>
      {doc && (
        <div className="text-sm space-y-1">
          <p className="break-words">{doc.file_name}</p>
          <p className="text-xs text-muted-foreground">{describeAttachment({ status: "stored", not_kept_reason: null, size_bytes: doc.size_bytes }).text}</p>
          <Button type="button" variant="outline" size="sm" disabled={opening} onClick={() => void open()} aria-label={`Open ${doc.file_name}`}>Open</Button>
        </div>
      )}
    </section>
  );
}
