// Sends claimed outbox events and records what happened to each. Pure orchestration: the edge
// function supplies the database and provider calls. No imports beyond sibling modules, so it
// runs under Deno and Vitest alike.

import type { DispatchConfig } from "./config.ts";
import {
  parseAdvisorNotification,
  parseProspectConfirmation,
  renderAdvisorNotification,
  renderProspectConfirmation,
  type OutboxKind,
} from "./messages.ts";
import type { EmailMessage, SendResult } from "./providers.ts";

/** Seconds to wait after the 1st, 2nd, 3rd and 4th failed attempt. The 5th failure is final. */
const RETRY_DELAYS_SECONDS = [60, 300, 1800, 7200];
export const MAX_ATTEMPTS = RETRY_DELAYS_SECONDS.length + 1;

/** When to try again after failed attempt number `attempt` (1-based), or null to give up. */
export function retryDelaySeconds(attempt: number): number | null {
  return attempt >= MAX_ATTEMPTS ? null : RETRY_DELAYS_SECONDS[Math.max(attempt, 1) - 1];
}

/** A claimed row from `claim_outbox_events`. `attempts` already counts the attempt being made. */
export interface OutboxRow {
  id: string;
  kind: string;
  session_id: string;
  payload: unknown;
  attempts: number;
}

export interface DispatchDeps {
  config: DispatchConfig;
  send: (message: EmailMessage, idempotencyKey: string) => Promise<SendResult>;
  complete: (id: string, messageId: string | null) => Promise<void>;
  fail: (id: string, error: string, retryInSeconds: number | null) => Promise<void>;
  log: (line: string) => void;
}

export interface DispatchSummary {
  sent: number;
  retrying: number;
  dead: number;
  /** Sent or failed, but the database write that records it failed; the claim will lapse and retry. */
  unrecorded: number;
}

type Built = { ok: true; message: EmailMessage } | { ok: false; reason: string; final: boolean };

/** The email for an event, or why there is none. A bad payload can never succeed, so it is final. */
function buildMessage(row: OutboxRow, config: DispatchConfig): Built {
  if (row.kind === "advisor_notification") {
    if (!config.advisor.ok) return { ok: false, reason: "not_configured", final: false };
    const n = parseAdvisorNotification(row.payload);
    if (!n) return { ok: false, reason: "invalid_payload", final: true };
    const reviewUrl = `${config.advisor.appBaseUrl}/advisor/submissions/${encodeURIComponent(row.session_id)}`;
    return { ok: true, message: { from: config.advisor.from, to: config.advisor.to, ...renderAdvisorNotification(n, { reviewUrl }) } };
  }
  if (row.kind === "prospect_confirmation") {
    if (!config.prospect.ok) return { ok: false, reason: "not_configured", final: false };
    const c = parseProspectConfirmation(row.payload);
    if (!c) return { ok: false, reason: "invalid_payload", final: true };
    const { from, supportEmail, responseTime } = config.prospect;
    return {
      ok: true,
      message: { from, to: [c.recipientEmail], replyTo: supportEmail, ...renderProspectConfirmation(c, { supportEmail, responseTime }) },
    };
  }
  return { ok: false, reason: "unknown_kind", final: true };
}

/** FNV-1a, as 8 hex digits. Not security: it only tells two different messages apart. */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * The provider treats a repeated key as the same message, but rejects a key reused with different
 * content. So the key is the event plus a fingerprint of what is being sent: a retry of the same
 * message is deduplicated, and a retry after the operator fixed the sender or copy still goes out.
 */
export function idempotencyKey(eventId: string, message: EmailMessage): string {
  return `outbox-${eventId}-${fingerprint(JSON.stringify(message))}`;
}

/**
 * Sends each event once and records the outcome. A failure is logged and retried with backoff, or
 * the event is marked dead when attempts run out; it never throws, so one bad event cannot stop
 * the rest of the batch. Log lines carry ids and failure kinds only: no addresses, names or bodies.
 */
export async function dispatchEvents(rows: OutboxRow[], deps: DispatchDeps): Promise<DispatchSummary> {
  const summary: DispatchSummary = { sent: 0, retrying: 0, dead: 0, unrecorded: 0 };

  for (const row of rows) {
    const tag = `kind=${row.kind} event=${row.id}`;

    const record = async (action: () => Promise<void>, counted: keyof DispatchSummary) => {
      try {
        await action();
        summary[counted] += 1;
      } catch {
        summary.unrecorded += 1;
        deps.log(`OUTBOX_RECORD_FAILED: ${tag} could not be recorded; it will be retried once its claim lapses`);
      }
    };

    const failWith = (reason: string, final: boolean) => {
      const delay = final ? null : retryDelaySeconds(row.attempts);
      if (delay === null) {
        deps.log(`OUTBOX_DEAD: ${tag} attempts=${row.attempts} reason=${reason}; needs an operator`);
        return record(() => deps.fail(row.id, reason, null), "dead");
      }
      deps.log(`OUTBOX_SEND_FAILED: ${tag} attempt=${row.attempts}/${MAX_ATTEMPTS} reason=${reason} retry_in=${delay}s`);
      return record(() => deps.fail(row.id, reason, delay), "retrying");
    };

    const built = buildMessage(row, deps.config);
    if (!built.ok) {
      await failWith(built.reason, built.final);
      continue;
    }

    let result: SendResult;
    try {
      result = await deps.send(built.message, idempotencyKey(row.id, built.message));
    } catch {
      result = { ok: false, kind: "network", httpStatus: null };
    }

    if (result.ok) {
      const { messageId } = result;
      deps.log(`OUTBOX_SENT: ${tag} attempt=${row.attempts}`);
      await record(() => deps.complete(row.id, messageId), "sent");
    } else {
      await failWith(result.httpStatus === null ? result.kind : `${result.kind}:${result.httpStatus}`, false);
    }
  }
  return summary;
}

/** The kinds this configuration can send, for `claim_outbox_events`. */
export function sendableKinds(config: DispatchConfig): OutboxKind[] {
  const kinds: OutboxKind[] = [];
  if (config.advisor.ok) kinds.push("advisor_notification");
  if (config.prospect.ok) kinds.push("prospect_confirmation");
  return kinds;
}
