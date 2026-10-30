// The webhook's logic, apart from the runtime: check it is the provider's, read the event, record
// it. The edge function supplies the database call. Answers are chosen for the provider's retry
// behaviour: anything that could succeed later (our database failing) is a 5xx so it is retried,
// and anything a retry cannot fix (a bad signature, an event we do not act on) is not. No imports
// beyond sibling modules, so it runs under Deno and Vitest alike.

import { parseResendEvent, type EmailEvent } from "./events.ts";
import { verifySignature } from "./verify.ts";

export interface WebhookRequest {
  method: string;
  header: (name: string) => string | null;
  body: string;
}

export interface RecordInput extends EmailEvent {
  /** The provider's message id for this delivery: the same on every retry, which is what makes a replay harmless. */
  eventId: string;
  /** The advisory team's addresses, which are never suppressed. */
  protectedAddresses: string[];
}

/** What `record_email_delivery_event` answers. */
export interface RecordResult {
  duplicate?: boolean;
  outcome?: string;
  suppressed?: number;
  protected?: number;
}

export interface WebhookDeps {
  /** `RESEND_WEBHOOK_SECRET`. */
  secret: string | undefined;
  protectedAddresses: string[];
  now: () => number;
  record: (input: RecordInput) => Promise<RecordResult>;
  log: (line: string) => void;
}

export interface WebhookResponse {
  status: number;
  body: Record<string, unknown>;
}

/** Provider payloads are a few hundred bytes. */
export const MAX_BODY_BYTES = 256 * 1024;

const respond = (status: number, body: Record<string, unknown>): WebhookResponse => ({ status, body });

/** A short code for a failed database call, for logs: never its message, which can echo row data. */
export function errorCode(error: unknown): string {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" && /^[A-Za-z0-9_]{1,16}$/.test(code) ? code : "unknown";
}

/** Which console a log line belongs on: a recorded event is info, noise from outside is a warning, the rest is for the error log operators alert on. */
export function logLevel(line: string): "log" | "warn" | "error" {
  if (line.startsWith("WEBHOOK_RECORDED:")) return "log";
  if (line.startsWith("WEBHOOK_REJECTED:") || line.startsWith("WEBHOOK_UNUSABLE:")) return "warn";
  return "error";
}

export async function handleWebhook(req: WebhookRequest, deps: WebhookDeps): Promise<WebhookResponse> {
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });
  if (req.body.length > MAX_BODY_BYTES) return respond(413, { error: "Payload too large" });

  const id = req.header("svix-id") ?? req.header("webhook-id");
  const timestamp = req.header("svix-timestamp") ?? req.header("webhook-timestamp");
  const signature = req.header("svix-signature") ?? req.header("webhook-signature");

  // Nothing signed is nothing to check, whatever the settings: a request with no signature headers
  // is refused the same way whether or not the secret is set. (The setup's probe relies on this
  // to see that the function started.)
  if (!id || !timestamp || !signature) {
    deps.log("WEBHOOK_REJECTED: reason=missing_headers");
    return respond(401, { error: "Unauthorized" });
  }
  if (!deps.secret) {
    deps.log("WEBHOOK_CONFIG_MISSING: RESEND_WEBHOOK_SECRET is not set; bounces and complaints are not being processed");
    return respond(503, { error: "Webhooks are unavailable right now." });
  }

  const verified = await verifySignature(deps.secret, { id, timestamp, signature, body: req.body }, deps.now());
  if (!verified.ok) {
    if (verified.reason === "bad_secret") {
      deps.log("WEBHOOK_CONFIG_MISSING: RESEND_WEBHOOK_SECRET is not a whsec_ signing secret");
      return respond(503, { error: "Webhooks are unavailable right now." });
    }
    deps.log(`WEBHOOK_REJECTED: reason=${verified.reason}`);
    return respond(401, { error: "Unauthorized" });
  }

  let json: unknown;
  try {
    json = JSON.parse(req.body);
  } catch {
    return respond(400, { error: "Bad request" });
  }

  const parsed = parseResendEvent(json);
  if (parsed.kind === "ignore") return respond(200, { ok: true, ignored: true });
  if (parsed.kind === "unusable") {
    deps.log(`WEBHOOK_UNUSABLE: type=${parsed.type} had no recipient to act on`);
    return respond(200, { ok: true, ignored: true });
  }

  const { event } = parsed;
  let result: RecordResult;
  try {
    result = await deps.record({ ...event, eventId: id, protectedAddresses: deps.protectedAddresses });
  } catch (e) {
    deps.log(`WEBHOOK_RECORD_FAILED: type=${event.type} ${errorCode(e)}; the provider will retry`);
    return respond(500, { error: "Internal error" });
  }

  if (result.duplicate === true) return respond(200, { ok: true, duplicate: true });

  const outcome = typeof result.outcome === "string" ? result.outcome : "recorded";
  const bounce = event.bounceType ? ` bounce=${event.bounceType}` : "";
  deps.log(`WEBHOOK_RECORDED: type=${event.type}${bounce} outcome=${outcome} suppressed=${Number(result.suppressed) || 0}`);
  if (outcome === "protected") {
    // The advisory team's mailbox is failing. It is deliberately not suppressed (silently dropping
    // the alerts would be worse), so a person has to look.
    deps.log(`WEBHOOK_ADVISOR_BOUNCE: type=${event.type}${bounce}; an alert to the advisory team was refused or bounced and the address was NOT suppressed; check that mailbox`);
  }
  return respond(200, { ok: true, duplicate: false, outcome });
}
