import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleWebhook, logLevel, type RecordInput, type RecordResult } from "./handler.ts";

// Receives the email provider's webhooks (bounces, spam complaints, delays) and records them. It
// is called by the provider, which holds no Supabase login, so the gateway's JWT check is off for
// it (supabase/config.toml) and the request is trusted only if its signature verifies against
// RESEND_WEBHOOK_SECRET. See docs/NOTIFICATIONS.md.

const DB_TIMEOUT_MS = 10_000;

const log = (line: string) => console[logLevel(line)](line);
const env = (name: string) => Deno.env.get(name);

/** The advisory team's addresses, which a bounce must never suppress. */
const protectedAddresses = () =>
  (env("ADVISORY_NOTIFY_EMAIL") ?? "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);

serve(async (req) => {
  const supabaseUrl = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

  try {
    const body = await req.text();
    const { status, body: payload } = await handleWebhook(
      { method: req.method, header: (name) => req.headers.get(name), body },
      {
        secret: env("RESEND_WEBHOOK_SECRET"),
        protectedAddresses: protectedAddresses(),
        now: () => Date.now(),
        record: async (input: RecordInput): Promise<RecordResult> => {
          if (!admin) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set");
          const { data, error } = await admin
            .rpc("record_email_delivery_event", {
              p_event_id: input.eventId,
              p_type: input.type,
              p_message_id: input.messageId,
              p_recipients: input.recipients,
              p_bounce_type: input.bounceType,
              p_detail: input.detail,
              p_occurred_at: input.occurredAt,
              p_protected: input.protectedAddresses,
            })
            .abortSignal(AbortSignal.timeout(DB_TIMEOUT_MS));
          if (error) throw error;
          return (data ?? {}) as RecordResult;
        },
        log,
      },
    );
    return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
  } catch {
    // Never echo what went wrong; the provider retries a 5xx.
    console.error("WEBHOOK_ERROR: the request could not be processed");
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
