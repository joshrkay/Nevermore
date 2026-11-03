// The error codes both AI functions answer with (`{ error, code, request_id }`), so the browser can say
// something specific without reading the wording, and the extraction events can record why a call
// failed. The database's list is the migration's `ai_error_codes` sync block (20261103120200), which
// src/data/schemaSync.test.ts holds to this one. No imports, so it runs under Deno and Vitest alike.

export const AI_ERROR_CODES = [
  "bad_request",      // malformed, missing or oversized input (400, or 413 for size)
  "unauthorized",     // no signed-in user
  "not_found",        // the intake or document isn't the caller's, or doesn't exist
  "rate_limited",     // the caller's, their address's or the provider's rate limit
  "daily_cap",        // the daily ceiling shared by everyone is reached
  "unavailable",      // AI isn't set up, the budget can't be checked, or the provider account can't pay
  "provider_error",   // the provider answered with an error, or couldn't be reached
  "timeout",          // the provider took too long
  "invalid_response", // the provider answered, but not with the forced tool call
  "internal",         // anything else
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export interface AiErrorReply {
  status: number;
  code: AiErrorCode;
  /** Calm wording for anyone reading the raw response; the browser chooses its own by code. */
  message: string;
}

const REPLIES: Record<AiErrorCode, { status: number; message: string }> = {
  bad_request: { status: 400, message: "The request was not understood." },
  unauthorized: { status: 401, message: "Unauthorized" },
  not_found: { status: 404, message: "Not found" },
  rate_limited: { status: 429, message: "Rate limited, please try again shortly." },
  daily_cap: { status: 503, message: "Lenore is resting for the day. Please come back tomorrow, or continue filling in the workspace by hand." },
  unavailable: { status: 503, message: "Lenore is unavailable right now. Please try again in a few minutes." },
  provider_error: { status: 502, message: "Lenore couldn't respond. Please try again." },
  timeout: { status: 504, message: "Lenore is taking too long to answer. Please try again." },
  invalid_response: { status: 502, message: "Lenore's answer didn't come through. Please try again." },
  internal: { status: 500, message: "Internal error" },
};

/** The status and wording for a code. `message` replaces the wording, `status` the status (a 413 for size). */
export function aiError(code: AiErrorCode, override: { status?: number; message?: string } = {}): AiErrorReply {
  const base = REPLIES[code];
  return { code, status: override.status ?? base.status, message: override.message ?? base.message };
}

export const isAiErrorCode = (value: unknown): value is AiErrorCode =>
  typeof value === "string" && (AI_ERROR_CODES as readonly string[]).includes(value);
