import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { isServiceCall } from "./auth.ts";
import { readDispatchConfig } from "./config.ts";
import { dispatchEvents, MAX_ATTEMPTS, sendableKinds, type OutboxRow } from "./dispatch.ts";
import { selectEmailAdapter, sendEmail } from "./providers.ts";

// Sends the queued submission emails (advisor alert and prospect confirmation) with retry and
// backoff. It works on the queue, not on anything the caller sends, so who calls it only decides
// when the queue is worked: the browser right after a submission, and a schedule as the safety
// net that also drives retries (see docs/NOTIFICATIONS.md). It returns counts, never contents.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Sends are sequential (providers rate-limit per second), so the batch is sized to finish well
// inside both the function's time limit and the claim's lock.
const BATCH_SIZE = 10;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const env = (name: string) => Deno.env.get(name);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("OUTBOX_CONFIG_MISSING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set");
      return json({ error: "Notifications are unavailable right now." }, 503);
    }

    // The scheduled sweep presents the service-role key. Anyone else must be a signed-in,
    // non-guest user (the publishable anon key is a valid JWT too, so it is not enough).
    if (!isServiceCall(req.headers.get("Authorization"), serviceRoleKey)) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const caller = createClient(supabaseUrl, env("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await caller.auth.getUser();
      if (!user || user.is_anonymous) return json({ error: "Unauthorized" }, 401);
    }

    const chosen = selectEmailAdapter(env);
    if (!chosen.ok) {
      console.error(`OUTBOX_CONFIG_MISSING: ${chosen.problem}`);
      return json({ error: "Notifications are unavailable right now." }, 503);
    }
    const config = readDispatchConfig(env);
    for (const [kind, readiness] of [["advisor_notification", config.advisor], ["prospect_confirmation", config.prospect]] as const) {
      if (!readiness.ok) console.error(`OUTBOX_CONFIG_MISSING: ${kind} is not being sent: ${readiness.problems.join("; ")}`);
    }
    const kinds = sendableKinds(config);
    if (kinds.length === 0) return json({ error: "Notifications are unavailable right now." }, 503);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin.rpc("claim_outbox_events", {
      p_kinds: kinds,
      p_batch: BATCH_SIZE,
      p_max_attempts: MAX_ATTEMPTS,
    });
    if (error) throw error;
    const rows = (data ?? []) as OutboxRow[];

    const summary = await dispatchEvents(rows, {
      config,
      send: (message, key) => sendEmail(chosen.adapter, message, key, { fetch }),
      complete: async (id, messageId) => {
        const { error: e } = await admin.rpc("complete_outbox_event", { p_id: id, p_message_id: messageId });
        if (e) throw e;
      },
      fail: async (id, reason, retryInSeconds) => {
        const { error: e } = await admin.rpc("fail_outbox_event", { p_id: id, p_error: reason, p_retry_in_seconds: retryInSeconds });
        if (e) throw e;
      },
      // Failures go to the error log, where operators alert on OUTBOX_DEAD; a send is just info.
      log: (line) => (line.startsWith("OUTBOX_SENT") ? console.log : console.error)(line),
    });
    return json({ claimed: rows.length, ...summary });
  } catch (e) {
    // Database errors are plain objects with a message, not Error instances.
    console.error(`OUTBOX_DISPATCH_ERROR: ${(e as { message?: string } | null)?.message ?? "unknown"}`);
    return json({ error: "Internal error" }, 500);
  }
});
