import { describe, expect, it, vi } from "vitest";
import { EICAR } from "../_shared/eicar";
import { STORED_CONTENT_TYPE } from "../_shared/fileSignature";
import { handleQuoteDocumentUpload, type QuoteDocumentClient, type QuoteDocumentDeps } from "./handler";

// Uploading a quote document recorded by hand (N-2.2, D-731), through a faked database, storage and scanner: what an agent is told and what is kept.

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REQUEST = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const INTAKE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const ENV: Record<string, string | undefined> = {
  SUPABASE_URL: "https://project.test",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  MALWARE_SCANNER: "http",
  MALWARE_SCANNER_URL: "https://scan.example.com/scan",
  MALWARE_SCANNER_TOKEN: "scan-token",
  ENGINEERING_ALERT_WEBHOOK_URL: "https://hooks.example.com/alerts",
};

const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");

interface Setup {
  env?: Record<string, string | undefined>;
  user?: { id: string } | null;
  /** What start_quote_document_upload answers with as the agent. */
  startError?: { code?: string; message?: string };
  /** What attach_quote_document answers with as the agent. */
  attachError?: { code?: string; message?: string };
  storeError?: unknown;
  scan?: (body: Uint8Array) => Response | Promise<Response>;
}

const setup = (opts: Setup = {}) => {
  const env = { ...ENV, ...opts.env };
  const logs: string[] = [];
  const rpcs: { fn: string; args: Record<string, unknown>; key: string; auth?: string }[] = [];
  const stored: { bucket: string; path: string; bytes: Uint8Array; options: unknown; key: string }[] = [];
  const createClient = vi.fn((_url: string, key: string, options?: { global?: { headers: Record<string, string> } }): QuoteDocumentClient => ({
    auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: USER } : opts.user } }) },
    rpc: async (fn, args) => {
      rpcs.push({ fn, args, key, auth: options?.global?.headers.Authorization });
      if (fn === "start_quote_document_upload") {
        return opts.startError ? { data: null, error: opts.startError } : { data: { attachment_id: 51, message_id: 41, folder: `${INTAKE}/41` }, error: null };
      }
      if (fn === "attach_quote_document" && opts.attachError) return { data: null, error: opts.attachError };
      return { data: null, error: null };
    },
    storage: {
      from: (bucket) => ({
        upload: async (path, bytes, options) => {
          stored.push({ bucket, path, bytes, options, key });
          return { data: opts.storeError ? null : { path }, error: opts.storeError ?? null };
        },
      }),
    },
  }));
  const scanFetch = vi.fn(async (_url: string, init: RequestInit) => {
    const body = init.body as Uint8Array;
    if (opts.scan) return opts.scan(body);
    const infected = new TextDecoder().decode(body).includes(EICAR);
    return new Response(JSON.stringify(infected ? { verdict: "infected", signature: "Eicar-Test-Signature" } : { verdict: "clean" }), { status: 200 });
  });
  const alerts: unknown[] = [];
  const deps: QuoteDocumentDeps = {
    env: (name) => env[name],
    createClient,
    scanner: { fetch: scanFetch as unknown as typeof fetch, connect: vi.fn(), timeoutMs: 1_000 },
    fetch: (async (_url: string, init?: RequestInit) => {
      alerts.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch,
    log: (line) => logs.push(line),
    newRequestId: () => REQUEST,
  };
  return { deps, logs, rpcs, stored, alerts, scanFetch };
};

// A multipart body as a browser sends it, built by hand so it is the same bytes in any test environment.
const BOUNDARY = "----test-boundary-7MA4YWxkTrZu0gW";
type Upload = { bytes: Uint8Array; name: string };
const multipart = (fields: { quote_id?: string; file?: Upload }): Uint8Array => {
  const enc = (x: string) => new TextEncoder().encode(x);
  const parts: Uint8Array[] = [];
  if (fields.quote_id !== undefined) parts.push(enc(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="quote_id"\r\n\r\n${fields.quote_id}\r\n`));
  if (fields.file) {
    parts.push(enc(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${fields.file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`), fields.file.bytes, enc("\r\n"));
  }
  parts.push(enc(`--${BOUNDARY}--\r\n`));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const post = (fields: { quote_id?: string; file?: Upload }, headers: Record<string, string> = { Authorization: "Bearer agent-jwt" }) =>
  new Request("https://functions.test/quote-document-upload", {
    method: "POST",
    headers: { ...headers, "Content-Type": `multipart/form-data; boundary=${BOUNDARY}` },
    body: multipart(fields) as Uint8Array<ArrayBuffer>,
  });
const file = (bytes: Uint8Array, name: string): Upload => ({ bytes, name });
const read = async (r: Response) => ({ status: r.status, body: await r.json() });

describe("quote-document-upload: a quote document recorded by hand, an upload like any other (ADR 0002)", () => {
  // Catches: a file kept without its scan, or kept somewhere the thread and its signed links don't know, or never named as the quote's document.
  it("starts the upload as the agent, scans the file, keeps a clean one in peo-mail under its message and names it as the quote's document", async () => {
    const t = setup();
    const { status, body } = await read(await handleQuoteDocumentUpload(post({ quote_id: "3", file: file(PDF, "Insperity quote.pdf") }), t.deps));
    expect(status).toBe(200);
    expect(body).toEqual({ document: { attachment_id: 51, file_name: "Insperity quote.pdf", status: "stored" }, request_id: REQUEST });
    expect(t.rpcs.find((r) => r.fn === "start_quote_document_upload")).toMatchObject({
      key: "anon-key", auth: "Bearer agent-jwt", args: { p_quote_id: 3, p_file_name: "Insperity quote.pdf", p_size_bytes: PDF.length },
    });
    expect(t.stored).toHaveLength(1);
    expect(t.stored[0]).toMatchObject({ bucket: "peo-mail", key: "service-key", options: { contentType: STORED_CONTENT_TYPE, upsert: true } });
    expect(t.stored[0].path).toMatch(new RegExp(`^${INTAKE}/41/51-`));
    const finish = t.rpcs.find((r) => r.fn === "finish_inbound_attachment")!;
    expect(finish).toMatchObject({ key: "service-key", args: { p_attachment_id: 51, p_verdict: "clean", p_bucket: "peo-mail", p_path: t.stored[0].path } });
    expect(t.rpcs.find((r) => r.fn === "attach_quote_document")).toMatchObject({ key: "anon-key", auth: "Bearer agent-jwt", args: { p_quote_id: 3, p_attachment_id: 51 } });
  });

  // Catches: a program, or a file that isn't what its name says, kept as a quote document, or an upload recorded on the thread before its bytes were looked at.
  it("refuses a file that is not what its name says, or an executable, before anything is recorded", async () => {
    const t = setup();
    const renamed = await read(await handleQuoteDocumentUpload(post({ quote_id: "3", file: file(new TextEncoder().encode("MZ\u0090 not a pdf"), "quote.pdf") }), t.deps));
    expect(renamed.status).toBe(415);
    expect(renamed.body.code).toBe("mismatch");
    const exe = await read(await handleQuoteDocumentUpload(post({ quote_id: "3", file: file(new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03]), "quote.exe") }), t.deps));
    expect(exe.status).toBe(415);
    expect(exe.body.code).toBe("executable");
    expect(t.rpcs).toEqual([]);
    expect(t.stored).toEqual([]);
  });

  // Catches: a file kept with no scan because the scanner isn't set up, or an upload left pending on the thread with nothing able to scan it.
  it("refuses everything, recording nothing, while no scanner is set up", async () => {
    const t = setup({ env: { MALWARE_SCANNER: "" , MALWARE_SCANNER_URL: undefined } });
    const { status, body } = await read(await handleQuoteDocumentUpload(post({ quote_id: "3", file: file(PDF, "quote.pdf") }), t.deps));
    expect(status).toBe(503);
    expect(body.code).toBe("scanner_missing");
    expect(t.rpcs).toEqual([]);
    expect(t.stored).toEqual([]);
    expect(t.logs.join("\n")).toContain("SCAN_CONFIG_MISSING");
  });

  // Catches: a file the scanner flagged kept readable, named as a quote's document, or left unalerted.
  it("settles a file with malware as blocked with its signature, drops its bytes, alerts, and names no document", async () => {
    const t = setup({ scan: () => new Response(JSON.stringify({ verdict: "infected", signature: "Eicar-Test-Signature" }), { status: 200 }) });
    const { status, body } = await read(await handleQuoteDocumentUpload(post({ quote_id: "3", file: file(PDF, "quote.pdf") }), t.deps));
    expect(status).toBe(200);
    expect(body.document).toEqual({ attachment_id: 51, file_name: "quote.pdf", status: "blocked" });
    expect(t.stored).toEqual([]);
    expect(t.rpcs.find((r) => r.fn === "finish_inbound_attachment")?.args).toEqual({ p_attachment_id: 51, p_verdict: "infected", p_signature: "Eicar-Test-Signature" });
    expect(t.rpcs.some((r) => r.fn === "attach_quote_document")).toBe(false);
    expect(t.logs.join("\n")).toContain("MALWARE_DETECTED source=quote-document-upload attachment=51");
    expect(t.alerts).toHaveLength(1);
  });
});
