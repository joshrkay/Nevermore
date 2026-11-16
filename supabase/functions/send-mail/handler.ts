// send-mail sends the messages agents write to their contacts and leads (story CRM-E1.2a, #196; docs/BROKER_CRM_BUILD.md D-602, D-630 to D-639;
// docs/adr/0005). Each message was recorded as queued before anything is sent (send_conversation_message), and the outbox carries only its id. This
// function claims them on the outbox every email uses, with dispatch-outbox's lease and retry delays, opens the sender's sealed mailbox token, and sends
// one RFC 5322 message through Gmail users.messages.send or Microsoft Graph sendMail, from the sender's own address. It asks for no permission: the
// mailbox was connected with send-only permission (M-4.1), and a refresh asks for nothing more.
//
// Who calls it only decides when the queue is worked: the schedule (the service-role key) and a signed-in person right after they send. Logs carry ids
// and a failure kind, never an address, a subject, a body or a token. index.ts wires in Deno and the real Supabase client; the tests wire in fakes.

import { getMailboxAccess, MAILBOX_PROBLEMS, readMailboxConfig, type MailboxConfig } from "../_shared/mailbox.ts";
import { isMailAddress } from "../_shared/mailAddress.ts";
import { isServiceCall } from "../_shared/serviceAuth.ts";
import { parseBaseUrl } from "../dispatch-outbox/config.ts";
import { CLAIM_LEASE_SECONDS, MAX_ATTEMPTS, retryDelaySeconds } from "../dispatch-outbox/dispatch.ts";
import { buildMessage, gmailRaw, mimeBase64, type ClaimedMessage } from "./message.ts";

export const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
export const GRAPH_SEND_URL = "https://graph.microsoft.com/v1.0/me/sendMail";

// Sends are one after another, so a batch finishes well inside the function's time limit and the claim's lease.
const BATCH_SIZE = 10;
// A send is cut off after this, far inside the claim's lease.
const SEND_TIMEOUT_MS = 15_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Rpc = { data: unknown; error: { code?: string; message?: string } | null };

export interface SendMailClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<Rpc>;
  auth: { getUser: () => PromiseLike<{ data: { user: { id: string; is_anonymous?: boolean } | null } }> };
}

export interface SendMailDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options?: { global?: { headers?: Record<string, string> } }) => SendMailClient;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  now: () => Date;
  log: (line: string) => void;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export async function handleSendMailRequest(req: Request, deps: SendMailDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = deps.env("SUPABASE_URL");
  const anonKey = deps.env("SUPABASE_ANON_KEY");
  const serviceKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    deps.log("SEND_MAIL_CONFIG_MISSING: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set");
    return json({ error: "Sending is unavailable right now." }, 503);
  }

  // The schedule presents the service-role key. Anyone else must be a signed-in person, not a guest (the anon key is a valid JWT too).
  const authorization = req.headers.get("Authorization");
  if (!isServiceCall(authorization, serviceKey)) {
    if (!authorization) return json({ error: "Unauthorized" }, 401);
    const caller = deps.createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user || user.is_anonymous) return json({ error: "Unauthorized" }, 401);
  }

  const replyDomain = deps.env("QUOTE_REPLY_DOMAIN")?.trim().toLowerCase();
  const configured = readMailboxConfig(deps.env);
  if (!replyDomain || !configured.ok) {
    deps.log(`SEND_MAIL_CONFIG_MISSING: ${!replyDomain ? "QUOTE_REPLY_DOMAIN is not set" : (configured as { problem: string }).problem}`);
    return json({ error: "Sending is unavailable right now." }, 503);
  }
  const db = deps.createClient(url, serviceKey);

  const summary = { claimed: 0, sent: 0, retrying: 0, failed: 0 };
  // The contacts' and leads' messages (6.2), then the PEOs' (M-2.1): one function, two queues on the one outbox, each with its own claim.
  const queues: Queue[] = [CONVERSATION_QUEUE];
  const appBase = deps.env("APP_BASE_URL")?.trim().replace(/\/+$/, "");
  if (appBase) queues.push({ ...PEO_QUEUE, linkBase: `${appBase}/b/` });
  else deps.log("SEND_MAIL_CONFIG_MISSING: APP_BASE_URL is not set, so no message to a PEO is sent");
  for (const queue of queues) {
    const claim = await db.rpc(queue.claim, { p_batch: BATCH_SIZE, p_max_attempts: MAX_ATTEMPTS, p_lock_seconds: CLAIM_LEASE_SECONDS });
    if (claim.error) {
      deps.log(`SEND_MAIL_CLAIM_FAILED: ${claim.error.code ?? "unexpected"}`);
      return json({ error: "Internal error" }, 500);
    }
    const rows = (Array.isArray(claim.data) ? claim.data : []) as Claimed[];
    summary.claimed += rows.length;
    for (const row of rows) {
      const outcome = await sendOne(db, deps, configured.config, replyDomain, queue, row);
      summary[outcome] += 1;
    }
  }
  return json(summary);
}

