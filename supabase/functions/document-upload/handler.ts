// The request handler for document-upload, with everything it touches passed in. index.ts wires in Deno,
// the real Supabase client and a TCP connection for the scanner; the tests wire in fakes. No remote imports,
// so it runs under Deno and Vitest alike.
//
// The only way a document reaches storage (E-4.1, E-4.3; migration 20261104130000_document_scanning.sql).
// The prospect's browser sends the file here as multipart form data (session_id, category, file), and:
//
//   1. its bytes are checked before anything is stored: not empty, at most 20 MB, not a program, and the
//      kind of file its name says (supabase/functions/_shared/fileSignature.ts). A file that fails is
//      refused, and nothing is stored or recorded;
//   2. its row is written as the prospect, so row security and the documents triggers decide, as they did
//      for the browser: their own open intake, their agreement, at most 25 documents, not the same file
//      twice (by the SHA-256 computed here, of the bytes received);
//   3. it is scanned for malware (supabase/functions/_shared/malwareScan.ts) and stored with the service
//      role: in the documents bucket once the scan passed, in the quarantine bucket otherwise, which nobody
//      but the service role can read. A detection is recorded (malware_detected) and alerted at once;
//   4. a scan that couldn't run now leaves the document pending in quarantine, and document-scan retries it.
//
// With no usable scanner (MALWARE_SCANNER unset or wrong, or `none` outside a named non-production APP_ENV;
// docs/adr/0002-uploads-need-a-scanner-in-production.md) nothing is checked, stored or recorded: the file is
// refused with `scanner_missing`, which the browser shows as uploads being paused, and the refusal is logged
// (SCAN_CONFIG_MISSING). document-scan records the scan_failed event (config_missing) that ops-monitor alerts on,
// once per five-minute run rather than once per upload. A file is never taken in with no way out of quarantine.
//
// Every file is stored as application/octet-stream (fileSignature.ts says why); the row records the type
// its bytes showed. Answers carry a code the browser maps to its message, and a request id. Logs carry ids,
// codes and failure kinds only, never file names, contents or the signed-in user's token.

import {
  cleanFileName,
  formatFileSize,
  MAX_UPLOAD_BYTES,
  sha256Hex,
  SNIFF_BYTES,
  sniffUpload,
  storageKeyName,
  STORED_CONTENT_TYPE,
} from "../_shared/fileSignature.ts";
import { isReleased, malwareAlert, postScanAlert, selectScanner, type ScannerDeps, type ScanResult } from "../_shared/malwareScan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-Request-Id",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** documents_category_check, as of 20261029090000_document_ingestion.sql (src/data/documentCategories.ts). */
export const DOCUMENT_CATEGORIES = [
  "employee_census", "benefits_summary", "payroll_report", "workers_comp_loss_runs", "peo_invoice", "prior_proposal", "other",
] as const;

/** Room for the multipart boundaries and the other fields around the file. */
export const FORM_OVERHEAD_BYTES = 64 * 1024;

/** What the browser reads back for a document (useSessionDocuments' COLUMNS). */
export const DOCUMENT_COLUMNS =
  "id, file_name, file_size, size_bytes, mime_type, file_sha256, category, status, created_at, storage_path, extraction, processing_started_at, scan_verdict";

type DbError = { message?: string; code?: string } | null;

/** The parts of the Supabase client this function uses, as the prospect and as the service role. */
export interface UploadClient {
  auth: { getUser: () => PromiseLike<{ data: { user: { id: string } | null } }> };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: DbError }>;
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => { select: (columns: string) => { single: () => PromiseLike<{ data: Record<string, unknown> | null; error: DbError }> } };
    delete: () => { eq: (column: string, value: string) => PromiseLike<{ error: DbError }> };
  };
  storage: {
    from: (bucket: string) => {
      upload: (path: string, body: Uint8Array, options: { contentType: string; upsert: boolean }) => PromiseLike<{ data: unknown; error: unknown }>;
      remove: (paths: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
    };
  };
}

export interface UploadDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options?: { global?: { headers: Record<string, string> } }) => UploadClient;
  /** What the malware scanner needs: fetch for an HTTPS service, connect for clamd. */
  scanner: ScannerDeps;
  /** For the alert webhook. */
  fetch: typeof fetch;
  log: (line: string) => void;
  newRequestId: () => string;
  /** The unique part of a stored file's key. */
  newId: () => string;
}

export type UploadErrorCode =
  | "bad_request" | "unauthorized" | "too_large" | "empty" | "mismatch" | "executable" | "unsupported"
  | "duplicate" | "limit" | "closed" | "consent" | "not_found" | "storage" | "unavailable" | "scanner_missing" | "internal";

