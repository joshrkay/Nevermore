import { describe, expect, it, vi } from "vitest";
import { CLAIM_BATCH, CLAIM_LOCK_SECONDS, failedAlertText, handleRequest, retryDelaySeconds, TIME_BUDGET_MS, type PurgeClient, type PurgeDeps } from "./handler";

const ENV: Record<string, string | undefined> = {
  SUPABASE_URL: "https://project.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

interface File {
  bucket: string;
  name: string;
}

interface Fake {
  /** What each claim returns, in order; once used up a claim returns nothing. */
  claims: Array<Array<{ id: string; session_id: string; user_id: string; attempt: number }>>;
  files: Map<string, File[]>;
  /** A storage error to answer remove() with, per bucket. */
  removeError?: Record<string, { statusCode: string; message: string }>;
  /** remove() answers success but deletes nothing (what storage does when it can't). */
  silentRemove?: boolean;
  /** Files that appear after the listing, so complete_intake_deletion finds them (an upload racing the deletion). */
  lateFiles?: number;
  failOutcome?: "pending" | "failed";
  failError?: { code: string };
  claimError?: { code: string };
}

const setup = (fake: Fake, opts: { env?: Record<string, string | undefined>; clock?: () => number } = {}) => {
  const env = { ...ENV, ...opts.env };
  const logs: string[] = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const removeCalls: Array<{ bucket: string; paths: string[] }> = [];
  const claims = [...fake.claims];
  const client: PurgeClient = {
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      const id = args.p_deletion_id as string;
      switch (fn) {
        case "claim_intake_deletions":
          if (fake.claimError) return { data: null, error: fake.claimError };
          return { data: claims.shift() ?? [], error: null };
        case "intake_deletion_files":
          return { data: [...(fake.files.get(id) ?? [])], error: null };
        case "complete_intake_deletion": {
          const left = (fake.files.get(id) ?? []).length + (fake.lateFiles ?? 0);
          if (left > 0) return { data: null, error: { code: "EA006", details: String(left), message: "The intake still has stored files" } };
          return { data: { chamber_sessions: 1, documents: 2, submission_status_history: 3 }, error: null };
        }
        case "fail_intake_deletion":
          if (fake.failError) return { data: null, error: fake.failError };
          return { data: fake.failOutcome ?? "pending", error: null };
        default:
          throw new Error(`unexpected rpc ${fn}`);
      }
    },
    storage: {
      from: (bucket) => ({
        remove: async (paths) => {
          removeCalls.push({ bucket, paths });
          const err = fake.removeError?.[bucket];
          if (err) return { data: null, error: err };
          if (fake.silentRemove) return { data: [], error: null };
          const removed: File[] = [];
          for (const [id, list] of fake.files) {
            const keep = list.filter((f) => !(f.bucket === bucket && paths.includes(f.name)));
            removed.push(...list.filter((f) => f.bucket === bucket && paths.includes(f.name)));
            fake.files.set(id, keep);
          }
          return { data: removed.map((f) => ({ name: f.name })), error: null };
        },
      }),
    },
  };
  const createClient = vi.fn((_url: string, _key: string) => client);
  const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => new Response("ok", { status: 200 }));
  const deps: PurgeDeps = {
    env: (name) => env[name],
    createClient,
    fetch: fetchFn as unknown as typeof fetch,
    now: opts.clock ?? (() => 0),
    log: (line) => logs.push(line),
  };
  return { deps, logs, rpcCalls, removeCalls, createClient, fetchFn, fake };
};

const scheduled = (key = "service-key") =>
  new Request("https://functions.test/purge-intakes", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: "{}" });
const read = async (response: Response) => ({ status: response.status, body: await response.json() });

const D1 = "d0000000-0000-0000-0000-000000000001";
const D2 = "d0000000-0000-0000-0000-000000000002";
const claim = (id: string, attempt = 1) => ({ id, session_id: `s-${id}`, user_id: "u-1", attempt });
// File names carry what prospects called their files; none of it may reach a log or a response.
const docs = (id: string, n: number): File[] =>
  Array.from({ length: n }, (_, i) => ({ bucket: "documents", name: `u-1/s-${id}/${i}_Jane Doe payroll.csv` }));

