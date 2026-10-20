import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { checkAiAllowance, clientIp, hashIp } from "./allowance.ts";
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

// Guest sessions are free to create, so spend is also bounded per IP and globally. Counts, not
// dollars; override with function secrets.
const intFromEnv = (name: string, fallback: number) => {
  const n = Number.parseInt(Deno.env.get(name) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const IP_REQUESTS_PER_MINUTE = intFromEnv("AI_IP_PER_MINUTE", 20);
const IP_REQUESTS_PER_DAY = intFromEnv("AI_IP_PER_DAY", 400);
const GLOBAL_CALLS_PER_DAY = intFromEnv("AI_GLOBAL_DAILY_CALLS", 2000);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });


serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // The publishable anon key is a valid JWT too, so require an actual signed-in user.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // Check provider configuration before spending any budget on the request.
    const chosen = selectAdapter((name) => Deno.env.get(name));
    if (!chosen.ok) {
      console.error(`AI_CONFIG_MISSING: ${chosen.problem}`);
      return json({ error: "Lenore is unavailable right now. Please try again in a few minutes." }, 503);
    }

    // The per-IP and global budgets are service-role only, so they use a separate client.
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ipHashSecret = Deno.env.get("IP_HASH_SECRET");
    if (!serviceRoleKey || !ipHashSecret) {
      console.error("AI_CONFIG_MISSING: SUPABASE_SERVICE_ROLE_KEY and IP_HASH_SECRET must both be set");
      return json({ error: "Lenore is unavailable right now. Please try again in a few minutes." }, 503);
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
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
            per_minute: IP_REQUESTS_PER_MINUTE,
            per_day: IP_REQUESTS_PER_DAY,
          });
          if (error) throw error;
          return data === true;
        },
        consumeGlobalBudget: async () => {
          const { data, error } = await admin.rpc("consume_global_ai_budget", { max_calls: GLOBAL_CALLS_PER_DAY });
          if (error) throw error;
          return data === true;
        },
        log: (message) => console.error(message),
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
      { fetch, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now: () => Date.now() },
    );
    if (!result.ok) {
      // Fixed fields only: never the provider's response or the prospect's message.
      console.error(failureLogLine({ requestId, provider: chosen.adapter.name, result }));
      const failure = failureResponse(result.kind);
      return json({ error: failure.message }, failure.status);
    }

    const args = result.args;
    if (!args) return json({ extracted: {}, reply: null });
    const reply = typeof args.reply === "string" && args.reply ? args.reply : null;
    delete args.reply;

    // Remove null/undefined values
    const extracted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      if (v !== null && v !== undefined && v !== "") {
        extracted[k] = v;
      }
    }

    return json({ extracted, reply });
  } catch (e) {
    console.error(unexpectedErrorLine(requestId, e));
    return json({ error: "Internal error" }, 500);
  }
});
