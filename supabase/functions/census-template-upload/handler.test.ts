import { describe, expect, it, vi } from "vitest";
import { EICAR } from "../_shared/eicar";
import { STORED_CONTENT_TYPE } from "../_shared/fileSignature";
import { handleTemplateUpload, type TemplateClient, type TemplateDeps } from "./handler";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REQUEST = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const ENV: Record<string, string | undefined> = {
  SUPABASE_URL: "https://project.test",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  MALWARE_SCANNER: "http",
  MALWARE_SCANNER_URL: "https://scan.example.com/scan",
  MALWARE_SCANNER_TOKEN: "scan-token",
  ENGINEERING_ALERT_WEBHOOK_URL: "https://hooks.example.com/alerts",
};

// An .xlsx is a zip file: its bytes start "PK\x03\x04".
const XLSX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 8, 0, ...new Array(40).fill(1)]);
const CSV = new TextEncoder().encode("Last Name,First Name\n");

interface Setup {
  env?: Record<string, string | undefined>;
  user?: { id: string } | null;
  /** What admin_register_census_template answers with; an admin by default. */
  registerError?: { code?: string; message?: string };
  storeError?: unknown;
  /** The scanner's answer; by default EICAR is malware and everything else clean. */
  scan?: (body: Uint8Array) => Response | Promise<Response>;
}

