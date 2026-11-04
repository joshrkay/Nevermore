// document-scan settles every document whose malware scan is still pending (E-4.3; migration
// 20261104130000_document_scanning.sql): one document-upload couldn't scan when it was uploaded (the scanner
// was unreachable or not set up), one whose verdict didn't get recorded, and every document uploaded before
// scanning existed. It runs every five minutes, from the database's schedule, and:
//
//   claim_document_scans ─► download from the bucket the file is in ─► scan
//     clean / skipped ─► copy into documents (from quarantine) ─► record_document_scan ─► drop the quarantined copy
//     infected        ─► record_document_scan (malware_detected) ─► move into quarantine (if it was in documents) ─► alert
//     no verdict      ─► fail_document_scan: retried with backoff; after six attempts `failed` (scan_failed);
//                        a document with no stored file fails at once
//
// then settles files whose document was removed before its scan passed (withheld_files_due): deletes them,
// or, for a submission's certified file kept for the advisor, scans it and releases it once clean; and then
// removes quarantined copies nothing holds any more (document_scan_orphans). Until a document's verdict
// passes, nobody but the service role can read its file: quarantine has no policies, and the documents
// bucket's read policies refuse a file whose row is not clean, or whose row was removed before it was
// (is_withheld_document_file).
//
// Alerts: MALWARE_DETECTED at once for every detection, and one SCAN_FAILED per run that gave up on any
// document, with the count and reasons. Each failure is also a scan_failed event, which ops-monitor alerts on
// at most hourly, so a flood of failures (forged rows with no file, a long scanner outage) is one alert a run.
//
// Only the schedule may call it: the caller must present the service-role key. It answers with counts. Its
// log lines carry document and intake ids, signatures and failure kinds, never file names. index.ts wires in
// Deno and the real Supabase client; the tests wire in fakes. No remote imports.

import { STORED_CONTENT_TYPE } from "../_shared/fileSignature.ts";
import { malwareAlert, postScanAlert, selectScanner, type ScannerDeps, type ScanResult } from "../_shared/malwareScan.ts";
import { isServiceCall } from "../_shared/serviceAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// One document is claimed at a time, so a slow scan never holds others past their claim.
export const CLAIM_LOCK_SECONDS = 300;
// Stop claiming once a run has used this much time: a scan may take a minute more (SCAN_TIMEOUT_MS), and the
// function itself is stopped at 150 seconds.
export const TIME_BUDGET_MS = 45_000;
export const MAX_PER_RUN = 50;
export const ORPHAN_BATCH = 100;
export const WITHHELD_BATCH = 50;

/** How long to wait before attempt n + 1, after attempt n couldn't scan. The database gives up after its sixth. */
export function retryDelaySeconds(attempt: number): number {
  const delays = [300, 900, 3_600, 14_400, 43_200];
  return delays[Math.min(Math.max(attempt, 1), delays.length) - 1];
}

type DbError = { message?: string; code?: string } | null;

/** The parts of a Supabase client (service role) this function uses. */
export interface ScanClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: DbError }>;
  storage: {
    from: (bucket: string) => {
      download: (path: string) => PromiseLike<{ data: Blob | null; error: unknown }>;
      upload: (path: string, body: Uint8Array, options: { contentType: string; upsert: boolean }) => PromiseLike<{ data: unknown; error: unknown }>;
      remove: (paths: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
    };
  };
}

export interface ScanDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string) => ScanClient;
  scanner: ScannerDeps;
  fetch: typeof fetch;
  now: () => number;
  log: (line: string) => void;
}

type Bucket = "quarantine" | "documents";

interface Claimed {
  document_id: string;
  storage_path: string;
  attempt: number;
  /** Where the file is now: quarantine, documents, or neither. */
  bucket: Bucket | null;
  /** The document's intake; null for an upload from before intakes. Never read it from the path. */
  session_id: string | null;
}

/** A file whose document was removed before its scan passed (public.withheld_files_due). */
interface Withheld {
  storage_path: string;
  session_id: string | null;
  verdict: "pending" | "infected";
  /** A submission's certified file, kept for the advisor: scanned and released, never deleted. */
  evidence: boolean;
  bucket: Bucket | null;
}

export interface ScanSummary {
  claimed: number;
  clean: number;
  skipped: number;
  infected: number;
  retrying: number;
  failed: number;
  gone: number;
  withheld_removed: number;
  withheld_released: number;
  orphans_removed: number;
}

const errorCode = (error: unknown): string => {
  const e = error as { code?: unknown; statusCode?: unknown; status?: unknown } | null;
  const code = e?.code ?? e?.statusCode ?? e?.status;
  return typeof code === "string" || typeof code === "number" ? String(code) : "error";
};

