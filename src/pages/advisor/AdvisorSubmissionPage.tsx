import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import AuditTrail from "@/components/advisor/AuditTrail";
import DocumentsPanel from "@/components/advisor/DocumentsPanel";
import FieldReviewPanel from "@/components/advisor/FieldReviewPanel";
import ManuscriptPanel from "@/components/advisor/ManuscriptPanel";
import NotesPanel from "@/components/advisor/NotesPanel";
import StatusPanel from "@/components/advisor/StatusPanel";
import TranscriptEvidence from "@/components/advisor/TranscriptEvidence";
import { formatDateTime, messageAnchor } from "@/components/advisor/format";
import { loadSubmission, type SubmissionDetail } from "@/lib/advisorApi";

type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  | { kind: "not_found" }
  | { kind: "ready"; detail: SubmissionDetail };

const AdvisorSubmissionPage = () => {
  const { id = "" } = useParams();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Keep showing the current detail while refreshing after a change.
    setLoad((prev) => (prev.kind === "ready" && prev.detail.id === id ? prev : { kind: "loading" }));
    loadSubmission(id)
      .then((detail) => !cancelled && setLoad(detail ? { kind: "ready", detail } : { kind: "not_found" }))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => { cancelled = true; };
  }, [id, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const showMessage = useCallback((messageId: string) => {
    setHighlighted(messageId);
    document.getElementById(messageAnchor(messageId))?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, []);

  const messageIds = useMemo(
    () => new Set(load.kind === "ready" ? load.detail.transcript.map((m) => m.id) : []),
    [load],
  );

  return (
    <div className="min-h-screen bg-background">
      <AdvisorHeader />
      <main className="container mx-auto px-6 py-8">
        <Link to="/advisor" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> All submissions
        </Link>

        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-24 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading submission…
          </div>
        )}

        {load.kind === "error" && <AdvisorLoadError error={load.error} what="this submission" onRetry={reload} />}

        {load.kind === "not_found" && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <p className="font-medium">Submission not found.</p>
            <p className="text-sm text-muted-foreground">It may have been removed, or the link is wrong.</p>
          </div>
        )}

        {load.kind === "ready" && (
          <Detail detail={load.detail} reload={reload} messageIds={messageIds} highlighted={highlighted} onShowMessage={showMessage} />
        )}
      </main>
    </div>
  );
};

const Detail = ({
  detail,
  reload,
  messageIds,
  highlighted,
  onShowMessage,
}: {
  detail: SubmissionDetail;
  reload: () => void;
  messageIds: Set<string>;
  highlighted: string | null;
  onShowMessage: (id: string) => void;
}) => {
  const sub = detail.submission;
  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">{detail.data.company_name ?? "Company not provided"}</h1>
        <p className="text-sm text-muted-foreground font-mono">{detail.fileId}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {detail.certified && sub
            ? `Certified by ${sub.signer_name}${sub.signer_title ? `, ${sub.signer_title}` : ""} · ${formatDateTime(sub.certified_at ?? sub.signed_at)}`
            : sub?.signer_name
              ? "Certification withdrawn: the prospect changed their answers after signing. Showing their current answers."
              : "Not certified yet. Showing the prospect's answers so far."}
          {detail.contactName && ` · Contact: ${detail.contactName}`}
          {detail.phone && ` · ${detail.phone}`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6 min-w-0">
          <FieldReviewPanel
            sessionId={detail.id}
            data={detail.data}
            provenance={detail.provenance}
            reviews={detail.reviews}
            messageIds={messageIds}
            onShowMessage={onShowMessage}
            onChanged={reload}
          />
          <CensusTable detail={detail} />
          <TranscriptEvidence messages={detail.transcript} highlighted={highlighted} />
        </div>
        <div className="space-y-6">
          <StatusPanel
            key={detail.pipelineStatus}
            sessionId={detail.id}
            prospectUserId={detail.userId}
            status={detail.pipelineStatus}
            history={detail.history}
            onChanged={reload}
          />
          <ManuscriptPanel detail={detail} onGenerated={reload} />
          <DocumentsPanel documents={detail.documents} />
          <NotesPanel sessionId={detail.id} notes={detail.notes} onAdded={reload} />
          <AuditTrail events={detail.reviewEvents} />
        </div>
      </div>
    </>
  );
};

const CensusTable = ({ detail }: { detail: SubmissionDetail }) => (
  <section aria-labelledby="census-heading" className="border border-border rounded-xl p-5">
    <h2 id="census-heading" className="font-display text-lg font-bold mb-3">Employee census</h2>
    {detail.data.employees.length === 0 ? (
      <p className="text-sm text-muted-foreground">No census captured.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-3">Name</th>
              <th className="py-1 pr-3">DOB</th>
              <th className="py-1 pr-3">State</th>
              <th className="py-1 pr-3">Title</th>
              <th className="py-1 pr-3 text-right">Salary</th>
              <th className="py-1 pr-3">Type</th>
              <th className="py-1">Dependents</th>
            </tr>
          </thead>
          <tbody>
            {detail.data.employees.map((e, i) => (
              <tr key={i} className="border-t border-border">
                <td className="py-1 pr-3">{`${e.first_name} ${e.last_name}`.trim() || "—"}</td>
                <td className="py-1 pr-3 font-mono">{e.dob || "—"}</td>
                <td className="py-1 pr-3">{e.state || "—"}</td>
                <td className="py-1 pr-3">{e.title || "—"}</td>
                <td className="py-1 pr-3 text-right font-mono">{e.salary ? `$${e.salary.toLocaleString()}` : "—"}</td>
                <td className="py-1 pr-3">{e.classification}</td>
                <td className="py-1">{e.dependents.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

export default AdvisorSubmissionPage;