describe("purge-intakes: who may call it", () => {
  it("answers a preflight and refuses anything but POST", async () => {
    const t = setup({ claims: [], files: new Map() });
    expect((await handleRequest(new Request("https://functions.test/purge-intakes", { method: "OPTIONS" }), t.deps)).status).toBe(200);
    expect((await handleRequest(new Request("https://functions.test/purge-intakes", { method: "GET" }), t.deps)).status).toBe(405);
    expect(t.createClient).not.toHaveBeenCalled();
  });

  it("refuses any caller without the service-role key, the anon key and a user's token included, with its own 401", async () => {
    for (const key of ["anon-key", "eyJ.user.jwt", ""]) {
      const t = setup({ claims: [[claim(D1)]], files: new Map() });
      const headers: Record<string, string> = key ? { Authorization: `Bearer ${key}` } : {};
      const { status, body } = await read(await handleRequest(new Request("https://functions.test/purge-intakes", { method: "POST", headers }), t.deps));
      expect(status).toBe(401);
      expect(body).toEqual({ error: "Unauthorized" });
      expect(t.createClient).not.toHaveBeenCalled();
    }
  });

  it("says it is unavailable when its own settings are missing", async () => {
    const t = setup({ claims: [], files: new Map() }, { env: { SUPABASE_SERVICE_ROLE_KEY: undefined } });
    expect((await handleRequest(scheduled(), t.deps)).status).toBe(503);
    expect(t.logs).toEqual(["PURGE_CONFIG_MISSING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set"]);
  });
});

describe("purge-intakes: carrying out a deletion", () => {
  it("removes every stored file through storage, then has the database delete the rows, and logs counts only", async () => {
    const files = new Map([[D1, [...docs(D1, 2), { bucket: "manuscripts", name: `s-${D1}/v1-x.pdf` }]]]);
    const t = setup({ claims: [[claim(D1)]], files });
    const { status, body } = await read(await handleRequest(scheduled(), t.deps));
    expect(status).toBe(200);
    expect(body).toEqual({ claimed: 1, done: 1, retrying: 0, failed: 0, files_deleted: 3 });
    expect(t.rpcCalls[0]).toEqual({ fn: "claim_intake_deletions", args: { p_batch: CLAIM_BATCH, p_lock_seconds: CLAIM_LOCK_SECONDS } });
    expect(t.removeCalls.map((c) => [c.bucket, c.paths.length])).toEqual([["documents", 2], ["manuscripts", 1]]);
    // Files first: the rows are only deleted once the database's own listing is empty.
    const order = t.rpcCalls.map((c) => c.fn);
    expect(order.indexOf("complete_intake_deletion")).toBeGreaterThan(order.lastIndexOf("intake_deletion_files"));
    expect(t.rpcCalls.find((c) => c.fn === "complete_intake_deletion")?.args).toEqual({ p_deletion_id: D1, p_files_deleted: 3 });
    expect(t.logs).toEqual([`DELETION_DONE deletion=${D1} intake=s-${D1} files=3 rows=6`]);
    expect(JSON.stringify(body) + t.logs.join("\n")).not.toMatch(/Jane|payroll|\.csv|\.pdf/);
  });

  it("completes a deletion with nothing stored without calling storage", async () => {
    const t = setup({ claims: [[claim(D1)]], files: new Map() });
    expect((await read(await handleRequest(scheduled(), t.deps))).body).toMatchObject({ done: 1, files_deleted: 0 });
    expect(t.removeCalls).toEqual([]);
  });

  it("removes files 100 at a time", async () => {
    const t = setup({ claims: [[claim(D1)]], files: new Map([[D1, docs(D1, 250)]]) });
    await handleRequest(scheduled(), t.deps);
    expect(t.removeCalls.map((c) => c.paths.length)).toEqual([100, 100, 50]);
  });

  it("works several deletions in a run, and keeps claiming until the queue is empty", async () => {
    const t = setup({ claims: [[claim(D1)], [claim(D2)]], files: new Map([[D1, docs(D1, 1)], [D2, docs(D2, 1)]]) });
    expect((await read(await handleRequest(scheduled(), t.deps))).body).toEqual({ claimed: 2, done: 2, retrying: 0, failed: 0, files_deleted: 2 });
    expect(t.rpcCalls.filter((c) => c.fn === "claim_intake_deletions")).toHaveLength(3);
  });

  it("stops claiming once its time budget is spent", async () => {
    // The start and the first check read 0; by the second check the budget is used up.
    let reads = 0;
    const t = setup(
      { claims: [[claim(D1)], [claim(D2)]], files: new Map() },
      { clock: () => (reads++ < 2 ? 0 : TIME_BUDGET_MS) },
    );
    expect((await read(await handleRequest(scheduled(), t.deps))).body).toMatchObject({ claimed: 1, done: 1 });
  });
});

