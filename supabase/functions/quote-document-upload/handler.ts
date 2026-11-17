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
import { selectScanner, type ScannerDeps } from "../_shared/malwareScan.ts";

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

  const supabaseUrl = deps.env("SUPABASE_URL") as string;
  const anonKey = deps.env("SUPABASE_ANON_KEY") as string;
  const serviceRoleKey = deps.env("SUPABASE_SERVICE_ROLE_KEY") as string;
  const authHeader = req.headers.get("Authorization") as string;
  const agent = deps.createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  const body = (await readBodyCapped(req, MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES)) as Uint8Array;
  const form = await new Response(body as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": req.headers.get("Content-Type") ?? "" } }).formData();
  const quoteId = form.get("quote_id") as string;
  const upload = form.get("file") as File;
  const fileName = cleanFileName(upload.name ?? "");
  const bytes = new Uint8Array(await upload.arrayBuffer());
  const sniffed = sniffUpload(bytes.subarray(0, SNIFF_BYTES), fileName);
  if (!sniffed.ok) {
    const code = sniffed.reason === "executable" ? "executable" : sniffed.reason === "mismatch" ? "mismatch" : "unsupported";
    return reply({ error: code === "unsupported" ? "That file type can't be kept as a quote document." : "This file isn't what its name says.", code }, 415);
  }

  const { data: started } = await agent.rpc("start_quote_document_upload", {
    p_quote_id: Number(quoteId), p_file_name: fileName, p_content_type: upload.type, p_size_bytes: bytes.length,
  });
  const { attachment_id: attachmentId, folder } = started as { attachment_id: number; folder: string };

  const service = deps.createClient(supabaseUrl, serviceRoleKey);
  const choice = selectScanner(deps.env, deps.scanner);
  if (!choice.ok) return reply({ error: "Uploads are paused while virus checking is set up.", code: "scanner_missing" }, 503);
  await choice.scanner.scan(bytes);
  const path = `${folder}/${attachmentId}-${storageKeyName(fileName)}`;
  await service.storage.from("peo-mail").upload(path, bytes, { contentType: STORED_CONTENT_TYPE, upsert: true });
  await service.rpc("finish_inbound_attachment", { p_attachment_id: attachmentId, p_verdict: "clean", p_bucket: "peo-mail", p_path: path, p_sha256: await sha256Hex(bytes) });
  await agent.rpc("attach_quote_document", { p_quote_id: Number(quoteId), p_attachment_id: attachmentId });
  return reply({ document: { attachment_id: attachmentId, file_name: fileName, status: "stored" } }, 200);
}
