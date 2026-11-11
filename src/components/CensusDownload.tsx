import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { CensusEmployee } from "@/data/census";
import { blankColumnsOf, censusLayoutFor, OUR_CENSUS_LAYOUT, type PeoCensusLayout } from "@/data/censusExport";
import { findPeo, type PeoRecord } from "@/data/peoCatalog";
import { censusFile } from "@/lib/censusWorkbook";
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
  /** Reads a PEO's own template file (only a clean one can be read); the app's unless a test supplies one. */
  readTemplate?: (peoId: number, templateId: number) => Promise<Uint8Array | null>;
}

/** What the file is, in a sentence, before the click. */
function whatItIs(layout: PeoCensusLayout, version: number | null): string {
  const what = layout === OUR_CENSUS_LAYOUT
    ? "Our layout, every column named, as a CSV file"
    : layout.template
      ? `${layout.peo}'s own template, filled in`
      : `${layout.peo}'s census layout, as ${layout.format === "xlsx" ? "an Excel file" : "a CSV file"}`;
  return `${what}. ${version !== null ? `From certified version ${version}.` : "From the certification on record."}`;
}

/**
 * Downloads the certified census as a file for one PEO (L-3.1): in the census layout its requirement profile in use
 * holds, as CSV or xlsx or written into the PEO's own template, or in our own layout for a PEO with none. What the
 * file is, which certified version it comes from and the columns it leaves blank are said before the click.
 */
/** Reads a clean template's file from storage, loading the client only when a template is filled. */
const readFromStorage = async (peoId: number, templateId: number) => (await import("@/lib/censusTemplates")).readCensusTemplate(peoId, templateId);

const CensusDownload = ({ census, fileId, version, peo, catalog, readTemplate = readFromStorage }: CensusDownloadProps) => {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const layout = censusLayoutFor(peo, catalog);
  const ours = layout === OUR_CENSUS_LAYOUT;
  const blank = blankColumnsOf(layout);

  const download = async () => {
    setBusy(true);
    setProblem(null);
    try {
      let template: Uint8Array | null = null;
      if (layout.template) {
        const id = findPeo(catalog, layout.peo ?? "")?.id;
        template = id === undefined ? null : await readTemplate(id, layout.template.id);
        if (!template) {
          setProblem(`We couldn't get ${layout.peo}'s template file, so the census couldn't be filled in. Try again.`);
          return;
        }
      }
      const file = await censusFile(census, layout, { fileId, version, template });
      if (file.ok === false) setProblem(file.message);
      else downloadBlob(file.blob, file.filename);
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
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
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
