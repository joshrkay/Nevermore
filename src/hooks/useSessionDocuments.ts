import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { guessCategory, type DocumentCategory } from "@/data/documentCategories";
import { parseExtraction, type CandidateField, type DocumentExtraction } from "@/data/documentCandidates";

export interface SessionDocument {
  id: string;
  file_name: string;
  file_size: string;
  size_bytes: number | null;
  mime_type: string | null;
  category: string;
  status: string;
  created_at: string;
  storage_path: string | null; // null while the upload is in flight
  extraction: DocumentExtraction;
}

export interface UseSessionDocumentsReturn {
  docs: SessionDocument[];
  isLoading: boolean;
  uploading: boolean;
  /** Stores the files with this intake, then has Lenore read each one. */
  upload: (files: File[]) => Promise<{ saved: number; failed: string[] }>;
  /** Deletes the record and the stored file. Resolves false if either couldn't be removed. */
  remove: (doc: SessionDocument) => Promise<boolean>;
  setCategory: (doc: SessionDocument, category: DocumentCategory) => Promise<boolean>;
  /** Records that these fields were applied to the intake from this document. */
  markApplied: (doc: SessionDocument, fields: CandidateField[]) => Promise<void>;
  /** Reads the document again, e.g. after a failure. */
  extract: (doc: SessionDocument) => Promise<void>;
}

const COLUMNS = "id, file_name, file_size, size_bytes, mime_type, category, status, created_at, storage_path, extraction, processing_started_at";
const BUCKET = "documents";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Row = Omit<SessionDocument, "extraction"> & { extraction: unknown; processing_started_at?: string | null };
const fromRow = ({ processing_started_at: _startedAt, ...row }: Row): SessionDocument => ({
  ...row,
  extraction: parseExtraction(row.extraction),
});

// A read that has been going longer than this has stopped (the function's own limit is shorter).
const STALE_PROCESSING_MS = 5 * 60 * 1000;
// How often to look again at a read that another tab or an earlier visit started.
const PROCESSING_POLL_MS = 4000;

// A file still marked "processing" may be mid-read elsewhere (another tab, or before the page was
// left and reopened), so it stays "processing" until it has gone stale; then it is offered a retry.
const fromLoadedRow = (row: Row): SessionDocument => {
  const doc = fromRow(row);
  if (doc.status !== "processing") return doc;
  const started = row.processing_started_at ? Date.parse(row.processing_started_at) : NaN;
  return Number.isFinite(started) && Date.now() - started < STALE_PROCESSING_MS ? doc : { ...doc, status: "failed" };
};

