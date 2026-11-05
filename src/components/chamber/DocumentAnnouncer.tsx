import { useEffect, useRef, useState } from "react";
import { documentStatusChanges } from "@/data/documentStatus";
import type { SessionDocument } from "@/hooks/useSessionDocuments";

/**
 * Tells a screen reader when a file's state changes: uploading, the virus check, Lenore reading it, and how that
 * went (I-2.2). It sits beside the workspace's tabs rather than in the Upload tab, because a file is usually still
 * being read after the prospect has moved on. Files already there when the list loads (an intake reopened, or
 * another one opened) are not read out.
 */
const DocumentAnnouncer = ({ docs, loading }: { docs: readonly SessionDocument[]; loading: boolean }) => {
  const labelsRef = useRef<Map<string, string> | null>(null);
  const [said, setSaid] = useState<{ n: number; text: string } | null>(null);
  useEffect(() => {
    // While a list loads there is nothing to compare with; what it loads is where changes are counted from.
    if (loading) {
      labelsRef.current = null;
      return;
    }
    const { labels, lines } = documentStatusChanges(labelsRef.current ?? new Map(), docs);
    const first = labelsRef.current === null;
    labelsRef.current = labels;
    if (!first && lines.length > 0) setSaid((prev) => ({ n: (prev?.n ?? 0) + 1, text: lines.join(". ") }));
  }, [docs, loading]);
  return (
    <div className="sr-only" role="status" aria-live="polite" data-testid="document-announcer">
      {/* Keyed, so the same words for a second change are still read out. */}
      {said && <p key={said.n}>{said.text}</p>}
    </div>
  );
};

export default DocumentAnnouncer;
