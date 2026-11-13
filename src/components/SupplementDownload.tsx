import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Supplement } from "@/data/peoSupplement";
import { unchangedSinceOpened, type BuiltFrom } from "@/lib/certificationCheck";
import { downloadBlob } from "@/lib/downloadFile";
import { buildSupplementPdf } from "@/lib/supplementPdf";

/**
 * A PEO's supplement, "Additional questions from <PEO>", offered beside the packet: which certified version it is from
 * and which questions it leaves unanswered are said before the download, not found afterwards. A PDF that can't be
 * built is said, as the packet's download does. Busy while the certification is checked again (a tab can outlive it:
 * `builtFrom`) and the PDF is made.
 */
const SupplementDownload = ({ supplement, builtFrom, onDownloaded }: { supplement: Supplement; builtFrom: BuiltFrom; onDownloaded?: () => void }) => {
  const [busy, setBusy] = useState(false);
  const { rows, notAnswered } = supplement;
  const download = async () => {
    setBusy(true);
    try {
      if (!(await unchangedSinceOpened(builtFrom))) return;
      const pdf = buildSupplementPdf(supplement);
      downloadBlob(pdf.blob, pdf.filename);
      onDownloaded?.();
    } catch (err) {
      console.error("Failed to generate a PEO's supplement PDF:", err);
      toast.error("We couldn't generate the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  if (supplement.cantTell) {
    // A file of blanks would read as "not answered"; the certification simply didn't keep these answers.
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{supplement.title}</p>
        <p className="text-xs text-muted-foreground">
          {`${supplement.version !== null ? `Version ${supplement.version}` : "The certification on record"} was certified before we kept the answers to ${supplement.peo}'s own questions, so we can't tell them from it. Certifying again adds them.`}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{supplement.title}</p>
      <p className="text-xs text-muted-foreground">
        {`${supplement.version !== null ? `From certified version ${supplement.version}` : "From the certification on record"}, for ${supplement.peo} only. `}
        {notAnswered.length === 0 ? `All ${rows.length} answered.` : `${rows.length - notAnswered.length} of ${rows.length} answered.`}
      </p>
      {notAnswered.length > 0 && (
        <p className="text-xs text-warning">{`Listed as not answered: ${notAnswered.join("; ")}`}</p>
      )}
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className="min-h-11 inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md border border-border hover:border-primary/40 disabled:opacity-60"
        aria-label={`Download ${supplement.title}`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
        {busy ? "Preparing the PDF…" : "Download"}
      </button>
    </div>
  );
};

export default SupplementDownload;
