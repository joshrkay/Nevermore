import { useId } from "react";
import { Download } from "lucide-react";
import type { WorkersCompApplication } from "@/data/workersCompApplication";
import { downloadBlob } from "@/lib/downloadFile";

/**
 * The workers' comp application data (L-3.2), offered beside the packet: which certified version it is from, that it
 * is our own summary and not the form, and every item it leaves blank, said before the download, not found afterwards.
 * The PDF library loads only when it is downloaded.
 */
const WorkersCompDownload = ({ application: a }: { application: WorkersCompApplication }) => {
  const id = useId();
  // The blanks section by section: "Applicant: Doing business as (DBA), FEIN, ...".
  const bySection = a.sections
    .map((s) => ({ title: s.title, blanks: s.entries.filter((e) => e.value === null).map((e) => (e.note ? `${e.label} (${e.note})` : e.label)) }))
    .filter((s) => s.blanks.length > 0);
  const download = async () => {
    const { buildWorkersCompPdf } = await import("@/lib/workersCompPdf");
    const pdf = buildWorkersCompPdf(a);
    downloadBlob(pdf.blob, pdf.filename);
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
        className="min-h-11 inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md border border-border hover:border-primary/40"
        aria-label={`Download ${a.title}`}
      >
        <Download className="w-4 h-4" aria-hidden="true" /> Download
      </button>
    </div>
  );
};

export default WorkersCompDownload;