/** The reasons documents were given up on this run, as "file_missing x3, timeout x1". */
const reasonCounts = (reasons: string[]) =>
  [...reasons.reduce((m, r) => m.set(r, (m.get(r) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([r, n]) => `${r} x${n}`)
    .join(", ");

/** The line a person reads in the channel when a run gave up on scanning documents. */
export function scanFailedAlertText(count: number, reasons: string): string {
  return `SCAN_FAILED: ${count} uploaded document(s) could not be scanned for malware and were given up on, so nobody can open them. Reasons: ${reasons}. Follow the "Scan failed" playbook in docs/RUNBOOK.md; requeue them with public.requeue_document_scan once the cause is fixed.`;
}

/**
 * After copying a file into a bucket: a deletion of its intake may have checked the intake's files while the
 * copy was on its way (SR-15). Asking waits for such a deletion to finish; if the intake is gone or being
 * deleted, the copy is taken back, or it would be left behind. True when the copy may stay. A file with no
 * intake (an upload from before intakes) has no intake deletion to race.
 */
async function keepCopy(client: ScanClient, intake: string | null, bucket: Bucket, path: string): Promise<boolean> {
  if (!intake) return true;
  const { data: accepts, error } = await client.rpc("intake_accepts_files", { p_session: intake });
  if (error || accepts !== false) return true;
  await client.storage.from(bucket).remove([path]);
  return false;
}

type Scanner = { scan(bytes: Uint8Array): Promise<ScanResult> };

/** Scans one claimed document and records what happened. Reasons it gave up go into `failures`. */
async function settle(client: ScanClient, c: Claimed, scanner: Scanner, deps: ScanDeps, summary: ScanSummary, failures: string[]) {
  const id = c.document_id;
  const path = c.storage_path;
  const intake = c.session_id ?? null;
  const keep = async (bucket: Bucket) => {
    if (await keepCopy(client, intake, bucket, path)) return true;
    summary.gone++;
    return false;
  };

  const fail = async (reason: string) => {
    const { data: outcome, error } = await client.rpc("fail_document_scan", {
      p_document_id: id,
      p_error: reason,
      p_retry_in_seconds: retryDelaySeconds(c.attempt),
    });
    if (error) {
      // Its claim lapses and a later run takes it again.
      deps.log(`SCAN_ERROR document=${id} attempt=${c.attempt} reason=${reason} record=rpc_fail:${errorCode(error)}`);
      summary.retrying++;
    } else if (outcome === "failed") {
      summary.failed++;
      failures.push(reason);
      deps.log(`SCAN_FAILED document=${id} attempts=${c.attempt} reason=${reason}`);
    } else if (outcome === "gone") {
      summary.gone++;
    } else {
      summary.retrying++;
      deps.log(`SCAN_RETRY document=${id} attempt=${c.attempt} reason=${reason} retry_in=${retryDelaySeconds(c.attempt)}s`);
    }
  };

  const record = async (scan: Exclude<ScanResult, { verdict: "unavailable" }>): Promise<"recorded" | "gone" | "error"> => {
    const { error } = await client.rpc("record_document_scan", {
      p_document_id: id,
      p_verdict: scan.verdict,
      p_signature: scan.verdict === "infected" ? scan.signature : null,
      p_source: "document-scan",
    });
    if (!error) return "recorded";
    if (error.code === "PT404") return "gone";
    await fail(`rpc_record:${errorCode(error)}`);
    return "error";
  };

  if (!c.bucket) return await fail("file_missing");
  const { data: blob, error: downloadError } = await client.storage.from(c.bucket).download(path);
  if (downloadError || !blob) return await fail(`storage_download:${errorCode(downloadError)}`);
  const bytes = new Uint8Array(await blob.arrayBuffer());

  const scan = await scanner.scan(bytes);
  if (scan.verdict === "unavailable") return await fail(scan.reason);

  if (scan.verdict === "clean" || scan.verdict === "skipped") {
    if (c.bucket === "quarantine") {
      const { error } = await client.storage.from("documents").upload(path, bytes, { contentType: STORED_CONTENT_TYPE, upsert: true });
      if (error) return await fail(`storage_release:${errorCode(error)}`);
      if (!(await keep("documents"))) return;
    }
    const recorded = await record(scan);
    if (recorded === "error") return;
    if (recorded === "gone") {
      // Removed while it was scanned: take back the copy just made, and leave the quarantined one to the orphan sweep.
      if (c.bucket === "quarantine") await client.storage.from("documents").remove([path]);
      summary.gone++;
      return;
    }
    if (c.bucket === "quarantine") {
      const { error } = await client.storage.from("quarantine").remove([path]);
      // The orphan sweep removes it next time.
      if (error) deps.log(`SCAN_QUARANTINE_NOT_REMOVED document=${id} code=${errorCode(error)}`);
    }
    if (scan.verdict === "clean") summary.clean++;
    else summary.skipped++;
    return;
  }

  // Infected. Recorded first, so the file is withheld wherever it is while it moves.
  const recorded = await record(scan);
  if (recorded === "error") return;
  if (recorded === "gone") {
    summary.gone++;
    return;
  }
  summary.infected++;
  deps.log(`MALWARE_DETECTED source=document-scan document=${id} engine=${scan.engine} signature=${scan.signature}`);
  if (c.bucket === "documents") {
    // An upload from before scanning: it moves into quarantine. If the move fails, its row still withholds it.
    const { error: copyError } = await client.storage.from("quarantine").upload(path, bytes, { contentType: STORED_CONTENT_TYPE, upsert: true });
    const { error: removeError } = copyError ? { error: null } : await client.storage.from("documents").remove([path]);
    if (copyError || removeError) deps.log(`SCAN_QUARANTINE_MOVE_FAILED document=${id} code=${errorCode(copyError ?? removeError)}`);
    if (!copyError) await keep("quarantine");
  }
  await postScanAlert(deps, malwareAlert({ document: id, intake, signature: scan.signature, engine: scan.engine, source: "document-scan" }));
}

/**
 * Settles one file whose document was removed before its scan passed. Any other file is deleted from both
 * buckets; a submission's certified file is scanned, and released once clean or quarantined for good once
 * infected. Anything that doesn't settle (a storage error, no scanner, no verdict) is tried next run.
 */
async function settleWithheld(client: ScanClient, w: Withheld, scanner: Scanner | null, deps: ScanDeps, summary: ScanSummary) {
  const path = w.storage_path;
  const settled = async (outcome: "removed" | "released" | "infected", signature: string | null = null) => {
    const { error } = await client.rpc("settle_withheld_file", { p_storage_path: path, p_outcome: outcome, p_signature: signature });
    if (error) deps.log(`SCAN_WITHHELD_ERROR intake=${w.session_id ?? "-"} record=rpc_settle:${errorCode(error)}`);
    return !error;
  };

  if (!w.bucket) {
    await settled("removed");
    return;
  }
  if (!w.evidence) {
    for (const bucket of ["documents", "quarantine"] as const) {
      const { error } = await client.storage.from(bucket).remove([path]);
      if (error) {
        deps.log(`SCAN_WITHHELD_ERROR intake=${w.session_id ?? "-"} code=storage_remove:${errorCode(error)}`);
        return;
      }
    }
    if (await settled("removed")) summary.withheld_removed++;
    return;
  }

  // A certified file, kept for the advisor: it is read only once its scan passes.
  if (!scanner) return;
  const { data: blob, error: downloadError } = await client.storage.from(w.bucket).download(path);
  if (downloadError || !blob) {
    deps.log(`SCAN_WITHHELD_ERROR intake=${w.session_id ?? "-"} code=storage_download:${errorCode(downloadError)}`);
    return;
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const scan = await scanner.scan(bytes);
  if (scan.verdict === "unavailable") {
    deps.log(`SCAN_WITHHELD_RETRY intake=${w.session_id ?? "-"} reason=${scan.reason}`);
    return;
  }
  if (scan.verdict === "clean" || scan.verdict === "skipped") {
    if (w.bucket === "quarantine") {
      const { error } = await client.storage.from("documents").upload(path, bytes, { contentType: STORED_CONTENT_TYPE, upsert: true });
      if (error) {
        deps.log(`SCAN_WITHHELD_ERROR intake=${w.session_id ?? "-"} code=storage_release:${errorCode(error)}`);
        return;
      }
      if (!(await keepCopy(client, w.session_id, "documents", path))) return;
    }
    if (!(await settled("released"))) return;
    summary.withheld_released++;
    if (w.bucket === "quarantine") await client.storage.from("quarantine").remove([path]);
    return;
  }
  // Infected: recorded first (it stays withheld whatever happens next), then moved into quarantine.
  if (!(await settled("infected", scan.signature))) return;
  summary.infected++;
  deps.log(`MALWARE_DETECTED source=document-scan document=- intake=${w.session_id ?? "-"} engine=${scan.engine} signature=${scan.signature}`);
  if (w.bucket === "documents") {
    const { error: copyError } = await client.storage.from("quarantine").upload(path, bytes, { contentType: STORED_CONTENT_TYPE, upsert: true });
    if (!copyError && (await keepCopy(client, w.session_id, "quarantine", path))) await client.storage.from("documents").remove([path]);
  }
  await postScanAlert(deps, malwareAlert({ document: "-", intake: w.session_id, signature: scan.signature, engine: scan.engine, source: "document-scan" }));
}

/** Works through the files whose document was removed before its scan passed. */
async function settleAllWithheld(client: ScanClient, scanner: Scanner | null, deps: ScanDeps, summary: ScanSummary) {
  const { data, error } = await client.rpc("withheld_files_due", { p_limit: WITHHELD_BATCH });
  if (error) {
    deps.log(`SCAN_WITHHELD_ERROR record=rpc_due:${errorCode(error)}`);
    return;
  }
  for (const w of (Array.isArray(data) ? data : []) as Withheld[]) {
    try {
      await settleWithheld(client, w, scanner, deps, summary);
    } catch {
      deps.log(`SCAN_WITHHELD_ERROR intake=${w.session_id ?? "-"} code=unexpected`);
    }
  }
}

/** Removes quarantined copies that no document holds there any more. */
async function removeOrphans(client: ScanClient, deps: ScanDeps): Promise<number> {
  const { data, error } = await client.rpc("document_scan_orphans", { p_limit: ORPHAN_BATCH });
  if (error) {
    deps.log(`SCAN_ORPHANS_ERROR code=${errorCode(error)}`);
    return 0;
  }
  const names = (Array.isArray(data) ? data : []).map((r) => (r as { name?: unknown }).name).filter((n): n is string => typeof n === "string");
  if (names.length === 0) return 0;
  const { data: removed, error: removeError } = await client.storage.from("quarantine").remove(names);
  if (removeError) {
    deps.log(`SCAN_ORPHANS_ERROR code=storage_remove:${errorCode(removeError)}`);
    return 0;
  }
  return Array.isArray(removed) ? removed.length : 0;
}

/** Works the queue until it is empty or the time budget is spent, then sweeps orphans. */
export async function runScans(client: ScanClient, deps: ScanDeps): Promise<ScanSummary> {
  const started = deps.now();
  const summary: ScanSummary = {
    claimed: 0, clean: 0, skipped: 0, infected: 0, retrying: 0, failed: 0, gone: 0, withheld_removed: 0, withheld_released: 0, orphans_removed: 0,
  };
  const failures: string[] = [];

  const choice = selectScanner(deps.env, deps.scanner);
  if (!choice.ok) {
    // Nothing is claimed, so no attempt is spent; pending files stay unreadable until a scanner is set.
    deps.log(`SCAN_CONFIG_MISSING: ${choice.problem}`);
    const { error } = await client.rpc("record_ops_event", { p_kind: "scan_failed", p_source: "document-scan", p_code: "config_missing" });
    if (error) deps.log(`SCAN_ERROR record=rpc_event:${errorCode(error)}`);
  } else {
    while (summary.claimed < MAX_PER_RUN && deps.now() - started < TIME_BUDGET_MS) {
      const { data, error } = await client.rpc("claim_document_scans", { p_batch: 1, p_lock_seconds: CLAIM_LOCK_SECONDS });
      if (error) throw new Error(`rpc_claim:${errorCode(error)}`);
      const claimed = (Array.isArray(data) ? data : []) as Claimed[];
      if (claimed.length === 0) break;
      for (const c of claimed) {
        summary.claimed++;
        try {
          await settle(client, c, choice.scanner, deps, summary, failures);
        } catch {
          // Its claim lapses and a later run takes it again (the attempt is spent).
          deps.log(`SCAN_ERROR document=${c.document_id} attempt=${c.attempt} reason=unexpected`);
          summary.retrying++;
        }
      }
    }
  }

  // One alert for everything this run gave up on: a flood of failures is one line in the channel, not one each.
  if (failures.length > 0) {
    const reasons = reasonCounts(failures);
    await postScanAlert(deps, {
      text: scanFailedAlertText(failures.length, reasons),
      source: "document-scan",
      alert: "SCAN_FAILED",
      count: failures.length,
      reasons,
    });
  }

  await settleAllWithheld(client, choice.ok ? choice.scanner : null, deps, summary);
  summary.orphans_removed = await removeOrphans(client, deps);
  return summary;
}

export async function handleScanRequest(req: Request, deps: ScanDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = deps.env("SUPABASE_URL");
    const serviceRoleKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      deps.log("SCAN_CONFIG_MISSING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set");
      return json({ error: "Unavailable" }, 503);
    }
    // Only the schedule. Nobody signed in can move a file out of quarantine.
    if (!isServiceCall(req.headers.get("Authorization"), serviceRoleKey)) return json({ error: "Unauthorized" }, 401);

    return json(await runScans(deps.createClient(supabaseUrl, serviceRoleKey), deps));
  } catch (e) {
    deps.log(`SCAN_RUN_ERROR: ${e instanceof Error && /^rpc_/.test(e.message) ? e.message : "unexpected"}`);
    return json({ error: "Internal error" }, 500);
  }
}