interface Claimed {
  event_id: string;
  attempt: number;
  message: ClaimedMessage & { link_token?: string | null };
}

/** One queue on the outbox: its own claim, completion and failure, and for a PEO's messages where the bundle link starts (M-2.1). */
interface Queue {
  claim: string;
  complete: string;
  fail: string;
  linkBase?: string;
}

const CONVERSATION_QUEUE: Queue = { claim: "claim_conversation_mail", complete: "complete_conversation_mail", fail: "fail_conversation_mail" };
const PEO_QUEUE: Queue = { claim: "claim_peo_mail", complete: "complete_peo_mail", fail: "fail_peo_mail" };

/**
 * Where a PEO message's body holds its link: public.peo_link_marker(). The stored body never holds the token (D-673); the link goes in its place
 * here, as the email is built, from the token the outbox event alone carries.
 */
export const PEO_LINK_MARKER = "[the bundle link, sent in the email and not kept here]";

type Outcome = "sent" | "retrying" | "failed";
type FailureKind = "mailbox" | "refused" | "uncertain" | "unavailable";

/** What the sender reads on a message that did not go (D-632). */
export const REASONS = {
  bad_address: "An address on this message can't be sent to. Nothing was sent; check the addresses and write it again.",
  unavailable: "Google or Microsoft didn't take the message after several tries. Nothing was sent; write it again later.",
  not_allowed: "Google or Microsoft wouldn't let Nevermore send as you. Nothing was sent; connect your mailbox again.",
  refused: "Google or Microsoft refused this message. Nothing was sent; check the addresses and write it again.",
  no_link: "The bundle link wasn't made, so nothing was sent. Send it again.",
  other_mailbox: "Your connected mailbox has changed since you wrote this. Nothing was sent; write it again to send it from your mailbox now.",
  // The same words the database writes for a worker lost on its last attempt (conversation_mail_ended).
  uncertain: "This message may have been sent. Look in your Sent folder before writing again.",
} as const;

/** A failure worth trying again: after dispatch-outbox's delays, and final once they are used up. */
function retryOrGiveUp(db: SendMailClient, deps: SendMailDeps, queue: Queue, row: Claimed, kind: FailureKind, reason: string): Promise<Outcome> {
  return fail(db, deps, queue, row, kind, reason, retryDelaySeconds(row.attempt));
}

/** Records a failed attempt: retried after `retryInSeconds`, or final when it is null. */
async function fail(db: SendMailClient, deps: SendMailDeps, queue: Queue, row: Claimed, kind: FailureKind, reason: string, retryInSeconds: number | null): Promise<Outcome> {
  const { error } = await db.rpc(queue.fail, {
    p_event_id: row.event_id, p_attempt: row.attempt, p_kind: kind, p_reason: reason, p_retry_in_seconds: retryInSeconds,
  });
  deps.log(`SEND_MAIL_FAILED event=${row.event_id} attempt=${row.attempt} kind=${kind} final=${retryInSeconds === null}${error ? ` unrecorded=${error.code ?? "unexpected"}` : ""}`);
  return retryInSeconds === null ? "failed" : "retrying";
}

/** Gmail's id for a sent message, or null when its answer carries none that can be read. */
async function gmailId(res: Response): Promise<string | null> {
  try {
    const id = ((await res.json()) as { id?: unknown } | null)?.id;
    return typeof id === "string" && id !== "" && id.length <= 300 ? id : null;
  } catch {
    return null;
  }
}

