import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AnswersJsonDownload from "@/components/AnswersJsonDownload";
import { applyAdvisorReview, isCurrentVersion, isStaleRefusal, verifiedFieldsOf } from "@/data/advisor";
import { buildManuscript, manuscriptFilename } from "@/data/manuscript";
import type { PeoRecord } from "@/data/peoCatalog";
import { localToday } from "@/data/peoProfiles";
import type { PeoCatalogStatus } from "@/hooks/usePeoCatalog";
import { buildManuscriptPdf } from "@/lib/manuscriptPdf";
import { downloadBlob } from "@/lib/downloadFile";
import { manuscriptUrl, recordActivity, saveManuscriptVersion, type ManuscriptVersion, type SubmissionDetail } from "@/lib/advisorApi";
import { certificationOf } from "@/lib/certificationCheck";
import { certifiedAnswersSource } from "@/data/certifiedAnswersDocument";
import { formatDateTime } from "./format";

/**
 * A stored version's file name, from what that version recorded: its File ID, its own certification's date
 * and its advisor version. Never from the certification on record now, so a later certification doesn't
 * rename a PDF that was stored for an earlier one, and opening it later gives the name it was saved under.
 * (A stored version doesn't record which certification number it was built from, so the name carries the
 * certified date and `advisor-v<n>`, not `v<certification>`. The company is the intake's current legal name.)
 */
const versionFilename = (companyName: string | null, v: Pick<ManuscriptVersion, "file_id" | "version" | "certified_at" | "certified_signed_at">) =>
  manuscriptFilename(v.file_id, companyName, { date: v.certified_at ?? v.certified_signed_at, suffix: `advisor-v${v.version}` });

interface ManuscriptPanelProps {
  detail: SubmissionDetail;
  /** The PEOs and their profiles in use (usePeoCatalog), which the packet's eligibility checks read. */
  catalog: readonly PeoRecord[];
  /** Whether they are read yet: a packet is generated only once they are, or every check would read can't tell. */
  catalogStatus: PeoCatalogStatus;
  onRetryCatalog: () => void;
  onChanged: () => void;
}

/**
 * Download or regenerate the advisor-reviewed Manuscript, one stored version per generation. Each
 * version names the certification and review state it was built from; `onChanged` reloads the
 * submission after a version is stored, or when the database refuses one because either has moved on.
 */
const ManuscriptPanel = ({ detail, catalog, catalogStatus, onRetryCatalog, onChanged }: ManuscriptPanelProps) => {
  const [revealSensitive, setRevealSensitive] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const latestEventId = detail.reviewEvents[0]?.id ?? 0;
  const latest = detail.versions[0];
  const pending = Object.values(detail.reviews).filter((r) => r?.has_correction && r.review_state !== "verified").length;
  const answersChanged = Object.values(detail.reviews).filter((r) => r?.answer_changed_at).length;
  // Only a version built from the current certification is offered to the prospect (and is current).
  const current = (v: ManuscriptVersion) => detail.certified && isCurrentVersion(v, detail.submission);

  const catalogReady = catalogStatus === "ready";
  const answersJson = certifiedAnswersSource(detail);

  const generate = async () => {
    setGenerating(true);
    try {
      const version = (latest?.version ?? 0) + 1;
      const packet = applyAdvisorReview(detail.data, detail.provenance, detail.reviews);
      const manuscript = buildManuscript(packet.data, {
        fileId: detail.fileId ?? "EAA-UNCERTIFIED",
        submission: detail.submission,
        catalog,
        catalogStatus,
        today: localToday(),
        provenance: packet.provenance,
        verified: verifiedFieldsOf(detail.reviews),
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
      // Named from the certification it was built from, which is what the stored version records too.
      downloadBlob(
        pdf.blob,
        versionFilename(detail.data.company_name, {
          file_id: detail.fileId ?? "EAA-UNCERTIFIED",
          version,
          certified_at: detail.submission?.certified_at ?? null,
          certified_signed_at: detail.submission?.signed_at ?? "",
        }),
      );
      toast.success(`Packet v${version} saved.`);
      onChanged();
    } catch (err) {
      console.error("Failed to generate manuscript:", err);
      if (isStaleRefusal(err)) {
        // Built from answers or a review that are no longer current: show the current ones.
        toast.error(`${(err as Error).message}. The page now shows the latest answers and review.`);
        onChanged();
      } else {
        toast.error((err as Error).message || "We couldn't generate the packet.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const open = async (v: ManuscriptVersion) => {
    setOpening(v.id);
    try {
      void recordActivity("packet_downloaded", "manuscript", v.id);
      window.location.assign(await manuscriptUrl(v, versionFilename(detail.data.company_name, v)));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setOpening(null);
    }
  };

  return (
    <section aria-labelledby="manuscript-heading" className="border border-border rounded-xl p-5 space-y-4">
      <h2 id="manuscript-heading" className="font-display text-lg font-bold">Advisor packet</h2>

      {!detail.certified ? (
        <p className="text-sm text-muted-foreground">
          {detail.submission?.signer_name
            ? "The prospect changed their answers after certifying. A packet can be generated once they certify again."
            : "Not certified yet. A packet can be generated once the prospect certifies their intake."}
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
            The latest version is the prospect's final packet: they can download it from their packet page and send it
            on. Correction reasons are printed in it.
          </p>
          {catalogStatus === "loading" && (
            <p className="text-xs text-muted-foreground" role="status">
              Loading the PEOs' profiles. You can generate the packet once they're in.
            </p>
          )}
          {catalogStatus === "failed" && (
            <div role="alert" className="text-xs rounded-md bg-warning/10 text-warning px-2 py-1.5 space-y-1">
              <p>We couldn't load the PEOs' profiles, so the packet's eligibility checks can't be run. Try again before generating.</p>
              <button onClick={onRetryCatalog} className="min-h-11 underline">Try again</button>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={revealSensitive} onChange={(e) => setRevealSensitive(e.target.checked)} />
            Include full dates of birth
          </label>
          <button
            onClick={generate}
            disabled={generating || !catalogReady}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {latest ? "Regenerate as new version" : "Generate packet"}
          </button>
          {/* The certified answers as JSON (L-3.3): the prospect's certification alone, never the review, the
              corrections, the notes or a PEO's own answers. */}
          {answersJson && (
            <div className="border-t border-border pt-3">
              <AnswersJsonDownload source={answersJson} builtFrom={certificationOf(detail.id, detail.intakeStatus, answersJson.submission)} />
            </div>
          )}
        </div>
      )}

      {detail.versions.length > 0 ? (
        <ul className="space-y-2" aria-label="Packet versions">
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
                {v === latest && current(v) && <p className="text-xs text-success">Shared with the prospect as their final packet</p>}
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
