import { describe, expect, it, vi } from "vitest";
import { DOCUMENT_CATEGORIES as APP_CATEGORIES } from "../../../src/data/documentCategories";
import { EICAR } from "../_shared/eicar";
import { STORED_CONTENT_TYPE } from "../_shared/fileSignature";
import { DOCUMENT_CATEGORIES, handleUploadRequest, SCANNER_MISSING_MESSAGE, type UploadClient, type UploadDeps } from "./handler";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INTAKE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DOC = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const KEY_ID = "11111111-1111-4111-8111-111111111111";
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

const encode = (s: string) => new TextEncoder().encode(s);
// The start of a Windows program: "MZ", the DOS header and the "PE" signature.
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0, ...new Array(44).fill(0), 0x40, 0, 0, 0, 0x50, 0x45, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const CSV = encode("First,Last,State\nAnn,Lee,CA\n");

interface Setup {
  env?: Record<string, string | undefined>;
  user?: { id: string } | null;
  insertError?: { code?: string; message?: string };
  storeError?: unknown;
  recordError?: { code?: string };
  /** What intake_accepts_files answers once the file is stored (false: the intake is being deleted). */
  accepts?: boolean;
  /** What the scanning service answers; by default it flags EICAR and passes everything else. */
  scan?: (body: Uint8Array) => Response | Promise<Response>;
  /** What record_document_uploaded answers with (the funnel's record of the upload). */
  milestoneError?: { code?: string };
}

const setup = (opts: Setup = {}) => {
  const env = { ...ENV, ...opts.env };
  const logs: string[] = [];
  const inserts: { row: Record<string, unknown>; key: string; auth?: string }[] = [];
  const stored: { bucket: string; path: string; bytes: Uint8Array; options: unknown; key: string }[] = [];
  const deleted: { id: string; key: string }[] = [];
  const rpcs: { fn: string; args: Record<string, unknown>; key: string }[] = [];
  // The funnel's record of an upload (record_document_uploaded), kept apart from the scan's calls.
  const milestones: { document: unknown; key: string }[] = [];
  const removed: { bucket: string; paths: string[] }[] = [];
  const createClient = vi.fn((_url: string, key: string, options?: { global?: { headers: Record<string, string> } }): UploadClient => ({
    auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: USER } : opts.user } }) },
    rpc: async (fn, args) => {
      if (fn === "intake_accepts_files") return { data: opts.accepts ?? true, error: null };
      if (fn === "record_document_uploaded") {
        milestones.push({ document: args.p_document_id, key });
        return { data: true, error: opts.milestoneError ?? null };
      }
      rpcs.push({ fn, args, key });
      return { data: args.p_verdict ?? null, error: opts.recordError ?? null };
    },
    from: () => ({
      insert: (row) => ({
        select: () => ({
          single: async () => {
            inserts.push({ row, key, auth: options?.global?.headers.Authorization });
            if (opts.insertError) return { data: null, error: opts.insertError };
            return { data: { id: DOC, ...row, created_at: "2026-11-04T12:00:00Z", extraction: {}, processing_started_at: null, scan_verdict: "pending" }, error: null };
          },
        }),
      }),
      delete: () => ({
        eq: async (_column: string, id: string) => {
          deleted.push({ id, key });
          return { error: null };
        },
      }),
    }),
    storage: {
      from: (bucket) => ({
        upload: async (path, bytes, options) => {
          stored.push({ bucket, path, bytes, options, key });
          return { data: opts.storeError ? null : { path }, error: opts.storeError ?? null };
        },
        remove: async (paths) => {
          removed.push({ bucket, paths });
          return { data: paths.map((name) => ({ name })), error: null };
        },
      }),
    },
  }));
  const scanned: Uint8Array[] = [];
  const scanFetch = vi.fn(async (_url: string, init: RequestInit) => {
    const body = init.body as Uint8Array;
    scanned.push(body);
    if (opts.scan) return opts.scan(body);
    const infected = new TextDecoder().decode(body).includes(EICAR);
    return new Response(JSON.stringify(infected ? { verdict: "infected", signature: "Eicar-Signature" } : { verdict: "clean" }), { status: 200 });
  });
  const alerts: Record<string, unknown>[] = [];
  const alertFetch = vi.fn(async (_url: string, init: RequestInit) => {
    alerts.push(JSON.parse(String(init.body)));
    return new Response(null, { status: 200 });
  });
  const deps: UploadDeps = {
    env: (name) => env[name],
    createClient,
    scanner: { fetch: scanFetch as unknown as typeof fetch, connect: vi.fn(), timeoutMs: 1_000 },
    fetch: alertFetch as unknown as typeof fetch,
    log: (line) => logs.push(line),
    newRequestId: () => REQUEST,
    newId: () => KEY_ID,
  };
  return { deps, logs, inserts, stored, deleted, removed, rpcs, milestones, alerts, scanned, scanFetch };
};

