import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, FileText, CheckCircle, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ChamberData } from "@/data/chamberTypes";
import { DOCUMENT_CATEGORIES, isDocumentCategory, missingRecommended } from "@/data/documentCategories";
import type { DocumentCandidate } from "@/data/documentCandidates";
import { canRetryExtraction, documentStatusInfo } from "@/data/documentStatus";
import type { SessionDocument, UploadRejection, UseSessionDocumentsReturn } from "@/hooks/useSessionDocuments";
import { MAX_DOCUMENTS_PER_INTAKE, MAX_UPLOAD_BYTES } from "@/lib/uploadCheck";
import DocumentCandidates from "./DocumentCandidates";

const REJECTION_MESSAGES: Record<UploadRejection, (name: string) => string> = {
  empty: (name) => `${name} is empty.`,
  mismatch: (name) => `${name} doesn't contain what its name says (PDF, Word, Excel, or CSV). Check it's the right file.`,
  duplicate: (name) => `${name} is already uploaded to this intake.`,
  limit: (name) => `${name} wasn't uploaded: an intake holds up to ${MAX_DOCUMENTS_PER_INTAKE} files.`,
};

interface UploadTabProps {
  documents: UseSessionDocumentsReturn;
  /** Uploads attach to this intake; nothing can be uploaded until it exists. */
  sessionId: string | null;
  data: ChamberData;
  onApplyCandidates?: (doc: SessionDocument, candidates: DocumentCandidate[], opts: { replace: boolean }) => void;
}

const uploadedAt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const UploadTab = ({ documents, sessionId, data, onApplyCandidates }: UploadTabProps) => {
  const { docs, upload, remove, setCategory, extract, uploading } = documents;
  const uploaded = docs.filter((d) => d.status !== "uploading");
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
    disabled: !sessionId || uploading,
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
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          !sessionId || uploading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        } ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-foreground font-medium mb-1">
          {isDragActive ? "Release to upload..." : uploading ? "Uploading…" : "Drag & drop files here"}
        </p>
        <p className="text-sm text-muted-foreground">
          PDF, Excel, CSV, or Word · Max 20 MB · Up to {MAX_DOCUMENTS_PER_INTAKE} files
        </p>
      </div>

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
            const status = documentStatusInfo(doc.status);
            const busy = doc.status === "uploading" || doc.status === "processing";
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
                  <p className={`text-xs mt-1.5 ml-8 ${status.tone === "warn" ? "text-warning" : "text-muted-foreground"}`}>
                    <span className="font-medium">{status.label}.</span> {doc.extraction.message ?? status.message}
                    {canRetryExtraction(doc.status) && (
                      <button onClick={() => void extract(doc)} className="ml-1.5 text-primary hover:underline">
                        {doc.status === "uploaded" ? "Read it" : "Try again"}
                      </button>
                    )}
                  </p>
                )}
                {doc.status === "extracted" && (
                  <div className="ml-8">
                    <DocumentCandidates
                      fileName={doc.file_name}
                      extraction={doc.extraction}
                      data={data}
                      onApply={onApplyCandidates && ((c, opts) => onApplyCandidates(doc, c, opts))}
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
