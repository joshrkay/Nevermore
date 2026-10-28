// The call budget every AI function spends from: the caller's own quota, then their address's,
// then the daily ceiling shared by everyone. Guest sessions are free to create, so the per-user
// quota alone does not bound spend. The limits are counts, not dollars, and every function that
// calls the model draws on the same per-address and global counts. No remote imports, so it runs
// under Deno and Vitest alike.

import { checkAiAllowance, clientIp, hashIp, UNAVAILABLE, type AllowanceResult } from "./allowance.ts";

/** The part of a Supabase client the budget needs. */
export interface RpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

export interface BudgetLimits {
  userPerMinute: number;
  userPerDay: number;
  ipPerMinute: number;
  ipPerDay: number;
  globalPerDay: number;
}

const intFromEnv = (env: (name: string) => string | undefined, name: string, fallback: number) => {
  const n = Number.parseInt(env(name) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** The per-user limit is fixed; the per-address and global limits can be overridden with function secrets. */
export function readBudgetLimits(env: (name: string) => string | undefined): BudgetLimits {
  return {
    userPerMinute: 15,
    userPerDay: 300,
    ipPerMinute: intFromEnv(env, "AI_IP_PER_MINUTE", 20),
    ipPerDay: intFromEnv(env, "AI_IP_PER_DAY", 400),
    globalPerDay: intFromEnv(env, "AI_GLOBAL_DAILY_CALLS", 2000),
  };
}

export interface BudgetRequest {
  headers: Headers;
  env: (name: string) => string | undefined;
  /** The caller's own client: the per-user quota is theirs and runs under their sign-in. */
  user: RpcClient;
  /** Builds the service-role client the per-address and global counts need. Called only once the secrets are set. */
  createAdmin: (serviceRoleKey: string) => RpcClient;
  log: (line: string) => void;
}

/**
 * Spends one call from each budget, or says which one refused. Refuses, rather than skipping a
 * count, when the service-role key or the address-hashing secret is missing: an unchecked limit
 * would leave spend unbounded.
 */
export async function checkAiBudget(req: BudgetRequest): Promise<AllowanceResult> {
  const serviceRoleKey = req.env("SUPABASE_SERVICE_ROLE_KEY");
  const ipHashSecret = req.env("IP_HASH_SECRET");
  if (!serviceRoleKey || !ipHashSecret) {
    req.log("AI_CONFIG_MISSING: SUPABASE_SERVICE_ROLE_KEY and IP_HASH_SECRET must both be set");
    return { allowed: false, status: 503, error: UNAVAILABLE, reason: "config_missing" };
  }
  const admin = req.createAdmin(serviceRoleKey);
  const limits = readBudgetLimits(req.env);
  const ip = clientIp(req.headers);
  const ipHash = ip ? await hashIp(ip, ipHashSecret) : null;

  return await checkAiAllowance(
    {
      consumeUserQuota: async () => {
        const { data, error } = await req.user.rpc("consume_ai_quota", {
          per_minute: limits.userPerMinute,
          per_day: limits.userPerDay,
        });
        if (error) throw error;
        return data === true;
      },
      consumeIpQuota: async (hash) => {
        const { data, error } = await admin.rpc("consume_ip_quota", {
          p_ip_hash: hash,
          per_minute: limits.ipPerMinute,
          per_day: limits.ipPerDay,
        });
        if (error) throw error;
        return data === true;
      },
      consumeGlobalBudget: async () => {
        const { data, error } = await admin.rpc("consume_global_ai_budget", { max_calls: limits.globalPerDay });
        if (error) throw error;
        return data === true;
      },
      log: req.log,
    },
    ipHash,
  );
}