/** What the prospect is told when uploads are refused for want of a scanner (the browser has its own words for it). */
export const SCANNER_MISSING_MESSAGE =
  "Uploads are paused while we finish setting up virus checking. Our team has been told; you can upload this file later.";

const errorCode = (error: unknown): string => {
  const e = error as { code?: unknown; statusCode?: unknown; status?: unknown } | null;
  const code = e?.code ?? e?.statusCode ?? e?.status;
  return typeof code === "string" || typeof code === "number" ? String(code) : "unknown";
};

/** The request body, or null once it is over `max` bytes (read no further than that). */
async function readCapped(req: Request, max: number): Promise<Uint8Array | null> {
  const declared = Number(req.headers.get("Content-Length") ?? NaN);
  if (Number.isFinite(declared) && declared > max) return null;
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    body.set(c, at);
    at += c.length;
  }
  return body;
}

// The database's refusals of a new document row, as the browser's codes.
const INSERT_REFUSALS: Record<string, { status: number; code: UploadErrorCode; message: string }> = {
  "23505": { status: 409, code: "duplicate", message: "This file is already uploaded to this intake." },
  "23514": { status: 409, code: "limit", message: "This intake holds as many documents as it can." },
  EA002: { status: 409, code: "closed", message: "This intake is closed and takes no more documents." },
  EA007: { status: 409, code: "closed", message: "This intake is being deleted and takes no more documents." },
  EA004: { status: 403, code: "consent", message: "Agree to how your information is used before you upload documents." },
  "42501": { status: 404, code: "not_found", message: "Intake not found." },
};

