import { describe, expect, it, vi } from "vitest";
import { checkAiAllowance, clientIp, hashIp, type AllowanceDeps } from "./allowance";

const deps = (overrides: Partial<AllowanceDeps> = {}): AllowanceDeps & { order: string[] } => {
  const order: string[] = [];
  return {
    order,
    consumeUserQuota: vi.fn(async () => { order.push("user"); return true; }),
    consumeIpQuota: vi.fn(async () => { order.push("ip"); return true; }),
    consumeGlobalBudget: vi.fn(async () => { order.push("global"); return true; }),
    log: vi.fn(),
    ...overrides,
  };
};

describe("checkAiAllowance", () => {
  it("allows a request that is within every limit, checking user, then IP, then the global ceiling", async () => {
    const d = deps();
    expect(await checkAiAllowance(d, "hash-1")).toEqual({ allowed: true });
    expect(d.order).toEqual(["user", "ip", "global"]);
  });

  it("refuses an over-quota user without spending IP or global budget", async () => {
    const d = deps({ consumeUserQuota: vi.fn(async () => false) });
    const result = await checkAiAllowance(d, "hash-1");
    expect(result).toMatchObject({ allowed: false, status: 429, reason: "user_quota" });
    expect(d.consumeIpQuota).not.toHaveBeenCalled();
    expect(d.consumeGlobalBudget).not.toHaveBeenCalled();
  });

  it("refuses an over-limit IP without spending global budget", async () => {
    const d = deps({ consumeIpQuota: vi.fn(async () => false) });
    const result = await checkAiAllowance(d, "hash-1");
    expect(result).toMatchObject({ allowed: false, status: 429, reason: "ip_quota" });
    expect(d.consumeGlobalBudget).not.toHaveBeenCalled();
  });

  it("stops everyone, with a calm message, once the global ceiling is hit, and logs it", async () => {
    const d = deps({ consumeGlobalBudget: vi.fn(async () => false) });
    const result = await checkAiAllowance(d, "hash-1");
    expect(result).toMatchObject({ allowed: false, status: 503, reason: "global_ceiling" });
    expect(result.allowed === false && result.error).toMatch(/resting/i);
    expect(d.log).toHaveBeenCalledWith(expect.stringContaining("AI_GLOBAL_CEILING_HIT"));
  });

  it.each(["consumeUserQuota", "consumeIpQuota", "consumeGlobalBudget"] as const)(
    "fails closed when %s can't be checked",
    async (failing) => {
      const d = deps({ [failing]: vi.fn(async () => { throw new Error("db down"); }) });
      const result = await checkAiAllowance(d, "hash-1");
      expect(result).toMatchObject({ allowed: false, status: 503, reason: "budget_unavailable" });
      expect(d.log).toHaveBeenCalledWith(expect.stringContaining("AI_BUDGET_CHECK_FAILED"));
    },
  );

  it("limits requests with no usable IP together in one shared bucket instead of letting them through", async () => {
    const d = deps();
    await checkAiAllowance(d, null);
    expect(d.consumeIpQuota).toHaveBeenCalledWith("unknown");
  });
});

describe("clientIp", () => {
  const headers = (h: Record<string, string>) => new Headers(h);

  it("prefers the edge-provided client address, which callers can't spoof", () => {
    expect(clientIp(headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.7");
  });

  it("otherwise takes the last forwarded address, ignoring a caller-supplied leading one", () => {
    expect(clientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("returns null when no address is available", () => {
    expect(clientIp(headers({}))).toBeNull();
  });
});

describe("hashIp", () => {
  it("is stable, keyed by a secret, and never contains the address", async () => {
    const a = await hashIp("203.0.113.7", "secret-1");
    expect(a).toBe(await hashIp("203.0.113.7", "secret-1"));
    expect(a).not.toBe(await hashIp("203.0.113.8", "secret-1"));
    expect(a).not.toBe(await hashIp("203.0.113.7", "secret-2"));
    expect(a).not.toContain("203.0.113.7");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
