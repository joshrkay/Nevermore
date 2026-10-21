import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { documentUrl, type UploadedDocument } from "@/lib/advisorApi";
import { formatDateTime } from "./format";

// Links are signed on demand and expire within a minute, so they can't be shared on.
const DocumentsPanel = ({ documents }: { documents: UploadedDocument[] }) => {
  const [opening, setOpening] = useState<string | null>(null);

  const open = async (doc: UploadedDocument) => {
    setOpening(doc.id);
    try {
      window.location.assign(await documentUrl(doc));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setOpening(null);
    }
  };

  return (
    <section aria-labelledby="documents-heading" className="border border-border rounded-xl p-5 space-y-3">
      <h2 id="documents-heading" className="font-display text-lg font-bold">Uploaded documents</h2>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">The prospect hasn't uploaded any documents.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate">{doc.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.category} · {doc.file_size} · {formatDateTime(doc.created_at)}
                </p>
              </div>
              <button
                onClick={() => void open(doc)}
                disabled={opening === doc.id}
                className="text-xs text-primary underline flex items-center gap-1 disabled:opacity-50"
              >
                {opening === doc.id && <Loader2 className="w-3 h-3 animate-spin" />} Open
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default DocumentsPanel;
