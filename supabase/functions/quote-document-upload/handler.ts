// The request handler for quote-document-upload, with everything it touches passed in. index.ts wires in Deno, the real Supabase client and a connection for the scanner; the
// tests wire in fakes. No remote imports, so it runs under Deno and Vitest alike.
//
// The way a quote document recorded by hand reaches storage (N-2.2, D-731; migration 20261124150000_quote_document.sql). It is an upload like any other (docs/adr/0002), and
// it is kept the way a file that arrived by mail is kept, so it reuses receive-mail's rules and store: an agent's browser sends multipart form data (quote_id, file), and
//
//   1. the bytes are checked: not empty, at most 20 MB, a file type uploads take, in fact as in name (fileSignature.ts);
//   2. the upload is started as the agent (start_quote_document_upload, which refuses anyone who is not an advisor of the quote's firm, a closing firm and a support
//      session): a message recorded by hand on the quote request's thread, with one attachment waiting for its scan;
//   3. the bytes are scanned (malwareScan.ts), and a clean file is stored in the peo-mail bucket under the intake and the message, as a mail attachment is, and settled
//      stored (finish_inbound_attachment, the service role); one the scanner flags is settled blocked with its signature and its bytes dropped, and alerted;
//   4. a stored file is named as the quote's document, as the agent (attach_quote_document).
//
// Logs carry ids and codes only, never file names or contents.

import { readBodyCapped } from "../_shared/body.ts";
import { cleanFileName, MAX_UPLOAD_BYTES, sha256Hex, SNIFF_BYTES, sniffUpload, storageKeyName, STORED_CONTENT_TYPE } from "../_shared/fileSignature.ts";
import { malwareAlert, postScanAlert, selectScanner, type ScannerDeps } from "../_shared/malwareScan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-Request-Id",
};

const FORM_OVERHEAD_BYTES = 64 * 1024;
const QUOTE_ID = /^[1-9][0-9]{0,14}$/;

type DbError = { message?: string; code?: string } | null;

/** The parts of the Supabase client this function uses, as the agent and as the service role. */
export interface QuoteDocumentClient {
  auth: { getUser: () => PromiseLike<{ data: { user: { id: string } | null } }> };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: DbError }>;
  storage: {
    from: (bucket: string) => {
      upload: (path: string, body: Uint8Array, options: { contentType: string; upsert: boolean }) => PromiseLike<{ data: unknown; error: unknown }>;
    };
  };
}

export interface QuoteDocumentDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options?: { global?: { headers: Record<string, string> } }) => QuoteDocumentClient;
  scanner: ScannerDeps;
  /** For the alert webhook. */
  fetch: typeof fetch;
  log: (line: string) => void;
  newRequestId: () => string;
}

