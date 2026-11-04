import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { applyAdvisorReview, isCurrentVersion, isStaleRefusal } from "@/data/advisor";
import { buildManuscript, manuscriptFilename } from "@/data/manuscript";
import { buildManuscriptPdf } from "@/lib/manuscriptPdf";
import { downloadBlob } from "@/lib/downloadFile";
import { manuscriptUrl, saveManuscriptVersion, type ManuscriptVersion, type SubmissionDetail } from "@/lib/advisorApi";
import { formatDateTime } from "./format";

const versionFilename = (detail: SubmissionDetail, fileId: string, version: number) =>
  manuscriptFilename(`${fileId}-v${version}`, detail.data.company_name);

/**
 * Download or regenerate the advisor-reviewed Manuscript, one stored version per generation. Each
 * version names the certification and review state it was built from; `onChanged` reloads the
 * submission after a version is stored, or when the database refuses one because either has moved on.
 */
const ManuscriptPanel = ({ detail, onChanged }: { detail: SubmissionDetail; onChanged: () => void }) => {
  const [revealSensitive, setRevealSensitive] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const latestEventId = detail.reviewEvents[0]?.id ?? 0;
  const latest = detail.versions[0];
  const pending = Object.values(detail.reviews).filter((r) => r?.has_correction && r.review_state !== "verified").length;
  const answersChanged = Object.values(detail.reviews).filter((r) => r?.answer_changed_at).length;
  // Only a version built from the current certification is offered to the prospect (and is current).
  const current = (v: ManuscriptVersion) => detail.certified && isCurrentVersion(v, detail.submission);

  const generate = async () => {
    setGenerating(true);
    try {
      const version = (latest?.version ?? 0) + 1;
      const packet = applyAdvisorReview(detail.data, detail.provenance, detail.reviews);
      const manuscript = buildManuscript(packet.data, {
        fileId: detail.fileId,
        submission: detail.submission,
        provenance: packet.provenance,
        advisor: { version, corrections: packet.corrections, followUps: packet.followUps },
      });
      const pdf = buildManuscriptPdf(manuscript, { revealSensitive });
      await saveManuscriptVersion({
        sessionId: detail.id,
        version,
        pdf: pdf.blob,
        reviewEventId: latestEventId,
        correctionsApplied: packet.corrections.length,
        sensitiveRevealed: revealSensitive,
        certifiedDataHash: detail.submission?.data_sha256 ?? null,
        certifiedAt: detail.submission?.certified_at ?? null,
      });
      downloadBlob(pdf.blob, versionFilename(detail, detail.fileId, version));
      toast.success(`Manuscript v${version} saved.`);
      onChanged();
    } catch (err) {
      console.error("Failed to generate manuscript:", err);
      if (isStaleRefusal(err)) {
        // Built from answers or a review that are no longer current: show the current ones.
        toast.error(`${(err as Error).message}. The page now shows the latest answers and review.`);
        onChanged();
      } else {
        toast.error((err as Error).message || "We couldn't generate the Manuscript.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const open = async (v: ManuscriptVersion) => {
    setOpening(v.id);
    try {
      window.location.assign(await manuscriptUrl(v, versionFilename(detail, v.file_id, v.version)));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setOpening(null);
    }
  };

  return (
    <section aria-labelledby="manuscript-heading" className="border border-border rounded-xl p-5 space-y-4">
      <h2 id="manuscript-heading" className="font-display text-lg font-bold">The Manuscript</h2>

      {!detail.certified ? (
        <p className="text-sm text-muted-foreground">
          {detail.submission?.signer_name
            ? "The prospect changed their answers after certifying. A Manuscript can be generated once they certify again."
            : "Not certified yet. A Manuscript can be generated once the prospect certifies their intake."}
        </p>
      ) : (
        <div className="space-y-2">
          {latest && !current(latest) && (
            <p className="text-xs text-warning" role="status">
              The prospect certified again after v{latest.version} was generated, so it shows answers they've since
              changed and isn't offered to them. Generate a new version from their current answers.
            </p>
          )}
          {latest && latest.review_event_id !== latestEventId && (
            <p className="text-xs text-warning" role="status">
              The review has changed since v{latest.version}. Generate a new version to include it.
            </p>
          )}
          {answersChanged > 0 && (
            <p className="text-xs text-warning" role="status">
              {answersChanged === 1
                ? "The prospect changed 1 answer after it was reviewed, so its review was reset. Review it again before generating."
                : `The prospect changed ${answersChanged} answers after they were reviewed, so their reviews were reset. Review them again before generating.`}
            </p>
          )}
          {pending > 0 && (
            <p className="text-xs text-muted-foreground">
              {pending} correction{pending === 1 ? " isn't" : "s aren't"} verified yet and won't be included.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            The latest version is the prospect's final Manuscript: they can download it from their Manuscript page and
            send it on. Correction reasons are printed in it.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={revealSensitive} onChange={(e) => setRevealSensitive(e.target.checked)} />
            Include full dates of birth
          </label>
          <button
            onClick={generate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {latest ? "Regenerate as new version" : "Generate Manuscript"}
          </button>
        </div>
      )}

      {detail.versions.length > 0 ? (
        <ul className="space-y-2" aria-label="Manuscript versions">
          {detail.versions.map((v) => (
            <li key={v.id} className="flex items-start justify-between gap-3 text-sm border-t border-border pt-2">
              <div>
                <p className="font-medium">v{v.version}</p>
                <p className="text-xs text-muted-foreground">
                  {v.generated_by_email ?? "Advisor"} · {formatDateTime(v.generated_at)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Certified {formatDateTime(v.certified_signed_at)} · {v.corrections_applied} correction
                  {v.corrections_applied === 1 ? "" : "s"} · {v.sensitive_revealed ? "full DOBs" : "DOBs masked"}
                </p>
                {v === latest && current(v) && <p className="text-xs text-success">Shared with the prospect as their final Manuscript</p>}
                {detail.certified && !current(v) && <p className="text-xs text-warning">Built from an earlier certification</p>}
              </div>
              <button
                onClick={() => void open(v)}
                disabled={opening === v.id}
                className="flex items-center gap-1 text-xs text-primary underline disabled:opacity-50"
                aria-label={`Download v${v.version}`}
              >
                {opening === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                Download
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No versions generated yet.</p>
      )}
    </section>
  );
};

export default ManuscriptPanel;
