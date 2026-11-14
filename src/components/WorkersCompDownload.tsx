import type { ComponentProps } from "react";
import { useDownloadsOff } from "@/components/workspace/downloadsOff";
import { useId, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { WorkersCompApplication } from "@/data/workersCompApplication";
import { unchangedSinceOpened, type BuiltFrom } from "@/lib/certificationCheck";
import { downloadBlob } from "@/lib/downloadFile";

/**
 * The workers' comp application data (L-3.2), offered beside the packet: which certified version it is from, that it
 * is our own summary and not the form, and every item it leaves blank, said before the download, not found afterwards.
 * The PDF library loads only when it is downloaded; when that fails (after a deploy its old file is gone) or the PDF
 * can't be built, it says so, as the packet's download does. A tab that outlived the certification gives no file
 * (`builtFrom`, checked at the click).
 */
const WorkersCompDownloadControl = ({ application: a, builtFrom, onDownloaded }: { application: WorkersCompApplication; builtFrom: BuiltFrom; onDownloaded?: () => void }) => {
  const id = useId();
  const [busy, setBusy] = useState(false);
  // The blanks section by section: "Applicant: Doing business as (DBA), FEIN, ...".
  const bySection = a.sections
    .map((s) => ({ title: s.title, blanks: s.entries.filter((e) => e.value === null).map((e) => (e.note ? `${e.label} (${e.note})` : e.label)) }))
    .filter((s) => s.blanks.length > 0);
  const download = async () => {
    setBusy(true);
    try {
      if (!(await unchangedSinceOpened(builtFrom))) return;
      const { buildWorkersCompPdf } = await import("@/lib/workersCompPdf");
      const pdf = buildWorkersCompPdf(a);
      downloadBlob(pdf.blob, pdf.filename);
      onDownloaded?.();
    } catch (err) {
      console.error("Failed to generate the workers' comp application PDF:", err);
      toast.error("We couldn't generate the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="group" aria-labelledby={`${id}-title`} className="space-y-1.5">
      <p id={`${id}-title`} className="text-sm font-medium">{a.title}</p>
      <p className="text-xs text-muted-foreground">
        {`${a.fromVersion}. Our own summary of the certified answers, in the standard application's order. It isn't the ACORD form. The same for every PEO.`}
      </p>
      {a.blanks.length > 0 && (
        <>
          <p className="text-xs text-warning">{`Left blank, not in the certified answers: ${a.blanks.length} items. ${a.intakeGaps}`}</p>
          <ul aria-label="Left blank" className="text-xs text-muted-foreground space-y-0.5">
            {bySection.map((s) => <li key={s.title}>{`${s.title}: ${s.blanks.join(", ")}`}</li>)}
          </ul>
        </>
      )}
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className="min-h-11 inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md border border-border hover:border-primary/40 disabled:opacity-60"
        aria-label={`Download ${a.title}`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
        {busy ? "Preparing the PDF…" : "Download"}
      </button>
    </div>
  );
};

/** Not offered during Nevermore support: a file built here from rows support may read would leave the product unrecorded (CRM-P2.4). */
const WorkersCompDownload = (props: ComponentProps<typeof WorkersCompDownloadControl>) => (useDownloadsOff() ? null : <WorkersCompDownloadControl {...props} />);

export default WorkersCompDownload;
