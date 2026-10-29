// Advisor-side view of the notification queue. Mirrors supabase/migrations/20261027090000_outbox_operations.sql
// and the worker in supabase/functions/dispatch-outbox (docs/NOTIFICATIONS.md).

export const OUTBOX_STATUSES = ["dead", "pending", "claimed", "sent"] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const isOutboxStatus = (s: unknown): s is OutboxStatus =>
  typeof s === "string" && (OUTBOX_STATUSES as readonly string[]).includes(s);

export const OUTBOX_STATUS_LABELS: Record<OutboxStatus, string> = {
  dead: "Dead",
  pending: "Pending",
  claimed: "Claimed",
  sent: "Sent",
};

/** One line each, for people who have not read the runbook. */
export const OUTBOX_STATUS_HELP: Record<OutboxStatus, string> = {
  dead: "Gave up after every attempt, or its worker was lost. Needs a retry.",
  pending: "Waiting to be sent, or waiting out a retry delay.",
  claimed: "A worker has it and is sending now.",
  sent: "Delivered to the email provider.",
};

/** The worker's attempt limit (`MAX_ATTEMPTS` in the dispatch-outbox function): the fifth failure is final. */
export const OUTBOX_MAX_ATTEMPTS = 5;

/** How long the longest-waiting due event may wait before the queue is called stalled: the worker runs every minute. */
export const STALLED_AFTER_MINUTES = 10;

export const OUTBOX_KIND_LABELS: Record<string, string> = {
  advisor_notification: "Advisor alert",
  prospect_confirmation: "Prospect confirmation",
};

export const outboxKindLabel = (kind: string) => OUTBOX_KIND_LABELS[kind] ?? kind;

/** Only a dead event can be retried: any other is still being worked, or already went out. */
export const canRetry = (e: { status: string }) => e.status === "dead";

const GLOSSES: Record<string, string> = {
  worker_lost: "The worker stopped before recording a result. No email was written, so nothing was sent.",
  worker_lost_maybe_sent: "The worker stopped mid-send. The email may have been delivered: check the provider's log before retrying.",
  invalid_payload: "The saved summary can't be turned into an email.",
  unknown_kind: "This kind of notification isn't recognised.",
  freeze_failed: "The email couldn't be saved before sending, so nothing was sent.",
  not_configured: "Not being sent: a setting is missing or invalid.",
  timeout: "The provider didn't answer in time. The email may have been delivered.",
  network: "The connection to the provider failed. The email may have been delivered.",
};

/**
 * A plain-language reading of an event's `last_error`: the worker records a short failure kind
 * (`provider_error:503`, `auth:403`, `timeout`) and, when the provider explained itself, that
 * explanation in brackets. Returns null when there is nothing to explain. The recorded text is
 * still shown beside it, so nothing is hidden.
 */
export function explainOutboxError(lastError: string | null): string | null {
  const text = lastError?.trim();
  if (!text) return null;
  const configured = /^not_configured: (.+)$/.exec(text);
  if (configured) return `Not being sent until this is fixed: ${configured[1]}. It sends by itself once it is.`;
  const m = /^([a-z_]+)(?::(\d{3}))?(?: \(.*\))?$/.exec(text);
  if (!m) return null;
  const [, kind, status] = m;
  if (kind === "rate_limited") return "The provider asked us to slow down.";
  if (kind === "auth") return "The provider refused our API key or sender domain. Check RESEND_API_KEY and that the sender domain is verified.";
  if (kind === "provider_error") return status ? `The provider reported an error (HTTP ${status}).` : "The provider reported an error.";
  return GLOSSES[kind] ?? null;
}

/**
 * Minutes the longest-waiting due event has waited, when that is long enough to mean nothing is
 * working the queue (the schedule is down, or a kind's settings are incomplete); else null.
 */
export function stalledMinutes(
  summary: { status: string; oldest_due_at: string | null }[],
  now: number = Date.now(),
): number | null {
  const due = summary.find((r) => r.status === "pending")?.oldest_due_at;
  if (!due) return null;
  const minutes = Math.floor((now - Date.parse(due)) / 60_000);
  return Number.isFinite(minutes) && minutes >= STALLED_AFTER_MINUTES ? minutes : null;
}

/** A status's count from the summary, 0 when absent. */
export const countFor = (summary: { status: string; events: number }[], status: OutboxStatus) =>
  Number(summary.find((r) => r.status === status)?.events ?? 0);