export async function handleQuoteDocumentUpload(req: Request, deps: QuoteDocumentDeps): Promise<Response> {
  const requestId = deps.newRequestId();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reply = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify({ ...body, request_id: requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });

  const refuse = (status: number, code: string, message: string) => reply({ error: message, code }, status);
  if (req.method !== "POST") return refuse(405, "bad_request", "Method not allowed");

  const supabaseUrl = deps.env("SUPABASE_URL");
  const anonKey = deps.env("SUPABASE_ANON_KEY");
  const serviceRoleKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    deps.log("QUOTE_DOCUMENT_CONFIG_MISSING: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set");
    return refuse(503, "unavailable", "Uploads aren't available right now.");
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return refuse(401, "unauthorized", "Unauthorized");
  const agent = deps.createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await agent.auth.getUser();
  if (!user) return refuse(401, "unauthorized", "Unauthorized");

  // A scanner, before anything else (ADR 0002): never a file kept, or an upload started, that nothing can scan.
  const choice = selectScanner(deps.env, deps.scanner);
  if (!choice.ok) {
    deps.log(`SCAN_CONFIG_MISSING: ${choice.problem}; uploads are refused until it is fixed (docs/SUPABASE_SETUP.md, "Malware scanning")`);
    return refuse(503, "scanner_missing", "Uploads are paused while virus checking is set up. Try again once it is.");
  }

  const body = await readBodyCapped(req, MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES);
  if (!body) return refuse(413, "too_large", "A quote document can be up to 20 MB.");
  let form: FormData;
  try {
    form = await new Response(body as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": req.headers.get("Content-Type") ?? "" } }).formData();
  } catch {
    return refuse(400, "bad_request", "Send the file as multipart form data.");
  }
  const quoteId = form.get("quote_id");
  const upload = form.get("file");
  if (typeof quoteId !== "string" || !QUOTE_ID.test(quoteId)) return refuse(400, "bad_request", "quote_id is required.");
  if (!upload || typeof upload === "string") return refuse(400, "bad_request", "file is required.");
  if (upload.size === 0) return refuse(422, "empty", "This file is empty.");
  if (upload.size > MAX_UPLOAD_BYTES) return refuse(413, "too_large", "A quote document can be up to 20 MB.");
  const fileName = cleanFileName((upload as File).name ?? "");
  const bytes = new Uint8Array(await upload.arrayBuffer());
  const sniffed = sniffUpload(bytes.subarray(0, SNIFF_BYTES), fileName);
  if (!sniffed.ok) {
    const code = sniffed.reason === "executable" ? "executable" : sniffed.reason === "mismatch" ? "mismatch" : "unsupported";
    return reply({ error: code === "unsupported" ? "That file type can't be kept as a quote document." : "This file isn't what its name says.", code }, 415);
  }

  const { data: started, error: startError } = await agent.rpc("start_quote_document_upload", {
    p_quote_id: Number(quoteId), p_file_name: fileName, p_content_type: upload.type, p_size_bytes: bytes.length,
  });
  if (startError || !started) {
    // The database decides who may: not an advisor of the quote's firm (another firm's quote is "not found"), a closing firm, a support session.
    const refusal = ({ PT404: [404, "not_found"], "42501": [403, "forbidden"], PT423: [423, "read_only"] } as Record<string, [number, string]>)[startError?.code ?? ""];
    if (refusal) return reply({ error: startError?.message ?? "Refused", code: refusal[1] }, refusal[0]);
    deps.log(`QUOTE_DOCUMENT_START_FAILED request=${requestId} quote=${quoteId} code=${startError?.code ?? "unknown"}`);
    return reply({ error: "The quote document couldn't be saved. Try again.", code: "internal" }, 500);
  }
  const { attachment_id: attachmentId, folder } = started as { attachment_id: number; folder: string };

  const service = deps.createClient(supabaseUrl, serviceRoleKey);
  const scan = await choice.scanner.scan(bytes);
  if (scan.verdict === "unavailable") {
    // Not checked, so not kept: the attachment stays pending (the thread shows it as still being checked) and the agent uploads the file again.
    deps.log(`QUOTE_DOCUMENT_SCAN_UNAVAILABLE attachment=${attachmentId} engine=${scan.engine} reason=${scan.reason.replace(/[^A-Za-z0-9_:. -]/g, "").slice(0, 60)}`);
    return reply({ error: "The file couldn't be checked for viruses just now. Upload it again in a minute.", code: "scan_unavailable" }, 502);
  }
  if (scan.verdict === "infected") {
    // Blocked, its bytes dropped (never stored), alerted at once; nothing is named as the quote's document.
    await service.rpc("finish_inbound_attachment", { p_attachment_id: attachmentId, p_verdict: "infected", p_signature: scan.signature });
    deps.log(`MALWARE_DETECTED source=quote-document-upload attachment=${attachmentId} engine=${scan.engine} signature=${scan.signature}`);
    await postScanAlert(deps, malwareAlert({ document: `mail-attachment-${attachmentId}`, intake: folder.split("/")[0], signature: scan.signature, engine: scan.engine, source: "quote-document-upload" }));
    return reply({ document: { attachment_id: attachmentId, file_name: fileName, status: "blocked" } }, 200);
  }
  const path = `${folder}/${attachmentId}-${storageKeyName(fileName)}`;
  await service.storage.from("peo-mail").upload(path, bytes, { contentType: STORED_CONTENT_TYPE, upsert: true });
  await service.rpc("finish_inbound_attachment", { p_attachment_id: attachmentId, p_verdict: scan.verdict, p_bucket: "peo-mail", p_path: path, p_sha256: await sha256Hex(bytes) });
  await agent.rpc("attach_quote_document", { p_quote_id: Number(quoteId), p_attachment_id: attachmentId });
  return reply({ document: { attachment_id: attachmentId, file_name: fileName, status: "stored" } }, 200);
}
