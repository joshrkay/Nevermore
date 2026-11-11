import { describe, expect, it, vi } from "vitest";
import { EICAR } from "../_shared/eicar";
import { decodeSecret, sign } from "../resend-webhook/verify";
import { handleReceiveRequest, logLevel, type ReceiveClient, type ReceiveDeps } from "./handler";

const SECRET = "whsec_dmVyaWZ5LWhhcm5lc3Mtd2ViaG9vay1zZWNyZXQtMzJiIQ==";
const NOW = 1762789200 * 1000;
const SESSION = "6f1f7a0e-1c1e-4a39-9d57-5d2f0a8f7c11";
const LOCAL = "eaa-2026-0042.trinet.0123456789abcdef";
const ENC = new TextEncoder();

const eventBody = (over: Record<string, unknown> = {}, attachments: unknown[] = []) =>
  JSON.stringify({
    type: "email.received",
    created_at: "2026-11-10T15:42:00.000Z",
    data: {
      email_id: "re_abc", created_at: "2026-11-10T15:41:58.000Z", from: "Priya Raman <priya@trinet.example>",
      to: [`${LOCAL}@quotes.nevermorepeo.com`], cc: ["dana@trinet.example"], bcc: [], received_for: [`${LOCAL}@quotes.nevermorepeo.com`],
      message_id: "<m@trinet.example>", subject: "Re: Harbor Street proposal", attachments, ...over,
    },
  });

const att = (id: string, over: Record<string, unknown> = {}) => ({ id, filename: "proposal.pdf", content_type: "application/pdf", ...over });

/** A request signed the way the provider signs it. */
async function signed(body: string, over: { secret?: string; method?: string; ts?: number } = {}): Promise<Request> {
  const id = "msg_2Lh9KRb0pzN8";
  const ts = String(over.ts ?? NOW / 1000);
  const mac = await sign(decodeSecret(over.secret ?? SECRET)!, id, ts, body);
  return new Request("https://x.example/receive-mail", {
    method: over.method ?? "POST",
    headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${mac}` },
    body: over.method === "GET" ? undefined : body,
  });
}

const PDF = (extra = "") => ENC.encode(`%PDF-1.4\n${extra}\n%%EOF`);

interface Options {
  env?: Record<string, string | undefined>;
  message?: Record<string, unknown> | null | "fail";
  attachments?: Record<string, unknown>[];
  files?: Record<string, Uint8Array | number>;
  recorded?: Record<string, unknown>;
  recordError?: boolean;
  attachmentStatus?: Record<string, string>;
  scannerDown?: boolean;
  uploadError?: boolean;
}

function setup(o: Options = {}) {
  const logs: string[] = [];
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "record_inbound_mail") {
      return o.recordError
        ? { data: null, error: { code: "XX000" } }
        : { data: { message_id: 17, duplicate: false, held: false, held_reason: null, quote_request_id: 3, session_id: SESSION, ...o.recorded }, error: null };
    }
    if (fn === "record_inbound_attachment") {
      const known = o.attachmentStatus?.[args.p_provider_attachment_id as string];
      const status = known ?? (args.p_not_kept_reason ? "not_kept" : "pending");
      return { data: { id: Number(String(args.p_provider_attachment_id).replace(/\D/g, "")) || 1, status }, error: null };
    }
    return { data: {}, error: null };
  });
  const uploads: { bucket: string; path: string; type: string; size: number }[] = [];
  const client: ReceiveClient = {
    rpc,
    storage: {
      from: (bucket) => ({
        upload: async (path, body, options) => {
          if (o.uploadError) return { data: null, error: { statusCode: 500 } };
          uploads.push({ bucket, path, type: options.contentType, size: body.length });
          return { data: {}, error: null };
        },
      }),
    },
  };
  const downloads: string[] = [];
  const provider = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "https://api.resend.com/emails/receiving/re_abc") {
      if (o.message === "fail") return new Response("{}", { status: 500 });
      return Response.json(o.message === undefined ? { text: "Proposal attached.\n\n> earlier quoted text", html: "<p>ignored</p>", headers: { "Message-ID": "<m@trinet.example>", "In-Reply-To": "<a@b>" } } : o.message);
    }
    if (url === "https://api.resend.com/emails/receiving/re_abc/attachments") {
      return Response.json({
        object: "list", has_more: false,
        data: (o.attachments ?? []).map((a) => ({ size: 1000, content_type: "application/pdf", download_url: `https://files.resend.example/${a.id as string}`, ...a })),
      });
    }
    if (url.startsWith("https://files.resend.example/")) {
      downloads.push(url);
      const file = o.files?.[url.split("/").pop()!];
      if (typeof file === "number") return new Response("", { status: file });
      return new Response(file ?? PDF(), { status: 200 });
    }
    return new Response("unexpected " + url, { status: 599 });
  });
  const scanFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (o.scannerDown) return new Response("", { status: 503 });
    const sent = new TextDecoder().decode(init?.body as Uint8Array);
    return Response.json(sent.includes(EICAR) ? { verdict: "infected", signature: "Eicar-Test-Signature" } : { verdict: "clean" });
  });
  const env: Record<string, string | undefined> = {
    RESEND_INBOUND_WEBHOOK_SECRET: SECRET, PEO_MAIL_RECEIVING: "on", SUPABASE_URL: "https://p.supabase.example", SUPABASE_SERVICE_ROLE_KEY: "service",
    RESEND_API_KEY: "re_key", QUOTE_REPLY_DOMAIN: "quotes.nevermorepeo.com", MALWARE_SCANNER: "http",
    MALWARE_SCANNER_URL: "https://scan.example/scan", MALWARE_SCANNER_TOKEN: "token", ...o.env,
  };
  const deps: ReceiveDeps = {
    env: (n) => env[n], createClient: () => client, fetch: provider as unknown as typeof fetch,
    scanner: { fetch: scanFetch as unknown as typeof fetch, connect: vi.fn(), timeoutMs: 1000 }, now: () => NOW, log: (l) => logs.push(l),
  };
  const calls = (fn: string) => rpc.mock.calls.filter((c) => c[0] === fn).map((c) => c[1]);
  return { deps, logs, rpc, calls, uploads, downloads, provider, scanFetch };
}