/** The uploaded documents of one intake. Lists, uploads, and removals are scoped to `sessionId`. */
export function useSessionDocuments(sessionId: string | null): UseSessionDocumentsReturn {
  const { user } = useAuth();
  const userId = user?.id;
  const [docs, setDocs] = useState<SessionDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  // Responses for an intake that's no longer open must not land in this one's list.
  const sessionRef = useRef(sessionId);
  useEffect(() => { sessionRef.current = sessionId; }, [sessionId]);
  // Documents this tab is reading itself; their status comes from extract(), not from re-fetching.
  const activeRef = useRef(new Set<string>());
  const docsRef = useRef(docs);
  useEffect(() => { docsRef.current = docs; }, [docs]);

  const patchDoc = useCallback((id: string, patch: Partial<SessionDocument>) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  useEffect(() => {
    setDocs([]);
    if (!userId || !sessionId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(COLUMNS)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) console.error("Failed to load documents:", error.message);
      setDocs(((data ?? []) as Row[]).map(fromLoadedRow));
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, sessionId]);

  // Reads another tab (or an earlier visit) started: look again until they finish or go stale.
  const hasForeignRead = docs.some((d) => d.status === "processing" && !activeRef.current.has(d.id));
  useEffect(() => {
    if (!userId || !sessionId || !hasForeignRead) return;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("documents")
        .select(COLUMNS)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (!data || sessionRef.current !== sessionId) return;
      const fresh = new Map((data as Row[]).map((r) => [r.id, fromLoadedRow(r)]));
      setDocs((prev) => prev.map((d) => (fresh.has(d.id) && !activeRef.current.has(d.id) ? fresh.get(d.id)! : d)));
    }, PROCESSING_POLL_MS);
    return () => clearTimeout(timer);
  }, [userId, sessionId, hasForeignRead, docs]);

  const extract = useCallback(async (doc: SessionDocument) => {
    const sid = sessionRef.current;
    activeRef.current.add(doc.id);
    patchDoc(doc.id, { status: "processing" });
    try {
      const { error } = await supabase.functions.invoke("document-extract", { body: { document_id: doc.id } });
      if (error) console.error("Document extraction failed:", error.message);
      // The function records its outcome on the row (or leaves it untouched if it never ran),
      // so the row is the source of truth either way.
      const { data } = await supabase.from("documents").select(COLUMNS).eq("id", doc.id).maybeSingle();
      if (sessionRef.current !== sid) return;
      if (data) patchDoc(doc.id, fromRow(data as Row));
      else patchDoc(doc.id, { status: "failed" });
    } finally {
      activeRef.current.delete(doc.id);
    }
  }, [patchDoc]);

  const upload = useCallback(async (files: File[]) => {
    const sid = sessionRef.current;
    if (!userId || !sid || files.length === 0) return { saved: 0, failed: files.map((f) => f.name) };
    setUploading(true);

    const pending: SessionDocument[] = files.map((f) => ({
      id: `pending-${crypto.randomUUID()}`,
      file_name: f.name,
      file_size: formatFileSize(f.size),
      size_bytes: f.size,
      mime_type: f.type || null,
      category: guessCategory(f.name),
      status: "uploading",
      created_at: new Date().toISOString(),
      storage_path: null,
      extraction: parseExtraction(null),
    }));
    setDocs((prev) => [...prev, ...pending]);

    const saved: SessionDocument[] = [];
    const failed: string[] = [];
    for (const [i, file] of files.entries()) {
      const pendingId = pending[i].id;
      const dropPending = () => {
        failed.push(file.name);
        setDocs((prev) => prev.filter((d) => d.id !== pendingId));
      };
      // Unique prefix avoids collisions; strip characters storage keys don't allow.
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const storagePath = `${userId}/${sid}/${crypto.randomUUID()}_${safeName}`;

      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: file.type || undefined });
      if (storageError) {
        console.error("Failed to upload a document:", storageError.message);
        dropPending();
        continue;
      }

      const { data, error: dbError } = await supabase
        .from("documents")
        .insert({
          user_id: userId,
          session_id: sid,
          file_name: file.name,
          file_size: formatFileSize(file.size),
          size_bytes: file.size,
          mime_type: file.type || null,
          category: pending[i].category,
          storage_path: storagePath,
          status: "uploaded",
        })
        .select(COLUMNS)
        .single();
      if (dbError || !data) {
        console.error("Failed to save a document record:", dbError?.message);
        // Don't leave an untracked file behind.
        await supabase.storage.from(BUCKET).remove([storagePath]);
        dropPending();
        continue;
      }
      const doc = fromRow(data as Row);
      saved.push(doc);
      if (sessionRef.current === sid) setDocs((prev) => prev.map((d) => (d.id === pendingId ? doc : d)));
    }
    setUploading(false);

    // Read them one at a time, after every upload is safely stored.
    void (async () => {
      for (const doc of saved) {
        if (sessionRef.current !== sid) return;
        await extract(doc);
      }
    })();
    return { saved: saved.length, failed };
  }, [userId, extract]);

  const remove = useCallback(async (doc: SessionDocument) => {
    const sid = sessionRef.current;
    if (!userId || !sid || !doc.storage_path) return false;
    // Delete the row first, then the file. If the file can't be removed, put the
    // row back so the document stays listed and the delete can be retried —
    // never leave a row pointing at a missing file.
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) return false;
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    if (storageError) {
      const { error: restoreError } = await supabase.from("documents").insert({
        id: doc.id,
        user_id: userId,
        session_id: sid,
        file_name: doc.file_name,
        file_size: doc.file_size,
        size_bytes: doc.size_bytes,
        mime_type: doc.mime_type,
        category: doc.category,
        storage_path: doc.storage_path,
        status: doc.status,
        extraction: doc.extraction as unknown as Json,
        created_at: doc.created_at,
      });
      if (restoreError) console.error("Failed to restore document row:", restoreError);
      return false;
    }
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    return true;
  }, [userId]);

  const setCategory = useCallback(async (doc: SessionDocument, category: DocumentCategory) => {
    patchDoc(doc.id, { category });
    const { error } = await supabase.from("documents").update({ category }).eq("id", doc.id);
    if (!error) return true;
    console.error("Failed to change category:", error);
    patchDoc(doc.id, { category: doc.category });
    return false;
  }, [patchDoc]);

  const markApplied = useCallback(async (doc: SessionDocument, fields: CandidateField[]) => {
    const at = new Date().toISOString();
    // Build on the latest copy so two quick applies don't drop each other's marker.
    const current = docsRef.current.find((d) => d.id === doc.id)?.extraction ?? doc.extraction;
    const extraction: DocumentExtraction = {
      ...current,
      applied: { ...current.applied, ...Object.fromEntries(fields.map((f) => [f, at])) },
    };
    docsRef.current = docsRef.current.map((d) => (d.id === doc.id ? { ...d, extraction } : d));
    patchDoc(doc.id, { extraction });
    const { error } = await supabase
      .from("documents")
      .update({ extraction: extraction as unknown as Json })
      .eq("id", doc.id);
    // The intake already has the values; only the "applied" marker is lost.
    if (error) console.error("Failed to record applied fields:", error);
  }, [patchDoc]);

  return { docs, isLoading, uploading, upload, remove, setCategory, markApplied, extract };
}
