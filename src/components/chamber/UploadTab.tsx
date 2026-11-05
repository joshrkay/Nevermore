import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, FileText, CheckCircle, AlertTriangle, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CENSUS_TEMPLATE_COLUMNS, CENSUS_TEMPLATE_FILE_NAME, CENSUS_TEMPLATE_GUIDE, censusTemplateCsv } from "@/data/census";
import type { ChamberData } from "@/data/chamberTypes";
import { DOCUMENT_CATEGORIES, isDocumentCategory, missingRecommended } from "@/data/documentCategories";
import type { CandidateResolution } from "@/data/documentCandidates";
import type { ProvenanceMap } from "@/data/provenance";
import { canRetryExtraction, documentStatusInfo, scanStatusInfo } from "@/data/documentStatus";
import { DOCUMENT_FAILURE_MESSAGES, retryCanClear } from "@/data/aiFailure";
import type { SessionDocument, UploadRejection, UseSessionDocumentsReturn } from "@/hooks/useSessionDocuments";
import { downloadBlob } from "@/lib/downloadFile";
import { MAX_DOCUMENTS_PER_INTAKE, MAX_UPLOAD_BYTES } from "@/lib/uploadCheck";
import DocumentCandidates from "./DocumentCandidates";

// The census template (US-2.3d): built from the columns document-extract reads, so it can't drift from them.
const downloadCensusTemplate = () =>
  downloadBlob(new Blob([censusTemplateCsv()], { type: "text/csv;charset=utf-8" }), CENSUS_TEMPLATE_FILE_NAME);

const REJECTION_MESSAGES: Record<UploadRejection, (name: string) => string> = {
  empty: (name) => `${name} is empty.`,
  mismatch: (name) => `${name} doesn't contain what its name says (PDF, Word, Excel, or CSV). Check it's the right file.`,
  too_large: (name) => `${name} is over 20 MB.`,
  duplicate: (name) => `${name} is already uploaded to this intake.`,
  limit: (name) => `${name} wasn't uploaded: an intake holds up to ${MAX_DOCUMENTS_PER_INTAKE} files.`,
};

interface UploadTabProps {
  documents: UseSessionDocumentsReturn;
  /** Uploads attach to this intake; nothing can be uploaded until it exists. */
  sessionId: string | null;
  /** True when an upload may start the intake (the prospect hasn't yet, and the workspace can create one). */
  canStart?: boolean;
  data: ChamberData;
  provenance?: ProvenanceMap;
  /** The prospect's decision on what Lenore found in a document; omit for read-only. */
  onResolveCandidates?: (doc: SessionDocument, resolution: CandidateResolution) => void;
}

