// The engineering alert webhook (ENGINEERING_ALERT_WEBHOOK_URL), shared by every function that alerts:
// dispatch-outbox (a dead notification), purge-intakes (a deletion that ran out of attempts) and ops-monitor
// (a failure kind over its threshold). A log line nobody is watching is not an alert, so each of them also
// pushes here when the secret is set. No imports, so it runs under Deno and Vitest alike.
//
// An alert is a plain JSON POST with a `text` field (what Slack's and Teams' incoming webhooks read) plus
// the same facts as fields, for anything else. Callers put ids, kinds, counts and failure codes in it,
// never addresses, names, file names or intake content, so it is safe in a shared channel.

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

export interface AlertDeps {
  fetch: typeof fetch;
  timeoutMs?: number;
}

export const ALERT_TIMEOUT_MS = 5_000;

/** What every alert carries: the line a person reads, and which function and alert it is. */
export interface AlertBody {
  text: string;
  source: string;
  alert: string;
  [fact: string]: string | number | boolean | null;
}

/**
 * Posts one alert. Resolves to whether the receiver accepted it, and never throws or waits longer
 * than the timeout: an alert that cannot be delivered must not hold up the work it is about.
 */
export async function postAlert(url: string, body: AlertBody, deps: AlertDeps): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? ALERT_TIMEOUT_MS);
  try {
    const response = await deps.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
