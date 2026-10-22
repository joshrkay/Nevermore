// The email provider behind an adapter, as the AI provider is (plan decision D7: a transactional
// provider on a verified subdomain). Switching providers means adding one adapter here and
// changing one secret, not touching the dispatcher. No imports, so it runs under Deno and
// Vitest alike.

export interface EmailMessage {
  /** Must be on a domain the provider has verified for this account. */
  from: string;
  to: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}

/** Maps our message to and from one provider's wire format. */
export interface EmailAdapter {
  name: string;
  /** `idempotencyKey` makes the provider treat a repeat of this send as the same message. */
  buildRequest: (message: EmailMessage, idempotencyKey: string) => {
    url: string;
    headers: Record<string, string>;
    body: unknown;
  };
  /** The provider's id for the accepted message, or null if the response carries none. */
  parseResponse: (json: unknown) => string | null;
}

/** Resend's REST API. It honours `Idempotency-Key` for 24 hours, so a retry with the same key is not sent twice inside that window. */
export function createResendAdapter(opts: { apiKey: string }): EmailAdapter {
  return {
    name: "resend",
    buildRequest: (message, idempotencyKey) => ({
      url: "https://api.resend.com/emails",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: {
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      },
    }),
    parseResponse: (json) => {
      const id = (json as { id?: unknown } | null)?.id;
      return typeof id === "string" && id ? id : null;
    },
  };
}

export type AdapterChoice = { ok: true; adapter: EmailAdapter } | { ok: false; problem: string };

/** Picks the provider from function secrets. Names the missing secret, never its value. */
export function selectEmailAdapter(env: (name: string) => string | undefined): AdapterChoice {
  const provider = env("EMAIL_PROVIDER") || "resend";
  if (provider !== "resend") return { ok: false, problem: `EMAIL_PROVIDER "${provider}" is not supported` };
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) return { ok: false, problem: "RESEND_API_KEY is not set" };
  return { ok: true, adapter: createResendAdapter({ apiKey }) };
}

/**
 * Why a send failed, as a kind: never the provider's response body, which can echo the message.
 * `auth` covers a bad key and a sender domain the provider has not verified; both need an operator.
 */
export type SendFailureKind = "timeout" | "network" | "rate_limited" | "auth" | "provider_error";

export interface SendFailure {
  ok: false;
  kind: SendFailureKind;
  httpStatus: number | null;
  /**
   * The message may have been accepted anyway. The outbox keeps the frozen message and key of an
   * ambiguous failure, so the retry cannot send a second, different copy.
   */
  ambiguous: boolean;
}

export type SendResult = { ok: true; messageId: string | null } | SendFailure;

export interface SendDeps {
  fetch: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * The only answers that prove the provider did not send. This is an allowlist on purpose: a status
 * we have not thought about (409 for a key still in flight, 408, 425, a 3xx from a proxy, any 5xx)
 * may well follow an accepted message, and calling it definitive would let a retry rotate the key
 * and deliver twice.
 */
const DEFINITIVE_STATUSES: ReadonlySet<number> = new Set([400, 401, 403, 404, 405, 413, 422, 429]);

/**
 * One attempt, no retry of its own: the outbox owns retries and backoff. A timeout may mean the
 * provider did accept the message, which is why every send carries an idempotency key.
 */
export async function sendEmail(
  adapter: EmailAdapter,
  message: EmailMessage,
  idempotencyKey: string,
  deps: SendDeps,
): Promise<SendResult> {
  const { url, headers, body } = adapter.buildRequest(message, idempotencyKey);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      // `redirect: "error"`: following a redirect would resend the key and body to another host, and
      // the answer from there says nothing about our request. It surfaces as a network failure.
      response = await deps.fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal, redirect: "error" });
    } catch {
      return { ok: false, kind: timedOut ? "timeout" : "network", httpStatus: null, ambiguous: true };
    }
    const status = response.status;
    const ambiguous = !DEFINITIVE_STATUSES.has(status);
    if (status === 429) return { ok: false, kind: "rate_limited", httpStatus: status, ambiguous };
    if (status === 401 || status === 403) return { ok: false, kind: "auth", httpStatus: status, ambiguous };
    if (status < 200 || status >= 300) return { ok: false, kind: "provider_error", httpStatus: status, ambiguous };
    // Accepted. An unreadable body must not turn an accepted message into a retry (a duplicate).
    const json = await response.json().catch(() => null);
    return { ok: true, messageId: adapter.parseResponse(json) };
  } finally {
    clearTimeout(timer);
  }
}
