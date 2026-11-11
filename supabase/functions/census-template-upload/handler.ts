// The request handler for census-template-upload, with everything it touches passed in. index.ts wires in Deno,
// the real Supabase client and a connection for the scanner; the tests wire in fakes. No remote imports, so it runs
// under Deno and Vitest alike.
//
// The only way a PEO's own census template reaches storage (L-3.1; migration 20261114090000_peo_census_templates.sql).
// It is an upload like any other (docs/adr/0002), so it reuses document-upload's checks: an admin's browser sends
// the file as multipart form data (peo_id, file), and
//
//   1. with no usable scanner it is refused before anything is read, stored or recorded (scanner_missing);
//   2. its bytes are checked: not empty, at most 20 MB, and an .xlsx in fact as in name (fileSignature.ts). Only a
//      spreadsheet can be filled;
//   3. its record is written as the admin (admin_register_census_template, which refuses anyone else), pending;
//   4. it is scanned (malwareScan.ts) and stored with the service role: in peo-templates once clean, otherwise in
//      quarantine (templates/<path>), which nobody but the service role reads;
//   5. the verdict is recorded once: clean, blocked (malware, alerted at once) or failed. A template the scanner
//      couldn't check now, or one that couldn't be stored, is failed rather than held: an admin uploads it again,
//      and nothing waits in quarantine with no way out. A template that isn't clean is never used.
//
// Logs carry ids and codes only, never file names or contents.

import { readBodyCapped } from "../_shared/body.ts";
import { cleanFileName, MAX_UPLOAD_BYTES, sha256Hex, SNIFF_BYTES, sniffUpload, STORED_CONTENT_TYPE } from "../_shared/fileSignature.ts";
import { postScanAlert, selectScanner, type ScannerDeps } from "../_shared/malwareScan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-Request-Id",
};

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const FORM_OVERHEAD_BYTES = 64 * 1024;
const PEO_ID = /^[1-9][0-9]{0,18}$/;

type DbError = { message?: string; code?: string } | null;

/** The parts of the Supabase client this function uses, as the admin and as the service role. */
export interface TemplateClient {
  auth: { getUser: () => PromiseLike<{ data: { user: { id: string } | null } }> };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: DbError }>;
  storage: {
    from: (bucket: string) => {
      upload: (path: string, body: Uint8Array, options: { contentType: string; upsert: boolean }) => PromiseLike<{ data: unknown; error: unknown }>;
    };
  };
}

export interface TemplateDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options?: { global?: { headers: Record<string, string> } }) => TemplateClient;
  scanner: ScannerDeps;
  /** For the alert webhook. */
  fetch: typeof fetch;
  log: (line: string) => void;
  newRequestId: () => string;
}

export type TemplateErrorCode =
  | "bad_request" | "unauthorized" | "forbidden" | "not_found" | "too_large" | "empty" | "mismatch" | "executable" | "unsupported"
  | "storage" | "unavailable" | "scanner_missing" | "internal";

const errorCode = (error: unknown): string => {
  const e = error as { code?: unknown; statusCode?: unknown; status?: unknown } | null;
  const code = e?.code ?? e?.statusCode ?? e?.status;
  return typeof code === "string" || typeof code === "number" ? String(code) : "unknown";
};

