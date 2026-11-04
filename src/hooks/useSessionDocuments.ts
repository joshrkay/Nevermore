import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { guessCategory, type DocumentCategory } from "@/data/documentCategories";
import { parseExtraction, type CandidateField, type DocumentExtraction } from "@/data/documentCandidates";
import { inspectUpload, MAX_DOCUMENTS_PER_INTAKE } from "@/lib/uploadCheck";
import { describeInvokeError, failureKindFromCode, type AiFailureKind } from "@/data/aiFailure";
import { errorDetail, reportOpsEvent, unrecordedFunctionFailure } from "@/lib/monitoring";

export interface SessionDocument {
  id: string;
  file_name: string;
  file_size: string;
  size_bytes: number | null;
  mime_type: string | null;
  /** SHA-256 of the file; null for files uploaded before fingerprints were recorded. */
  file_sha256: string | null;
  category: string;
  status: string;
  created_at: string;
  storage_path: string | null; // null while the upload is in flight
  extraction: DocumentExtraction;
  /**
   * Why the last read in this tab didn't go through (a rate limit, the daily cap, a timeout...), from the
   * function's answer. Not stored: a reload shows the row's own status.
   */
  readIssue?: AiFailureKind | null;
}

/** Why a file wasn't uploaded, before or as it was stored. */
export type UploadRejection = "empty" | "mismatch" | "duplicate" | "limit";

export interface UploadOutcome {
  saved: number;
  /** Files that couldn't be stored (a network or storage error); they can be tried again. */
  failed: string[];
  /** Files that were refused, with why. */
  rejected: { name: string; reason: UploadRejection }[];
}

export interface UseSessionDocumentsReturn {
  docs: SessionDocument[];
  isLoading: boolean;
  uploading: boolean;
  /**
   * Checks the files (contents match the name, not already in this intake, within the per-intake
   * limit), stores the rest with this intake, then has Lenore read each one.
   */
  upload: (files: File[]) => Promise<UploadOutcome>;
  /**
   * Deletes the stored file, then the record. Resolves false if either is still there; trying again
   * finishes the job.
   */
  remove: (doc: SessionDocument) => Promise<boolean>;
  setCategory: (doc: SessionDocument, category: DocumentCategory) => Promise<boolean>;
  /**
   * Records that these fields were settled from this document: applied to the intake, or, with
   * `kept`, left as the prospect's own answer.
   */
  markApplied: (doc: SessionDocument, fields: CandidateField[], opts?: { kept?: boolean }) => Promise<void>;
  /** Reads the document again, e.g. after a failure. */
  extract: (doc: SessionDocument) => Promise<void>;
}

const COLUMNS = "id, file_name, file_size, size_bytes, mime_type, file_sha256, category, status, created_at, storage_path, extraction, processing_started_at";
const BUCKET = "documents";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Row = Omit<SessionDocument, "extraction" | "file_sha256"> & {
  extraction: unknown;
  file_sha256?: string | null;
  processing_started_at?: string | null;
};
const fromRow = ({ processing_started_at: _startedAt, ...row }: Row): SessionDocument => ({
  ...row,
  file_sha256: row.file_sha256 ?? null,
  extraction: parseExtraction(row.extraction),
});

/**
 * Deletes a stored file. True once it is gone, including when it was already gone; false while it is
 * still there or that can't be told.
 */
async function removeStoredFile(path: string): Promise<boolean> {
  const { data, error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error("Failed to delete a stored document:", error.message);
    return false;
  }
  if (data.length > 0) return true;
  // Storage answers success with an empty list whenever it deleted nothing: when the file is already
  // gone, and also when its policies refused. Only the first counts as removed.
  try {
    const { data: stillThere } = await supabase.storage.from(BUCKET).exists(path);
    if (stillThere) console.error("A stored document was not deleted");
    return !stillThere;
  } catch (e) {
    // exists() throws for anything but "not found" (a network or server error).
    console.error("Couldn't check whether a stored document was deleted:", e instanceof Error ? e.message : e);
    return false;
  }
}

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