// A multipart body as a browser sends it, built by hand so it is the same bytes in any test environment.
const BOUNDARY = "----test-boundary-7MA4YWxkTrZu0gW";
type Form = { session_id?: string; category?: string; file?: { bytes: Uint8Array; name: string } };
const multipart = (fields: Form): Uint8Array => {
  const parts: Uint8Array[] = [];
  const text = (s: string) => parts.push(encode(s));
  for (const name of ["session_id", "category"] as const) {
    const value = fields[name];
    if (value !== undefined) text(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  if (fields.file) {
    text(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${fields.file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
    parts.push(fields.file.bytes);
    text("\r\n");
  }
  text(`--${BOUNDARY}--\r\n`);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const post = (body: Form | string, headers: Record<string, string> = { Authorization: "Bearer user-jwt" }) =>
  new Request("https://functions.test/document-upload", {
    method: "POST",
    headers: typeof body === "string" ? { ...headers, "Content-Type": "application/json" } : { ...headers, "Content-Type": `multipart/form-data; boundary=${BOUNDARY}` },
    body: typeof body === "string" ? body : (multipart(body) as Uint8Array<ArrayBuffer>),
  });
const form = (fields: Form) => fields;
const upload = (bytes: Uint8Array, name: string, category = "employee_census") => post({ session_id: INTAKE, category, file: { bytes, name } });
const read = async (response: Response) => ({ status: response.status, body: await response.json() });

describe("document-upload: who may upload", () => {
  it("answers a preflight request without touching Supabase", async () => {
    const t = setup();
    const response = await handleUploadRequest(new Request("https://functions.test/document-upload", { method: "OPTIONS" }), t.deps);
    expect(response.status).toBe(200);
    expect(t.deps.createClient).not.toHaveBeenCalled();
  });

  it("refuses a caller who isn't signed in, with the answer the setup script's probe looks for", async () => {
    for (const request of [post(form({}), {}), upload(CSV, "a.csv")]) {
      const t = setup({ user: null });
      const { status, body } = await read(await handleUploadRequest(request, t.deps));
      expect(status).toBe(401);
      expect(body).toEqual({ error: "Unauthorized", code: "unauthorized", request_id: REQUEST });
      expect(t.inserts).toEqual([]);
      expect(t.stored).toEqual([]);
    }
  });
});

describe("document-upload: the bytes are checked before anything is stored (E-4.1)", () => {
  it("refuses a program renamed to .pdf and sent straight to the API: no row, no file, no scan", async () => {
    const t = setup();
    const { status, body } = await read(await handleUploadRequest(upload(EXE, "Invoice March.pdf"), t.deps));
    expect(status).toBe(415);
    expect(body.code).toBe("executable");
    expect(t.inserts).toEqual([]);
    expect(t.stored).toEqual([]);
    expect(t.scanned).toEqual([]);
    expect(t.logs).toEqual([`UPLOAD_REFUSED request=${REQUEST} user=${USER} reason=executable`]);
  });

  it.each([
    ["a PNG named .pdf", PNG, "scan.pdf", 415, "mismatch"],
    ["a PDF named .xlsx", encode("%PDF-1.7\n"), "census.xlsx", 415, "mismatch"],
    ["a file the intake doesn't take", encode("%PDF-1.7\n"), "census.exe", 415, "unsupported"],
    ["an empty file", new Uint8Array(0), "census.csv", 422, "empty"],
  ] as const)("refuses %s, storing nothing", async (_label, bytes, name, status, code) => {
    const t = setup();
    const answer = await read(await handleUploadRequest(upload(bytes, name), t.deps));
    expect(answer.status).toBe(status);
    expect(answer.body.code).toBe(code);
    expect(t.inserts).toEqual([]);
    expect(t.stored).toEqual([]);
  });

  it("refuses a body over 20 MB, by its declared length without reading it, or as it streams in", async () => {
    const t = setup();
    const declared = new Request("https://functions.test/document-upload", {
      method: "POST",
      headers: { Authorization: "Bearer user-jwt", "Content-Length": String(30 * 1024 * 1024), "Content-Type": "multipart/form-data; boundary=x" },
      body: "--x--",
    });
    expect((await read(await handleUploadRequest(declared, t.deps))).body.code).toBe("too_large");

    const big = new Uint8Array(21 * 1024 * 1024).fill(0x41);
    const streamed = new Request("https://functions.test/document-upload", {
      method: "POST",
      headers: { Authorization: "Bearer user-jwt", "Content-Type": "multipart/form-data; boundary=x" },
      body: new ReadableStream({
        start(controller) {
          for (let i = 0; i < big.length; i += 1 << 20) controller.enqueue(big.subarray(i, i + (1 << 20)));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
    expect((await read(await handleUploadRequest(streamed, t.deps))).status).toBe(413);
    expect(t.inserts).toEqual([]);
  });

  it.each([
    ["no intake", form({ category: "other", file: { bytes: CSV, name: "a.csv" } })],
    ["an intake that isn't an id", form({ session_id: "../other", category: "other", file: { bytes: CSV, name: "a.csv" } })],
    ["a category the intake doesn't have", form({ session_id: INTAKE, category: "malware", file: { bytes: CSV, name: "a.csv" } })],
    ["no file", form({ session_id: INTAKE, category: "other" })],
    ["a body that isn't form data", "{}"],
  ] as const)("refuses %s as a bad request", async (_label, body) => {
    const t = setup();
    const { status, body: answer } = await read(await handleUploadRequest(post(body), t.deps));
    expect(status).toBe(400);
    expect(answer.code).toBe("bad_request");
    expect(t.inserts).toEqual([]);
  });

  it("takes the categories the app offers, and only those", () => {
    expect([...DOCUMENT_CATEGORIES].sort()).toEqual(APP_CATEGORIES.map((c) => c.key).sort());
  });
});

describe("document-upload: storing and scanning (E-4.3)", () => {
  it("writes the row as the prospect, scans the bytes, then stores a clean file for reading", async () => {
    const t = setup();
    const { status, body } = await read(await handleUploadRequest(upload(CSV, "C:\\Users\\pat\\Employee Census.csv"), t.deps));
    expect(status).toBe(200);

    // The row is the prospect's own write: their token, so row security and the triggers decide.
    expect(t.inserts).toHaveLength(1);
    expect(t.inserts[0].key).toBe("anon-key");
    expect(t.inserts[0].auth).toBe("Bearer user-jwt");
    const path = `${USER}/${INTAKE}/${KEY_ID}_Employee_Census.csv`;
    expect(t.inserts[0].row).toEqual({
      user_id: USER,
      session_id: INTAKE,
      file_name: "Employee Census.csv",
      file_size: `${CSV.length} B`,
      size_bytes: CSV.length,
      mime_type: "text/csv",
      file_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      category: "employee_census",
      storage_path: path,
      status: "uploaded",
    });
    // No verdict from the browser's side: the row starts pending (documents_guard_scan).
    expect(t.inserts[0].row).not.toHaveProperty("scan_verdict");

    // The bytes received are the bytes scanned and the bytes stored.
    expect(t.scanned.map((b) => Array.from(b))).toEqual([Array.from(CSV)]);
    expect(t.stored.map(({ bytes, ...rest }) => ({ ...rest, bytes: Array.from(bytes) }))).toEqual([
      { bucket: "documents", path, bytes: Array.from(CSV), options: { contentType: STORED_CONTENT_TYPE, upsert: false }, key: "service-key" },
    ]);
    expect(t.rpcs).toEqual([{ fn: "record_document_scan", args: { p_document_id: DOC, p_verdict: "clean", p_signature: null, p_source: "document-upload" }, key: "service-key" }]);
    expect(body.document).toMatchObject({ id: DOC, storage_path: path, scan_verdict: "clean" });
    expect(t.alerts).toEqual([]);
  });

  it("quarantines the EICAR test file, records the detection and alerts at once, naming no file", async () => {
    const t = setup();
    const { status, body } = await read(await handleUploadRequest(upload(encode(EICAR), "Payroll Register.csv", "payroll_report"), t.deps));
    expect(status).toBe(200);
    expect(body.document.scan_verdict).toBe("infected");
    expect(t.stored.map((s) => s.bucket)).toEqual(["quarantine"]);
    expect(t.rpcs[0]).toMatchObject({ fn: "record_document_scan", args: { p_document_id: DOC, p_verdict: "infected", p_signature: "Eicar-Signature" } });

    expect(t.alerts).toHaveLength(1);
    expect(t.alerts[0]).toMatchObject({ alert: "MALWARE_DETECTED", source: "document-upload", document: DOC, intake: INTAKE, signature: "Eicar-Signature" });
    expect(t.logs).toContain(`MALWARE_DETECTED source=document-upload document=${DOC} intake=${INTAKE} engine=http signature=Eicar-Signature`);
    for (const line of [...t.logs, JSON.stringify(t.alerts)]) expect(line).not.toMatch(/Payroll/);
  });

  it("holds a file in quarantine when the scanner can't answer, for document-scan to retry", async () => {
    const t = setup({ scan: () => new Response("busy", { status: 503 }) });
    const { body } = await read(await handleUploadRequest(upload(CSV, "a.csv"), t.deps));
    expect(body.document.scan_verdict).toBe("pending");
    expect(t.stored.map((s) => s.bucket)).toEqual(["quarantine"]);
    expect(t.rpcs).toEqual([]);
    expect(t.logs).toEqual([`SCAN_DEFERRED request=${REQUEST} document=${DOC} engine=http reason=http:503`]);
  });

  it("refuses every file when no scanner is set up: nothing stored or recorded, the prospect told, the setting logged", async () => {
    const t = setup({ env: { MALWARE_SCANNER: undefined } });
    const { status, body } = await read(await handleUploadRequest(upload(CSV, "a.csv"), t.deps));
    expect(status).toBe(503);
    expect(body).toEqual({ error: SCANNER_MISSING_MESSAGE, code: "scanner_missing", request_id: REQUEST });
    expect(t.inserts).toEqual([]);
    expect(t.stored).toEqual([]);
    expect(t.scanFetch).not.toHaveBeenCalled();
    // document-scan records the alertable event every five minutes; here it would be one row per request.
    expect(t.rpcs).toEqual([]);
    expect(t.logs[0]).toMatch(/^SCAN_CONFIG_MISSING: MALWARE_SCANNER is not set .*; uploads are refused until it is fixed/);
    expect(t.logs[1]).toBe(`UPLOAD_REFUSED request=${REQUEST} user=${USER} reason=scanner_missing`);
  });

  // Review finding (2026-11-05): the refusal comes before the intake or the body is checked, so recording an event per
  // refusal let any signed-in guest write unlimited ops_events rows.
  it("writes nothing however many times a refused upload is repeated", async () => {
    const t = setup({ env: { MALWARE_SCANNER: undefined } });
    for (let i = 0; i < 50; i++) {
      const empty = new Request("https://project.test/functions/v1/document-upload", { method: "POST", headers: { Authorization: "Bearer t" } });
      expect((await handleUploadRequest(empty, t.deps)).status).toBe(503);
    }
    expect(t.rpcs).toEqual([]);
    expect(t.inserts).toEqual([]);
    expect(t.stored).toEqual([]);
  });

  it("refuses 'none' in production (APP_ENV unset) as if no scanner were set", async () => {
    const t = setup({ env: { MALWARE_SCANNER: "none" } });
    const { status, body } = await read(await handleUploadRequest(upload(CSV, "a.csv"), t.deps));
    expect(status).toBe(503);
    expect(body.code).toBe("scanner_missing");
    expect(t.stored).toEqual([]);
    expect(t.logs[0]).toMatch(/^SCAN_CONFIG_MISSING: MALWARE_SCANNER=none is allowed only when APP_ENV is development, demo or staging/);
  });

  it("checks who is uploading before it says anything about the scanner", async () => {
    const t = setup({ env: { MALWARE_SCANNER: undefined }, user: null });
    expect((await handleUploadRequest(upload(CSV, "a.csv"), t.deps)).status).toBe(401);
    expect(t.rpcs).toEqual([]);
    expect(t.logs).toEqual([]);
  });

  it("records a file as skipped, and readable, when a non-production deployment runs without a scanner on purpose", async () => {
    const t = setup({ env: { MALWARE_SCANNER: "none", APP_ENV: "demo" } });
    const { body } = await read(await handleUploadRequest(upload(CSV, "a.csv"), t.deps));
    expect(body.document.scan_verdict).toBe("skipped");
    expect(t.stored.map((s) => s.bucket)).toEqual(["documents"]);
    expect(t.rpcs[0].args).toMatchObject({ p_verdict: "skipped" });
  });

  it("leaves a passed file pending when its verdict couldn't be recorded, for document-scan to settle", async () => {
    const t = setup({ recordError: { code: "57014" } });
    const { body } = await read(await handleUploadRequest(upload(CSV, "a.csv"), t.deps));
    expect(body.document.scan_verdict).toBe("pending");
    expect(t.logs).toEqual([`SCAN_NOT_RECORDED request=${REQUEST} document=${DOC} code=57014`]);
  });

  it("removes the row again when the file couldn't be stored, so the prospect can try again", async () => {
    const t = setup({ storeError: { statusCode: "500", message: `${USER}/${INTAKE}/x_secret-name.csv failed` } });
    const { status, body } = await read(await handleUploadRequest(upload(CSV, "secret-name.csv"), t.deps));
    expect(status).toBe(502);
    expect(body.code).toBe("storage");
    expect(t.deleted).toEqual([{ id: DOC, key: "service-key" }]);
    expect(t.logs.join("\n")).not.toMatch(/secret-name/);
    // Not an upload: the funnel isn't told of it.
    expect(t.milestones).toEqual([]);
  });

  it("tells the funnel of the upload once its file is stored and kept, as the service", async () => {
    const t = setup();
    const { status } = await read(await handleUploadRequest(upload(CSV, "a.csv"), t.deps));
    expect(status).toBe(200);
    expect(t.milestones).toEqual([{ document: DOC, key: "service-key" }]);
  });

  it("keeps the upload when the funnel's record of it fails, and says so in the log", async () => {
    const t = setup({ milestoneError: { code: "57014" } });
    const { status } = await read(await handleUploadRequest(upload(CSV, "a.csv"), t.deps));
    expect(status).toBe(200);
    expect(t.deleted).toEqual([]);
    expect(t.logs).toContain(`UPLOAD_MILESTONE_NOT_RECORDED request=${REQUEST} document=${DOC} code=57014`);
  });

  it("takes back the file and its row when the intake's deletion began while the file was on its way (SR-15)", async () => {
    const t = setup({ accepts: false });
    const { status, body } = await read(await handleUploadRequest(upload(CSV, "a.csv"), t.deps));
    expect(status).toBe(409);
    expect(body.code).toBe("closed");
    expect(t.removed).toEqual([{ bucket: "documents", paths: [`${USER}/${INTAKE}/${KEY_ID}_a.csv`] }]);
    expect(t.deleted).toEqual([{ id: DOC, key: "service-key" }]);
    expect(t.rpcs).toEqual([]);
    expect(t.milestones).toEqual([]);
  });

  it.each([
    ["23505", 409, "duplicate"],
    ["23514", 409, "limit"],
    ["EA002", 409, "closed"],
    ["EA007", 409, "closed"],
    ["EA004", 403, "consent"],
    ["42501", 404, "not_found"],
  ] as const)("answers the database's %s refusal of the row as %s, scanning and storing nothing", async (code, status, answer) => {
    const t = setup({ insertError: { code, message: "refused" } });
    const { status: got, body } = await read(await handleUploadRequest(upload(CSV, "a.csv"), t.deps));
    expect(got).toBe(status);
    expect(body.code).toBe(answer);
    expect(t.scanned).toEqual([]);
    expect(t.stored).toEqual([]);
  });
});
