// The request handler for chamber-extract, with everything it touches passed in. index.ts wires in
// Deno and the real Supabase client; the tests wire in fakes. No remote imports, so it runs under
// Deno and Vitest alike.

import { checkAiAllowance, clientIp, hashIp } from "./allowance.ts";
import { emptyExtraction, shapeExtraction } from "./extraction.ts";
import { callModel, failureLogLine, failureResponse, unexpectedErrorLine } from "./model.ts";
import { selectAdapter } from "./providers.ts";
import { SYSTEM_PROMPT } from "./schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Caps keep a single request from running up AI costs.
const MAX_MESSAGE_CHARS = 2000;
const MAX_CONTEXT_CHARS = 20000;
const REQUESTS_PER_MINUTE = 15;
const REQUESTS_PER_DAY = 300;

const UNAVAILABLE = "Lenore is unavailable right now. Please try again in a few minutes.";

/** The parts of the Supabase client this function uses. */
export interface SupabaseLike {
  auth: { getUser: () => PromiseLike<{ data: { user: unknown } }> };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

export interface HandlerDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options?: { global?: { headers: Record<string, string> } }) => SupabaseLike;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  logError: (line: string) => void;
  newRequestId: () => string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  const requestId = deps.newRequestId();
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Guest sessions are free to create, so spend is also bounded per IP and globally. Counts, not
  // dollars; override with function secrets.
  const intFromEnv = (name: string, fallback: number) => {
    const n = Number.parseInt(deps.env(name) ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const ipPerMinute = intFromEnv("AI_IP_PER_MINUTE", 20);
  const ipPerDay = intFromEnv("AI_IP_PER_DAY", 400);
  const globalCallsPerDay = intFromEnv("AI_GLOBAL_DAILY_CALLS", 2000);

  try {
    // The publishable anon key is a valid JWT too, so require an actual signed-in user.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabaseUrl = deps.env("SUPABASE_URL")!;
    const supabase = deps.createClient(supabaseUrl, deps.env("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // Check provider configuration before spending any budget on the request.
    const chosen = selectAdapter(deps.env);
    if (!chosen.ok) {
      deps.logError(`AI_CONFIG_MISSING: ${chosen.problem}`);
      return json({ error: UNAVAILABLE }, 503);
    }

    // The per-IP and global budgets are service-role only, so they use a separate client.
    const serviceRoleKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
    const ipHashSecret = deps.env("IP_HASH_SECRET");
    if (!serviceRoleKey || !ipHashSecret) {
      deps.logError("AI_CONFIG_MISSING: SUPABASE_SERVICE_ROLE_KEY and IP_HASH_SECRET must both be set");
      return json({ error: UNAVAILABLE }, 503);
    }
    const admin = deps.createClient(supabaseUrl, serviceRoleKey);
    const ip = clientIp(req.headers);
    const ipHash = ip ? await hashIp(ip, ipHashSecret) : null;

    const allowance = await checkAiAllowance(
      {
        consumeUserQuota: async () => {
          const { data, error } = await supabase.rpc("consume_ai_quota", {
            per_minute: REQUESTS_PER_MINUTE,
            per_day: REQUESTS_PER_DAY,
          });
          if (error) throw error;
          return data === true;
        },
        consumeIpQuota: async (hash) => {
          const { data, error } = await admin.rpc("consume_ip_quota", {
            p_ip_hash: hash,
            per_minute: ipPerMinute,
            per_day: ipPerDay,
          });
          if (error) throw error;
          return data === true;
        },
        consumeGlobalBudget: async () => {
          const { data, error } = await admin.rpc("consume_global_ai_budget", { max_calls: globalCallsPerDay });
          if (error) throw error;
          return data === true;
        },
        log: deps.logError,
      },
      ipHash,
    );
    if (!allowance.allowed) return json({ error: allowance.error }, allowance.status);

    const { message, context } = await req.json();
    if (typeof message !== "string" || !message.trim()) {
      return json({ error: "message is required" }, 400);
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return json({ error: `message must be at most ${MAX_MESSAGE_CHARS} characters` }, 413);
    }
    const contextJson = context ? JSON.stringify(context) : "";
    if (contextJson.length > MAX_CONTEXT_CHARS) {
      return json({ error: "context too large" }, 413);
    }

    // JSON.stringify quotes and escapes the message so it can't break out of its slot.
    const userPrompt = contextJson
      ? `Previous context (already captured data): ${contextJson}\n\nNew user message: ${JSON.stringify(message)}`
      : `User message: ${JSON.stringify(message)}`;

    const result = await callModel(
      chosen.adapter,
      { system: SYSTEM_PROMPT, user: userPrompt },
      { fetch: deps.fetch, sleep: deps.sleep, now: deps.now },
    );
    if (!result.ok) {
      deps.logError(failureLogLine({ requestId, provider: chosen.adapter.name, result }));
      const failure = failureResponse(result.kind);
      return json({ error: failure.message }, failure.status);
    }

    return json(result.args ? shapeExtraction(result.args) : emptyExtraction());
  } catch (e) {
    deps.logError(unexpectedErrorLine(requestId, e));
    return json({ error: "Internal error" }, 500);
  }
}
