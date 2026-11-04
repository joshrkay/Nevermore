// ops-monitor tells engineering when application errors, failed uploads, AI failures, authorization
// failures or deletion failures cross their thresholds (US-6.4). The database holds the events and the
// thresholds and decides what to alert on (public.claim_ops_alerts, migration 20261104091000_ops_monitoring.sql),
// recording each alert so overlapping runs raise it once; this function turns each one into a log line and
// a push to ENGINEERING_ALERT_WEBHOOK_URL. It runs every five minutes from the database's schedule.
// index.ts wires in Deno and the real Supabase client; the tests wire in fakes. No remote imports, so it
// runs under Deno and Vitest alike.
//
// An alert carries the kind, the count, the window, the threshold and the most frequent failure codes,
// nothing else: the events themselves hold no intake content, and none is fetched here.

import { parseAlertWebhook, postAlert } from "../_shared/alertWebhook.ts";
import { isServiceCall } from "../_shared/serviceAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** The parts of a Supabase client this function uses. */
export interface MonitorClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
}

export interface MonitorDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string) => MonitorClient;
  fetch: typeof fetch;
  log: (line: string) => void;
}

/** One row of public.claim_ops_alerts(). */
export interface OpsAlert {
  kind: string;
  event_count: number;
  window_minutes: number;
  threshold: number;
  top_codes: string | null;
}

/** The docs/RUNBOOK.md playbook for each kind. */
export const PLAYBOOKS: Record<string, string> = {
  app_error: "Application errors",
  upload_failed: "Failed uploads",
  ai_failed: "AI failures",
  auth_denied: "Authorization failures",
  deletion_failed: "Deletion failed",
  voice_failed: "Voice failures",
  malware_detected: "Malware detected",
  scan_failed: "Scan failed",
};

/** Codes are machine codes already; anything else is dropped so a line can't be broken or padded. */
const safeCodes = (codes: string | null): string => (codes ? codes.replace(/[^A-Za-z0-9_:., -]/g, "").slice(0, 200) : "-");

/** The codes as one space-free field: "timeout x4, 42501 x1" becomes "timeout*4,42501*1". */
const logCodes = (codes: string | null): string =>
  codes ? safeCodes(codes).split(",").map((c) => c.trim().replace(/ x(\d+)$/, "*$1").replace(/ /g, "")).filter(Boolean).join(",") || "-" : "-";

export function alertLogLine(a: OpsAlert): string {
  return `OPS_ALERT kind=${a.kind} count=${a.event_count} window=${a.window_minutes}m threshold=${a.threshold} codes=${logCodes(a.top_codes)}`;
}

/** The line a person reads in the channel. */
export function alertText(a: OpsAlert): string {
  const playbook = PLAYBOOKS[a.kind] ?? "Triage";
  return `OPS_ALERT: ${a.event_count} ${a.kind} event(s) in the last ${a.window_minutes} minutes (threshold ${a.threshold}). Most frequent codes: ${safeCodes(a.top_codes)}. Follow the "${playbook}" playbook in docs/RUNBOOK.md.`;
}

const errorCode = (error: unknown): string => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "error";
};

export async function handleRequest(req: Request, deps: MonitorDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = deps.env("SUPABASE_URL");
    const serviceRoleKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      deps.log("OPS_CONFIG_MISSING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set");
      return json({ error: "Unavailable" }, 503);
    }
    // Only the schedule: claiming an alert records it, so a stray caller would swallow a real one.
    if (!isServiceCall(req.headers.get("Authorization"), serviceRoleKey)) return json({ error: "Unauthorized" }, 401);

    const { data, error } = await deps.createClient(supabaseUrl, serviceRoleKey).rpc("claim_ops_alerts", {});
    if (error) {
      deps.log(`OPS_MONITOR_ERROR: rpc_claim:${errorCode(error)}`);
      return json({ error: "Internal error" }, 500);
    }
    const alerts = (Array.isArray(data) ? data : []) as OpsAlert[];

    const webhook = parseAlertWebhook(deps.env("ENGINEERING_ALERT_WEBHOOK_URL"));
    if (alerts.length > 0 && webhook.url === null) {
      deps.log(webhook.problem
        ? `OPS_CONFIG_MISSING: ${webhook.problem}; alerts are only logged`
        : "OPS_CONFIG_MISSING: ENGINEERING_ALERT_WEBHOOK_URL is not set; alerts are only logged");
    }

    let delivered = 0;
    for (const a of alerts) {
      deps.log(alertLogLine(a));
      if (!webhook.url) continue;
      const ok = await postAlert(
        webhook.url,
        {
          text: alertText(a),
          source: "ops-monitor",
          alert: "OPS_ALERT",
          kind: a.kind,
          count: a.event_count,
          window_minutes: a.window_minutes,
          threshold: a.threshold,
          codes: a.top_codes ?? null,
          playbook: PLAYBOOKS[a.kind] ?? null,
        },
        { fetch: deps.fetch },
      );
      if (ok) delivered++;
      // The alert is already recorded as raised, so its cooldown has started either way; the log line stands.
      else deps.log(`OPS_ALERT_UNDELIVERED kind=${a.kind}`);
    }
    return json({ alerts: alerts.length, delivered });
  } catch {
    deps.log("OPS_MONITOR_ERROR: unexpected");
    return json({ error: "Internal error" }, 500);
  }
}
