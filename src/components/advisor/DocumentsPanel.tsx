import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ReviewedDocument } from "@/data/advisor";
import { categoryInfo } from "@/data/documentCategories";
import { advisorScanNotice } from "@/data/documentStatus";
import { documentUrl, type DocumentEvent } from "@/lib/advisorApi";
import { actorName, formatDateTime } from "./format";

interface DocumentsPanelProps {
  documents: ReviewedDocument[];
  /** Every add, removal, rename and re-categorisation, newest first. */
  events: DocumentEvent[];
  prospectUserId: string;
}

// Links are signed on demand and expire within a minute, so they can't be shared on.
const DocumentsPanel = ({ documents, events, prospectUserId }: DocumentsPanelProps) => {
  const [opening, setOpening] = useState<string | null>(null);

  const open = async (doc: ReviewedDocument) => {
    setOpening(doc.id);
    try {
      window.location.assign(await documentUrl(doc));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setOpening(null);
    }
  };

  /** Who made the latest change of this kind to a document, and when. */
  const by = (doc: ReviewedDocument, kind: DocumentEvent["kind"]) => {
    const e = events.find((ev) => ev.document_id === doc.id && ev.kind === kind);
    return e ? ` by ${actorName(e.actor_id, e.actor_email, prospectUserId)} · ${formatDateTime(e.created_at)}` : "";
  };

  return (
    <section aria-labelledby="documents-heading" className="border border-border rounded-xl p-5 space-y-3">
      <h2 id="documents-heading" className="font-display text-lg font-bold">Uploaded documents</h2>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">The prospect hasn't uploaded any documents.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => {
            const held = advisorScanNotice(doc.scan_verdict);
            return (
            // A document re-created under its id with another file appears twice: certified (removed) and added.
            <li key={`${doc.id}:${doc.certification ?? ""}:${doc.storage_path}`} className="flex items-start justify-between gap-3 text-sm" data-testid={`document-${doc.id}`}>
              <div className="min-w-0">
                <p className={`truncate ${doc.certification === "removed" ? "line-through text-muted-foreground" : ""}`}>{doc.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {categoryInfo(doc.category).label} · {doc.file_size} · {formatDateTime(doc.created_at)}
                </p>
                {doc.certification === "removed" && (
                  <p className="text-xs text-warning">
                    Removed after certification{by(doc, "removed")}. The certified file is kept for review.
                  </p>
                )}
                {doc.certification === "added" && (
                  <p className="text-xs text-warning">Added after certification{by(doc, "added")}. Not part of what was certified.</p>
                )}
                {doc.certifiedCategory !== undefined && (
                  <p className="text-xs text-warning">
                    Certified as {categoryInfo(doc.certifiedCategory).label}; re-categorised{by(doc, "recategorised")}.
                  </p>
                )}
                {doc.certifiedFileName !== undefined && (
                  <p className="text-xs text-warning">Certified as “{doc.certifiedFileName}”; renamed{by(doc, "renamed")}.</p>
                )}
                {held && <p className="text-xs text-warning">{held}</p>}
              </div>
              <button
                onClick={() => void open(doc)}
                disabled={opening === doc.id || held !== null}
                className="text-xs text-primary underline flex items-center gap-1 disabled:opacity-50"
                aria-label={`Open ${doc.file_name}`}
              >
                {opening === doc.id && <Loader2 className="w-3 h-3 animate-spin" />} Open
              </button>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default DocumentsPanel;