export async function handleTemplateUpload(req: Request, deps: TemplateDeps): Promise<Response> {
  const requestId = deps.newRequestId();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reply = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify({ ...body, request_id: requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  const refuse = (status: number, code: TemplateErrorCode, message: string) => reply({ error: message, code }, status);
  if (req.method !== "POST") return refuse(405, "bad_request", "Method not allowed");

  try {
    const supabaseUrl = deps.env("SUPABASE_URL");
    const anonKey = deps.env("SUPABASE_ANON_KEY");
    const serviceRoleKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      deps.log("TEMPLATE_CONFIG_MISSING: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set");
      return refuse(503, "unavailable", "Uploads aren't available right now.");
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return refuse(401, "unauthorized", "Unauthorized");
    const admin = deps.createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await admin.auth.getUser();
    if (!user) return refuse(401, "unauthorized", "Unauthorized");

    // 1. A scanner, before anything else (ADR 0002).
    const choice = selectScanner(deps.env, deps.scanner);
    if (!choice.ok) {
      deps.log(`SCAN_CONFIG_MISSING: ${choice.problem}; uploads are refused until it is fixed (docs/SUPABASE_SETUP.md, "Malware scanning")`);
      return refuse(503, "scanner_missing", "Uploads are paused while virus checking is set up. Try again once it is.");
    }

    // 2. The bytes.
    const body = await readBodyCapped(req, MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES);
    if (!body) return refuse(413, "too_large", "A template can be up to 20 MB.");
    let form: FormData;
    try {
      form = await new Response(body as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": req.headers.get("Content-Type") ?? "" } }).formData();
    } catch {
      return refuse(400, "bad_request", "Send the file as multipart form data.");
    }
    const peoId = form.get("peo_id");
    const file = form.get("file");
    if (typeof peoId !== "string" || !PEO_ID.test(peoId)) return refuse(400, "bad_request", "peo_id is required.");
    if (!file || typeof file === "string") return refuse(400, "bad_request", "file is required.");
    if (file.size === 0) return refuse(422, "empty", "This file is empty.");
    if (file.size > MAX_UPLOAD_BYTES) return refuse(413, "too_large", "A template can be up to 20 MB.");
    const fileName = cleanFileName((file as File).name ?? "");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniff = sniffUpload(bytes.subarray(0, SNIFF_BYTES), fileName);
    if (!sniff.ok || sniff.contentType !== XLSX_TYPE) {
      const reason = sniff.ok ? "unsupported" : sniff.reason;
      return refuse(415, reason, reason === "unsupported" ? "A PEO's template is an Excel workbook (.xlsx)." : "This file isn't the Excel workbook its name says.");
    }

    // 3. The record, as the admin: the database decides who may.
    const { data: registered, error: registerError } = await admin.rpc("admin_register_census_template", {
      p_peo_id: Number(peoId),
      p_file_name: fileName,
      p_size_bytes: bytes.length,
      p_sha256: await sha256Hex(bytes),
    });
    if (registerError || !registered) {
      if (registerError?.code === "42501") return refuse(403, "forbidden", "Only an admin uploads a PEO's template.");
      if (registerError?.code === "P0002") return refuse(404, "not_found", "PEO not found.");
      deps.log(`TEMPLATE_RECORD_FAILED request=${requestId} peo=${peoId} code=${errorCode(registerError)}`);
      return refuse(500, "internal", "The template couldn't be saved. Try again.");
    }
    const { id, storage_path: storagePath } = registered as { id: number; storage_path: string };
    const service = deps.createClient(supabaseUrl, serviceRoleKey);
    const record = async (verdict: "clean" | "blocked" | "failed", signature: string | null) => {
      const { error } = await service.rpc("record_census_template_scan", { p_template_id: id, p_verdict: verdict, p_signature: signature });
      if (error) deps.log(`TEMPLATE_SCAN_NOT_RECORDED request=${requestId} template=${id} code=${errorCode(error)}`);
    };

    // 4. The scan, then the file: in peo-templates once clean, otherwise in quarantine.
    const scan = await choice.scanner.scan(bytes);
    const clean = scan.verdict === "clean" || scan.verdict === "skipped";
    const [bucket, path] = clean ? ["peo-templates", storagePath] : ["quarantine", `templates/${storagePath}`];
    const { error: storeError } = await service.storage.from(bucket).upload(path, bytes, { contentType: STORED_CONTENT_TYPE, upsert: false });
    if (storeError) {
      await record("failed", null);
      deps.log(`TEMPLATE_STORE_FAILED request=${requestId} template=${id} bucket=${bucket} code=${errorCode(storeError)}`);
      return refuse(502, "storage", "The template couldn't be stored. Upload it again.");
    }

    // 5. The verdict, once.
    let status: "clean" | "blocked" | "failed";
    if (clean) {
      status = "clean";
      await record("clean", null);
    } else if (scan.verdict === "infected") {
      status = "blocked";
      await record("blocked", scan.signature);
      deps.log(`MALWARE_DETECTED source=census-template-upload template=${id} peo=${peoId} engine=${scan.engine} signature=${scan.signature}`);
      await postScanAlert(deps, {
        text: `MALWARE_DETECTED: a PEO's census template matched ${scan.signature} (${scan.engine}) and is quarantined; nobody can open it. template=${id} peo=${peoId}. Follow the "Malware detected" playbook in docs/RUNBOOK.md.`,
        source: "census-template-upload",
        alert: "MALWARE_DETECTED",
        template: id,
        peo: Number(peoId),
        signature: scan.signature,
        engine: scan.engine,
      });
    } else {
      status = "failed";
      await record("failed", null);
      deps.log(`TEMPLATE_SCAN_FAILED request=${requestId} template=${id} engine=${scan.engine} reason=${scan.reason}`);
    }
    return reply({ template: { id, file_name: fileName, scan_status: status } }, 200);
  } catch {
    deps.log(`TEMPLATE_UPLOAD_ERROR request=${requestId}`);
    return refuse(500, "internal", "The template couldn't be saved. Try again.");
  }
}