describe("purge-intakes: when a step fails", () => {
  it("leaves the rows when storage refuses, and asks for a retry with the failure kind and a backoff", async () => {
    const t = setup({ claims: [[claim(D1)]], files: new Map([[D1, docs(D1, 2)]]), removeError: { documents: { statusCode: "500", message: "Jane Doe payroll.csv: internal" } } });
    const { body } = await read(await handleRequest(scheduled(), t.deps));
    expect(body).toEqual({ claimed: 1, done: 0, retrying: 1, failed: 0, files_deleted: 0 });
    expect(t.rpcCalls.map((c) => c.fn)).not.toContain("complete_intake_deletion");
    expect(t.rpcCalls.find((c) => c.fn === "fail_intake_deletion")?.args).toEqual({ p_deletion_id: D1, p_error: "storage_remove:500", p_retry_in_seconds: 300 });
    expect(t.logs).toEqual([`DELETION_RETRY deletion=${D1} intake=s-${D1} attempt=1 reason=storage_remove:500 retry_in=300s`]);
    expect(t.logs.join("\n")).not.toMatch(/Jane|internal/);
  });

  it("doesn't trust storage's empty success: files still listed mean the rows stay", async () => {
    const t = setup({ claims: [[claim(D1, 2)]], files: new Map([[D1, docs(D1, 2)]]), silentRemove: true });
    await handleRequest(scheduled(), t.deps);
    expect(t.rpcCalls.map((c) => c.fn)).not.toContain("complete_intake_deletion");
    expect(t.rpcCalls.find((c) => c.fn === "fail_intake_deletion")?.args).toMatchObject({ p_error: "files_remain:2", p_retry_in_seconds: 1_800 });
  });

  it("retries when a file was stored after the listing and the database refuses (EA006)", async () => {
    const t = setup({ claims: [[claim(D1)]], files: new Map([[D1, docs(D1, 1)]]), lateFiles: 1 });
    await handleRequest(scheduled(), t.deps);
    expect(t.rpcCalls.find((c) => c.fn === "fail_intake_deletion")?.args).toMatchObject({ p_error: "files_remain:1" });
  });

  it("reports a deletion that ran out of attempts, and alerts engineering with ids and the kind only", async () => {
    const t = setup(
      { claims: [[claim(D1, 5)]], files: new Map([[D1, docs(D1, 1)]]), removeError: { documents: { statusCode: "403", message: "denied" } }, failOutcome: "failed" },
      { env: { ENGINEERING_ALERT_WEBHOOK_URL: "https://hooks.example.com/x" } },
    );
    const { body } = await read(await handleRequest(scheduled(), t.deps));
    expect(body).toMatchObject({ failed: 1, retrying: 0 });
    expect(t.logs).toEqual([`DELETION_FAILED deletion=${D1} intake=s-${D1} attempts=5 reason=storage_remove:403`]);
    expect(t.fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = t.fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/x");
    const sent = JSON.parse(init.body as string);
    expect(sent).toEqual({
      text: failedAlertText(D1, `s-${D1}`, 5, "storage_remove:403"),
      source: "purge-intakes",
      alert: "DELETION_FAILED",
      deletion: D1,
      intake: `s-${D1}`,
      attempts: 5,
      reason: "storage_remove:403",
    });
    expect(init.body as string).not.toMatch(/Jane|payroll|u-1\//);
    expect(sent.text).toContain("docs/RUNBOOK.md");
  });

  it("only logs a terminal failure when no webhook is set, and says so when one is set wrong", async () => {
    const quiet = setup({ claims: [[claim(D1, 5)]], files: new Map(), lateFiles: 1, failOutcome: "failed" });
    await handleRequest(scheduled(), quiet.deps);
    expect(quiet.fetchFn).not.toHaveBeenCalled();
    const wrong = setup({ claims: [], files: new Map() }, { env: { ENGINEERING_ALERT_WEBHOOK_URL: "http://hooks.example.com/x" } });
    await handleRequest(scheduled(), wrong.deps);
    expect(wrong.logs).toEqual(["PURGE_CONFIG_MISSING: ENGINEERING_ALERT_WEBHOOK_URL is not an https URL"]);
  });

  it("logs a failure it couldn't record and leaves the claim to lapse", async () => {
    const t = setup({ claims: [[claim(D1)]], files: new Map(), lateFiles: 1, failError: { code: "PGRST000" } });
    const { status, body } = await read(await handleRequest(scheduled(), t.deps));
    expect(status).toBe(200);
    expect(body).toMatchObject({ retrying: 1 });
    expect(t.logs).toEqual([`DELETION_ERROR deletion=${D1} intake=s-${D1} attempt=1 reason=files_remain:1 record=rpc_fail:PGRST000`]);
  });

  it("answers a 500 with a fixed line when the queue can't be claimed", async () => {
    const t = setup({ claims: [], files: new Map(), claimError: { code: "42501" } });
    const { status, body } = await read(await handleRequest(scheduled(), t.deps));
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Internal error" });
    expect(t.logs).toEqual(["PURGE_ERROR: rpc_claim:42501"]);
  });
});

describe("retryDelaySeconds", () => {
  it("backs off 5 minutes, 30 minutes, 2 hours, then 6 hours", () => {
    expect([1, 2, 3, 4, 5, 9].map(retryDelaySeconds)).toEqual([300, 1_800, 7_200, 21_600, 21_600, 21_600]);
    expect(retryDelaySeconds(0)).toBe(300);
  });
});
