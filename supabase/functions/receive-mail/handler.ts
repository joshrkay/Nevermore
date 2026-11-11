// The request handler for receive-mail, with everything it touches passed in. index.ts wires in Deno, the real
// Supabase client and the scanner's connection; the tests wire in fakes. No remote imports, so it runs under
// Deno and Vitest alike.
//
// Receives the email provider's `email.received` webhook for the receiving subdomain (story M-3.2 of
// joshrkay/Nevermore#92; docs/adr/0004-peo-mail-is-received-before-the-product-sends.md) and records the message
// against the quote request whose reply address it was sent to:
//
//   1. the request is trusted only if its signature verifies against RESEND_INBOUND_WEBHOOK_SECRET (the gateway's
//      JWT check is off for this function: the provider holds no login), and only while PEO_MAIL_RECEIVING is "on",
//      the setting that switches receiving off without a deploy. Off, it answers 503, so the provider retries later;
//   2. the webhook carries metadata only, so the message (text, headers) is fetched from the provider's API, and
//      recorded once, whatever the number of retries (record_inbound_mail is idempotent on the provider's id);
//   3. each attachment is recorded, then downloaded, checked (a size cap and the file types uploads take, by name
//      and by bytes), scanned for malware, and stored in the peo-mail bucket only once the scan passed. One the
//      scanner flags is recorded as blocked with its signature, and its bytes are dropped. One that isn't taken is
//      listed by name and size. One that can't be scanned yet stays pending and unreadable;
//   4. a scanner that was reachable but couldn't answer makes the function answer 500, so the provider retries the
//      webhook and the pending attachment is tried again. No scanner set at all leaves it pending and answers 200:
//      replay the webhook from the provider's dashboard once one is set (docs/RUNBOOK.md).
//
// A message never changes the quote request or its status. Logs carry ids, counts and failure codes only, never
// addresses, subjects, file names or text.

import { readBodyCapped } from "../_shared/body.ts";
import { cleanFileName, MAX_UPLOAD_BYTES, sha256Hex, SNIFF_BYTES, sniffUpload, storageKeyName, STORED_CONTENT_TYPE } from "../_shared/fileSignature.ts";
import { malwareAlert, postScanAlert, selectScanner, type ScannerDeps } from "../_shared/malwareScan.ts";
import { verifySignature } from "../resend-webhook/verify.ts";
import {
  addressesOf, attachmentDecision, bodyText, isAutomatic, keptHeaders, MAX_ATTACHMENTS, parseAddress, parseReceivedEmail, parseReceivedEvent,
  replyLocalParts,
} from "./inbound.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };
const MAX_BODY_BYTES = 256 * 1024;
const API = "https://api.resend.com";
const API_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;

type DbError = { message?: string; code?: string } | null;

/** The parts of the Supabase client this function uses, as the service role. */
export interface ReceiveClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: DbError }>;
  storage: {
    from: (bucket: string) => {
      upload: (path: string, body: Uint8Array, options: { contentType: string; upsert: boolean }) => PromiseLike<{ data: unknown; error: unknown }>;
    };
  };
}

export interface ReceiveDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string) => ReceiveClient;
  fetch: typeof fetch;
  /** What the malware scanner needs: fetch for an HTTPS service, connect for clamd. */
  scanner: ScannerDeps;
  now: () => number;
  log: (line: string) => void;
}

const respond = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

const errorCode = (error: unknown): string => {
  const e = error as { code?: unknown; statusCode?: unknown; status?: unknown } | null;
  const code = e?.code ?? e?.statusCode ?? e?.status;
  return typeof code === "string" || typeof code === "number" ? String(code).replace(/[^A-Za-z0-9_]/g, "").slice(0, 16) || "unknown" : "unknown";
};

/** Which console a log line belongs on: a recorded message is info, noise from outside is a warning, the rest is for the error log operators alert on. */
export function logLevel(line: string): "log" | "warn" | "error" {
  if (line.startsWith("MAIL_RECORDED:")) return "log";
  if (line.startsWith("MAIL_REJECTED:") || line.startsWith("MAIL_IGNORED:") || line.startsWith("MAIL_RECEIVING_OFF:")) return "warn";
  return "error";
}

/** Runs `work` with a signal that aborts after `ms`. (AbortSignal.timeout isn't there in every runtime the tests use.) */
async function withTimeout<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(deps: ReceiveDeps, url: string, apiKey: string): Promise<unknown | null> {
  return await withTimeout(API_TIMEOUT_MS, async (signal) => {
    const res = await deps.fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, "User-Agent": "nevermore-receive-mail", Accept: "application/json" },
      signal,
    });
    if (!res.ok) throw new Error(`provider_${res.status}`);
    return await res.json();
  });
}

