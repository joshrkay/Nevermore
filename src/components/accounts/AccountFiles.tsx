import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DownloadsOffNotice, useDownloadsOff } from "@/components/workspace/downloadsOff";
import { failureWords } from "@/components/workspace/form";
import { categoryInfo } from "@/data/documentCategories";
import { formatBytes, formatDay } from "@/data/accountPage";
import { documentUrl, recordActivity } from "@/lib/advisorApi";
import type { AccountFile } from "@/lib/accountPageApi";
import { Rows, type Column } from "./accountLists";

/**
 * The files an account's intakes hold that passed the virus check (D-199), each downloaded through the app's one place that signs a link (`documentUrl`,
 * src/lib/advisorApi.ts): Storage makes the link only for someone its own file rule lets read the file, and says so by refusing. No download is offered during
 * a Nevermore support session (ADR 0024): the names stay, the button goes, and one line says why.
 */
export function AccountFiles({ files }: { files: AccountFile[] }) {
  const [opening, setOpening] = useState<string | null>(null);
  const downloadsOff = useDownloadsOff();

  const open = async (file: AccountFile) => {
    setOpening(file.id);
    try {
      window.location.assign(await documentUrl({ storage_path: file.storagePath, file_name: file.fileName }));
      // Recorded once a link was signed and handed to the browser (the link itself is never kept here).
      void recordActivity("document_downloaded", "document", file.id);
    } catch (err) {
      toast.error(failureWords(err, "We couldn't open that file. Check your connection and try again."));
    } finally {
      setOpening(null);
    }
  };

  const columns: Column<AccountFile>[] = [
    { header: "File", cell: (f) => <span className="break-all font-medium">{f.fileName}</span> },
    { header: "Kind", cell: (f) => categoryInfo(f.category).label },
    { header: "Size", cell: (f) => formatBytes(f.sizeBytes), className: "whitespace-nowrap" },
    { header: "Added", cell: (f) => formatDay(f.createdAt), className: "whitespace-nowrap" },
  ];
  if (!downloadsOff) {
    columns.push({
      header: "Download",
      cell: (f) => (
        <button
          type="button"
          onClick={() => void open(f)}
          disabled={opening === f.id}
          aria-label={`Download ${f.fileName}`}
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/90 disabled:opacity-50"
        >
          {opening === f.id && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />} Download
        </button>
      ),
    });
  }

  return (
    <div className="space-y-3">
      <Rows caption="The account's files" rows={files} rowKey={(f) => f.id} columns={columns} />
      <DownloadsOffNotice />
    </div>
  );
}
