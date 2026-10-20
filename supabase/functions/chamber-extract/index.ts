import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Caps keep a single request from running up AI costs.
const MAX_MESSAGE_CHARS = 2000;
const MAX_CONTEXT_CHARS = 20000;
const REQUESTS_PER_MINUTE = 15;
const REQUESTS_PER_DAY = 300;

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
- business_goals: Business goals mentioned

For every field you return, also report:
- field_status: "confirmed" if the user stated it explicitly, "inferred" if you derived or assumed it from what they said, "incomplete" if they gave only part of the answer (e.g. "a few states, mainly CA").
- evidence: the short phrase from the user's message that supports it (at most 200 characters, quoted verbatim).
- corrected_fields: list a field only when the user explicitly corrects a value already in the previous context ("actually it's 45 people, not 40").`;

const FIELD_TYPES: Record<string, unknown> = {
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
};
const FIELDS = Object.keys(FIELD_TYPES);
const FIELD_STATUSES = ["confirmed", "inferred", "incomplete"];
const MAX_EVIDENCE_CHARS = 200;

const perField = (schema: unknown) => ({
  type: "object",
  properties: Object.fromEntries(FIELDS.map((f) => [f, schema])),
  additionalProperties: false,
});

// Keeps only entries for fields that were actually extracted.
function pickPerField<T>(raw: unknown, extracted: Record<string, unknown>, ok: (v: unknown) => v is T): Record<string, T> {
  const out: Record<string, T> = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (k in extracted && ok(v)) out[k] = v;
  }
  return out;
}

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

    const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", {
      per_minute: REQUESTS_PER_MINUTE,
      per_day: REQUESTS_PER_DAY,
    });
    if (quotaError) throw quotaError;
    if (!allowed) return json({ error: "Rate limited, please try again shortly." }, 429);

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
                  ...FIELD_TYPES,
                  field_status: perField({ type: "string", enum: FIELD_STATUSES }),
                  evidence: perField({ type: "string" }),
                  corrected_fields: { type: "array", items: { type: "string", enum: FIELDS } },
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

    if (!toolCall) return json({ extracted: {}, field_status: {}, evidence: {}, corrected_fields: [], reply: null });

    const args = JSON.parse(toolCall.function.arguments);
    const reply = args.reply || null;

    // Keep known fields only, without null/empty values.
    const extracted: Record<string, unknown> = {};
    for (const k of FIELDS) {
      const v = args[k];
      if (v !== null && v !== undefined && v !== "") extracted[k] = v;
    }
    const field_status = pickPerField(args.field_status, extracted, (v): v is string =>
      typeof v === "string" && FIELD_STATUSES.includes(v));
    const evidence = Object.fromEntries(
      Object.entries(pickPerField(args.evidence, extracted, (v): v is string => typeof v === "string" && v.trim() !== ""))
        .map(([k, v]) => [k, v.trim().slice(0, MAX_EVIDENCE_CHARS)]),
    );
    const corrected_fields = Array.isArray(args.corrected_fields)
      ? args.corrected_fields.filter((f: unknown) => typeof f === "string" && f in extracted)
      : [];

    return json({ extracted, field_status, evidence, corrected_fields, reply });
  } catch (e) {
    console.error("chamber-extract error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
