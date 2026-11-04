// Tells engineering when an event has died (G-1.1): out of attempts, or its worker lost with every
// attempt used. The log line `OUTBOX_DEAD` is always written; this adds a push to a chat or paging
// webhook, because a log line nobody is watching is not an alert. The webhook itself (parsing the
// secret, posting with a timeout) is shared with the other alerting functions in
// ../_shared/alertWebhook.ts. No remote imports, so it runs under Deno and Vitest alike.
//
// The message carries the event id, kind, attempt count and failure kind only: no addresses, names
// or email bodies, so it is safe in a shared channel. It is a plain JSON POST with a `text` field
// (what Slack's and Teams' incoming webhooks read) plus the same facts as fields, for anything else.

import { postAlert, type AlertDeps } from "../_shared/alertWebhook.ts";

export { parseAlertWebhook } from "../_shared/alertWebhook.ts";
export type { AlertDeps, WebhookChoice } from "../_shared/alertWebhook.ts";

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

/** The text a person reads in the channel. */
export function alertText(a: DeadEventAlert): string {
  const where = a.queueUrl ? ` Retry it from ${a.queueUrl}.` : "";
  return `OUTBOX_DEAD: a notification email gave up after ${a.attempts} attempt(s) and needs an operator. kind=${a.kind} event=${a.event} reason=${a.reason}.${where}`;
}

/**
 * Posts one alert. Resolves to whether the receiver accepted it, and never throws or waits longer
 * than the timeout: an alert that cannot be delivered must not hold up the queue it is about.
 */
export async function sendDeadAlert(url: string, alert: DeadEventAlert, deps: AlertDeps): Promise<boolean> {
  return await postAlert(
    url,
    {
      text: alertText(alert),
      source: "dispatch-outbox",
      alert: "OUTBOX_DEAD",
      event: alert.event,
      kind: alert.kind,
      attempts: alert.attempts,
      reason: alert.reason,
    },
    deps,
  );
}
