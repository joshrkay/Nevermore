import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { UNAVAILABLE } from "../_shared/ai/allowance.ts";
import { checkAiBudget } from "../_shared/ai/budget.ts";
import { selectAdapter } from "../_shared/ai/providers.ts";
import { AiUnavailableError, askWithinBudget, DOCUMENT_MAX_TOKENS, retryLater } from "./ask.ts";
import { MAX_EXTRACT_BYTES, type Candidate, type TextSection } from "./parse.ts";
import { readDocument, type Outcome } from "./read.ts";
import { REPORT_TOOL } from "./schema.ts";

// Reads one uploaded document into candidate intake fields. Everything runs as the calling
// user: RLS decides whether they may see the row and the stored file, so a document from
// another user or intake simply isn't found. Results are written to the document row only;
// the prospect reviews them before anything reaches the intake.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Client = SupabaseClient;


serve(async (req) => {
  const requestId = crypto.randomUUID();
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
        : await readDocument(new Uint8Array(await blob.arrayBuffer()), doc.file_name, (sections) => askModel(supabase, sections, requestId, req));
    } catch (e) {
      // Not the document's fault: leave it ready to read again rather than marking it failed.
      const later = retryLater(e);
      if (later) {
        await supabase.from("documents").update({ status: "uploaded" }).eq("id", doc.id);
        return json({ error: later.message }, later.status);
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

async function askModel(supabase: Client, sections: TextSection[], requestId: string, req: Request): Promise<Candidate[]> {
  // Check provider configuration before spending any of the budget on the request.
  const chosen = selectAdapter((name) => Deno.env.get(name), REPORT_TOOL, { maxTokens: DOCUMENT_MAX_TOKENS });
  if (!chosen.ok) {
    console.error(`AI_CONFIG_MISSING: ${chosen.problem}`);
    throw new AiUnavailableError(UNAVAILABLE);
  }

  return await askWithinBudget(sections, {
    adapter: chosen.adapter,
    model: {
      fetch: (input, init) => fetch(input, init),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => Date.now(),
    },
    requestId,
    log: (line) => console.error(line),
    // The same budget chat spends from: the caller's quota, their address's, and the daily ceiling for everyone.
    checkBudget: () =>
      checkAiBudget({
        headers: req.headers,
        env: (name) => Deno.env.get(name),
        user: supabase,
        createAdmin: (serviceRoleKey) => createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey),
        log: (line) => console.error(line),
      }),
  });
}
