// purge-intakes carries out intake deletions (US-6.1): the retention job's (closed drafts kept past their
// window) and an admin's (public.request_intake_deletion). The database decides what is deleted and when
// (migration 20261104092000_data_retention_and_deletion.sql); this function does the one part SQL can't, removing the
// stored files through the Storage API, and then asks the database to delete the rows. Files go first,
// and the database refuses to delete the rows while any file is still stored (EA006), so a row is never
// gone while its file stays behind. index.ts wires in Deno and the real Supabase client; the tests wire in
// fakes. No remote imports, so it runs under Deno and Vitest alike.
//
// Only the schedule may call it: the caller must present the service-role key. It answers with counts,
// never ids of what it removed. Its log lines carry the deletion's and the intake's ids, counts and failure
// kinds only (docs/RUNBOOK.md re-deletes intakes after a restore from DELETION_DONE lines). File names are
// never logged: they are the names prospects gave their files.

import { parseAlertWebhook, postAlert } from "../_shared/alertWebhook.ts";
import { isServiceCall } from "../_shared/serviceAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Claims are small so each run finishes well inside the function's time limit and the claim's lock.
export const CLAIM_BATCH = 5;
export const CLAIM_LOCK_SECONDS = 600;
// Storage removes up to this many paths per call.
export const REMOVE_CHUNK = 100;
// Stop claiming more once a run has used this much time; what is left waits for the next run.
export const TIME_BUDGET_MS = 40_000;
// Belt and braces against a loop that keeps finding work.
const MAX_BATCHES = 20;

/** How long to wait before attempt n + 1, after attempt n failed. The database gives up after its last attempt. */
export function retryDelaySeconds(attempt: number): number {
  const delays = [300, 1_800, 7_200, 21_600];
  return delays[Math.min(Math.max(attempt, 1), delays.length) - 1];
}

type RpcResult = { data: unknown; error: unknown };

/** The parts of a Supabase client this function uses. */
export interface PurgeClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
  storage: {
    from: (bucket: string) => {
      remove: (paths: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
    };
  };
}

export interface PurgeDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string) => PurgeClient;
  fetch: typeof fetch;
  now: () => number;
  log: (line: string) => void;
}

interface Claimed {
  id: string;
  session_id: string;
  attempt: number;
}

interface StoredFile {
  bucket: string;
  name: string;
}

export interface PurgeSummary {
  claimed: number;
  done: number;
  retrying: number;
  failed: number;
  files_deleted: number;
}

/** A step that failed, with the failure kind the database records (no names, no provider text). */
class StepFailed extends Error {
  kind: string;
  constructor(kind: string) {
    super(kind);
    this.kind = kind;
  }
}

const errorCode = (error: unknown): string => {
  const e = error as { code?: unknown; status?: unknown; statusCode?: unknown } | null;
  const code = e?.code ?? e?.statusCode ?? e?.status;
  return typeof code === "string" || typeof code === "number" ? String(code) : "error";
};

const errorDetail = (error: unknown): string => {
  const detail = (error as { details?: unknown } | null)?.details;
  return typeof detail === "string" || typeof detail === "number" ? String(detail) : "?";
};

async function listFiles(client: PurgeClient, id: string): Promise<StoredFile[]> {
  const { data, error } = await client.rpc("intake_deletion_files", { p_deletion_id: id });
  if (error) throw new StepFailed(`rpc_files:${errorCode(error)}`);
  return Array.isArray(data) ? (data as StoredFile[]) : [];
}

/** Removes every stored file of one deletion, then checks storage really is empty for it. Returns how many went. */
async function removeFiles(client: PurgeClient, id: string): Promise<number> {
  const files = await listFiles(client, id);
  const byBucket = new Map<string, string[]>();
  for (const f of files) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.name]);

  let removed = 0;
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += REMOVE_CHUNK) {
      const { data, error } = await client.storage.from(bucket).remove(names.slice(i, i + REMOVE_CHUNK));
      if (error) throw new StepFailed(`storage_remove:${errorCode(error)}`);
      removed += Array.isArray(data) ? data.length : 0;
    }
  }

  // Storage answers success with an empty list when it removed nothing, so the database's own listing is
  // what says the files are gone.
  const remaining = (await listFiles(client, id)).length;
  if (remaining > 0) throw new StepFailed(`files_remain:${remaining}`);
  return removed;
}

const rowsIn = (removed: unknown): number =>
  removed && typeof removed === "object"
    ? Object.values(removed as Record<string, unknown>).reduce<number>((n, v) => n + (typeof v === "number" ? v : 0), 0)
    : 0;

