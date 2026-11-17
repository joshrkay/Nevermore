import { useState } from "react";
import { toast } from "sonner";
import { describeAttachment } from "@/data/mailThread";
import { mailAttachmentUrl, recordActivity, uploadQuoteDocument, type QuoteRecord } from "@/lib/advisorApi";
import { failureWords, DID_NOT_GO_THROUGH } from "@/components/workspace/form";
import { Button } from "@/components/ui/button";

/**
 * The quote document (N-2.2, D-730): the file the PEO sent, kept with the quote. It is a mail attachment already stored and scanned on the quote request's thread, so it opens
 * through the same 60-second signed link the thread's files do.
 */
export function QuoteDocument({ quoteRequestId, quote, canChange, onChanged }: { quoteRequestId: number; quote: QuoteRecord; canChange: boolean; onChanged: () => void }) {
  const [opening, setOpening] = useState(false);
  const [uploading, setUploading] = useState(false);
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
  // A quote recorded by hand has no email to take the file from: the agent uploads it (quote-document-upload checks and scans it, and keeps it with the thread's files).
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadQuoteDocument(quote.id, file);
      if (result.status === "blocked") toast.error("The virus check blocked that file, so it was not kept.");
      onChanged();
    } catch (err) {
      toast.error(failureWords(err, DID_NOT_GO_THROUGH));
    } finally {
      setUploading(false);
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
      {!doc && canChange && (
        <label className="block text-sm space-y-1">
          <span>Upload the quote document</span>
          <input type="file" aria-label="Upload the quote document" disabled={uploading} className="block text-sm"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
        </label>
      )}
    </section>
  );
}
