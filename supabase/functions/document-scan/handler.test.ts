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
  session_id: string | null;
}

interface WithheldRow {
  storage_path: string;
  session_id: string | null;
  verdict: "pending" | "infected";
  evidence: boolean;
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
  /** Files whose document was removed before its scan passed (withheld_files_due). */
  withheld?: WithheldRow[];
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
      if (fn === "withheld_files_due") return { data: opts.withheld ?? [], error: null };
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
const claim = (over: Partial<Claim> = {}): Claim => ({ document_id: DOC, storage_path: PATH, attempt: 1, bucket: "quarantine", session_id: INTAKE, ...over });

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
      "claim_document_scans", "withheld_files_due", "document_scan_orphans",
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

  it("gives up on a document with no stored file, and alerts once for the run however many there are", async () => {
    // Forged rows (written straight through the API) or uploads that failed half way: each one fails, and the
    // channel gets one SCAN_FAILED with the count, not one per document.
    const claims = Array.from({ length: 25 }, (_, i) => claim({ document_id: `d${i}`, bucket: null }));
    const t = setup({ claims: [...claims, claim({ document_id: "d-timeout", attempt: 6 })], files: { quarantine: { [PATH]: CLEAN } }, failOutcome: "failed", scan: () => new Response("", { status: 504 }) });
    const { body } = await run(t);
    expect(body).toMatchObject({ failed: 26 });
    expect(t.rpcs.filter((r) => r.fn === "fail_document_scan").map((r) => r.args.p_error)).toEqual([...Array(25).fill("file_missing"), "http:504"]);
    expect(t.steps.filter((s) => s === "download:quarantine")).toHaveLength(1);
    expect(t.alerts).toEqual([
      expect.objectContaining({ alert: "SCAN_FAILED", source: "document-scan", count: 26, reasons: "file_missing x25, http:504 x1" }),
    ]);
    expect(t.logs).toContain("SCAN_FAILED document=d0 attempts=1 reason=file_missing");
  });

  it("names the intake from the row, so an upload from before intakes never puts its file name in an alert", async () => {
    // Stored as {user}/{uuid}_{name}, with no intake folder: the path's second part is the file name.
    const legacy = `${USER}/11111111-1111-1111-1111-111111111111_Secret_Payroll.csv`;
    const t = setup({ claims: [claim({ storage_path: legacy, bucket: "documents", session_id: null })], files: { documents: { [legacy]: encode(EICAR) } } });
    await run(t);
    expect(t.alerts).toEqual([expect.objectContaining({ alert: "MALWARE_DETECTED", intake: null })]);
    // No intake, so no intake deletion to race: the move into quarantine stands.
    expect(t.steps).not.toContain("intake_accepts_files");
    expect(t.steps.filter((s) => s.startsWith("upload") || s.startsWith("remove"))).toEqual(["upload:quarantine", "remove:documents"]);
    for (const line of [...t.logs, JSON.stringify(t.alerts)]) expect(line).not.toMatch(/Secret|Payroll/);
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
    expect(t.rpcs.map((r) => r.fn)).toEqual(["record_ops_event", "withheld_files_due", "document_scan_orphans"]);
    expect(t.rpcs[0].args).toEqual({ p_kind: "scan_failed", p_source: "document-scan", p_code: "config_missing" });
    expect(t.scanFetch).not.toHaveBeenCalled();
  });

  it("removes quarantined copies nothing holds any more", async () => {
    const t = setup({ orphans: [PATH, `${USER}/${INTAKE}/22222222_x.pdf`] });
    const { body } = await run(t);
    expect(body).toMatchObject({ orphans_removed: 2 });
    expect(t.steps).toEqual(["claim_document_scans", "withheld_files_due", "document_scan_orphans", "remove:quarantine"]);
  });

  describe("files whose document was removed before its scan passed", () => {
    const withheld = (over: Partial<WithheldRow> = {}): WithheldRow => ({ storage_path: PATH, session_id: INTAKE, verdict: "pending", evidence: false, bucket: "documents", ...over });
    const settles = (t: ReturnType<typeof setup>) => t.rpcs.filter((r) => r.fn === "settle_withheld_file").map((r) => r.args);

    it("deletes one that isn't a certified file from both buckets, unscanned, then ends its record", async () => {
      const t = setup({ withheld: [withheld()] });
      const { body } = await run(t);
      expect(body).toMatchObject({ withheld_removed: 1 });
      expect(t.steps).toEqual(["claim_document_scans", "withheld_files_due", "remove:documents", "remove:quarantine", "settle_withheld_file", "document_scan_orphans"]);
      expect(settles(t)).toEqual([{ p_storage_path: PATH, p_outcome: "removed", p_signature: null }]);
      expect(t.scanFetch).not.toHaveBeenCalled();
    });

    it("ends the record of one whose file is already gone", async () => {
      const t = setup({ withheld: [withheld({ bucket: null })] });
      await run(t);
      expect(settles(t)).toEqual([{ p_storage_path: PATH, p_outcome: "removed", p_signature: null }]);
      expect(t.steps.filter((s) => s.startsWith("remove"))).toEqual([]);
    });

    it("scans a certified file kept for the advisor, and releases it from quarantine once clean", async () => {
      const t = setup({ withheld: [withheld({ evidence: true, bucket: "quarantine" })], files: { quarantine: { [PATH]: CLEAN } } });
      const { body } = await run(t);
      expect(body).toMatchObject({ withheld_released: 1 });
      expect(t.steps.slice(1, 8)).toEqual(["withheld_files_due", "download:quarantine", "scan", "upload:documents", "intake_accepts_files", "settle_withheld_file", "remove:quarantine"]);
      expect(settles(t)).toEqual([{ p_storage_path: PATH, p_outcome: "released", p_signature: null }]);
    });

    it("quarantines a certified file found infected, keeps it withheld, and alerts", async () => {
      const t = setup({ withheld: [withheld({ evidence: true })], files: { documents: { [PATH]: encode(EICAR) } } });
      const { body } = await run(t);
      expect(body).toMatchObject({ infected: 1 });
      expect(settles(t)).toEqual([{ p_storage_path: PATH, p_outcome: "infected", p_signature: "Eicar-Signature" }]);
      expect(t.steps.slice(1, 8)).toEqual(["withheld_files_due", "download:documents", "scan", "settle_withheld_file", "upload:quarantine", "intake_accepts_files", "remove:documents"]);
      expect(t.alerts).toEqual([expect.objectContaining({ alert: "MALWARE_DETECTED", intake: INTAKE, signature: "Eicar-Signature" })]);
    });

    it("leaves a certified file withheld, for the next run, when no scanner can check it, while still deleting the rest", async () => {
      const t = setup({ env: { MALWARE_SCANNER: undefined }, withheld: [withheld({ evidence: true, storage_path: "a" }), withheld({ storage_path: "b" })] });
      await run(t);
      expect(settles(t)).toEqual([{ p_storage_path: "b", p_outcome: "removed", p_signature: null }]);
      expect(t.steps).not.toContain("download:documents");
    });
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
