// Calls the AI provider with a timeout and one retry, and reports failures as structured kinds
// (never as provider response bodies, which can echo the prospect's text). Shared by every
// function that reads text with the model. No imports, so it runs under Deno and Vitest alike.

export interface ModelRequest {
  system: string;
  user: string;
}

/** The one tool the model is forced to call, so its answer comes back as structured arguments. */
export interface ExtractionTool {
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  parameters: Record<string, unknown>;
}

/** Maps our request and the provider's response to and from one provider's wire format. */
export interface ProviderAdapter {
  name: string;
  buildRequest: (req: ModelRequest) => { url: string; headers: Record<string, string>; body: unknown };
  /** The extracted fields, or null if the model returned none. Throws if the response is malformed. */
  parseResponse: (json: unknown) => Record<string, unknown> | null;
}

export type ModelFailureKind = "timeout" | "rate_limited" | "credits" | "provider_error" | "invalid_response" | "network";

export type ModelResult =
  | { ok: true; args: Record<string, unknown> | null; attempts: number; latencyMs: number }
  | { ok: false; kind: ModelFailureKind; httpStatus: number | null; attempts: number; latencyMs: number };

export interface ModelDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  timeoutMs?: number;
  retryDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_ATTEMPTS = 2; // the first try and one retry

type Attempt =
  | { done: true; args: Record<string, unknown> | null }
  | { done: false; kind: ModelFailureKind; httpStatus: number | null; retry: boolean };

async function attemptOnce(adapter: ProviderAdapter, req: ModelRequest, deps: ModelDeps): Promise<Attempt> {
  const { url, headers, body } = adapter.buildRequest(req);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await deps.fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    } catch {
      return timedOut
        ? { done: false, kind: "timeout", httpStatus: null, retry: false }
        : { done: false, kind: "network", httpStatus: null, retry: true };
    }

    const status = response.status;
    if (status === 429) return { done: false, kind: "rate_limited", httpStatus: status, retry: true };
    if (status === 402) return { done: false, kind: "credits", httpStatus: status, retry: false };
    if (status >= 500) return { done: false, kind: "provider_error", httpStatus: status, retry: true };
    if (status >= 400) return { done: false, kind: "provider_error", httpStatus: status, retry: false };

    try {
      return { done: true, args: adapter.parseResponse(await response.json()) };
    } catch {
      return timedOut
        ? { done: false, kind: "timeout", httpStatus: null, retry: false }
        : { done: false, kind: "invalid_response", httpStatus: status, retry: false };
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function callModel(adapter: ProviderAdapter, req: ModelRequest, deps: ModelDeps): Promise<ModelResult> {
  const startedAt = deps.now();
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const outcome = await attemptOnce(adapter, req, deps);
    if (outcome.done) return { ok: true, args: outcome.args, attempts, latencyMs: deps.now() - startedAt };
    if (!outcome.retry || attempts >= MAX_ATTEMPTS) {
      return { ok: false, kind: outcome.kind, httpStatus: outcome.httpStatus, attempts, latencyMs: deps.now() - startedAt };
    }
    await deps.sleep(deps.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
  }
}

/** What we tell the browser. Calm, and never mentions provider billing or internals. */
export function failureResponse(kind: ModelFailureKind): { status: 429 | 502 | 503 | 504; message: string } {
  switch (kind) {
    case "timeout":
      return { status: 504, message: "Lenore is taking too long to answer. Please try again." };
    case "rate_limited":
      return { status: 429, message: "Rate limited, please try again shortly." };
    case "credits":
      return { status: 503, message: "Lenore is unavailable right now. Please try again later." };
    default:
      return { status: 502, message: "Lenore couldn't respond. Please try again." };
  }
}

/**
 * One line, fixed fields only. Built from structured values, never from the provider's response
 * or the prospect's message, so it can't carry either into the logs.
 */
export function failureLogLine(info: { requestId: string; provider: string; result: Extract<ModelResult, { ok: false }> }): string {
  const { requestId, provider, result } = info;
  return `AI_CALL_FAILED request=${requestId} provider=${provider} kind=${result.kind} status=${result.httpStatus ?? "-"} attempts=${result.attempts} latency_ms=${result.latencyMs}`;
}

/** For the catch-all: the error's class only. Its message (a JSON.parse failure, say) can quote the request body. */
export function unexpectedErrorLine(requestId: string, error: unknown): string {
  return `AI_UNEXPECTED_ERROR request=${requestId} error=${error instanceof Error ? error.name : "unknown"}`;
}
