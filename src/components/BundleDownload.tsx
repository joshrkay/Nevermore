import type { ComponentProps } from "react";
import { useDownloadsOff } from "@/components/workspace/downloadsOff";
import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ReviewedDocument } from "@/data/advisor";
import { count } from "@/data/peoCompleteness";
import { bundleSummary, planBundle, type BundleSource } from "@/data/submissionBundle";
import type { BuiltBundle } from "@/lib/submissionBundle";
import { unchangedSinceOpened, type BuiltFrom } from "@/lib/certificationCheck";
import { downloadBlob } from "@/lib/downloadFile";

interface BundleDownloadProps {
  /** The last certified version and the PEO the bundle is for. */
  source: BundleSource;
  /** The certification the page was built from, checked again at the click. */
  builtFrom: BuiltFrom;
  /** "Download bundle", or "Download bundle anyway" when something is missing. */
  label: string;
  /** The one main action of the card: filled. */
  primary?: boolean;
  /** Fetches an uploaded document's file (the advisor's bundle); the prospect's bundle has none to fetch. */
  fetchDocument?: (doc: ReviewedDocument) => Promise<Blob>;
  /** Reads a PEO template workbook's file; the app's unless a test supplies one. */
  readTemplate?: (peoId: number, templateId: number) => Promise<Uint8Array | null>;
  /** After the zip was handed to the browser to save. */
  onSaved?: () => void;
}

const readFromStorage = async (peoId: number, templateId: number) => (await import("@/lib/templateWorkbooks")).readTemplateWorkbook(peoId, templateId);
const noDocuments = async (): Promise<Blob> => { throw new Error("No document is fetched for this bundle."); };

/**
 * A PEO's bundle (L-3.4): one file (a zip) of its packet, census file, workers' comp application data, supplement and, for an
 * advisor, the documents its profile lists that are on file, with a contents page. What it holds and what is missing
 * are said before the click. The builder loads on the click; it checks the certification again first, fetches the
 * documents with progress, and when a file couldn't go in, says which before anything is saved.
 */
const BundleDownloadControl = ({ source, builtFrom, label, primary = false, fetchDocument = noDocuments, readTemplate = readFromStorage, onSaved }: BundleDownloadProps) => {
  const plan = useMemo(() => planBundle(source), [source]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  // A bundle made without some files, held until the user says whether to save it.
  const [held, setHeld] = useState<BuiltBundle | null>(null);

  const save = (bundle: BuiltBundle) => {
    setHeld(null);
    downloadBlob(bundle.blob, bundle.filename);
    onSaved?.();
  };

  // A held bundle is saved only while the certification is still the one it was made from: the prospect may have
  // certified again while the advisor read what couldn't be included. unchangedSinceOpened shows the shared toast.
  const saveHeld = async (bundle: BuiltBundle) => {
    setBusy(true);
    try {
      if (await unchangedSinceOpened(builtFrom)) save(bundle);
      else setHeld(null);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    setHeld(null);
    try {
      if (!(await unchangedSinceOpened(builtFrom))) return;
      const { buildBundle } = await import("@/lib/submissionBundle");
      const bundle = await buildBundle(plan, {
        readTemplate,
        fetchDocument,
        onProgress: ({ done, total }) => setProgress(done < total ? `Adding documents: ${done + 1} of ${total}…` : "Putting the bundle together…"),
      });
      if (bundle.notIncluded.length) setHeld(bundle);
      else save(bundle);
    } catch (err) {
      console.error("Failed to make a PEO's bundle:", err);
      toast.error("We couldn't make the bundle. Please try again.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const n = held?.notIncluded.length ?? 0;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{plan.application.changedNotice ?? `${plan.application.fromVersion}: one file with a contents page.`}</p>
      <p className="text-xs text-muted-foreground">{bundleSummary(plan)}</p>
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className={`min-h-11 w-full sm:w-auto px-4 inline-flex items-center justify-center gap-2 text-sm font-medium rounded-md disabled:opacity-60 ${
          primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border hover:border-primary/40"
        }`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
        {label}
      </button>
      {busy && <p aria-live="polite" className="text-xs text-muted-foreground">{progress ?? "Preparing the bundle…"}</p>}
      {held && (
        <div role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm space-y-2">
          <p>{`${count(n, "file")} couldn't be included. The contents page lists ${n === 1 ? "it" : "them"}.`}</p>
          <ul className="text-xs space-y-1">
            {held.notIncluded.map((x) => <li key={x.what}>{`${x.what}: ${x.why}`}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void saveHeld(held)} disabled={busy} className="min-h-11 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              Save the bundle anyway
            </button>
            <button type="button" onClick={() => setHeld(null)} className="min-h-11 px-3 rounded-md border border-border text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

/** Not offered during Nevermore support: a file built here from rows support may read would leave the product unrecorded (CRM-P2.4). */
const BundleDownload = (props: ComponentProps<typeof BundleDownloadControl>) => (useDownloadsOff() ? null : <BundleDownloadControl {...props} />);

export default BundleDownload;
