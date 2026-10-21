import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import {
  buildPromptText,
  DOCUMENT_FIELDS,
  MAX_EXTRACT_BYTES,
  shapeAiCandidates,
  type Candidate,
  type TextSection,
} from "./parse.ts";
import { AiQuotaError, readDocument, type Outcome } from "./read.ts";

// Reads one uploaded document into candidate intake fields. Everything runs as the calling
// user: RLS decides whether they may see the row and the stored file, so a document from
// another user or intake simply isn't found. Results are written to the document row only;
// the prospect reviews them before anything reaches the intake.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUESTS_PER_MINUTE = 15;
const REQUESTS_PER_DAY = 300;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `You read business documents (benefits summaries, payroll reports, workers' comp pages, invoices) for an HR/PEO intake.
Report only company-level facts the document clearly states. Never report details about an individual person.
The text is split into numbered sections marked [[Section N]]; give the section number each fact came from.
Field meanings:
- company_name, industry, hq_state (two-letter code), states (two-letter codes, comma-separated), employee_count (integer)
- start_month: desired benefits start date; renewal_date: current policy renewal date
- virgin_medical: "yes" if they have never had employer health insurance; current_carrier: current medical carrier
- rate_history: recent premium changes; benefits_waiting_period; ancillary_benefits (comma-separated, e.g. dental, vision, life)
- has_401k, retirement_type, employer_contributes (to retirement)
- payroll_vendor, pay_frequency (weekly, bi-weekly, semi-monthly, monthly), nonexempt_count, exempt_count
- has_handbook, has_1099 (uses 1099 contractors), ca_contractors (contractors in California)
Use "yes"/"no" for yes-or-no fields. Leave out anything not stated.`;

type Client = SupabaseClient;


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { document_id } = await req.json().catch(() => ({}));
    if (typeof document_id !== "string" || !document_id) return json({ error: "document_id is required" }, 400);

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, session_id, file_name, storage_path, size_bytes, status")
      .eq("id", document_id)
      .maybeSingle();
    if (docError) throw docError;
    // Only documents attached to one of the caller's intakes can be read.
    if (!doc || !doc.session_id) return json({ error: "Not found" }, 404);

    const save = async (o: Outcome) => {
      const { error } = await supabase
        .from("documents")
        .update({
          status: o.status,
          extraction: {
            message: o.message ?? null,
            candidates: o.candidates ?? [],
            applied: {},
            extracted_at: new Date().toISOString(),
          },
        })
        .eq("id", doc.id);
      if (error) throw error;
      return json({ status: o.status });
    };

    if ((doc.size_bytes ?? 0) > MAX_EXTRACT_BYTES) return await save({ status: "too_large" });

    await supabase
      .from("documents")
      .update({ status: "processing", processing_started_at: new Date().toISOString() })
      .eq("id", doc.id);

    let outcome: Outcome;
    try {
      const { data: blob, error: downloadError } = await supabase.storage.from("documents").download(doc.storage_path);
      if (downloadError || !blob) throw new Error("download failed");
      outcome = blob.size > MAX_EXTRACT_BYTES
        ? { status: "too_large" }
        : await readDocument(new Uint8Array(await blob.arrayBuffer()), doc.file_name, (sections) => askModel(supabase, sections));
    } catch (e) {
      if (e instanceof AiQuotaError) {
        await supabase.from("documents").update({ status: "uploaded" }).eq("id", doc.id);
        return json({ error: "Rate limited, please try again shortly." }, 429);
      }
      console.error("document-extract read error:", e instanceof Error ? e.message : "unknown");
      outcome = { status: "failed" };
    }
    if (outcome.status === "extracted" && (outcome.candidates ?? []).length === 0) outcome = { status: "no_data" };
    return await save(outcome);
  } catch (e) {
    console.error("document-extract error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});

async function askModel(supabase: Client, sections: TextSection[]): Promise<Candidate[]> {
  const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", {
    per_minute: REQUESTS_PER_MINUTE,
    per_day: REQUESTS_PER_DAY,
  });
  if (quotaError) throw quotaError;
  if (!allowed) throw new AiQuotaError();

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        // JSON.stringify keeps document text in a quoted slot so it reads as data, not instructions.
        { role: "user", content: `Document text: ${JSON.stringify(buildPromptText(sections))}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_document_fields",
            description: "Report the company-level intake fields stated in the document",
            parameters: {
              type: "object",
              properties: {
                fields: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string", enum: [...DOCUMENT_FIELDS] },
                      value: { type: "string" },
                      section: { type: "integer" },
                    },
                    required: ["field", "value", "section"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["fields"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_document_fields" } },
    }),
  });

  if (!response.ok) {
    console.error("AI gateway error:", response.status);
    if (response.status === 429) throw new AiQuotaError();
    throw new Error("AI extraction failed");
  }
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return [];
  const args = JSON.parse(toolCall.function.arguments);
  return shapeAiCandidates(args.fields, sections);
}