const uploadedAt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const UploadTab = ({ documents, sessionId, canStart = false, data, provenance, onResolveCandidates }: UploadTabProps) => {
  // Before the prospect has started an intake, an upload starts one.
  const canUpload = Boolean(sessionId) || canStart;
  const { docs, upload, remove, setCategory, extract, uploading } = documents;
  // A file the virus check blocked, or couldn't finish, doesn't count as provided.
  const uploaded = docs.filter((d) => d.status !== "uploading" && d.scan_verdict !== "infected" && d.scan_verdict !== "failed");
  const present = new Set(uploaded.map((d) => d.category));
  const missing = missingRecommended(uploaded);

  const onDrop = useCallback(
    async (accepted: File[], rejected: FileRejection[]) => {
      for (const r of rejected) {
        const tooBig = r.errors.some((e) => e.code === "file-too-large");
        toast.error(tooBig ? `${r.file.name} is over 20 MB.` : `${r.file.name} isn't a PDF, Excel, CSV, or Word file.`);
      }
      if (accepted.length === 0) return;
      const { saved, failed, rejected: refused } = await upload(accepted);
      for (const { name, reason } of refused) toast.error(REJECTION_MESSAGES[reason](name));
      for (const name of failed) toast.error(`Failed to upload ${name}.`);
      if (saved > 0) toast.success(`${saved} file${saved === 1 ? "" : "s"} uploaded.`);
    },
    [upload],
  );

  const handleDelete = async (doc: SessionDocument) => {
    if (await remove(doc)) toast.success("Document removed.");
    else toast.error("Failed to delete document.");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: !canUpload || uploading,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxSize: MAX_UPLOAD_BYTES,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">Drop your documents here.</h2>
        <p className="text-muted-foreground text-sm">
          Lenore reads what she can and shows you what she found before anything is added. None of these are
          required — share what you have.
        </p>
      </div>

      <div
        {...getRootProps({
          // The keyboard stops here and Enter opens the file picker, so it is announced as a button with its text,
          // not as nothing (react-dropzone's default role is "presentation").
          role: "button",
          "aria-labelledby": "upload-drop-label",
          "aria-describedby": "upload-drop-hint",
          "aria-disabled": !canUpload || uploading || undefined,
        })}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          !canUpload || uploading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        } ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
        <p id="upload-drop-label" className="text-foreground font-medium mb-1">
          {isDragActive ? "Release to upload..." : uploading ? "Uploading…" : "Drag & drop files here"}
        </p>
        <p id="upload-drop-hint" className="text-sm text-muted-foreground">
          PDF, Excel, CSV, or Word · Max 20 MB · Up to {MAX_DOCUMENTS_PER_INTAKE} files
        </p>
      </div>

      {/* Downloadable before an intake exists: getting the template starts nothing. */}
      <section aria-labelledby="census-template-heading" className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="census-template-heading" className="text-sm font-medium">
              Employee census template
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              The surest way to share your team: fill in one row per employee and drop the file above, and Lenore
              reads every column. Leave out Social Security and bank numbers — the template has no place for them.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={downloadCensusTemplate}>
            <Download className="w-4 h-4" aria-hidden="true" />
            Download census template (CSV)
          </Button>
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">What goes in each column</summary>
          <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
            {CENSUS_TEMPLATE_COLUMNS.map((column) => (
              <div key={column} className="contents">
                <dt className="font-mono text-foreground">{column}</dt>
                <dd className="text-muted-foreground mb-1 sm:mb-0">{CENSUS_TEMPLATE_GUIDE[column]}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      {/* What's useful to share: a checklist, never a gate */}
      <section aria-labelledby="helpful-heading" className="space-y-2">
        <div>
          <h3 id="helpful-heading" className="text-sm font-medium">
            {missing.length > 0 ? "Still helpful to provide" : "That covers the documents we'd most like to see"}
          </h3>
          <p className="text-xs text-muted-foreground">
            All optional — skip anything that doesn't apply to you. You can continue without uploading.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {DOCUMENT_CATEGORIES.filter((c) => c.key !== "other").map((c) => (
            <div key={c.key} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium flex items-center gap-1.5">
                {present.has(c.key) && <CheckCircle className="w-3.5 h-3.5 text-success" aria-label="Uploaded" />}
                {c.label}
                {c.recommended && !present.has(c.key) && (
                  <span className="text-[10px] font-normal text-muted-foreground">· helpful</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.guidance}</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5 italic">e.g. {c.example}</p>
            </div>
          ))}
        </div>
      </section>

      {docs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Categories are suggested from file names — change any that are off.
          </p>
          {docs.map((doc) => {
            // Until its virus check passes, that is all there is to say about a file (not while it uploads).
            const scan = doc.status === "uploading" ? null : scanStatusInfo(doc.scan_verdict);
            const status = scan ?? documentStatusInfo(doc.status);
            // Why the last read in this tab didn't go through, while the file is still unread.
            const readIssue = !scan && doc.readIssue && canRetryExtraction(doc.status) ? doc.readIssue : null;
            // No "Read it" or "Try again" while reading again can't help (the daily cap, a Lenore that isn't set
            // up, a file not yet cleared by the virus check); after a reload it is offered again.
            const canRead = !scan && canRetryExtraction(doc.status) && (!readIssue || retryCanClear(readIssue));
            const busy = doc.status === "uploading" || doc.status === "processing" || status.tone === "busy";
            return (
              <div key={doc.id} className="bg-muted rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.file_size}
                      {doc.status !== "uploading" && ` · ${uploadedAt(doc.created_at)}`}
                    </p>
                  </div>
                  <Select
                    value={doc.category}
                    disabled={doc.status === "uploading"}
                    onValueChange={(v) => {
                      if (isDocumentCategory(v)) void setCategory(doc, v);
                    }}
                  >
                    <SelectTrigger className="w-40 h-8 text-xs" aria-label={`Category for ${doc.file_name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <SelectItem key={c.key} value={c.key} className="text-xs">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {busy && (
                    <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                  )}
                  {!busy && status.tone === "ok" && <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />}
                  {!busy && status.tone === "warn" && <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />}
                  {doc.status !== "uploading" && (
                    <button
                      onClick={() => handleDelete(doc)}
                      aria-label={`Remove ${doc.file_name}`}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {status.message && (
                  <p className={`text-xs mt-1.5 ml-8 ${status.tone === "warn" || readIssue ? "text-warning" : "text-muted-foreground"}`}>
                    <span className="font-medium">{status.label}.</span>{" "}
                    {scan ? scan.message : readIssue ? DOCUMENT_FAILURE_MESSAGES[readIssue] : doc.extraction.message ?? status.message}
                    {canRead && (
                      <button onClick={() => void extract(doc)} className="ml-1.5 text-primary hover:underline">
                        {doc.status === "uploaded" ? "Read it" : "Try again"}
                      </button>
                    )}
                  </p>
                )}
                {!scan && doc.status === "extracted" && (
                  <div className="ml-8">
                    <DocumentCandidates
                      fileName={doc.file_name}
                      extraction={doc.extraction}
                      data={data}
                      provenance={provenance}
                      onResolve={onResolveCandidates && ((r) => onResolveCandidates(doc, r))}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UploadTab;
