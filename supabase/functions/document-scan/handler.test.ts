import { describe, expect, it, vi } from "vitest";
import { EICAR } from "../_shared/eicar";
import { STORED_CONTENT_TYPE } from "../_shared/fileSignature";
import { handleScanRequest, retryDelaySeconds, type ScanClient, type ScanDeps } from "./handler";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INTAKE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DOC = "ffffffff-ffff-4fff-8fff-ffffffffffff";
// The stored path carries the prospect's file name, which must never reach a log or an alert.
const PATH = `${USER}/${INTAKE}/11111111_Secret_Payroll.csv`;

const ENV: Record<string, string | undefined> = {
  SUPABASE_URL: "https://project.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  MALWARE_SCANNER: "http",
  MALWARE_SCANNER_URL: "https://scan.example.com/scan",
  MALWARE_SCANNER_TOKEN: "scan-token",
  ENGINEERING_ALERT_WEBHOOK_URL: "https://hooks.example.com/alerts",
};

const encode = (s: string) => new TextEncoder().encode(s);
const CLEAN = encode("First,Last\nAnn,Lee\n");

interface Claim {
  document_id: string;
  storage_path: string;
  attempt: number;
  bucket: "quarantine" | "documents" | null;
}

interface Setup {
  env?: Record<string, string | undefined>;
  claims?: Claim[];
  /** What each bucket holds, by path. */
  files?: Partial<Record<"quarantine" | "documents", Record<string, Uint8Array>>>;
  failOutcome?: "retrying" | "failed" | "gone";
  recordError?: { code?: string };
  orphans?: string[];
  scan?: (body: Uint8Array) => Response;
  /** What intake_accepts_files answers after a copy (false: the intake is being deleted). */
  accepts?: boolean;
}

const setup = (opts: Setup = {}) => {
  const env = { ...ENV, ...opts.env };
  const steps: string[] = [];
  const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
  const uploads: { bucket: string; path: string; options: unknown }[] = [];
  const logs: string[] = [];
  const queue = [...(opts.claims ?? [])];
  const client: ScanClient = {
    rpc: async (fn, args) => {
      rpcs.push({ fn, args });
      steps.push(fn);
      if (fn === "claim_document_scans") return { data: queue.splice(0, Number(args.p_batch)), error: null };
      if (fn === "record_document_scan") return { data: args.p_verdict, error: opts.recordError ?? null };
      if (fn === "fail_document_scan") return { data: opts.failOutcome ?? "retrying", error: null };
      if (fn === "document_scan_orphans") return { data: (opts.orphans ?? []).map((name) => ({ name })), error: null };
      if (fn === "intake_accepts_files") return { data: opts.accepts ?? true, error: null };
      return { data: null, error: null };
    },
    storage: {
      from: (bucket) => ({
        download: async (path) => {
          steps.push(`download:${bucket}`);
          const bytes = opts.files?.[bucket as "quarantine" | "documents"]?.[path];
          if (!bytes) return { data: null, error: { statusCode: "404" } };
          // The test environment's Blob lacks arrayBuffer(); the handler needs only this.
          return { data: { size: bytes.length, arrayBuffer: async () => bytes.buffer } as unknown as Blob, error: null };
        },
        upload: async (path, _bytes, options) => {
          steps.push(`upload:${bucket}`);
          uploads.push({ bucket, path, options });
          return { data: { path }, error: null };
        },
        remove: async (paths) => {
          steps.push(`remove:${bucket}`);
          return { data: paths.map((name) => ({ name })), error: null };
        },
      }),
    },
  };
  const scanFetch = vi.fn(async (_url: string, init: RequestInit) => {
    const body = init.body as Uint8Array;
    steps.push("scan");
    if (opts.scan) return opts.scan(body);
    const infected = new TextDecoder().decode(body).includes(EICAR);
    return new Response(JSON.stringify(infected ? { verdict: "infected", signature: "Eicar-Signature" } : { verdict: "clean" }), { status: 200 });
  });
  const alerts: Record<string, unknown>[] = [];
  const alertFetch = vi.fn(async (_url: string, init: RequestInit) => {
    alerts.push(JSON.parse(String(init.body)));
    return new Response(null, { status: 200 });
  });
  let clock = 0;
  const deps: ScanDeps = {
    env: (name) => env[name],
    createClient: vi.fn(() => client),
    scanner: { fetch: scanFetch as unknown as typeof fetch, connect: vi.fn(), timeoutMs: 1_000 },
    fetch: alertFetch as unknown as typeof fetch,
    now: () => (clock += 10),
    log: (line) => logs.push(line),
  };
  return { deps, steps, rpcs, uploads, logs, alerts, scanFetch };
};