describe("a message to a quote request's reply address", () => {
  it("is fetched and recorded once, and answered 200", async () => {
    const t = setup();
    const res = await handleReceiveRequest(await signed(eventBody()), t.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, duplicate: false, held: false, attachments: { stored: 0, blocked: 0, not_kept: 0, pending: 0, retry: false } });
    expect(t.calls("record_inbound_mail")).toEqual([
      {
        p_provider_message_id: "re_abc", p_local_parts: [LOCAL], p_from_address: "priya@trinet.example", p_from_name: "Priya Raman",
        p_to: [`${LOCAL}@quotes.nevermorepeo.com`], p_cc: ["dana@trinet.example"], p_subject: "Re: Harbor Street proposal",
        p_body_text: "Proposal attached.\n\n> earlier quoted text", p_body_truncated: false,
        p_headers: { "message-id": "<m@trinet.example>", "in-reply-to": "<a@b>" }, p_is_automatic: false, p_sent_at: "2026-11-10T15:41:58.000Z",
      },
    ]);
    expect(t.logs).toEqual(["MAIL_RECORDED: message=17 duplicate=false held=false"]);
  });

  it("calls the provider with its key, and never sends the key anywhere else", async () => {
    const t = setup();
    await handleReceiveRequest(await signed(eventBody()), t.deps);
    const [, init] = t.provider.mock.calls[0] as [unknown, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    expect(JSON.stringify(t.logs)).not.toContain("re_key");
  });

  it("marks an automatic reply as one", async () => {
    const t = setup({ message: { text: "I am away", headers: { "Auto-Submitted": "auto-replied" } } });
    await handleReceiveRequest(await signed(eventBody()), t.deps);
    expect(t.calls("record_inbound_mail")[0].p_is_automatic).toBe(true);
  });

  it("records the HTML as plain text when the message has no text part", async () => {
    const t = setup({ message: { html: "<p>Hello &amp; thanks</p>", headers: {} } });
    await handleReceiveRequest(await signed(eventBody()), t.deps);
    expect(t.calls("record_inbound_mail")[0].p_body_text).toBe("Hello & thanks");
  });

  it("is recorded as held when the database says no quote request has the address", async () => {
    const t = setup({ recorded: { held: true, held_reason: "revoked_address", quote_request_id: null, session_id: null } });
    const res = await handleReceiveRequest(await signed(eventBody()), t.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ held: true });
    expect(t.logs[0]).toBe("MAIL_RECORDED: message=17 duplicate=false held=true reason=revoked_address");
  });

  it("is answered 200 again on a replay, which the database records as a duplicate", async () => {
    const t = setup({ recorded: { duplicate: true } });
    const res = await handleReceiveRequest(await signed(eventBody()), t.deps);
    expect(await res.json()).toMatchObject({ ok: true, duplicate: true });
  });

  it("keeps no address, subject, file name or text in its logs", async () => {
    const t = setup({ attachments: [att("att_1")] });
    await handleReceiveRequest(await signed(eventBody({}, [att("att_1")])), t.deps);
    const text = t.logs.join("\n");
    for (const secret of ["priya", "trinet.example", "Harbor Street", "proposal.pdf", "Proposal attached"]) expect(text).not.toContain(secret);
  });
});