/** The response body, read no further than `max` bytes; null once it is longer. */
async function readCapped(res: Response, max: number): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get("Content-Length") ?? NaN);
  if (Number.isFinite(declared) && declared > max) return null;
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
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
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

interface ProviderAttachment {
  id: string;
  filename: string;
  size: number;
  contentType: string;
  downloadUrl: string;
}

function parseAttachments(json: unknown): { items: ProviderAttachment[]; more: boolean } {
  const body = json as { data?: unknown; has_more?: unknown } | null;
  const items: ProviderAttachment[] = [];
  for (const a of Array.isArray(body?.data) ? (body!.data as Record<string, unknown>[]) : []) {
    if (!a || typeof a.id !== "string" || a.id === "") continue;
    items.push({
      id: a.id.slice(0, 200),
      filename: typeof a.filename === "string" ? a.filename : "",
      size: typeof a.size === "number" && Number.isFinite(a.size) && a.size >= 0 ? a.size : 0,
      contentType: typeof a.content_type === "string" ? a.content_type : "",
      downloadUrl: typeof a.download_url === "string" ? a.download_url : "",
    });
  }
  return { items, more: body?.has_more === true };
}

export async function handleReceiveRequest(req: Request, deps: ReceiveDeps): Promise<Response> {
  const log = deps.log;
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

  const bytes = await readBodyCapped(req, MAX_BODY_BYTES);
  if (bytes === null) return respond(413, { error: "Payload too large" });
  const raw = new TextDecoder().decode(bytes);

  const id = req.headers.get("svix-id") ?? req.headers.get("webhook-id");
  const timestamp = req.headers.get("svix-timestamp") ?? req.headers.get("webhook-timestamp");
  const signature = req.headers.get("svix-signature") ?? req.headers.get("webhook-signature");
  // Nothing signed is nothing to check, whatever the settings (the setup's probe relies on this).
  if (!id || !timestamp || !signature) {
    log("MAIL_REJECTED: reason=missing_headers");
    return respond(401, { error: "Unauthorized" });
  }

  const secret = deps.env("RESEND_INBOUND_WEBHOOK_SECRET");
  if (!secret) {
    log("MAIL_CONFIG_MISSING: RESEND_INBOUND_WEBHOOK_SECRET is not set; PEO mail is not being received");
    return respond(503, { error: "Receiving is unavailable right now." });
  }
  const verified = await verifySignature(secret, { id, timestamp, signature, body: raw }, deps.now());
  if (!verified.ok) {
    if (verified.reason === "bad_secret") {
      log("MAIL_CONFIG_MISSING: RESEND_INBOUND_WEBHOOK_SECRET is not a whsec_ signing secret");
      return respond(503, { error: "Receiving is unavailable right now." });
    }
    log(`MAIL_REJECTED: reason=${verified.reason}`);
    return respond(401, { error: "Unauthorized" });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return respond(400, { error: "Bad request" });
  }
  const parsed = parseReceivedEvent(json);
  if (parsed.kind === "ignore") return respond(200, { ok: true, ignored: true });
  if (parsed.kind === "unusable") {
    log(`MAIL_IGNORED: ${parsed.reason}`);
    return respond(200, { ok: true, ignored: true });
  }
  const { event } = parsed;

  // The setting that switches receiving off. The provider keeps what it received and retries, so nothing is lost.
  if (deps.env("PEO_MAIL_RECEIVING") !== "on") {
    log("MAIL_RECEIVING_OFF: PEO_MAIL_RECEIVING is not on; the provider will retry");
    return respond(503, { error: "Receiving is switched off." });
  }

  const supabaseUrl = deps.env("SUPABASE_URL");
  const serviceKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = deps.env("RESEND_API_KEY");
  const domain = deps.env("QUOTE_REPLY_DOMAIN")?.trim().toLowerCase();
  if (!supabaseUrl || !serviceKey || !apiKey || !domain) {
    const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "QUOTE_REPLY_DOMAIN"].filter((n) => !deps.env(n)?.trim());
    log(`MAIL_CONFIG_MISSING: ${missing.join(", ")} not set; PEO mail is not being received`);
    return respond(503, { error: "Receiving is unavailable right now." });
  }
  const client = deps.createClient(supabaseUrl, serviceKey);

  try {
    // The message itself: the webhook has only metadata.
    const email = parseReceivedEmail(await getJson(deps, `${API}/emails/receiving/${encodeURIComponent(event.emailId)}`, apiKey));
    if (!email) {
      log("MAIL_RECORD_FAILED: the provider's message could not be read; the provider will retry");
      return respond(500, { error: "Internal error" });
    }
    const sender = parseAddress(event.from);
    if (!sender) {
      log("MAIL_IGNORED: the sender is not an address");
      return respond(200, { ok: true, ignored: true });
    }
    const everyone = [...event.to, ...event.cc, ...event.bcc, ...event.receivedFor];
    const body = bodyText(email);
    const headers = keptHeaders(email.headers);

    const { data: recorded, error: recordError } = await client.rpc("record_inbound_mail", {
      p_provider_message_id: event.emailId,
      p_local_parts: replyLocalParts(everyone, domain),
      p_from_address: sender.address,
      p_from_name: sender.name,
      p_to: addressesOf(event.to),
      p_cc: addressesOf(event.cc),
      p_subject: event.subject,
      p_body_text: body.text,
      p_body_truncated: body.truncated,
      p_headers: headers,
      p_is_automatic: isAutomatic(email.headers, sender.address),
      p_sent_at: event.createdAt,
    });
    if (recordError) {
      log(`MAIL_RECORD_FAILED: record_inbound_mail ${errorCode(recordError)}; the provider will retry`);
      return respond(500, { error: "Internal error" });
    }
    const result = recorded as { message_id?: number; duplicate?: boolean; held?: boolean; held_reason?: string | null; session_id?: string | null } | null;
    const messageId = result?.message_id;
    if (typeof messageId !== "number") {
      log("MAIL_RECORD_FAILED: record_inbound_mail answered nothing usable; the provider will retry");
      return respond(500, { error: "Internal error" });
    }
    log(`MAIL_RECORDED: message=${messageId} duplicate=${result?.duplicate === true} held=${result?.held === true}${result?.held_reason ? ` reason=${result.held_reason}` : ""}`);

    const summary = await processAttachments({ client, deps, apiKey, event, messageId, sessionId: result?.session_id ?? null });
    if (summary.retry) {
      log(`MAIL_ATTACHMENT_RETRY: message=${messageId} pending=${summary.pending}; the provider will retry`);
      return respond(500, { error: "Internal error" });
    }
    return respond(200, { ok: true, duplicate: result?.duplicate === true, held: result?.held === true, attachments: summary });
  } catch (e) {
    log(`MAIL_RECORD_FAILED: ${(e as Error)?.message?.startsWith("provider_") ? (e as Error).message : "error"}; the provider will retry`);
    return respond(500, { error: "Internal error" });
  }
}