/** Works the queue until it is empty or the time budget is spent. */
export async function runPurge(
  client: PurgeClient,
  deps: {
    now: () => number;
    log: (line: string) => void;
    alertFailed?: (deletion: string, intake: string, attempts: number, reason: string) => Promise<boolean>;
  },
): Promise<PurgeSummary> {
  const started = deps.now();
  const summary: PurgeSummary = { claimed: 0, done: 0, retrying: 0, failed: 0, files_deleted: 0 };

  for (let batch = 0; batch < MAX_BATCHES && deps.now() - started < TIME_BUDGET_MS; batch++) {
    const { data, error } = await client.rpc("claim_intake_deletions", { p_batch: CLAIM_BATCH, p_lock_seconds: CLAIM_LOCK_SECONDS });
    if (error) throw new StepFailed(`rpc_claim:${errorCode(error)}`);
    const claimed = (Array.isArray(data) ? data : []) as Claimed[];
    if (claimed.length === 0) break;
    summary.claimed += claimed.length;

    for (const d of claimed) {
      try {
        const files = await removeFiles(client, d.id);
        const { data: removed, error: completeError } = await client.rpc("complete_intake_deletion", { p_deletion_id: d.id, p_files_deleted: files });
        if (completeError) {
          // A file stored after the listing (an upload racing the deletion) is caught here.
          const code = errorCode(completeError);
          throw new StepFailed(code === "EA006" ? `files_remain:${errorDetail(completeError)}` : `rpc_complete:${code}`);
        }
        summary.done++;
        summary.files_deleted += files;
        deps.log(`DELETION_DONE deletion=${d.id} intake=${d.session_id} files=${files} rows=${rowsIn(removed)}`);
      } catch (e) {
        const reason = e instanceof StepFailed ? e.kind : "unexpected";
        const retryIn = retryDelaySeconds(d.attempt);
        const { data: outcome, error: failError } = await client.rpc("fail_intake_deletion", {
          p_deletion_id: d.id,
          p_error: reason,
          p_retry_in_seconds: retryIn,
        });
        if (failError) {
          // Its claim lapses and a later run takes it again.
          deps.log(`DELETION_ERROR deletion=${d.id} intake=${d.session_id} attempt=${d.attempt} reason=${reason} record=rpc_fail:${errorCode(failError)}`);
          summary.retrying++;
        } else if (outcome === "failed") {
          summary.failed++;
          deps.log(`DELETION_FAILED deletion=${d.id} intake=${d.session_id} attempts=${d.attempt} reason=${reason}`);
          await deps.alertFailed?.(d.id, d.session_id, d.attempt, reason);
        } else {
          summary.retrying++;
          deps.log(`DELETION_RETRY deletion=${d.id} intake=${d.session_id} attempt=${d.attempt} reason=${reason} retry_in=${retryIn}s`);
        }
      }
    }
  }
  return summary;
}

/** The line a person reads in the channel when a deletion has run out of attempts. */
export function failedAlertText(deletion: string, intake: string, attempts: number, reason: string): string {
  return `DELETION_FAILED: an intake deletion gave up after ${attempts} attempt(s) and needs an operator. deletion=${deletion} intake=${intake} reason=${reason}. See "Deletion failed" in docs/RUNBOOK.md; retry it with public.retry_intake_deletion once the cause is fixed.`;
}

export async function handleRequest(req: Request, deps: PurgeDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = deps.env("SUPABASE_URL");
    const serviceRoleKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      deps.log("PURGE_CONFIG_MISSING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set");
      return json({ error: "Unavailable" }, 503);
    }
    // Only the schedule. A signed-in user, even an admin, asks for a deletion in the database instead.
    if (!isServiceCall(req.headers.get("Authorization"), serviceRoleKey)) return json({ error: "Unauthorized" }, 401);

    const webhook = parseAlertWebhook(deps.env("ENGINEERING_ALERT_WEBHOOK_URL"));
    if (webhook.url === null && webhook.problem) deps.log(`PURGE_CONFIG_MISSING: ${webhook.problem}`);
    const webhookUrl = webhook.url;
    const alertFailed = webhookUrl
      ? (deletion: string, intake: string, attempts: number, reason: string) =>
          postAlert(
            webhookUrl,
            { text: failedAlertText(deletion, intake, attempts, reason), source: "purge-intakes", alert: "DELETION_FAILED", deletion, intake, attempts, reason },
            { fetch: deps.fetch },
          )
      : undefined;

    const summary = await runPurge(deps.createClient(supabaseUrl, serviceRoleKey), { now: deps.now, log: deps.log, alertFailed });
    return json(summary);
  } catch (e) {
    deps.log(`PURGE_ERROR: ${e instanceof StepFailed ? e.kind : "unexpected"}`);
    return json({ error: "Internal error" }, 500);
  }
}
