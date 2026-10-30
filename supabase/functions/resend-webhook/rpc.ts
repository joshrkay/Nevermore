// What the function sends to the database, and the one setting it reads: kept here, apart from the
// Deno entrypoint, so the argument names (which must match record_email_delivery_event exactly, or
// every webhook fails) and the team-address parsing (which keeps the advisory team from being
// suppressed) are pinned by tests. No imports beyond a type, so it runs under Deno and Vitest alike.

import type { RecordInput } from "./handler.ts";

/** The advisory team's addresses from `ADVISORY_NOTIFY_EMAIL` (comma-separated), lower-cased. Never throws. */
export function protectedAddresses(value: string | undefined): string[] {
  return (value ?? "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
}

/** The named arguments of `public.record_email_delivery_event`. */
export function recordArgs(input: RecordInput): Record<string, unknown> {
  return {
    p_event_id: input.eventId,
    p_type: input.type,
    p_message_id: input.messageId,
    p_recipients: input.recipients,
    p_bounce_type: input.bounceType,
    p_detail: input.detail,
    p_occurred_at: input.occurredAt,
    p_protected: input.protectedAddresses,
  };
}
