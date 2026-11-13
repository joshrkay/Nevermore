import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { CensusEmployee } from "@/data/census";
import { blankColumnsOf, censusLayoutFor, OUR_CENSUS_LAYOUT, type PeoCensusLayout } from "@/data/censusExport";
import { findPeo, type PeoRecord } from "@/data/peoCatalog";
import { unchangedSinceOpened, type BuiltFrom } from "@/lib/certificationCheck";
import { censusFile, templateWorkbookFits } from "@/lib/censusWorkbook";
import { downloadBlob } from "@/lib/downloadFile";

interface CensusDownloadProps {
  /** The certified census: never the draft. */
  census: readonly CensusEmployee[];
  fileId: string;
  /** The certified version the census is from; null when none is recorded. */
  version: number | null;
  /** The PEO the file is for, as named (on the list or typed in); null for our own layout. */
  peo: string | null;
  /** The PEOs the database lists, with their profiles in use. */
  catalog: readonly PeoRecord[];
  /** The certification the page was built from, checked again at the click (a tab can outlive it). */
  builtFrom: BuiltFrom;
  /** Reads a PEO template workbook's file (only a clean one can be read); the app's unless a test supplies one. */
  readTemplate?: (peoId: number, templateId: number) => Promise<Uint8Array | null>;
  /** Called once the file has been handed to the browser (not when the click was refused or the file couldn't be made). */
  onDownloaded?: () => void;
}

/** What the file is, in a sentence, before the click. */
function whatItIs(layout: PeoCensusLayout, version: number | null): string {
  const what = layout === OUR_CENSUS_LAYOUT
    ? "Our layout, every column named, as a CSV file"
    : layout.template
      ? `${layout.peo}'s own template workbook, filled in`
      : `${layout.peo}'s census layout, as ${layout.format === "xlsx" ? "an Excel file" : "a CSV file"}`;
  return `${what}. ${version !== null ? `From certified version ${version}.` : "From the certification on record."}`;
}

/** Reads a clean template workbook's file from storage, loading the client only when one is filled. */
const readFromStorage = async (peoId: number, templateId: number) => (await import("@/lib/templateWorkbooks")).readTemplateWorkbook(peoId, templateId);

/**
 * Downloads the certified census as a file for one PEO (L-3.1): in the census layout its requirement profile in use
 * holds, as CSV or xlsx or written into the PEO template workbook, or in our own layout for a PEO with none. What the
 * file is, which certified version it comes from, the columns it leaves blank, and why a template workbook can't take
 * this census (its headers don't match, or an employee would go over what it holds) are said before the click.
 */
const CensusDownload = ({ census, fileId, version, peo, catalog, builtFrom, readTemplate = readFromStorage, onDownloaded }: CensusDownloadProps) => {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // A template workbook is read and checked as soon as the download is shown, so a refusal comes before the click.
  const [template, setTemplate] = useState<Uint8Array | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const layout = censusLayoutFor(peo, catalog);
  const ours = layout === OUR_CENSUS_LAYOUT;
  const blank = blankColumnsOf(layout);
  const peoId = layout.template ? findPeo(catalog, layout.peo ?? "")?.id : undefined;
  const templateId = layout.template?.id;

  const unreadable = `We couldn't get ${layout.peo}'s template workbook, so the census couldn't be filled in. Try again.`;

  useEffect(() => {
    if (templateId === undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        const bytes = peoId === undefined ? null : await readTemplate(peoId, templateId);
        if (cancelled || !bytes) return;
        const fits = await templateWorkbookFits(bytes, census, layout);
        if (cancelled) return;
        setTemplate(bytes);
        setRefusal(fits.ok === false ? fits.message : null);
      } catch {
        // Said on the click, which tries again.
      }
    })();
    return () => { cancelled = true; };
    // The layout is the profile's, held as long as the PEO and template are the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peoId, templateId, census, readTemplate]);

  const download = async () => {
    setBusy(true);
    setProblem(null);
    try {
      if (!(await unchangedSinceOpened(builtFrom))) return;
      let bytes: Uint8Array | null = template;
      if (layout.template && !bytes) {
        bytes = peoId === undefined ? null : await readTemplate(peoId, layout.template.id);
        if (!bytes) {
          setProblem(unreadable);
          return;
        }
      }
      const file = await censusFile(census, layout, { fileId, version, template: bytes });
      if (file.ok === false) setProblem(file.message);
      else {
        downloadBlob(file.blob, file.filename);
        onDownloaded?.();
      }
    } catch {
      setProblem("The census file couldn't be made. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{whatItIs(layout, version)}</p>
      {peo && ours && (
        <p className="text-xs text-muted-foreground">We don't have {peo}'s census layout yet, so this is ours: every column is named.</p>
      )}
      {blank.length > 0 && (
        <p className="text-xs text-warning">
          {layout.peo}'s layout also asks for: {blank.join(", ")}. Fill these in before sending.
        </p>
      )}
      {refusal && <p role="alert" className="text-xs text-destructive">{refusal}</p>}
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy || refusal !== null}
        aria-label={ours ? "Download the census" : `Download the census in ${layout.peo}'s layout`}
        className="min-h-11 inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md border border-border hover:border-primary/40 disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
        {busy ? "Preparing the census…" : "Download the census"}
      </button>
      {problem && <p role="alert" className="text-xs text-destructive">{problem}</p>}
    </div>
  );
};

export default CensusDownload;
