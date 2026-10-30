// Tells engineering when an event has died (G-1.1): out of attempts, or its worker lost with every
// attempt used. The log line `OUTBOX_DEAD` is always written; this adds a push to a chat or paging
// webhook, because a log line nobody is watching is not an alert. No imports, so it runs under Deno
// and Vitest alike.
//
// The message carries the event id, kind, attempt count and failure kind only: no addresses, names
// or email bodies, so it is safe in a shared channel. It is a plain JSON POST with a `text` field
// (what Slack's and Teams' incoming webhooks read) plus the same facts as fields, for anything else.

/** What an operator needs to find the event. */
export interface DeadEventAlert {
  event: string;
  kind: string;
  attempts: number;
  /** A failure kind such as `provider_error:500` or `worker_lost`, never provider text. */
  reason: string;
  /** Where an advisor can retry it, when the app's address is configured. */
  queueUrl: string | null;
}

export type WebhookChoice = { url: string } | { url: null; problem: string | null };

/**
 * The webhook from its secret. Unset is fine (no push, log only); one that is set but unusable is
 * reported, so a typo does not silently turn the alert off. https only (http for localhost, which
 * is what a local test receiver is), with no credentials in the address.
 */
export function parseAlertWebhook(value: string | undefined): WebhookChoice {
  const v = value?.trim();
  if (!v) return { url: null, problem: null };
  try {
    const url = new URL(v);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) throw new Error("scheme");
    if (url.username || url.password) throw new Error("credentials");
    return { url: url.href };
  } catch {
    return { url: null, problem: "ENGINEERING_ALERT_WEBHOOK_URL is not an https URL" };
  }
}

const TIMEOUT_MS = 5_000;

/** The text a person reads in the channel. */
export function alertText(a: DeadEventAlert): string {
  const where = a.queueUrl ? ` Retry it from ${a.queueUrl}.` : "";
  return `OUTBOX_DEAD: a notification email gave up after ${a.attempts} attempt(s) and needs an operator. kind=${a.kind} event=${a.event} reason=${a.reason}.${where}`;
}

export interface AlertDeps {
  fetch: typeof fetch;
  timeoutMs?: number;
}

/**
 * Posts one alert. Resolves to whether the receiver accepted it, and never throws or waits longer
 * than the timeout: an alert that cannot be delivered must not hold up the queue it is about.
 */
export async function sendDeadAlert(url: string, alert: DeadEventAlert, deps: AlertDeps): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? TIMEOUT_MS);
  try {
    const response = await deps.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: alertText(alert),
        source: "dispatch-outbox",
        alert: "OUTBOX_DEAD",
        event: alert.event,
        kind: alert.kind,
        attempts: alert.attempts,
        reason: alert.reason,
      }),
      signal: controller.signal,
      // A redirect would carry the alert to another host.
      redirect: "error",
    });
    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
