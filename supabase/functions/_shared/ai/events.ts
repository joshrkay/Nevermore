// One extraction event for each signed-in call to an AI function (US-2.4a, decision D20): what was asked,
// what the function answered and why, findable later by intake or by request id. An event holds no
// prospect content: identifiers, codes, counts, and field names or schema paths, never a value. This
// module drops anything that isn't a name or a path, and the database refuses it too (20261103120200).
// No remote imports, so it runs under Deno and Vitest alike.

import type { AiErrorCode } from "./errors.ts";

export const EVENTS_TABLE = "ai_extraction_events";

export type AiFunctionName = "chamber-extract" | "document-extract";

export interface AiEvent {
  requestId: string;
  functionName: AiFunctionName;
  userId: string | null;
  /** Only once the function has checked that the caller owns the intake. */
  sessionId: string | null;
  documentId?: string | null;
  httpStatus: number;
  /** Null when the call succeeded. */
  errorCode: AiErrorCode | null;
  /** What a document read left the document as. */
  documentStatus?: string | null;
  /** The fields extracted or proposed, by name. */
  fields?: readonly string[];
  /** Schema paths the intake schema refused, such as states[1]. */
  refusedPaths?: readonly string[];
  promptVersion?: number | null;
  /** The intake schema version answers were checked against. */
  contractVersion?: number | null;
  provider?: string | null;
  model?: string | null;
  attempts?: number | null;
  latencyMs?: number | null;
}

/** The part of a (service-role) Supabase client that writes an event. */
export interface EventWriter {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message?: string } | null }>;
  };
}

const NAME = /^[a-z][a-z0-9_]*$/;
const PATH = /^[a-z][a-z0-9_]*(\[[0-9]+\])?(\.[a-z][a-z0-9_]*(\[[0-9]+\])?)*$/;
const MAX_NAME = 120;

const onlyNames = (list: readonly string[] | undefined, pattern: RegExp, max: number) =>
  [...new Set((list ?? []).filter((n) => typeof n === "string" && n.length <= MAX_NAME && pattern.test(n)))].slice(0, max);

const short = (value: string | null | undefined, max: number) => (typeof value === "string" ? value.slice(0, max) : null);

/** The row as the table stores it. */
export function eventRow(event: AiEvent): Record<string, unknown> {
  return {
    request_id: event.requestId,
    function_name: event.functionName,
    user_id: event.userId,
    session_id: event.sessionId,
    document_id: event.documentId ?? null,
    outcome: event.errorCode ? "error" : "ok",
    error_code: event.errorCode,
    http_status: event.httpStatus,
    document_status: event.documentStatus ?? null,
    fields: onlyNames(event.fields, NAME, 100),
    refused_paths: onlyNames(event.refusedPaths, PATH, 50),
    prompt_version: event.promptVersion ?? null,
    contract_version: event.contractVersion ?? null,
    provider: short(event.provider, 40),
    model: short(event.model, 100),
    attempts: event.attempts ?? null,
    latency_ms: event.latencyMs == null ? null : Math.max(0, Math.round(event.latencyMs)),
  };
}

/**
 * Writes the event. Never throws and never changes the answer: an event that can't be written is
 * logged (request id and a database code only) and the call goes on as it would have.
 */
export async function recordAiEvent(writer: EventWriter | null, event: AiEvent, log: (line: string) => void): Promise<void> {
  if (!writer) {
    log(`AI_EVENT_NOT_RECORDED request=${event.requestId} reason=no_service_role`);
    return;
  }
  try {
    const { error } = await writer.from(EVENTS_TABLE).insert(eventRow(event));
    if (error) log(`AI_EVENT_NOT_RECORDED request=${event.requestId} reason=${error.code ?? "unknown"}`);
  } catch (e) {
    log(`AI_EVENT_NOT_RECORDED request=${event.requestId} reason=${e instanceof Error ? e.name : "unknown"}`);
  }
}
