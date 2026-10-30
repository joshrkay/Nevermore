// Reads the provider's webhook events: which ones the product acts on, and the few fields of them
// it keeps. Everything else the provider sends (subject, sender, tags, links) is never read, so it
// cannot reach the database or a log. No imports, so it runs under Deno and Vitest alike.

/** The events worth recording: how a message ended up undelivered, or unwelcome. */
export const TRACKED_TYPES = [
  "email.bounced",
  "email.complained",
  "email.delivery_delayed",
  "email.failed",
  "email.suppressed",
] as const;
export type TrackedType = (typeof TRACKED_TYPES)[number];

export interface EmailEvent {
  type: TrackedType;
  /** The provider's id for the message: our `provider_message_id` when it is one of ours. */
  messageId: string | null;
  /** Everyone the message was sent to, as the provider reports them. */
  recipients: string[];
  /** The provider's word for a bounce: Permanent, Transient or Undetermined. */
  bounceType: string | null;
  /** The provider's explanation, with addresses and key-like strings replaced. */
  detail: string | null;
  /** ISO time the provider says it happened. */
  occurredAt: string | null;
}

export type Parsed =
  /** Not something we act on (delivered, opened, a contact change...). Acknowledged and dropped. */
  | { kind: "ignore"; type: string | null }
  /** One we track, but with nothing usable in it. Acknowledged: a retry would only repeat it. */
  | { kind: "unusable"; type: TrackedType }
  | { kind: "event"; event: EmailEvent };

const asObject = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const isTracked = (t: unknown): t is TrackedType => typeof t === "string" && (TRACKED_TYPES as readonly string[]).includes(t);

// Control characters, line/paragraph separators and invisible or bidi-override characters.
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u2029\u202a-\u202e\u2066-\u2069\ufeff]+/g;
const ADDRESS = /[^\s@<>,;"'()[\]\\]+@[^\s@<>,;"'()[\]\\]+/g;
const TOKEN = /[A-Za-z0-9_\-+/=]{24,}/g;

/** Free text from the provider as one capped line, with addresses and key-like strings replaced. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const flat = value.replace(ADDRESS, "[email]").replace(TOKEN, "[redacted]").replace(INVISIBLE, " ").replace(/\s+/g, " ").trim();
  if (!flat) return null;
  const points = Array.from(flat);
  return points.length > max ? `${points.slice(0, max - 1).join("")}…` : flat;
}

const MAX_RECIPIENTS = 20;
// An address with no spaces, quotes, commas or angle brackets.
const ADDRESS_ONLY = /^[^\s@<>,;"()[\]\\]+@[^\s@<>,;"()[\]\\]+$/;

function recipientsOf(to: unknown): string[] {
  if (!Array.isArray(to)) return [];
  const out: string[] = [];
  for (const item of to) {
    if (typeof item !== "string") continue;
    const address = item.trim();
    if (address.length <= 320 && ADDRESS_ONLY.test(address) && !out.includes(address)) out.push(address);
    if (out.length === MAX_RECIPIENTS) break;
  }
  return out;
}

const isoOrNull = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

/** Reads a webhook body that has already been parsed as JSON. */
export function parseResendEvent(raw: unknown): Parsed {
  const body = asObject(raw);
  const type = body && typeof body.type === "string" ? body.type : null;
  if (!body || !isTracked(type)) return { kind: "ignore", type };

  const data = asObject(body.data);
  const recipients = recipientsOf(data?.to);
  if (!data || recipients.length === 0) return { kind: "unusable", type };

  const bounce = asObject(data.bounce);
  const failed = asObject(data.failed);
  const suppressed = asObject(data.suppressed);
  const bounceType = typeof bounce?.type === "string" ? cleanText(bounce.type, 40) : null;
  const subType = cleanText(bounce?.subType, 40);
  const explanation = cleanText(bounce?.message ?? failed?.reason ?? suppressed?.message, 160);
  const detail = cleanText([subType, explanation].filter(Boolean).join(": "), 160);
  const messageId = typeof data.email_id === "string" && data.email_id.trim() !== "" && data.email_id.length <= 200 ? data.email_id.trim() : null;

  return {
    kind: "event",
    event: { type, messageId, recipients, bounceType, detail, occurredAt: isoOrNull(data.created_at) ?? isoOrNull(body.created_at) },
  };
}
