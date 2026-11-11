import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CertifiedAnswersSource } from "@/data/certifiedAnswersExport";
import { INTAKE_SCHEMA_VERSION } from "@/data/intakeSchema";
import { downloadBlob } from "@/lib/downloadFile";

/**
 * The certified answers as JSON (L-3.3), offered beside the packet to the prospect and to advisors: what the file is
 * and which certified version it is from are said before the click. The builder loads only when it is downloaded; when
 * that fails (after a deploy its old file is gone) or the file can't be made, it says so, as the packet's download
 * does. Offered only while the certification stands: the caller never renders it otherwise.
 */
const AnswersJsonDownload = ({ source }: { source: CertifiedAnswersSource }) => {
  const [busy, setBusy] = useState(false);
  const version = source.submission.version;
  const download = async () => {
    setBusy(true);
    try {
      const { certifiedAnswersExport, certifiedAnswersFilename } = await import("@/data/certifiedAnswersExport");
      const doc = certifiedAnswersExport(source);
      downloadBlob(new Blob([`${JSON.stringify(doc, null, 2)}\n`], { type: "application/json" }), certifiedAnswersFilename(doc));
    } catch (err) {
      console.error("Failed to generate the answers as JSON:", err);
      toast.error("We couldn't generate the JSON file. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {`The certified answers, census included, as one JSON file for a PEO's or an advisor's own system: intake schema version ${INTAKE_SCHEMA_VERSION}, each answer with its status as certified, and the certification. ${version != null ? `From certified version ${version}.` : "From the certification on record."} It holds no PEO's own questions.`}
      </p>
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        aria-label="Download the answers as JSON"
        className="min-h-11 inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md border border-border hover:border-primary/40 disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
        {busy ? "Preparing the file…" : "Download the answers as JSON"}
      </button>
    </div>
  );
};

export default AnswersJsonDownload;