/**
 * The uploaded documents of one intake. Lists, uploads, and removals are scoped to `sessionId`. With
 * `ensureSession`, an upload before the intake exists creates it first (an upload is a way to start, A-1).
 */
export function useSessionDocuments(sessionId: string | null, ensureSession?: () => Promise<string | null>): UseSessionDocumentsReturn {
  const { user } = useAuth();
  const userId = user?.id;
  const [docs, setDocs] = useState<SessionDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  // Responses for an intake that's no longer open must not land in this one's list.
  const sessionRef = useRef(sessionId);
  useEffect(() => { sessionRef.current = sessionId; }, [sessionId]);
  const ensureSessionRef = useRef(ensureSession);
  ensureSessionRef.current = ensureSession;
  // The intake whose list has loaded, and uploads waiting for a new intake's list (its load replaces the list).
  const listedRef = useRef<string | null>(null);
  const listWaitersRef = useRef<{ sid: string; resolve: () => void }[]>([]);
  const listLoaded = useCallback((sid: string) => new Promise<void>((resolve) => {
    if (listedRef.current === sid) return resolve();
    const waiter = { sid, resolve };
    listWaitersRef.current.push(waiter);
    // Never hold an upload for long on a list that doesn't answer.
    setTimeout(() => {
      listWaitersRef.current = listWaitersRef.current.filter((w) => w !== waiter);
      resolve();
    }, 10_000);
  }), []);
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
      listedRef.current = sessionId;
      const ready = listWaitersRef.current.filter((w) => w.sid === sessionId);
      listWaitersRef.current = listWaitersRef.current.filter((w) => w.sid !== sessionId);
      for (const w of ready) w.resolve();
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
      const { data: answer, error } = await supabase.functions.invoke("document-extract", { body: { document_id: doc.id } });
      let readIssue: AiFailureKind | null = null;
      if (error) {
        const info = await describeInvokeError(error);
        readIssue = info.kind;
        console.warn("Document not read:", info.kind, info.requestId ?? "");
        // document-extract records every read it answers (ai_extraction_events); this covers it never answering.
        const unrecorded = unrecordedFunctionFailure("document_read", error, info.requestId);
        if (unrecorded) reportOpsEvent("upload_failed", { code: unrecorded, detail: errorDetail(error), sessionId: sid });
      } else if (answer && typeof answer.code === "string") {
        // The function answered, and the read failed (the model timed out, say): the row says failed, this says why.
        readIssue = failureKindFromCode(answer.code);
      }
      // The function records its outcome on the row (or leaves it untouched if it never ran),
      // so the row is the source of truth either way.
      const { data } = await supabase.from("documents").select(COLUMNS).eq("id", doc.id).maybeSingle();
      if (sessionRef.current !== sid) return;
      if (data) patchDoc(doc.id, { ...fromRow(data as Row), readIssue });
      else patchDoc(doc.id, { status: "failed", readIssue });
    } finally {
      activeRef.current.delete(doc.id);
    }
  }, [patchDoc]);

  const upload = useCallback(async (files: File[]): Promise<UploadOutcome> => {
    let sid = sessionRef.current;
    if (!sid && userId && files.length > 0 && ensureSessionRef.current) {
      setUploading(true);
      sid = await ensureSessionRef.current();
      // The new intake's (empty) list loads once it renders: wait, so that load can't replace these files.
      if (sid) await listLoaded(sid);
    }
    if (!userId || !sid || files.length === 0) {
      setUploading(false);
      return { saved: 0, failed: files.map((f) => f.name), rejected: [] };
    }
    setUploading(true);

    // Check every file before storing any, so a refusal is explained before anything moves.
    const rejected: UploadOutcome["rejected"] = [];
    const accepted: { file: File; contentType: string; sha256: string | null }[] = [];
    const known = new Set(docsRef.current.map((d) => d.file_sha256).filter(Boolean));
    let room = MAX_DOCUMENTS_PER_INTAKE - docsRef.current.length;
    for (const file of files) {
      const checked = await inspectUpload(file);
      if ("reason" in checked) {
        rejected.push({ name: file.name, reason: checked.reason });
      } else if (checked.sha256 && known.has(checked.sha256)) {
        rejected.push({ name: file.name, reason: "duplicate" });
      } else if (room <= 0) {
        rejected.push({ name: file.name, reason: "limit" });
      } else {
        if (checked.sha256) known.add(checked.sha256);
        room--;
        accepted.push({ file, contentType: checked.contentType, sha256: checked.sha256 });
      }
    }

    const pending: SessionDocument[] = accepted.map(({ file: f, contentType, sha256 }) => ({
      id: `pending-${crypto.randomUUID()}`,
      file_name: f.name,
      file_size: formatFileSize(f.size),
      size_bytes: f.size,
      mime_type: contentType,
      file_sha256: sha256,
      category: guessCategory(f.name),
      status: "uploading",
      created_at: new Date().toISOString(),
      storage_path: null,
      extraction: parseExtraction(null),
    }));
    if (sessionRef.current === sid) setDocs((prev) => [...prev, ...pending]);

    const saved: SessionDocument[] = [];
    const failed: string[] = [];
    for (const [i, { file, contentType, sha256 }] of accepted.entries()) {
      const pendingId = pending[i].id;
      const dropPending = () => setDocs((prev) => prev.filter((d) => d.id !== pendingId));
      // Unique prefix avoids collisions; strip characters storage keys don't allow.
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const storagePath = `${userId}/${sid}/${crypto.randomUUID()}_${safeName}`;

      // Stored as the type its contents showed, not the one the browser guessed.
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType });
      if (storageError) {
        console.error("Failed to upload a document:", storageError.message);
        // The status only: storage's message can quote the path, which carries the file name.
        const status = (storageError as { statusCode?: string | number }).statusCode;
        reportOpsEvent("upload_failed", { code: `storage_upload:${status ?? "unknown"}`, sessionId: sid });
        failed.push(file.name);
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
          mime_type: contentType,
          file_sha256: sha256,
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
        // The database refuses a second copy of a file (23505) and a 26th document (23514).
        const code = (dbError as { code?: string } | null)?.code;
        if (code === "23505") rejected.push({ name: file.name, reason: "duplicate" });
        else if (code === "23514") rejected.push({ name: file.name, reason: "limit" });
        else {
          failed.push(file.name);
          // A closed intake (EA002) refusing a file is the intake's state, not a failure.
          if (code !== "EA002") reportOpsEvent("upload_failed", { code: `record_insert:${code ?? "unknown"}`, sessionId: sid });
        }
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
    return { saved: saved.length, failed, rejected };
  }, [userId, extract, listLoaded]);

  const remove = useCallback(async (doc: SessionDocument) => {
    if (!userId || !sessionRef.current || !doc.storage_path) return false;
    // The file goes first, then the record. If the record can't be deleted, it stays listed and the
    // next try finds its file already gone and finishes. The other order could leave a stored file
    // with no record, which nobody can see or delete: putting the record back can fail too (an
    // expired intake refuses new rows).
    if (!(await removeStoredFile(doc.storage_path))) {
      reportOpsEvent("upload_failed", { code: "storage_remove", sessionId: sessionRef.current });
      return false;
    }
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) {
      console.error("Failed to delete a document record:", error.message);
      reportOpsEvent("upload_failed", { code: `record_delete:${(error as { code?: string }).code ?? "unknown"}`, sessionId: sessionRef.current });
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

  const markApplied = useCallback(async (doc: SessionDocument, fields: CandidateField[], opts: { kept?: boolean } = {}) => {
    const at = new Date().toISOString();
    const marks = Object.fromEntries(fields.map((f) => [f, at]));
    // Build on the latest copy so two quick applies don't drop each other's marker.
    const current = docsRef.current.find((d) => d.id === doc.id)?.extraction ?? doc.extraction;
    const extraction: DocumentExtraction = opts.kept
      ? { ...current, kept: { ...current.kept, ...marks } }
      : { ...current, applied: { ...current.applied, ...marks } };
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
