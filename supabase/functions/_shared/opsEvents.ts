// Records an operational event (public.ops_events, migration 20261104091000_ops_monitoring.sql) from an
// edge function, through public.record_ops_event with the service role. ops-monitor alerts when a kind
// crosses its threshold. No remote imports, so it runs under Deno, Node's type stripping and Vitest alike.
//
// Best effort: monitoring must never change what a function answers. The call is bounded by a short
// timeout, never throws, and resolves to whether the event was recorded. An event carries a kind, the
// function's name and a short machine code (`provider_error:503`, `timeout:-`, `config_missing`), never
// a message, a provider's text or anything the prospect sent.

export type OpsEventKind = "app_error" | "upload_failed" | "ai_failed" | "auth_denied" | "deletion_failed";

export interface OpsEvent {
  kind: OpsEventKind;
  /** The function that saw it, e.g. `chamber-extract`. */
  source: string;
  code: string | null;
  userId?: string | null;
  sessionId?: string | null;
}

/** The part of a Supabase client this needs. */
export interface OpsRpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
}

export const OPS_EVENT_TIMEOUT_MS = 2_000;

/** The code for a failed model call: its kind and HTTP status, e.g. `provider_error:503` or `timeout:-`. */
export function aiFailureCode(result: { kind: string; httpStatus?: number | null }): string {
  return `${result.kind}:${result.httpStatus ?? "-"}`;
}

export async function recordOpsEvent(
  client: OpsRpcClient | null,
  event: OpsEvent,
  opts: { timeoutMs?: number; log?: (line: string) => void } = {},
): Promise<boolean> {
  if (!client) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), opts.timeoutMs ?? OPS_EVENT_TIMEOUT_MS);
  });
  try {
    const call = Promise.resolve(
      client.rpc("record_ops_event", {
        p_kind: event.kind,
        p_source: event.source,
        p_code: event.code,
        p_detail: null,
        p_user_id: event.userId ?? null,
        p_session_id: event.sessionId ?? null,
      }),
    );
    const outcome = await Promise.race([call, timedOut]);
    if (outcome === "timeout") {
      opts.log?.(`OPS_EVENT_NOT_RECORDED kind=${event.kind} source=${event.source} reason=timeout`);
      return false;
    }
    if (outcome.error) {
      const code = (outcome.error as { code?: string } | null)?.code ?? "error";
      opts.log?.(`OPS_EVENT_NOT_RECORDED kind=${event.kind} source=${event.source} reason=rpc:${code}`);
      return false;
    }
    return true;
  } catch {
    opts.log?.(`OPS_EVENT_NOT_RECORDED kind=${event.kind} source=${event.source} reason=unexpected`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