describe("who may call it, and when", () => {
  it("refuses a request with no signature, without reading the message", async () => {
    const t = setup();
    const res = await handleReceiveRequest(new Request("https://x.example/", { method: "POST", body: eventBody() }), t.deps);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(t.provider).not.toHaveBeenCalled();
    expect(t.rpc).not.toHaveBeenCalled();
  });

  it("refuses a signature made with another secret, and one from long ago", async () => {
    const t = setup();
    expect((await handleReceiveRequest(await signed(eventBody(), { secret: "whsec_b3RoZXItc2VjcmV0LW90aGVyLXNlY3JldC0zMmJ5dGVz" }), t.deps)).status).toBe(401);
    expect((await handleReceiveRequest(await signed(eventBody(), { ts: NOW / 1000 - 3600 }), t.deps)).status).toBe(401);
    expect(t.rpc).not.toHaveBeenCalled();
  });

  it("answers 503 when it has no signing secret, and says which setting", async () => {
    const t = setup({ env: { RESEND_INBOUND_WEBHOOK_SECRET: undefined } });
    const res = await handleReceiveRequest(await signed(eventBody()), t.deps);
    expect(res.status).toBe(503);
    expect(t.logs[0]).toContain("RESEND_INBOUND_WEBHOOK_SECRET is not set");
  });

  it("answers 503, for the provider to retry, while receiving is switched off", async () => {
    for (const off of [undefined, "", "off", "ON", "true"]) {
      const t = setup({ env: { PEO_MAIL_RECEIVING: off } });
      const res = await handleReceiveRequest(await signed(eventBody()), t.deps);
      expect(res.status, String(off)).toBe(503);
      expect(t.rpc).not.toHaveBeenCalled();
      expect(t.provider).not.toHaveBeenCalled();
      expect(t.logs).toEqual(["MAIL_RECEIVING_OFF: PEO_MAIL_RECEIVING is not on; the provider will retry"]);
    }
  });

  it("answers 503 and names each setting it lacks", async () => {
    const t = setup({ env: { QUOTE_REPLY_DOMAIN: undefined, RESEND_API_KEY: " " } });
    const res = await handleReceiveRequest(await signed(eventBody()), t.deps);
    expect(res.status).toBe(503);
    expect(t.logs[0]).toBe("MAIL_CONFIG_MISSING: RESEND_API_KEY, QUOTE_REPLY_DOMAIN not set; PEO mail is not being received");
  });

  it("answers 405 to anything but a POST, 413 to a body that is too large, and 400 to one that isn't JSON", async () => {
    const t = setup();
    expect((await handleReceiveRequest(new Request("https://x.example/", { method: "GET" }), t.deps)).status).toBe(405);
    expect((await handleReceiveRequest(new Request("https://x.example/", { method: "POST", body: "x".repeat(300 * 1024) }), t.deps)).status).toBe(413);
    expect((await handleReceiveRequest(await signed("not json"), t.deps)).status).toBe(400);
  });

  it("ignores an event that isn't a received email, and one with no sender it can use", async () => {
    const t = setup();
    expect(await (await handleReceiveRequest(await signed(JSON.stringify({ type: "email.bounced", data: {} })), t.deps)).json()).toEqual({ ok: true, ignored: true });
    expect(await (await handleReceiveRequest(await signed(eventBody({ from: "undisclosed" })), t.deps)).json()).toEqual({ ok: true, ignored: true });
    expect(t.rpc).not.toHaveBeenCalled();
  });
});

