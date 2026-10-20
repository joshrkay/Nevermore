import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { checkAiAllowance, clientIp, hashIp } from "./allowance.ts";

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

const SYSTEM_PROMPT = `You are a data extraction assistant for an HR/PEO underwriting system. 
Given a user message from a business discovery conversation, extract any structured data fields you can identify.

You MUST use the extract_chamber_data tool to return the extracted fields. Only include fields that are clearly stated or strongly implied. Do not guess.

Field definitions:
- company_name: Company or business name
- industry: Industry or business type
- hq_state: Two-letter US state code for headquarters
- states: Array of two-letter state codes where employees work
- employee_count: Total number of employees (integer)
- start_month: Desired benefits start date
- virgin_medical: true if they've never had employer-sponsored health insurance, false if switching
- current_carrier: Current insurance carrier name
- renewal_date: Current policy renewal date
- payroll_vendor: Current payroll provider
- pay_frequency: How often they run payroll (weekly, bi-weekly, semi-monthly, monthly)
- has_401k: Whether they offer 401k
- has_1099: Whether they have 1099 contractors
- ca_contractors: Whether they have contractors in California
- has_handbook: Whether they have an employee handbook
- key_challenges: Main HR/compliance challenges described
- business_goals: Business goals mentioned`;

serve(async (req) => {
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // JSON.stringify quotes and escapes the message so it can't break out of its slot.
    const userPrompt = contextJson
      ? `Previous context (already captured data): ${contextJson}\n\nNew user message: ${JSON.stringify(message)}`
      : `User message: ${JSON.stringify(message)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_chamber_data",
              description: "Extract structured business data fields from the user message",
              parameters: {
                type: "object",
                properties: {
                  company_name: { type: "string" },
                  industry: { type: "string" },
                  hq_state: { type: "string" },
                  states: { type: "array", items: { type: "string" } },
                  employee_count: { type: "integer" },
                  start_month: { type: "string" },
                  virgin_medical: { type: "boolean" },
                  current_carrier: { type: "string" },
                  renewal_date: { type: "string" },
                  payroll_vendor: { type: "string" },
                  pay_frequency: { type: "string" },
                  has_401k: { type: "boolean" },
                  has_1099: { type: "boolean" },
                  ca_contractors: { type: "boolean" },
                  has_handbook: { type: "boolean" },
                  key_challenges: { type: "string" },
                  business_goals: { type: "string" },
                  reply: { type: "string", description: "A natural conversational reply from Lenore, the gothic HR advisor. Keep her tone intelligent, warm, and slightly literary. Ask a follow-up question to continue the discovery." },
                },
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_chamber_data" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) return json({ error: "Rate limited, please try again shortly." }, 429);
      if (response.status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: "AI extraction failed" }, 500);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) return json({ extracted: {}, reply: null });

    const args = JSON.parse(toolCall.function.arguments);
    const reply = args.reply || null;
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
    console.error("chamber-extract error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