const scheduled = (key = "service-key") =>
  new Request("https://functions.test/document-scan", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: "{}" });
const run = async (t: ReturnType<typeof setup>, request = scheduled()) => {
  const response = await handleScanRequest(request, t.deps);
  return { status: response.status, body: await response.json() };
};
const claim = (over: Partial<Claim> = {}): Claim => ({ document_id: DOC, storage_path: PATH, attempt: 1, bucket: "quarantine", ...over });

describe("document-scan: who may run it", () => {
  it("is the schedule's alone: anyone else, signed in or not, is refused before anything moves", async () => {
    for (const request of [scheduled("user-jwt"), new Request("https://functions.test/document-scan", { method: "POST" })]) {
      const t = setup({ claims: [claim()] });
      expect((await run(t, request)).status).toBe(401);
      expect(t.steps).toEqual([]);
    }
    expect((await run(setup(), new Request("https://functions.test/document-scan"))).status).toBe(405);
  });

  it("says what is missing when its Supabase secrets aren't set", async () => {
    const t = setup({ env: { SUPABASE_SERVICE_ROLE_KEY: undefined } });
    expect((await run(t)).status).toBe(503);
    expect(t.logs).toEqual(["SCAN_CONFIG_MISSING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set"]);
  });
});

describe("document-scan: settling pending uploads", () => {
  it("moves a clean file out of quarantine: copied into documents, recorded, then the quarantined copy removed", async () => {
    const t = setup({ claims: [claim()], files: { quarantine: { [PATH]: CLEAN } } });
    const { body } = await run(t);
    expect(body).toMatchObject({ claimed: 1, clean: 1, infected: 0, retrying: 0 });
    expect(t.steps).toEqual([
      "claim_document_scans", "download:quarantine", "scan", "upload:documents", "intake_accepts_files", "record_document_scan", "remove:quarantine",
      "claim_document_scans", "document_scan_orphans",
    ]);
    expect(t.rpcs.find((r) => r.fn === "intake_accepts_files")?.args).toEqual({ p_session: INTAKE });
    expect(t.uploads).toEqual([{ bucket: "documents", path: PATH, options: { contentType: STORED_CONTENT_TYPE, upsert: true } }]);
    expect(t.rpcs.find((r) => r.fn === "record_document_scan")?.args).toEqual({ p_document_id: DOC, p_verdict: "clean", p_signature: null, p_source: "document-scan" });
  });

  it("quarantines an infected upload from before scanning: recorded first (withheld at once), moved, and alerted", async () => {
    const t = setup({ claims: [claim({ bucket: "documents" })], files: { documents: { [PATH]: encode(EICAR) } } });
    const { body } = await run(t);
    expect(body).toMatchObject({ infected: 1 });
    expect(t.steps.slice(0, 7)).toEqual(["claim_document_scans", "download:documents", "scan", "record_document_scan", "upload:quarantine", "remove:documents", "intake_accepts_files"]);
    expect(t.alerts).toEqual([expect.objectContaining({ alert: "MALWARE_DETECTED", source: "document-scan", document: DOC, intake: INTAKE, signature: "Eicar-Signature" })]);
    expect(t.logs).toEqual([`MALWARE_DETECTED source=document-scan document=${DOC} engine=http signature=Eicar-Signature`]);
  });

  it("leaves an infected file in quarantine where it is", async () => {
    const t = setup({ claims: [claim()], files: { quarantine: { [PATH]: encode(EICAR) } } });
    await run(t);
    expect(t.steps.filter((s) => s.startsWith("upload") || s.startsWith("remove"))).toEqual([]);
    expect(t.alerts).toHaveLength(1);
  });

  it("tries again later, with backoff, when the scanner can't answer", async () => {
    const t = setup({ claims: [claim({ attempt: 2 })], files: { quarantine: { [PATH]: CLEAN } }, scan: () => new Response("", { status: 503 }) });
    const { body } = await run(t);
    expect(body).toMatchObject({ retrying: 1, clean: 0 });
    expect(t.rpcs.find((r) => r.fn === "fail_document_scan")?.args).toEqual({ p_document_id: DOC, p_error: "http:503", p_retry_in_seconds: 900 });
    expect(t.steps).not.toContain("record_document_scan");
    expect(t.logs).toEqual([`SCAN_RETRY document=${DOC} attempt=2 reason=http:503 retry_in=900s`]);
  });

  it("alerts when an upload gives up after its last attempt", async () => {
    const t = setup({ claims: [claim({ attempt: 6, bucket: null })], failOutcome: "failed" });
    const { body } = await run(t);
    expect(body).toMatchObject({ failed: 1 });
    expect(t.steps).not.toContain("download:quarantine");
    expect(t.rpcs.find((r) => r.fn === "fail_document_scan")?.args).toMatchObject({ p_error: "file_missing" });
    expect(t.alerts).toEqual([expect.objectContaining({ alert: "SCAN_FAILED", document: DOC, attempts: 6, reason: "file_missing" })]);
    expect(t.logs).toEqual([`SCAN_FAILED document=${DOC} attempts=6 reason=file_missing`]);
  });

  it("takes back the copy it made when the document was removed while it was scanned", async () => {
    const t = setup({ claims: [claim()], files: { quarantine: { [PATH]: CLEAN } }, recordError: { code: "PT404" } });
    const { body } = await run(t);
    expect(body).toMatchObject({ gone: 1, clean: 0 });
    expect(t.steps.slice(0, 7)).toEqual(["claim_document_scans", "download:quarantine", "scan", "upload:documents", "intake_accepts_files", "record_document_scan", "remove:documents"]);
  });

  it("takes back a copy made while the intake's deletion was checking its files (SR-15)", async () => {
    const t = setup({ claims: [claim()], files: { quarantine: { [PATH]: CLEAN } }, accepts: false });
    const { body } = await run(t);
    expect(body).toMatchObject({ gone: 1, clean: 0 });
    expect(t.steps.slice(0, 6)).toEqual(["claim_document_scans", "download:quarantine", "scan", "upload:documents", "intake_accepts_files", "remove:documents"]);
    expect(t.steps).not.toContain("record_document_scan");
  });

  it("holds everything, claims nothing and records an alertable event when no scanner is set up", async () => {
    const t = setup({ env: { MALWARE_SCANNER: undefined }, claims: [claim()] });
    const { body } = await run(t);
    expect(body).toMatchObject({ claimed: 0 });
    expect(t.rpcs.map((r) => r.fn)).toEqual(["record_ops_event", "document_scan_orphans"]);
    expect(t.rpcs[0].args).toEqual({ p_kind: "scan_failed", p_source: "document-scan", p_code: "config_missing" });
    expect(t.scanFetch).not.toHaveBeenCalled();
  });

  it("removes quarantined copies nothing holds any more", async () => {
    const t = setup({ orphans: [PATH, `${USER}/${INTAKE}/22222222_x.pdf`] });
    const { body } = await run(t);
    expect(body).toMatchObject({ orphans_removed: 2 });
    expect(t.steps).toEqual(["claim_document_scans", "document_scan_orphans", "remove:quarantine"]);
  });

  it("never logs or alerts a file name", async () => {
    const t = setup({
      claims: [claim(), claim({ document_id: "d2", bucket: "documents" }), claim({ document_id: "d3", bucket: null })],
      files: { quarantine: { [PATH]: encode(EICAR) }, documents: { [PATH]: encode(EICAR) } },
      failOutcome: "failed",
    });
    await run(t);
    expect(t.alerts.length).toBeGreaterThan(0);
    for (const line of [...t.logs, JSON.stringify(t.alerts)]) expect(line).not.toMatch(/Secret|Payroll/);
  });

  it("backs off from five minutes to twelve hours", () => {
    expect([1, 2, 3, 4, 5, 6].map(retryDelaySeconds)).toEqual([300, 900, 3_600, 14_400, 43_200, 43_200]);
  });
});
