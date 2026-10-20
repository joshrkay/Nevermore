import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, CheckCircle, AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UploadedDoc {
  id: string;
  file_name: string;
  file_size: string;
  doc_type: string;
  status: string;
  metadata: string | null;
  storage_path: string | null; // null while the upload is in flight
}

interface UploadTabProps {
  onFilesUploaded: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function guessDocType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes("census") || lower.includes("employee")) return "Employee Census";
  if (lower.includes("invoice") || lower.includes("benefit")) return "Benefits Invoice";
  if (lower.includes("loss") || lower.includes("wc") || lower.includes("comp")) return "W/C Loss Runs";
  if (lower.includes("plan") || lower.includes("design")) return "Plan Design";
  if (lower.includes("payroll")) return "Payroll Report";
  if (lower.includes("handbook")) return "Employee Handbook";
  return "Other";
}

const UploadTab = ({ onFilesUploaded }: UploadTabProps) => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoadingExisting(false);
      return;
    }
    const loadDocs = async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, file_name, file_size, doc_type, status, metadata, storage_path")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setDocs(data);
      }
      setLoadingExisting(false);
    };
    loadDocs();
  }, [user]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!user) {
        toast.error("You must be logged in to upload files.");
        return;
      }

      setUploading(true);

      const pendingDocs: UploadedDoc[] = acceptedFiles.map((f) => ({
        id: `pending-${crypto.randomUUID()}`,
        file_name: f.name,
        file_size: formatFileSize(f.size),
        doc_type: guessDocType(f.name),
        status: "uploading",
        metadata: null,
        storage_path: null,
      }));
      const pendingIds = new Set(pendingDocs.map((d) => d.id));
      setDocs((prev) => [...prev, ...pendingDocs]);

      const uploaded: UploadedDoc[] = [];

      for (const file of acceptedFiles) {
        // Unique prefix avoids collisions; strip characters storage keys don't allow.
        const safeName = file.name.replace(/[^\w.-]+/g, "_");
        const storagePath = `${user.id}/${crypto.randomUUID()}_${safeName}`;

        const { error: storageError } = await supabase.storage
          .from("documents")
          .upload(storagePath, file);

        if (storageError) {
          toast.error(`Failed to upload ${file.name}: ${storageError.message}`);
          continue;
        }

        const docType = guessDocType(file.name);

        const { data, error: dbError } = await supabase
          .from("documents")
          .insert({
            user_id: user.id,
            file_name: file.name,
            file_size: formatFileSize(file.size),
            doc_type: docType,
            storage_path: storagePath,
            status: "uploaded",
          })
          .select()
          .single();

        if (dbError) {
          toast.error(`Failed to save ${file.name}: ${dbError.message}`);
          // Don't leave an untracked file behind.
          await supabase.storage.from("documents").remove([storagePath]);
          continue;
        }

        uploaded.push({
          id: data.id,
          file_name: data.file_name,
          file_size: data.file_size,
          doc_type: data.doc_type,
          status: data.status,
          metadata: data.metadata,
          storage_path: data.storage_path,
        });
      }

      setDocs((prev) => [
        ...prev.filter((d) => !pendingIds.has(d.id)),
        ...uploaded,
      ]);

      setUploading(false);

      if (uploaded.length > 0) {
        toast.success(`${uploaded.length} file(s) uploaded successfully.`);
        onFilesUploaded();
      }
    },
    [user, onFilesUploaded]
  );

  const handleDelete = async (doc: UploadedDoc) => {
    if (!user) return;
    // Delete the row first, then the file. If the file can't be removed, put the
    // row back so the document stays listed and the delete can be retried —
    // never leave a row pointing at a missing file.
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) {
      toast.error("Failed to delete document.");
      return;
    }
    if (doc.storage_path) {
      const { error: storageError } = await supabase.storage.from("documents").remove([doc.storage_path]);
      if (storageError) {
        const { error: restoreError } = await supabase.from("documents").insert({
          id: doc.id,
          user_id: user.id,
          file_name: doc.file_name,
          file_size: doc.file_size,
          doc_type: doc.doc_type,
          storage_path: doc.storage_path,
          status: doc.status,
          metadata: doc.metadata,
        });
        if (restoreError) console.error("Failed to restore document row:", restoreError);
        toast.error("Failed to delete document.");
        return;
      }
    }
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast.success("Document removed.");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxSize: 20 * 1024 * 1024,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">Drop your documents here.</h2>
        <p className="text-muted-foreground text-sm">Lenore reads everything.</p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-foreground font-medium mb-1">
          {isDragActive ? "Release to upload..." : "Drag & drop files here"}
        </p>
        <p className="text-sm text-muted-foreground">
          PDF, Excel, CSV, or Word · Max 20 MB
        </p>
      </div>

      {/* Document chips */}
      <div className="flex flex-wrap gap-2">
        {["Census", "W/C Dec Page", "Loss Runs", "Medical Invoice", "Payroll Report"].map(label => (
          <span key={label} className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground border border-border">
            {label}
          </span>
        ))}
      </div>

      {docs.length > 0 && (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 bg-muted rounded-lg p-3"
            >
              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.file_size} · {doc.doc_type}
                </p>
              </div>
              {doc.status === "uploading" && (
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
              )}
              {doc.status === "uploaded" && (
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
              )}
              {doc.status === "needs-confirmation" && (
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              )}
              {doc.status !== "uploading" && (
                <button
                  onClick={() => handleDelete(doc)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadTab;
