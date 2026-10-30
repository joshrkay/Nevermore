import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { isServiceCall } from "./auth.ts";
import { parseAlertWebhook, sendDeadAlert } from "./alert.ts";
import { blockedKinds, readDispatchConfig } from "./config.ts";
import {
  CLAIM_LEASE_SECONDS,
  dispatchEvents,
  logLevel,
  MAX_ATTEMPTS,
  noteBlockedKinds,
  runMaintenance,
  sendableKinds,
  type DeadEvent,
  type OutboxRow,
} from "./dispatch.ts";
import { selectEmailAdapter, sendEmail } from "./providers.ts";

// Sends the queued submission emails (advisor alert and prospect confirmation) with retry and
// backoff. It works on the queue, not on anything the caller sends, so who calls it only decides
// when the queue is worked: the browser right after a submission, and a schedule as the safety
// net that also drives retries (see docs/NOTIFICATIONS.md). The schedule alone also heals
// certifications whose notifications failed to queue and reports claims a dead worker abandoned. It
// returns counts, never contents.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Sends are sequential (providers rate-limit per second), so the batch is sized to finish well
// inside both the function's time limit and the claim's lock.
const BATCH_SIZE = 10;

// Housekeeping runs ahead of the sends, so each call is cut off rather than allowed to hold them up.
const MAINTENANCE_TIMEOUT_MS = 10_000;
const RECONCILE_BATCH = 25;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const env = (name: string) => Deno.env.get(name);

const log = (line: string) => console[logLevel(line)](line);

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
    const service = isServiceCall(req.headers.get("Authorization"), serviceRoleKey);
    if (!service) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const caller = createClient(supabaseUrl, env("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await caller.auth.getUser();
      if (!user || user.is_anonymous) return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Settings are read first: a lost worker's death is reported to the alert webhook from the
    // housekeeping below, and what a kind is missing is what its events are told.
    const chosen = selectEmailAdapter(env);
    const config = readDispatchConfig(env);
    const webhook = parseAlertWebhook(env("ENGINEERING_ALERT_WEBHOOK_URL"));
    if (webhook.url === null && webhook.problem) console.error(`OUTBOX_CONFIG_MISSING: ${webhook.problem}`);
    const webhookUrl = webhook.url;
    const queueUrl = config.advisor.ok ? `${config.advisor.appBaseUrl}/advisor/outbox?status=dead` : null;
    const alertDead = webhookUrl ? (event: DeadEvent) => sendDeadAlert(webhookUrl, { ...event, queueUrl }, { fetch }) : undefined;

    // Housekeeping is the schedule's job, never a browser's: a prospect must not be able to drive
    // database work or read queue health. It needs only the database, so it runs before the email
    // configuration gate, and ahead of the claim so what it queues is sent in this same run.
    const maintenance = service
      ? await runMaintenance({
          reap: async () => {
            const { data, error } = await admin
              .rpc("reap_outbox_events", { p_max_attempts: MAX_ATTEMPTS })
              .abortSignal(AbortSignal.timeout(MAINTENANCE_TIMEOUT_MS));
            if (error) throw error;
            return data;
          },
          reconcile: async () => {
            const { data, error } = await admin
              .rpc("reconcile_outbox_events", { p_limit: RECONCILE_BATCH })
              .abortSignal(AbortSignal.timeout(MAINTENANCE_TIMEOUT_MS));
            if (error) throw error;
            return data;
          },
          alertDead,
          log,
        })
      : null;

    // What stops a kind from being sent is logged, and (on the schedule's runs) written on that
    // kind's waiting events, so an advisor looking at the queue sees why they are not moving.
    const blocked = blockedKinds(config, chosen.ok ? null : chosen.problem);
    if (!chosen.ok) console.error(`OUTBOX_CONFIG_MISSING: ${chosen.problem}`);
    else for (const b of blocked) console.error(`OUTBOX_CONFIG_MISSING: ${b.kind} is not being sent: ${b.problem}`);
    if (service) {
      await noteBlockedKinds(
        blocked,
        async (kind, problem) => {
          const { error } = await admin
            .rpc("note_outbox_config_problem", { p_kind: kind, p_error: problem })
            .abortSignal(AbortSignal.timeout(MAINTENANCE_TIMEOUT_MS));
          if (error) throw error;
        },
        log,
      );
    }
    if (!chosen.ok) return json({ error: "Notifications are unavailable right now." }, 503);
    const kinds = sendableKinds(config);
    if (kinds.length === 0) return json({ error: "Notifications are unavailable right now." }, 503);

    const { data, error } = await admin.rpc("claim_outbox_events", {
      p_kinds: kinds,
      p_batch: BATCH_SIZE,
      p_max_attempts: MAX_ATTEMPTS,
      p_lock_seconds: CLAIM_LEASE_SECONDS,
    });
    if (error) throw error;
    const rows = (data ?? []) as OutboxRow[];

    const summary = await dispatchEvents(rows, {
      config,
      now: () => Date.now(),
      send: (message, key) => sendEmail(chosen.adapter, message, key, { fetch }),
      freeze: async (id, attempt, message, replace) => {
        const { data: stored, error: e } = await admin.rpc("freeze_outbox_message", {
          p_id: id,
          p_attempt: attempt,
          p_message: message,
          p_replace: replace,
        });
        if (e) throw e;
        return stored;
      },
      complete: async (id, messageId) => {
        const { error: e } = await admin.rpc("complete_outbox_event", { p_id: id, p_message_id: messageId });
        if (e) throw e;
      },
      fail: async (id, reason, retryInSeconds, attempt, definitive) => {
        const { error: e } = await admin.rpc("fail_outbox_event", {
          p_id: id,
          p_error: reason,
          p_retry_in_seconds: retryInSeconds,
          p_attempt: attempt,
          p_definitive: definitive,
        });
        if (e) throw e;
      },
      alertDead,
      log,
    });
    return json({ claimed: rows.length, ...summary, ...maintenance });
  } catch (e) {
    // Database errors are plain objects with a message, not Error instances.
    console.error(`OUTBOX_DISPATCH_ERROR: ${(e as { message?: string } | null)?.message ?? "unknown"}`);
    return json({ error: "Internal error" }, 500);
  }
});
