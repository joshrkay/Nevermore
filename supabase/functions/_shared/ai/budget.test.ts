import { describe, expect, it, vi } from "vitest";
import { checkAiBudget, readBudgetLimits, type RpcClient } from "./budget";

const env = (vars: Record<string, string | undefined>) => (name: string) => vars[name];

const ENV: Record<string, string | undefined> = { SUPABASE_SERVICE_ROLE_KEY: "service-key", IP_HASH_SECRET: "ip-secret" };

interface Call { client: "user" | "admin"; fn: string; args: Record<string, unknown> }

// Two fake Supabase clients (the caller's, and the service-role one) that record what is spent.
const setup = (opts: { env?: Record<string, string | undefined>; allow?: Record<string, boolean>; rpcError?: string; ip?: string | null } = {}) => {
  const calls: Call[] = [];
  const logs: string[] = [];
  const allow: Record<string, boolean> = { consume_ai_quota: true, consume_ip_quota: true, consume_global_ai_budget: true, ...opts.allow };
  const client = (which: "user" | "admin"): RpcClient => ({
    rpc: async (fn, args) => {
      calls.push({ client: which, fn, args });
      return opts.rpcError ? { data: null, error: { message: opts.rpcError } } : { data: allow[fn], error: null };
    },
  });
  const createAdmin = vi.fn((_key: string) => client("admin"));
  const headers = new Headers(opts.ip === null ? {} : { "x-forwarded-for": opts.ip ?? "203.0.113.9" });
  const request = { headers, env: env({ ...ENV, ...opts.env }), user: client("user"), createAdmin, log: (line: string) => logs.push(line) };
  return { request, calls, logs, createAdmin };
};

describe("readBudgetLimits", () => {
  it("has fixed per-user limits and defaults for the per-address and global ones", () => {
    expect(readBudgetLimits(env({}))).toEqual({ userPerMinute: 15, userPerDay: 300, ipPerMinute: 20, ipPerDay: 400, globalPerDay: 2000 });
  });

  it("lets function secrets override the per-address and global limits only", () => {
    const limits = readBudgetLimits(env({ AI_IP_PER_MINUTE: "7", AI_IP_PER_DAY: "70", AI_GLOBAL_DAILY_CALLS: "700" }));
    expect(limits).toMatchObject({ ipPerMinute: 7, ipPerDay: 70, globalPerDay: 700, userPerMinute: 15, userPerDay: 300 });
  });

  it("ignores an override that isn't a positive whole number", () => {
    const limits = readBudgetLimits(env({ AI_IP_PER_MINUTE: "0", AI_IP_PER_DAY: "-5", AI_GLOBAL_DAILY_CALLS: "lots" }));
    expect(limits).toMatchObject({ ipPerMinute: 20, ipPerDay: 400, globalPerDay: 2000 });
  });
});

describe("checkAiBudget", () => {
  it("spends the caller's quota, then their address's, then the global ceiling, each from the right client", async () => {
    const t = setup();
    expect(await checkAiBudget(t.request)).toEqual({ allowed: true });
    expect(t.calls.map((c) => `${c.client}:${c.fn}`)).toEqual(["user:consume_ai_quota", "admin:consume_ip_quota", "admin:consume_global_ai_budget"]);
    expect(t.calls[0].args).toEqual({ per_minute: 15, per_day: 300 });
    expect(t.calls[1].args).toMatchObject({ per_minute: 20, per_day: 400 });
    expect(t.calls[2].args).toEqual({ max_calls: 2000 });
    expect(t.createAdmin).toHaveBeenCalledWith("service-key");
  });

  it("applies the overrides to the address and global counts", async () => {
    const t = setup({ env: { AI_IP_PER_MINUTE: "7", AI_IP_PER_DAY: "70", AI_GLOBAL_DAILY_CALLS: "700" } });
    await checkAiBudget(t.request);
    expect(t.calls[1].args).toMatchObject({ per_minute: 7, per_day: 70 });
    expect(t.calls[2].args).toEqual({ max_calls: 700 });
  });

  it("counts an address by a keyed hash, never the address itself, and the same address the same way each time", async () => {
    const first = setup({ ip: "203.0.113.9" });
    const again = setup({ ip: "203.0.113.9" });
    const other = setup({ ip: "203.0.113.10" });
    await Promise.all([checkAiBudget(first.request), checkAiBudget(again.request), checkAiBudget(other.request)]);
    const hash = (t: ReturnType<typeof setup>) => t.calls[1].args.p_ip_hash as string;
    expect(hash(first)).toMatch(/^[0-9a-f]{64}$/);
    expect(hash(first)).not.toContain("203.0.113");
    expect(hash(again)).toBe(hash(first));
    expect(hash(other)).not.toBe(hash(first));
  });

  it("puts callers with no usable address in one shared bucket instead of letting them skip the count", async () => {
    const t = setup({ ip: null });
    await checkAiBudget(t.request);
    expect(t.calls[1].args.p_ip_hash).toBe("unknown");
  });

  it("refuses, and spends nothing, when the service-role key or the address-hashing secret is missing", async () => {
    for (const missing of ["SUPABASE_SERVICE_ROLE_KEY", "IP_HASH_SECRET"]) {
      const t = setup({ env: { [missing]: undefined } });
      expect(await checkAiBudget(t.request)).toMatchObject({ allowed: false, status: 503, reason: "config_missing" });
      expect(t.calls).toEqual([]);
      expect(t.createAdmin).not.toHaveBeenCalled();
      expect(t.logs).toEqual(["AI_CONFIG_MISSING: SUPABASE_SERVICE_ROLE_KEY and IP_HASH_SECRET must both be set"]);
    }
  });

  it("refuses an over-quota caller with a 429 before touching the address or global counts", async () => {
    const t = setup({ allow: { consume_ai_quota: false } });
    expect(await checkAiBudget(t.request)).toMatchObject({ allowed: false, status: 429, reason: "user_quota" });
    expect(t.calls.map((c) => c.fn)).toEqual(["consume_ai_quota"]);
  });

  it("refuses an over-quota address with a 429 before the global count", async () => {
    const t = setup({ allow: { consume_ip_quota: false } });
    expect(await checkAiBudget(t.request)).toMatchObject({ allowed: false, status: 429, reason: "ip_quota" });
    expect(t.calls.map((c) => c.fn)).toEqual(["consume_ai_quota", "consume_ip_quota"]);
  });

  it("refuses everyone with a 503 once the daily ceiling is reached, and logs it", async () => {
    const t = setup({ allow: { consume_global_ai_budget: false } });
    expect(await checkAiBudget(t.request)).toMatchObject({ allowed: false, status: 503, reason: "global_ceiling" });
    expect(t.logs[0]).toContain("AI_GLOBAL_CEILING_HIT");
  });

  it("refuses rather than allows when a count can't be checked", async () => {
    const t = setup({ rpcError: "connection reset" });
    expect(await checkAiBudget(t.request)).toMatchObject({ allowed: false, status: 503, reason: "budget_unavailable" });
    expect(t.logs[0]).toContain("AI_BUDGET_CHECK_FAILED");
  });
});