async function sendOne(db: SendMailClient, deps: SendMailDeps, config: MailboxConfig, replyDomain: string, queue: Queue, row: Claimed): Promise<Outcome> {
  const claimed = row.message;
  // A PEO's message carries its bundle link where the marker is; one claimed without a token is refused, never sent without its bundle. A withdrawal
  // (M-2.4) holds no marker and carries no link: it goes as written.
  if (queue.linkBase !== undefined && claimed.body_text.includes(PEO_LINK_MARKER) && !/^[A-Za-z0-9_-]{43}$/.test(claimed.link_token ?? "")) {
    return fail(db, deps, queue, row, "refused", REASONS.no_link, null);
  }
  const m: ClaimedMessage = queue.linkBase === undefined ? claimed : { ...claimed, body_text: claimed.body_text.replace(PEO_LINK_MARKER, `${queue.linkBase}${claimed.link_token}`) };
  // Every address by the one rule the database used (D-637), so nothing in a header can start another header.
  if (![m.from_address, ...m.to_addresses, ...m.cc_addresses].every(isMailAddress)) {
    return fail(db, deps, queue, row, "refused", REASONS.bad_address, null);
  }
  const access = await getMailboxAccess(db, deps.fetch, config, m.sender_id ?? "");
  if (!access.ok) {
    // Google or Microsoft not answering, or the apps not set up yet, is tried again; a mailbox that is gone or can't send is final, kind mailbox, so the
    // place to write says Connect or Reconnect (CRM-E1.1).
    if (access.reason === "unavailable" || access.reason === "not_configured") {
      return retryOrGiveUp(db, deps, queue, row, "unavailable", MAILBOX_PROBLEMS[access.reason]);
    }
    return fail(db, deps, queue, row, "mailbox", MAILBOX_PROBLEMS[access.reason], null);
  }
  // The message was written from one address and its Message-ID is at that domain: it goes from that mailbox or not at all.
  if (access.address.toLowerCase() !== m.from_address.toLowerCase()) return fail(db, deps, queue, row, "mailbox", REASONS.other_mailbox, null);
  // A file goes as a link on the app's own address (D-605): with no address set, a message with files can't be built yet, so it waits and is tried again.
  const appBase = parseBaseUrl(deps.env("APP_BASE_URL"));
  if ((m.files ?? []).length > 0 && !appBase) {
    deps.log("SEND_MAIL_CONFIG_MISSING: APP_BASE_URL is not set to an https URL, so a message's file links can't be made");
    return retryOrGiveUp(db, deps, queue, row, "unavailable", REASONS.unavailable);
  }
  const text = buildMessage(m, replyDomain, deps.now(), appBase);
  const microsoft = access.provider === "microsoft";
  // Graph takes the MIME message as base64 text and answers 202 with no body; Gmail takes it as base64url `raw` and answers its id.
  let res: Response;
  const cutOff = new AbortController();
  const timer = setTimeout(() => cutOff.abort(), SEND_TIMEOUT_MS);
  try {
    res = await deps.fetch(microsoft ? GRAPH_SEND_URL : GMAIL_SEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${access.accessToken}`, "Content-Type": microsoft ? "text/plain" : "application/json" },
      body: microsoft ? mimeBase64(text) : JSON.stringify({ raw: gmailRaw(text) }),
      signal: cutOff.signal,
    });
  } catch {
    // No answer: it may have gone. Neither provider takes an idempotency key, so a retry could send it twice to the client. Final (D-632).
    return fail(db, deps, queue, row, "uncertain", REASONS.uncertain, null);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    // Busy or failing on their side: they took nothing, so it is tried again (D-632).
    if (res.status === 429 || res.status >= 500) return retryOrGiveUp(db, deps, queue, row, "unavailable", REASONS.unavailable);
    // They looked and said no: final. The sender's permission refused is kind mailbox (Reconnect); anything else, the message refused. Their words are
    // never kept: they can carry an address.
    if (res.status === 401 || res.status === 403) return fail(db, deps, queue, row, "mailbox", REASONS.not_allowed, null);
    return fail(db, deps, queue, row, "refused", REASONS.refused, null);
  }
  // Graph returns no id, and a Gmail answer may carry none we can read: our own Message-ID is then the send's id (D-633). It went either way.
  const providerId = microsoft ? m.message_id : await gmailId(res) ?? m.message_id;
  await db.rpc(queue.complete, { p_event_id: row.event_id, p_attempt: row.attempt, p_provider_message_id: providerId });
  return "sent";
}
