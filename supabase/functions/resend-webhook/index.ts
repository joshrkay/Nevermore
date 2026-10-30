import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { readBodyCapped } from "./body.ts";
import { handleWebhook, logLevel, MAX_BODY_BYTES, type RecordInput, type RecordResult } from "./handler.ts";
import { protectedAddresses, recordArgs } from "./rpc.ts";

// Receives the email provider's webhooks (bounces, spam complaints, delays) and records them. It
// is called by the provider, which holds no Supabase login, so the gateway's JWT check is off for
// it (supabase/config.toml) and the request is trusted only if its signature verifies against
// RESEND_WEBHOOK_SECRET. See docs/NOTIFICATIONS.md.

const DB_TIMEOUT_MS = 10_000;

const log = (line: string) => console[logLevel(line)](line);
const env = (name: string) => Deno.env.get(name);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  try {
    // Nothing is read, and no client built, until the request has shown it is one we can act on:
    // this endpoint is open to the internet, and its signature is checked only after the body is in.
    let body = "";
    if (req.method === "POST") {
      const read = await readBodyCapped(req.headers.get("content-length"), req.body, MAX_BODY_BYTES);
      if (!read.ok) return json(413, { error: "Payload too large" });
      body = read.text;
    }

    const { status, body: payload } = await handleWebhook(
      { method: req.method, header: (name) => req.headers.get(name), body },
      {
        secret: env("RESEND_WEBHOOK_SECRET"),
        protectedAddresses: protectedAddresses(env("ADVISORY_NOTIFY_EMAIL")),
        now: () => Date.now(),
        record: async (input: RecordInput): Promise<RecordResult> => {
          const supabaseUrl = env("SUPABASE_URL");
          const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
          if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set");
          // Built only for a verified event, and told not to start a session-refresh timer: a client
          // per request that never stops one would pile timers up in a warm isolate.
          const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
          const { data, error } = await admin.rpc("record_email_delivery_event", recordArgs(input)).abortSignal(AbortSignal.timeout(DB_TIMEOUT_MS));
          if (error) throw error;
          return (data ?? {}) as RecordResult;
        },
        log,
      },
    );
    return json(status, payload);
  } catch {
    // Never echo what went wrong; the provider retries a 5xx.
    console.error("WEBHOOK_ERROR: the request could not be processed");
    return json(500, { error: "Internal error" });
  }
});