export async function handleUploadRequest(req: Request, deps: UploadDeps): Promise<Response> {
  const requestId = deps.newRequestId();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const reply = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify({ ...body, request_id: requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  const refuse = (status: number, code: UploadErrorCode, message: string) => reply({ error: message, code }, status);

  if (req.method !== "POST") return refuse(405, "bad_request", "Method not allowed");

  try {
    const supabaseUrl = deps.env("SUPABASE_URL");
    const anonKey = deps.env("SUPABASE_ANON_KEY");
    const serviceRoleKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      deps.log("UPLOAD_CONFIG_MISSING: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set");
      return refuse(503, "unavailable", "Uploads aren't available right now.");
    }

    // Who is uploading. Everything about the row is decided as them.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return refuse(401, "unauthorized", "Unauthorized");
    const user = deps.createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: who } } = await user.auth.getUser();
    if (!who) return refuse(401, "unauthorized", "Unauthorized");
    const userId = who.id;

    const refused = (status: number, code: UploadErrorCode, message: string) => {
      deps.log(`UPLOAD_REFUSED request=${requestId} user=${userId} reason=${code}`);
      return refuse(status, code, message);
    };

    // 0. A scanner to check the file with. Without one a file would sit in quarantine with nothing to release
    // it, so it is refused before anything is stored, with a log line naming the setting. No ops event per
    // refusal: this runs before the intake or the body is checked, so any signed-in guest could add rows at will,
    // and document-scan already records the alertable scan_failed (config_missing) on every five-minute run.
    const choice = selectScanner(deps.env, deps.scanner);
    if (!choice.ok) {
      deps.log(`SCAN_CONFIG_MISSING: ${choice.problem}; uploads are refused until it is fixed (docs/SUPABASE_SETUP.md, "Malware scanning")`);
      return refused(503, "scanner_missing", SCANNER_MISSING_MESSAGE);
    }

    // 1. The bytes, before anything is stored.
    const body = await readCapped(req, MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES);
    if (!body) return refused(413, "too_large", "Files can be up to 20 MB.");
    let form: FormData;
    try {
      form = await new Response(body as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": req.headers.get("Content-Type") ?? "" } }).formData();
    } catch {
      return refuse(400, "bad_request", "Send the file as multipart form data.");
    }
    const sessionId = form.get("session_id");
    const category = form.get("category") ?? "other";
    const file = form.get("file");
    if (typeof sessionId !== "string" || !UUID.test(sessionId)) return refuse(400, "bad_request", "session_id is required.");
    if (typeof category !== "string" || !(DOCUMENT_CATEGORIES as readonly string[]).includes(category)) {
      return refuse(400, "bad_request", "category is not one the intake takes.");
    }
    if (!file || typeof file === "string") return refuse(400, "bad_request", "file is required.");
    if (file.size === 0) return refused(422, "empty", "This file is empty.");
    if (file.size > MAX_UPLOAD_BYTES) return refused(413, "too_large", "Files can be up to 20 MB.");

    const fileName = cleanFileName((file as File).name ?? "");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniff = sniffUpload(bytes.subarray(0, SNIFF_BYTES), fileName);
    if (!sniff.ok) {
      return refused(415, sniff.reason, sniff.reason === "unsupported"
        ? "The intake takes PDF, Word, Excel and CSV files."
        : "This file doesn't contain what its name says (PDF, Word, Excel or CSV).");
    }

    // 2. The row, as the prospect.
    const storagePath = `${userId}/${sessionId}/${deps.newId()}_${storageKeyName(fileName)}`;
    const { data: row, error: insertError } = await user
      .from("documents")
      .insert({
        user_id: userId,
        session_id: sessionId,
        file_name: fileName,
        file_size: formatFileSize(bytes.length),
        size_bytes: bytes.length,
        mime_type: sniff.contentType,
        file_sha256: await sha256Hex(bytes),
        category,
        storage_path: storagePath,
        status: "uploaded",
      })
      .select(DOCUMENT_COLUMNS)
      .single();
    if (insertError || !row) {
      const known = INSERT_REFUSALS[insertError?.code ?? ""];
      if (known) return refused(known.status, known.code, known.message);
      deps.log(`UPLOAD_RECORD_FAILED request=${requestId} user=${userId} intake=${sessionId} code=${errorCode(insertError)}`);
      return refuse(500, "internal", "The file couldn't be saved. Try again.");
    }
    const documentId = String(row.id);
    const admin = deps.createClient(supabaseUrl, serviceRoleKey);

    // 3. The scan, then the file: in documents once it passed, otherwise in quarantine.
    const scan: ScanResult = await choice.scanner.scan(bytes);
    const bucket = isReleased(scan.verdict) ? "documents" : "quarantine";

    const { error: storeError } = await admin.storage.from(bucket).upload(storagePath, bytes, { contentType: STORED_CONTENT_TYPE, upsert: false });
    if (storeError) {
      // No row without its file: the prospect can try again.
      const { error: undoError } = await admin.from("documents").delete().eq("id", documentId);
      deps.log(`UPLOAD_STORE_FAILED request=${requestId} document=${documentId} intake=${sessionId} bucket=${bucket} code=${errorCode(storeError)}${undoError ? ` undo=${errorCode(undoError)}` : ""}`);
      return refuse(502, "storage", "The file couldn't be stored. Try again.");
    }

    // The file was stored with the service role, past the storage policies that used to hold an upload against
    // a deletion of its intake (SR-15). Asking now waits for a deletion that is checking the intake's files to
    // finish; if the intake is gone or being deleted, this file goes too, or it would be left behind.
    const { data: accepts, error: acceptsError } = await admin.rpc("intake_accepts_files", { p_session: sessionId });
    if (acceptsError) {
      deps.log(`UPLOAD_INTAKE_UNCHECKED request=${requestId} document=${documentId} intake=${sessionId} code=${errorCode(acceptsError)}`);
    } else if (accepts === false) {
      const { error: removeError } = await admin.storage.from(bucket).remove([storagePath]);
      await admin.from("documents").delete().eq("id", documentId);
      deps.log(`UPLOAD_INTAKE_CLOSED request=${requestId} document=${documentId} intake=${sessionId}${removeError ? ` remove=${errorCode(removeError)}` : ""}`);
      return refuse(409, "closed", "This intake is being deleted and takes no more documents.");
    }

    let verdict = "pending";
    if (scan.verdict === "unavailable") {
      // Held in quarantine; document-scan tries again.
      deps.log(`SCAN_DEFERRED request=${requestId} document=${documentId} engine=${scan.engine} reason=${scan.reason}`);
    } else {
      const { error: recordError } = await admin.rpc("record_document_scan", {
        p_document_id: documentId,
        p_verdict: scan.verdict,
        p_signature: scan.verdict === "infected" ? scan.signature : null,
        p_source: "document-upload",
      });
      // Not recorded: the row stays pending and its file unreadable, and document-scan scans it again.
      if (recordError) deps.log(`SCAN_NOT_RECORDED request=${requestId} document=${documentId} code=${errorCode(recordError)}`);
      else verdict = scan.verdict;
    }

    if (scan.verdict === "infected") {
      deps.log(`MALWARE_DETECTED source=document-upload document=${documentId} intake=${sessionId} engine=${scan.engine} signature=${scan.signature}`);
      await postScanAlert(deps, malwareAlert({ document: documentId, intake: sessionId, signature: scan.signature, engine: scan.engine, source: "document-upload" }));
    }

    return reply({ document: { ...row, scan_verdict: verdict } }, 200);
  } catch {
    deps.log(`UPLOAD_ERROR request=${requestId}`);
    return refuse(500, "internal", "The file couldn't be saved. Try again.");
  }
}
