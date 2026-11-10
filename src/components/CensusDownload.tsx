import { useState } from "react";
import { Download } from "lucide-react";
import type { CensusEmployee } from "@/data/census";
import { censusExport, layoutFor, OUR_CENSUS_LAYOUT, PEO_CENSUS_LAYOUTS, type PeoCensusLayout } from "@/data/censusExport";
import { downloadBlob } from "@/lib/downloadFile";

interface CensusDownloadProps {
  /** The certified census: never the draft. */
  census: readonly CensusEmployee[];
  fileId: string;
  /** The PEOs offered as layouts, alphabetically. */
  peos: readonly string[];
  /** The PEO census layouts held; the app's unless a test supplies some. */
  layouts?: readonly PeoCensusLayout[];
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Downloads the certified census as a CSV, in a PEO's own census layout when we hold it, or in ours, so whoever
 * sends the packet can send a file the PEO's underwriters don't have to re-key (joshrkay/Nevermore#86).
 */
const CensusDownload = ({ census, fileId, peos, layouts = PEO_CENSUS_LAYOUTS }: CensusDownloadProps) => {
  const [peo, setPeo] = useState("");
  const layout = peo ? layoutFor(peo, layouts) : OUR_CENSUS_LAYOUT;
  const { blankColumns } = censusExport([], layout);
  const ours = layout === OUR_CENSUS_LAYOUT;

  const download = () => {
    const { csv } = censusExport(census, layout);
    const name = `${fileId}-census${ours ? "" : `-${slug(peo)}`}.csv`;
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), name);
  };

  return (
    <div className="space-y-2">
      <label htmlFor="census-layout" className="block text-xs text-muted-foreground">Layout</label>
      <select id="census-layout" value={peo} onChange={(e) => setPeo(e.target.value)} className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm">
        <option value="">Our layout (every column named)</option>
        {peos.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      {peo && ours && (
        <p className="text-xs text-muted-foreground">We don't have {peo}'s census layout yet, so this is ours: every column is named.</p>
      )}
      {blankColumns.length > 0 && (
        <p className="text-xs text-warning">
          {peo}'s layout also asks for: {blankColumns.join(", ")}. Fill these in before sending.
        </p>
      )}
      <button
        onClick={download}
        className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md border border-border hover:border-primary/40"
      >
        <Download className="w-4 h-4" aria-hidden="true" /> Download the census
      </button>
    </div>
  );
};

export default CensusDownload;
