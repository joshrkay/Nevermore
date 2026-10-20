// Decides whether an AI request may proceed. No imports, so it runs under Deno (the edge
// function) and under Vitest alike.

export interface AllowanceDeps {
  /** Per-user rate limit. */
  consumeUserQuota: () => Promise<boolean>;
  /** Per-IP rate limit, keyed by a hashed address. */
  consumeIpQuota: (ipHash: string) => Promise<boolean>;
  /** Global daily ceiling shared by every user. */
  consumeGlobalBudget: () => Promise<boolean>;
  log: (message: string) => void;
}

export type AllowanceResult =
  | { allowed: true }
  | {
      allowed: false;
      status: 429 | 503;
      error: string;
      reason: "user_quota" | "ip_quota" | "global_ceiling" | "budget_unavailable";
    };

const RATE_LIMITED = "Rate limited, please try again shortly.";

/**
 * Cheapest check first, and each later budget is only spent once the earlier ones pass, so a
 * rejected request never burns the shared allowance. If a limit can't be checked we refuse:
 * with free guest sessions, failing open would leave spend unbounded.
 */
export async function checkAiAllowance(deps: AllowanceDeps, ipHash: string | null): Promise<AllowanceResult> {
  try {
    if (!(await deps.consumeUserQuota())) {
      return { allowed: false, status: 429, error: RATE_LIMITED, reason: "user_quota" };
    }
    // Requests with no usable address share one bucket rather than bypassing the limit.
    if (!(await deps.consumeIpQuota(ipHash ?? "unknown"))) {
      return { allowed: false, status: 429, error: RATE_LIMITED, reason: "ip_quota" };
    }
    if (!(await deps.consumeGlobalBudget())) {
      deps.log("AI_GLOBAL_CEILING_HIT: daily AI call ceiling reached; refusing all AI requests until tomorrow (UTC)");
      return {
        allowed: false,
        status: 503,
        error: "Lenore is resting for the day. Please come back tomorrow, or continue filling in the workspace by hand.",
        reason: "global_ceiling",
      };
    }
    return { allowed: true };
  } catch (e) {
    deps.log(`AI_BUDGET_CHECK_FAILED: ${e instanceof Error ? e.message : "unknown error"}`);
    return {
      allowed: false,
      status: 503,
      error: "Lenore is unavailable right now. Please try again in a few minutes.",
      reason: "budget_unavailable",
    };
  }
}

/**
 * The caller's address. Cloudflare's header can't be set by the caller; otherwise take the last
 * forwarded hop (the one our own proxy appended), not the first, which a caller can forge.
 */
export function clientIp(headers: Headers): string | null {
  const edge = headers.get("cf-connecting-ip")?.trim();
  if (edge) return edge;
  const hops = headers.get("x-forwarded-for")?.split(",").map((h) => h.trim()).filter(Boolean) ?? [];
  return hops.length > 0 ? hops[hops.length - 1] : null;
}

/** Keyed SHA-256, hex. Lets us rate-limit an address without storing it. */
export async function hashIp(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