const setup = (opts: Setup = {}) => {
  const env = { ...ENV, ...opts.env };
  const logs: string[] = [];
  const rpcs: { fn: string; args: Record<string, unknown>; key: string; auth?: string }[] = [];
  const stored: { bucket: string; path: string; bytes: Uint8Array; options: unknown; key: string }[] = [];
  const createClient = vi.fn((_url: string, key: string, options?: { global?: { headers: Record<string, string> } }): TemplateClient => ({
    auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: ADMIN } : opts.user } }) },
    rpc: async (fn, args) => {
      rpcs.push({ fn, args, key, auth: options?.global?.headers.Authorization });
      if (fn === "admin_register_census_template") {
        return opts.registerError ? { data: null, error: opts.registerError } : { data: { id: 12, storage_path: "5/12.xlsx" }, error: null };
      }
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
  const deps: TemplateDeps = {
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
const multipart = (fields: { peo_id?: string; file?: Upload }): Uint8Array => {
  const enc = (x: string) => new TextEncoder().encode(x);
  const parts: Uint8Array[] = [];
  if (fields.peo_id !== undefined) parts.push(enc(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="peo_id"\r\n\r\n${fields.peo_id}\r\n`));
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
const post = (fields: { peo_id?: string; file?: Upload }, headers: Record<string, string> = { Authorization: "Bearer admin-jwt" }) =>
  new Request("https://functions.test/census-template-upload", {
    method: "POST",
    headers: { ...headers, "Content-Type": `multipart/form-data; boundary=${BOUNDARY}` },
    body: multipart(fields) as Uint8Array<ArrayBuffer>,
  });
const file = (bytes: Uint8Array, name: string): Upload => ({ bytes, name });
const read = async (r: Response) => ({ status: r.status, body: await r.json() });

describe("census-template-upload: a PEO's own census template, an upload like any other (ADR 0002)", () => {
  it("records it as the admin, scans it, stores a clean one in peo-templates and records it clean", async () => {
    const t = setup();
    const { status, body } = await read(await handleTemplateUpload(post({ peo_id: "5", file: file(XLSX, "TriNet census.xlsx") }), t.deps));
    expect(status).toBe(200);
    expect(body).toEqual({ template: { id: 12, file_name: "TriNet census.xlsx", scan_status: "clean" }, request_id: REQUEST });
    const register = t.rpcs.find((r) => r.fn === "admin_register_census_template")!;
    expect(register).toMatchObject({ key: "anon-key", auth: "Bearer admin-jwt", args: { p_peo_id: 5, p_file_name: "TriNet census.xlsx", p_size_bytes: XLSX.length } });
    expect(register.args.p_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(t.stored).toEqual([{ bucket: "peo-templates", path: "5/12.xlsx", bytes: XLSX, options: { contentType: STORED_CONTENT_TYPE, upsert: false }, key: "service-key" }]);
    expect(t.rpcs.find((r) => r.fn === "record_census_template_scan")).toMatchObject({ key: "service-key", args: { p_template_id: 12, p_verdict: "clean", p_signature: null } });
  });

  it("keeps a template with malware in quarantine, records it blocked, alerts, and says it can't be used", async () => {
    const t = setup();
    const { status } = await read(await handleTemplateUpload(post({ peo_id: "5", file: file(new TextEncoder().encode(EICAR), "template.xlsx") }), t.deps));
    // EICAR isn't a zip: it never reaches the scanner as an xlsx.
    expect(status).toBe(415);
    expect(t.scanFetch).not.toHaveBeenCalled();

    const infected = setup({ scan: () => new Response(JSON.stringify({ verdict: "infected", signature: "Eicar-Test-Signature" }), { status: 200 }) });
    const res = await read(await handleTemplateUpload(post({ peo_id: "5", file: file(XLSX, "template.xlsx") }), infected.deps));
    expect(res.status).toBe(200);
    expect(res.body.template).toEqual({ id: 12, file_name: "template.xlsx", scan_status: "blocked" });
    expect(infected.stored.map((s) => [s.bucket, s.path])).toEqual([["quarantine", "templates/5/12.xlsx"]]);
    expect(infected.rpcs.find((r) => r.fn === "record_census_template_scan")?.args).toEqual({ p_template_id: 12, p_verdict: "blocked", p_signature: "Eicar-Test-Signature" });
    expect(infected.logs.join("\n")).toContain("MALWARE_DETECTED source=census-template-upload template=12 peo=5");
    expect(infected.alerts).toHaveLength(1);
  });

  it("records one the scanner can't check now as failed, kept in quarantine, to be uploaded again: never held with no way out", async () => {
    const t = setup({ scan: () => new Response("busy", { status: 503 }) });
    const { status, body } = await read(await handleTemplateUpload(post({ peo_id: "5", file: file(XLSX, "template.xlsx") }), t.deps));
    expect(status).toBe(200);
    expect(body.template.scan_status).toBe("failed");
    expect(t.stored.map((s) => s.bucket)).toEqual(["quarantine"]);
    expect(t.rpcs.find((r) => r.fn === "record_census_template_scan")?.args).toMatchObject({ p_verdict: "failed", p_signature: null });
    expect(t.logs.join("\n")).toContain("TEMPLATE_SCAN_FAILED request=cccccccc-cccc-4ccc-8ccc-cccccccccccc template=12");
  });

  it("refuses anything but an xlsx, and stores and records nothing", async () => {
    for (const f of [file(CSV, "census.csv"), file(CSV, "census.xlsx"), file(new Uint8Array(0), "empty.xlsx")]) {
      const t = setup();
      const { status, body } = await read(await handleTemplateUpload(post({ peo_id: "5", file: f }), t.deps));
      expect([415, 422]).toContain(status);
      expect(body.code).toMatch(/unsupported|mismatch|empty/);
      expect(t.rpcs).toEqual([]);
      expect(t.stored).toEqual([]);
    }
  });

  it("refuses with no scanner set, before anything is read, stored or recorded (ADR 0002)", async () => {
    const t = setup({ env: { MALWARE_SCANNER: undefined } });
    const { status, body } = await read(await handleTemplateUpload(post({ peo_id: "5", file: file(XLSX, "template.xlsx") }), t.deps));
    expect(status).toBe(503);
    expect(body.code).toBe("scanner_missing");
    expect(t.rpcs).toEqual([]);
    expect(t.stored).toEqual([]);
  });

  it("leaves it to the database who may upload: someone not an admin is refused, and nothing is stored", async () => {
    const t = setup({ registerError: { code: "42501", message: "Only an admin uploads a PEO's template" } });
    const { status, body } = await read(await handleTemplateUpload(post({ peo_id: "5", file: file(XLSX, "template.xlsx") }), t.deps));
    expect(status).toBe(403);
    expect(body.code).toBe("forbidden");
    expect(t.stored).toEqual([]);
    expect(t.scanFetch).not.toHaveBeenCalled();
  });

  it("refuses a request with no one signed in, or no PEO", async () => {
    expect((await handleTemplateUpload(post({ peo_id: "5", file: file(XLSX, "t.xlsx") }, {}), setup().deps)).status).toBe(401);
    expect((await handleTemplateUpload(post({ peo_id: "5", file: file(XLSX, "t.xlsx") }), setup({ user: null }).deps)).status).toBe(401);
    expect((await handleTemplateUpload(post({ peo_id: "TriNet", file: file(XLSX, "t.xlsx") }), setup().deps)).status).toBe(400);
  });

  it("says the file couldn't be stored, and records it failed so it is never taken for one still being checked", async () => {
    const t = setup({ storeError: { statusCode: "500" } });
    const { status, body } = await read(await handleTemplateUpload(post({ peo_id: "5", file: file(XLSX, "template.xlsx") }), t.deps));
    expect(status).toBe(502);
    expect(body.code).toBe("storage");
    expect(t.rpcs.find((r) => r.fn === "record_census_template_scan")?.args).toMatchObject({ p_template_id: 12, p_verdict: "failed" });
  });
});