interface AttachmentSummary {
  stored: number;
  blocked: number;
  not_kept: number;
  pending: number;
  /** A scanner that was reachable could not answer: the provider should deliver the webhook again. */
  retry: boolean;
}

async function processAttachments(ctx: {
  client: ReceiveClient; deps: ReceiveDeps; apiKey: string; messageId: number; sessionId: string | null;
  event: { emailId: string; attachmentCount: number };
}): Promise<AttachmentSummary> {
  const { client, deps, apiKey, messageId, sessionId, event } = ctx;
  const summary: AttachmentSummary = { stored: 0, blocked: 0, not_kept: 0, pending: 0, retry: false };
  if (event.attachmentCount === 0) return summary;

  const listed = parseAttachments(await getJson(deps, `${API}/emails/receiving/${encodeURIComponent(event.emailId)}/attachments`, apiKey));
  if (listed.more || listed.items.length > MAX_ATTACHMENTS) deps.log(`MAIL_ATTACHMENTS_CAPPED: message=${messageId} only the first ${MAX_ATTACHMENTS} are recorded`);

  let choice: ReturnType<typeof selectScanner> | null = null;
  let configLogged = false;

  for (const file of listed.items.slice(0, MAX_ATTACHMENTS)) {
    const name = cleanFileName(file.filename || "attachment");
    const decision = attachmentDecision({ name, size: file.size });
    const { data: row, error: rowError } = await client.rpc("record_inbound_attachment", {
      p_message_id: messageId,
      p_provider_attachment_id: file.id,
      p_file_name: name,
      p_content_type: file.contentType,
      p_size_bytes: file.size,
      p_not_kept_reason: decision.keep ? null : decision.reason,
    });
    if (rowError) throw new Error(`rpc_attachment_${errorCode(rowError)}`);
    const att = row as { id?: number; status?: string } | null;
    if (typeof att?.id !== "number") throw new Error("rpc_attachment_unusable");
    if (att.status === "stored") { summary.stored++; continue; }
    if (att.status === "blocked") { summary.blocked++; continue; }
    if (att.status === "not_kept") { summary.not_kept++; continue; }

    const settle = async (args: Record<string, unknown>) => {
      const { error } = await client.rpc("finish_inbound_attachment", { p_attachment_id: att.id, ...args });
      if (error) throw new Error(`rpc_finish_${errorCode(error)}`);
    };

    // Download, within the cap and the time allowed. The URL is the provider's own signed link.
    let data: Uint8Array | null = null;
    try {
      if (!/^https:\/\//i.test(file.downloadUrl)) throw new Error("no_link");
      data = await withTimeout(DOWNLOAD_TIMEOUT_MS, async (signal) => {
        const res = await deps.fetch(file.downloadUrl, { signal });
        if (!res.ok) throw new Error(`download_${res.status}`);
        return await readCapped(res, MAX_UPLOAD_BYTES);
      });
    } catch (e) {
      deps.log(`MAIL_ATTACHMENT_DOWNLOAD_FAILED: message=${messageId} attachment=${att.id} ${(e as Error).message?.replace(/[^A-Za-z0-9_]/g, "").slice(0, 24) || "error"}`);
      summary.pending++;
      summary.retry = true;
      continue;
    }
    if (data === null) {
      await settle({ p_not_kept_reason: "too_large" });
      summary.not_kept++;
      continue;
    }
    const sniffed = sniffUpload(data.subarray(0, SNIFF_BYTES), name);
    if (!sniffed.ok) {
      const reason = sniffed.reason === "executable" ? "executable" : sniffed.reason === "mismatch" ? "type_mismatch" : "unsupported_type";
      deps.log(`MAIL_ATTACHMENT_REFUSED: message=${messageId} attachment=${att.id} reason=${reason}`);
      await settle({ p_not_kept_reason: reason });
      summary.not_kept++;
      continue;
    }

    choice ??= selectScanner(deps.env, deps.scanner);
    if (!choice.ok) {
      // Unreadable until a scanner is set; replay the webhook then. Never stored without a scan.
      if (!configLogged) {
        deps.log(`MAIL_SCAN_CONFIG_MISSING: ${choice.problem}; attachments stay pending and unreadable until it is fixed (docs/SUPABASE_SETUP.md, "Malware scanning")`);
        await client.rpc("record_ops_event", { p_kind: "scan_failed", p_source: "receive-mail", p_code: "config_missing", p_detail: choice.problem });
        configLogged = true;
      }
      summary.pending++;
      continue;
    }
    const scan = await choice.scanner.scan(data);
    if (scan.verdict === "unavailable") {
      deps.log(`MAIL_SCAN_UNAVAILABLE: message=${messageId} attachment=${att.id} reason=${scan.reason.replace(/[^A-Za-z0-9_:. -]/g, "").slice(0, 60)}`);
      summary.pending++;
      summary.retry = true;
      continue;
    }
    if (scan.verdict === "infected") {
      await settle({ p_verdict: "infected", p_signature: scan.signature });
      summary.blocked++;
      deps.log(`MALWARE_DETECTED source=receive-mail attachment=${att.id} engine=${scan.engine} signature=${scan.signature}`);
      await postScanAlert(
        { fetch: deps.fetch, env: deps.env, log: deps.log },
        malwareAlert({ document: `mail-attachment-${att.id}`, intake: sessionId, signature: scan.signature, engine: scan.engine, source: "receive-mail" }),
      );
      continue;
    }
    const path = `${sessionId ?? "held"}/${messageId}/${att.id}-${storageKeyName(name)}`;
    const { error: uploadError } = await client.storage.from("peo-mail").upload(path, data, { contentType: STORED_CONTENT_TYPE, upsert: true });
    if (uploadError) {
      deps.log(`MAIL_ATTACHMENT_STORAGE_FAILED: message=${messageId} attachment=${att.id} ${errorCode(uploadError)}`);
      summary.pending++;
      summary.retry = true;
      continue;
    }
    await settle({ p_verdict: scan.verdict, p_bucket: "peo-mail", p_path: path, p_sha256: await sha256Hex(data) });
    summary.stored++;
  }
  return summary;
}