describe("when something it depends on fails", () => {
  it("answers 500, for the provider to retry, when the message can't be fetched or the database refuses it", async () => {
    const a = setup({ message: "fail" });
    expect((await handleReceiveRequest(await signed(eventBody()), a.deps)).status).toBe(500);
    expect(a.logs[0]).toBe("MAIL_RECORD_FAILED: provider_500; the provider will retry");
    const b = setup({ recordError: true });
    expect((await handleReceiveRequest(await signed(eventBody()), b.deps)).status).toBe(500);
    expect(b.logs[0]).toBe("MAIL_RECORD_FAILED: record_inbound_mail XX000; the provider will retry");
    const c = setup({ message: null });
    expect((await handleReceiveRequest(await signed(eventBody()), c.deps)).status).toBe(500);
  });
});

describe("an attachment", () => {
  const run = async (t: ReturnType<typeof setup>, attachments: unknown[]) => handleReceiveRequest(await signed(eventBody({}, attachments)), t.deps);

  it("that scans clean is stored in the peo-mail bucket under its message, and settled", async () => {
    const t = setup({ attachments: [att("att_1")] });
    const res = await run(t, [att("att_1")]);
    expect(res.status).toBe(200);
    expect((await res.json() as { attachments: unknown }).attachments).toMatchObject({ stored: 1, pending: 0 });
    expect(t.uploads).toEqual([{ bucket: "peo-mail", path: `${SESSION}/17/1-proposal.pdf`, type: "application/octet-stream", size: PDF().length }]);
    const [finish] = t.calls("finish_inbound_attachment");
    expect(finish).toMatchObject({ p_attachment_id: 1, p_verdict: "clean", p_bucket: "peo-mail", p_path: `${SESSION}/17/1-proposal.pdf` });
    expect(String(finish.p_sha256)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("that the scanner flags is blocked with its signature, never stored, and alerted", async () => {
    const t = setup({ attachments: [att("att_1")], files: { att_1: PDF(EICAR) }, env: { ENGINEERING_ALERT_WEBHOOK_URL: "https://alerts.example/hook" } });
    const res = await run(t, [att("att_1")]);
    expect(res.status).toBe(200);
    expect((await res.json() as { attachments: unknown }).attachments).toMatchObject({ blocked: 1, stored: 0 });
    expect(t.uploads).toEqual([]);
    expect(t.calls("finish_inbound_attachment")).toEqual([{ p_attachment_id: 1, p_verdict: "infected", p_signature: "Eicar-Test-Signature" }]);
    expect(t.logs).toContain("MALWARE_DETECTED source=receive-mail attachment=1 engine=http signature=Eicar-Test-Signature");
  });

  it("over 20 MB, or of a type uploads don't take, is listed as not kept without being downloaded", async () => {
    const t = setup({ attachments: [att("att_1", { size: 21 * 1024 * 1024 }), att("att_2", { filename: "rate-model.xlsm" })] });
    const res = await run(t, [att("att_1"), att("att_2")]);
    expect((await res.json() as { attachments: unknown }).attachments).toMatchObject({ not_kept: 2 });
    expect(t.downloads).toEqual([]);
    expect(t.calls("record_inbound_attachment").map((c) => c.p_not_kept_reason)).toEqual(["too_large", "unsupported_type"]);
    expect(t.uploads).toEqual([]);
  });

  it("whose bytes aren't what its name says is listed as not kept once downloaded", async () => {
    const t = setup({ attachments: [att("att_1")], files: { att_1: ENC.encode("\x89PNG\r\n\x1a\n not a pdf") } });
    await run(t, [att("att_1")]);
    expect(t.calls("finish_inbound_attachment")).toEqual([{ p_attachment_id: 1, p_not_kept_reason: "type_mismatch" }]);
    expect(t.uploads).toEqual([]);
    expect(t.scanFetch).not.toHaveBeenCalled();
  });

  it("that is a program renamed is listed as not kept, and never scanned or stored", async () => {
    const t = setup({ attachments: [att("att_1")], files: { att_1: new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]) } });
    await run(t, [att("att_1")]);
    expect(t.calls("finish_inbound_attachment")).toEqual([{ p_attachment_id: 1, p_not_kept_reason: "executable" }]);
    expect(t.uploads).toEqual([]);
  });

  it("waits, unreadable, and has the provider retry, when the scanner can't answer", async () => {
    const t = setup({ attachments: [att("att_1")], scannerDown: true });
    const res = await run(t, [att("att_1")]);
    expect(res.status).toBe(500);
    expect(t.uploads).toEqual([]);
    expect(t.calls("finish_inbound_attachment")).toEqual([]);
    expect(t.logs.some((l) => l.startsWith("MAIL_SCAN_UNAVAILABLE:"))).toBe(true);
    // The message was recorded before; a retry finds it recorded and tries the attachment again.
    expect(t.calls("record_inbound_mail")).toHaveLength(1);
  });

  it("is never stored with no scanner set: it waits, an ops event is recorded once, and the answer is 200", async () => {
    const t = setup({ attachments: [att("att_1"), att("att_2")], env: { MALWARE_SCANNER: undefined } });
    const res = await run(t, [att("att_1"), att("att_2")]);
    expect(res.status).toBe(200);
    expect((await res.json() as { attachments: unknown }).attachments).toMatchObject({ pending: 2, stored: 0 });
    expect(t.uploads).toEqual([]);
    expect(t.calls("record_ops_event")).toEqual([{ p_kind: "scan_failed", p_source: "receive-mail", p_code: "config_missing", p_detail: expect.stringContaining("MALWARE_SCANNER is not set") }]);
    expect(t.logs.filter((l) => l.startsWith("MAIL_SCAN_CONFIG_MISSING:"))).toHaveLength(1);
  });

  it("is not stored with the scanner set to none outside a demo, staging or development project", async () => {
    const t = setup({ attachments: [att("att_1")], env: { MALWARE_SCANNER: "none" } });
    await run(t, [att("att_1")]);
    expect(t.uploads).toEqual([]);
  });

  it("answers 500 to have the provider retry when the download or the storage fails", async () => {
    const a = setup({ attachments: [att("att_1")], files: { att_1: 404 } });
    expect((await run(a, [att("att_1")])).status).toBe(500);
    expect(a.calls("finish_inbound_attachment")).toEqual([]);
    const b = setup({ attachments: [att("att_1")], uploadError: true });
    expect((await run(b, [att("att_1")])).status).toBe(500);
    expect(b.calls("finish_inbound_attachment")).toEqual([]);
  });

  it("that was settled on an earlier delivery is not downloaded again", async () => {
    const t = setup({ attachments: [att("att_1"), att("att_2"), att("att_3")], attachmentStatus: { att_1: "stored", att_2: "blocked", att_3: "not_kept" }, recorded: { duplicate: true } });
    const res = await run(t, [att("att_1"), att("att_2"), att("att_3")]);
    expect((await res.json() as { attachments: unknown }).attachments).toMatchObject({ stored: 1, blocked: 1, not_kept: 1, pending: 0 });
    expect(t.downloads).toEqual([]);
    expect(t.uploads).toEqual([]);
  });

  it("of a held message is stored under held/ rather than an intake", async () => {
    const t = setup({ attachments: [att("att_1")], recorded: { held: true, held_reason: "unknown_address", quote_request_id: null, session_id: null } });
    await run(t, [att("att_1")]);
    expect(t.uploads[0].path).toBe("held/17/1-proposal.pdf");
  });

  it("is downloaded only from an https link", async () => {
    const t = setup({ attachments: [att("att_1", { download_url: "http://169.254.169.254/latest" })] });
    const res = await run(t, [att("att_1")]);
    expect(res.status).toBe(500);
    expect(t.downloads).toEqual([]);
  });

  it("is not looked up when the message has none", async () => {
    const t = setup();
    await handleReceiveRequest(await signed(eventBody({}, [])), t.deps);
    expect(t.provider.mock.calls.map((c) => String(c[0]))).toEqual(["https://api.resend.com/emails/receiving/re_abc"]);
  });

  it("is named only by the provider's cleaned name in its path", async () => {
    const t = setup({ attachments: [att("att_1", { filename: "../../etc/pass wd.pdf" })] });
    await run(t, [att("att_1")]);
    expect(t.uploads[0].path).toBe(`${SESSION}/17/1-pass_wd.pdf`);
  });
});

describe("which console a log line goes to", () => {
  it("sends a recorded message to info, noise to a warning and everything else to the error log", () => {
    expect(logLevel("MAIL_RECORDED: message=1 duplicate=false held=false")).toBe("log");
    expect(logLevel("MAIL_REJECTED: reason=no_match")).toBe("warn");
    expect(logLevel("MAIL_RECEIVING_OFF: x")).toBe("warn");
    expect(logLevel("MAIL_IGNORED: no_data")).toBe("warn");
    expect(logLevel("MAIL_RECORD_FAILED: x")).toBe("error");
    expect(logLevel("MALWARE_DETECTED source=receive-mail")).toBe("error");
  });
});
