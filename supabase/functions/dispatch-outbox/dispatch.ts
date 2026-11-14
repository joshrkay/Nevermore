// Sends claimed outbox events and records what happened to each. Pure orchestration: the edge
// function supplies the database and provider calls. No imports beyond sibling modules (fieldLabels reads the
// shared intake schema, which imports nothing), so it runs under Deno and Vitest alike.
//
// The email an event sends is written to the event (frozen, with its idempotency key) before the
// first send and reused byte for byte by every retry, so a settings change between an ambiguous
// attempt and its retry cannot deliver a second, different message. The key only rotates when the
// freeze is cleared, which the database does for a definitive rejection of the first send.

import type { BlockedKind, DispatchConfig } from "./config.ts";
import { fieldLabels } from "./fieldLabels.ts";
import {
  parseAdvisorNotification,
  parsePeoMailArrived,
  parseExportAlert,
  parseFirmClosing,
  parseMemberLeft,
  parseDraftExpiryReminder,
  parseInformationRequest,
  parseProspectConfirmation,
  renderAdvisorNotification,
  renderPeoMailArrived,
  renderExportAlert,
  renderFirmClosing,
  renderMemberLeft,
  renderDraftExpiryReminder,
  renderInformationRequest,
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

/**
 * How long a claim is held, in seconds. A worker that has not recorded an outcome by then is taken
 * to be lost (the next claim takes the event over; `reap_outbox_events` kills it once every attempt
 * is used). Far longer than a batch takes: sends are sequential and each is cut off after 10 s.
 */
export const CLAIM_LEASE_SECONDS = 600;

/** A claimed row from `claim_outbox_events`. `attempts` already counts the attempt being made. */
export interface OutboxRow {
  id: string;
  kind: string;
  /** The intake the event is about; null for an event that belongs to a firm (a "member left" email). */
  session_id: string | null;
  /** The firm a firm-level event belongs to; null for an event about an intake. */
  firm_id?: string | null;
  payload: unknown;
  attempts: number;
  /** The frozen send of an earlier attempt, as stored; read it through `parsePending`. */
  pending_send: unknown;
  /**
   * The addresses the first preparation of an advisor alert went to, written once by the database and never cleared (D-35). Absent
   * on a row that has not been prepared yet, and on rows from before it existed.
   */
  first_recipients?: unknown;
}

/** The write-ahead copy of an email: what to send and the key to send it under. */
export interface PendingSend {
  key: string;
  message: EmailMessage;
  /** The claim attempt that froze it. */
  attempt: number;
  /** ISO timestamp. */
  frozen_at: string;
}

/**
 * How long a frozen message is reused. It stays under the provider's 24 hour key window: an older
 * freeze would no longer be deduplicated, and would only keep pinning settings that may be stale.
 */
export const FROZEN_MAX_AGE_MS = 20 * 60 * 60 * 1000;

/** An event that has just died, as engineering is told about it: ids and a failure kind, never content. */
export interface DeadEvent {
  event: string;
  kind: string;
  attempts: number;
  reason: string;
}

export interface DispatchDeps {
  config: DispatchConfig;
  now: () => number;
  send: (message: EmailMessage, idempotencyKey: string) => Promise<SendResult>;
  /** Stores the message as the event's frozen send and resolves to what was stored, or null if this worker no longer holds the claim. */
  freeze: (id: string, attempt: number, message: EmailMessage, replace: boolean) => Promise<unknown>;
  complete: (id: string, messageId: string | null) => Promise<void>;
  /** `attempt` fences the write to this claim; `definitive` says the provider proved it did not send. */
  fail: (id: string, error: string, retryInSeconds: number | null, attempt: number, definitive: boolean) => Promise<void>;
  /** Pushes a dead event to engineering. Resolves to whether it was delivered; optional, since not every deployment has a channel. */
  alertDead?: (event: DeadEvent) => Promise<boolean>;
  /**
   * The addresses of the current members of the firm the intake belongs to: who an advisor alert or a new-PEO-mail notice goes to
   * (never a platform-wide list). Asked each time one is built or resent, so a member who has left stops receiving at once.
   */
  advisorRecipients: (sessionId: string) => Promise<string[]>;
  /** The addresses of the current owners of a firm: who a "member left" email goes to. Asked each time one is built or resent, like `advisorRecipients`. */
  ownerRecipients: (firmId: string) => Promise<string[]>;
  log: (line: string) => void;
}

/** Tells engineering, if there is a way to. A failed alert is logged and never stops the batch. */
async function notifyDead(event: DeadEvent, deps: Pick<DispatchDeps, "alertDead" | "log">): Promise<void> {
  if (!deps.alertDead) return;
  let delivered = false;
  try {
    delivered = await deps.alertDead(event);
  } catch {
    delivered = false;
  }
  if (!delivered) deps.log(`OUTBOX_ALERT_FAILED: event=${event.event} died but the engineering alert was not delivered`);
}

/**
 * What the provider said, folded into the failure kind for `last_error`: `auth:403 (validation_error:
 * The sender domain is not verified)`. The detail was cleaned by the provider module; the kind alone
 * is what logs carry.
 */
const recordedError = (reason: string, detail?: string) => (detail ? `${reason} (${detail})` : reason);

export interface DispatchSummary {
  sent: number;
  retrying: number;
  dead: number;
  /** Sent or failed, but the database write that records it failed; the claim will lapse and retry. */
  unrecorded: number;
  /** Claimed, but another worker holds it now (or it is gone); nothing was sent. */
  skipped: number;
}

type Built = { ok: true; message: EmailMessage } | { ok: false; reason: string; final: boolean };

/** The email for an event, or why there is none. A bad payload can never succeed, so it is final. */
function buildMessage(row: OutboxRow, config: DispatchConfig, advisorTo: string[]): Built {
  if (row.kind === "member_left") {
    if (!config.advisor.ok) return { ok: false, reason: "not_configured", final: false };
    const n = parseMemberLeft(row.payload);
    if (!n) return { ok: false, reason: "invalid_payload", final: true };
    return { ok: true, message: { from: config.advisor.from, to: advisorTo, ...renderMemberLeft(n) } };
  }
  if (row.kind === "firm_closing") {
    if (!config.advisor.ok) return { ok: false, reason: "not_configured", final: false };
    const n = parseFirmClosing(row.payload);
    if (!n) return { ok: false, reason: "invalid_payload", final: true };
    return { ok: true, message: { from: config.advisor.from, to: advisorTo, ...renderFirmClosing(n) } };
  }
  if (row.kind === "export_alert") {
    if (!config.advisor.ok) return { ok: false, reason: "not_configured", final: false };
    const n = parseExportAlert(row.payload);
    if (!n) return { ok: false, reason: "invalid_payload", final: true };
    return { ok: true, message: { from: config.advisor.from, to: advisorTo, ...renderExportAlert(n) } };
  }
  // Every other kind is about an intake. An event with none can never be built.
  const sessionId = row.session_id;
  if (sessionId === null) return { ok: false, reason: "invalid_payload", final: true };
  if (row.kind === "advisor_notification") {
    if (!config.advisor.ok) return { ok: false, reason: "not_configured", final: false };
    const n = parseAdvisorNotification(row.payload);
    if (!n) return { ok: false, reason: "invalid_payload", final: true };
    const reviewUrl = `${config.advisor.appBaseUrl}/advisor/submissions/${encodeURIComponent(sessionId)}`;
    return { ok: true, message: { from: config.advisor.from, to: advisorTo, ...renderAdvisorNotification(n, { reviewUrl }) } };
  }
  if (row.kind === "peo_mail_arrived") {
    if (!config.advisor.ok) return { ok: false, reason: "not_configured", final: false };
    const n = parsePeoMailArrived(row.payload);
    if (!n) return { ok: false, reason: "invalid_payload", final: true };
    // The thread is on the submission page, behind advisor sign-in.
    const reviewUrl = `${config.advisor.appBaseUrl}/advisor/submissions/${encodeURIComponent(sessionId)}`;
    return { ok: true, message: { from: config.advisor.from, to: advisorTo, ...renderPeoMailArrived(n, { reviewUrl }) } };
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
  if (row.kind === "information_request" || row.kind === "draft_expiry_reminder") {
    if (!config.prospectLink.ok) return { ok: false, reason: "not_configured", final: false };
    const { from, supportEmail, appBaseUrl } = config.prospectLink;
    const intakeUrl = `${appBaseUrl}/start?session=${encodeURIComponent(sessionId)}`;
    if (row.kind === "information_request") {
      const r = parseInformationRequest(row.payload);
      if (!r) return { ok: false, reason: "invalid_payload", final: true };
      return {
        ok: true,
        message: {
          from, to: [r.recipientEmail], replyTo: supportEmail,
          ...renderInformationRequest(r, { supportEmail, intakeUrl, fieldLabels: fieldLabels(r.fields) }),
        },
      };
    }
    const d = parseDraftExpiryReminder(row.payload);
    if (!d) return { ok: false, reason: "invalid_payload", final: true };
    return {
      ok: true,
      message: {
        from, to: [d.recipientEmail], replyTo: supportEmail,
        ...renderDraftExpiryReminder(d, { supportEmail, intakeUrl, profileUrl: `${appBaseUrl}/profile` }),
      },
    };
  }
  return { ok: false, reason: "unknown_kind", final: true };
}

const asRecord = (raw: unknown): Record<string, unknown> | null =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v !== "";

/** A stored or returned frozen send, or null if it is not exactly that shape. Age is not checked here. */
export function parsePending(raw: unknown): PendingSend | null {
  const p = asRecord(raw);
  const m = asRecord(p?.message);
  if (!p || !m) return null;
  const { key, attempt, frozen_at } = p;
  if (!nonEmpty(key) || typeof attempt !== "number" || !Number.isInteger(attempt)) return null;
  if (!nonEmpty(frozen_at) || !Number.isFinite(Date.parse(frozen_at))) return null;
  const { from, to, replyTo, subject, text, html } = m;
  if (!nonEmpty(from) || !Array.isArray(to) || to.length === 0 || !to.every(nonEmpty)) return null;
  if (typeof subject !== "string" || typeof text !== "string" || typeof html !== "string") return null;
  if (replyTo !== undefined && replyTo !== null && typeof replyTo !== "string") return null;
  return { key, attempt, frozen_at, message: { from, to, subject, text, html, ...(replyTo ? { replyTo } : {}) } };
}

const isFresh = (pending: PendingSend, nowMs: number) => nowMs - Date.parse(pending.frozen_at) < FROZEN_MAX_AGE_MS;

/** The stored first recipients, or null when the row has none (not prepared yet, or older than the column). */
function firstRecipients(value: unknown): string[] | null {
  return Array.isArray(value) && value.length > 0 && value.every((a) => typeof a === "string") ? (value as string[]) : null;
}

/** The kinds sent to people of a firm, whose recipients are looked up at each send and fixed at the first preparation (D-35, D-102). */
const isAdvisorKind = (kind: string) =>
  kind === "advisor_notification" || kind === "peo_mail_arrived" || isOwnerKind(kind);

/** The firm's own emails, which go to the firm's current owners: a member left, a request to close, a large or repeated export. */
const isOwnerKind = (kind: string) => kind === "member_left" || kind === "firm_closing" || kind === "export_alert";

/** Whether a frozen message may still go as stored: an advisor alert only while everyone it names is still a current member (D-35: new joiners do not matter here). */
function namesOnly(pending: PendingSend, current: string[], kind: string): boolean {
  if (!isAdvisorKind(kind)) return true;
  const members = new Set(current.map((a) => a.toLowerCase()));
  return pending.message.to.every((a) => members.has(a.toLowerCase()));
}

/** `frozen`: the message an earlier attempt wrote down. `fresh`: built from the current settings for this attempt. */
type MessageOrigin = "frozen" | "fresh";

type Prepared =
  | { outcome: "send"; pending: PendingSend; origin: MessageOrigin }
  | { outcome: "fail"; reason: string; final: boolean }
  | { outcome: "skip" };

/** The frozen send to use for a claimed row: the stored one if it is usable, else a new one built from the current settings and frozen. */
async function prepare(row: OutboxRow, deps: DispatchDeps): Promise<Prepared> {
  // An advisor alert goes to the current members of the intake's firm, asked for now: a stored message that names someone who has
  // since left is not sent, and nothing is sent when the firm has no one to tell or the answer can't be had.
  let advisorTo: string[] = [];
  if (isAdvisorKind(row.kind)) {
    try {
      // A firm's own email (a member left, a request to close, an export) goes to the firm's owners; an intake's alert, to the members of the intake's firm.
      if (isOwnerKind(row.kind)) {
        // An event that names no firm has no one to tell and never will: it is not looked up by a null id.
        if (!row.firm_id) return { outcome: "fail", reason: "invalid_payload", final: true };
        advisorTo = await deps.ownerRecipients(row.firm_id);
      } else {
        if (row.session_id === null) return { outcome: "fail", reason: "invalid_payload", final: true };
        advisorTo = await deps.advisorRecipients(row.session_id);
      }
    } catch {
      return { outcome: "fail", reason: "recipients_failed", final: false };
    }
    if (advisorTo.length === 0) return { outcome: "fail", reason: "no_recipients", final: false };
  }

  const stored = parsePending(row.pending_send);
  if (stored && isFresh(stored, deps.now()) && namesOnly(stored, advisorTo, row.kind)) return { outcome: "send", pending: stored, origin: "frozen" };

  // D-35: the people an alert goes to are fixed when it is first prepared, and the database keeps them on the row (first_recipients),
  // apart from the frozen message, which is thrown away when it ages out or a send is definitively refused. A message that is rebuilt
  // goes to those people who are still members, never to anyone who joined after the first preparation (adding an address changes the key,
  // so everyone who already has it would get it twice). D-102: when none of them is still a member, it is not lost: it goes to the
  // current members, under a new key. A row older than the column falls back to the frozen message's people, whatever its age (age decides
  // only whether the message and key can be replayed above). With nothing stored it is a first preparation and goes to the current members.
  let to = advisorTo;
  if (isAdvisorKind(row.kind)) {
    const first = firstRecipients(row.first_recipients) ?? stored?.message.to ?? null;
    if (first) {
      const named = new Set(first.map((a) => a.toLowerCase()));
      const stillThere = advisorTo.filter((a) => named.has(a.toLowerCase()));
      if (stillThere.length > 0) to = stillThere;
    }
  }

  const built = buildMessage(row, deps.config, to);
  if (!built.ok) return { outcome: "fail", reason: built.reason, final: built.final };

  // Whatever is stored but unusable (too old, or not the shape we write) must be overwritten; the
  // database refuses to freeze over an existing one otherwise.
  const replace = row.pending_send !== null && row.pending_send !== undefined;
  let frozen: unknown;
  try {
    frozen = await deps.freeze(row.id, row.attempts, built.message, replace);
  } catch {
    return { outcome: "fail", reason: "freeze_failed", final: false };
  }
  // Nothing applied: this worker is no longer the claimant (or the event is gone).
  if (frozen === null || frozen === undefined) return { outcome: "skip" };
  // Send what the database holds, not what we built: that copy is what the next retry will see.
  const pending = parsePending(frozen);
  return pending ? { outcome: "send", pending, origin: "fresh" } : { outcome: "fail", reason: "freeze_failed", final: false };
}

/**
 * Sends each event once and records the outcome. A failure is logged and retried with backoff, or
 * the event is marked dead when attempts run out; it never throws, so one bad event cannot stop
 * the rest of the batch. Log lines carry ids and failure kinds only: no addresses, names or bodies.
 */
export async function dispatchEvents(rows: OutboxRow[], deps: DispatchDeps): Promise<DispatchSummary> {
  const summary: DispatchSummary = { sent: 0, retrying: 0, dead: 0, unrecorded: 0, skipped: 0 };

  for (const row of rows) {
    const tag = `kind=${row.kind} event=${row.id}`;

    const record = async (action: () => Promise<void>, counted: keyof DispatchSummary): Promise<boolean> => {
      try {
        await action();
        summary[counted] += 1;
        return true;
      } catch {
        summary.unrecorded += 1;
        deps.log(`OUTBOX_RECORD_FAILED: ${tag} could not be recorded; it will be retried once its claim lapses`);
        return false;
      }
    };

    // `sent` is set once a send was attempted. `msg` is logged so an operator can see why a settings
    // change did not apply (the frozen message is reused); `definitive` is what lets the database
    // rotate the key (see providers.ts for which answers qualify); `detail` is the provider's cleaned
    // explanation, which goes on the event but never into a log line.
    const failWith = async (reason: string, final: boolean, sent?: { msg: MessageOrigin; definitive: boolean; detail?: string }) => {
      const delay = final ? null : retryDelaySeconds(row.attempts);
      const definitive = sent?.definitive ?? false;
      const error = recordedError(reason, sent?.detail);
      if (delay === null) {
        deps.log(`OUTBOX_DEAD: ${tag} attempts=${row.attempts} reason=${reason}; needs an operator`);
        // Only once the event is really dead: if the write failed, the claim lapses and the reaper
        // (or the next attempt) deals with it, and tells engineering then.
        if (await record(() => deps.fail(row.id, error, null, row.attempts, definitive), "dead")) {
          await notifyDead({ event: row.id, kind: row.kind, attempts: row.attempts, reason }, deps);
        }
        return;
      }
      const msg = sent ? ` msg=${sent.msg}` : "";
      deps.log(`OUTBOX_SEND_FAILED: ${tag} attempt=${row.attempts}/${MAX_ATTEMPTS}${msg} reason=${reason} retry_in=${delay}s`);
      await record(() => deps.fail(row.id, error, delay, row.attempts, definitive), "retrying");
    };

    const prepared = await prepare(row, deps);
    if (prepared.outcome === "skip") {
      summary.skipped += 1;
      continue;
    }
    if (prepared.outcome === "fail") {
      await failWith(prepared.reason, prepared.final);
      continue;
    }
    const { pending, origin } = prepared;

    let result: SendResult;
    try {
      result = await deps.send(pending.message, pending.key);
    } catch {
      result = { ok: false, kind: "network", httpStatus: null, ambiguous: true };
    }

    if (result.ok) {
      const { messageId } = result;
      deps.log(`OUTBOX_SENT: ${tag} attempt=${row.attempts} msg=${origin}`);
      await record(() => deps.complete(row.id, messageId), "sent");
    } else {
      const reason = result.httpStatus === null ? result.kind : `${result.kind}:${result.httpStatus}`;
      await failWith(reason, false, { msg: origin, definitive: !result.ambiguous, detail: result.detail });
    }
  }
  return summary;
}

/** The kinds this configuration can send, for `claim_outbox_events`. */
export function sendableKinds(config: DispatchConfig): OutboxKind[] {
  const kinds: OutboxKind[] = [];
  if (config.advisor.ok) kinds.push("advisor_notification", "peo_mail_arrived", "member_left", "firm_closing", "export_alert");
  if (config.prospect.ok) kinds.push("prospect_confirmation");
  if (config.prospectLink.ok) kinds.push("information_request", "draft_expiry_reminder");
  return kinds;
}

/**
 * What a run answers its caller. The schedule (the service role) gets the counts; a browser (a prospect
 * nudging the queue after certifying) only hears that the run happened, since the counts would tell
 * anyone signed in how much email the team sends and whether the provider is failing.
 */
export function runReply(service: boolean, counts: Record<string, unknown>): Record<string, unknown> {
  return service ? counts : { ok: true };
}

/** Which console a log line belongs on: a send is info, a heal is worth noticing, anything else is for the error log that operators alert on. */
export function logLevel(line: string): "log" | "warn" | "error" {
  if (line.startsWith("OUTBOX_SENT:")) return "log";
  if (line.startsWith("OUTBOX_RECONCILED:")) return "warn";
  return "error";
}

/** A short code for a failed database call, for logs: never its message, which can echo row data. */
export function rpcErrorCode(error: unknown): string {
  const { code, name, message } = (asRecord(error) ?? {}) as { code?: unknown; name?: unknown; message?: unknown };
  if (typeof code === "string" && /^[A-Za-z0-9_]{1,16}$/.test(code)) return code;
  // An aborted call has no PostgREST code; the library reports the abort in the name or message prefix.
  const aborted = ["AbortError", "TimeoutError"];
  if (aborted.includes(name as string) || (typeof message === "string" && aborted.some((n) => message.startsWith(n)))) return "timeout";
  return "unknown";
}

const SQLSTATE = /^[0-9A-Z]{5}$/;
const wholeNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** What `reconcile_outbox_events` did, for the response. */
export interface ReconcileSummary {
  healed: number;
  failed: number;
  /** Active certifications still without notifications after the run. */
  unqueued: number;
}

/** Logs what a reconcile run found, as codes and counters only, and returns the counts. Null if the answer is not what the function returns. */
export function reportReconcile(raw: unknown, log: (line: string) => void): ReconcileSummary | null {
  const r = asRecord(raw);
  if (!r) return null;
  const summary = { healed: wholeNumber(r.healed), failed: wholeNumber(r.failed), unqueued: wholeNumber(r.unqueued) };
  if (summary.healed > 0) log(`OUTBOX_RECONCILED: queued notifications for ${summary.healed} missed certification(s)`);
  if (summary.unqueued > 0) {
    const sqlstate = typeof r.last_sqlstate === "string" && SQLSTATE.test(r.last_sqlstate) ? r.last_sqlstate : "none";
    log(`OUTBOX_ENQUEUE_FAILED: unqueued=${summary.unqueued} oldest_age_s=${wholeNumber(r.oldest_age_seconds)} last_sqlstate=${sqlstate}`);
  }
  return summary;
}

/** The events `reap_outbox_events` just killed, as it returned them. */
export function reapedDeaths(raw: unknown): DeadEvent[] {
  return (Array.isArray(raw) ? raw : []).map((row) => {
    const r = asRecord(row) ?? {};
    return {
      event: String(r.id),
      kind: String(r.kind),
      attempts: wholeNumber(r.attempts),
      reason: r.last_error === "worker_lost_maybe_sent" ? "worker_lost_maybe_sent" : "worker_lost",
    };
  });
}

/** Logs each event `reap_outbox_events` just killed, so a lost worker is never silent. Returns how many. */
export function reportReaped(raw: unknown, log: (line: string) => void): number {
  const dead = reapedDeaths(raw);
  for (const d of dead) log(`OUTBOX_DEAD: kind=${d.kind} event=${d.event} attempts=${d.attempts} reason=${d.reason}; needs an operator`);
  return dead.length;
}

/**
 * Tells the setting-blocked kinds' waiting events why, on the events themselves, so an advisor
 * looking at the queue sees "ADVISORY_NOTIFY_EMAIL is not set to valid address(es)" instead of a
 * pending event that never moves. Spends no attempt. A failed write is logged (by code) and skipped.
 */
export async function noteBlockedKinds(
  blocked: BlockedKind[],
  note: (kind: BlockedKind["kind"], problem: string) => Promise<void>,
  log: (line: string) => void,
): Promise<void> {
  for (const { kind, problem } of blocked) {
    try {
      await note(kind, problem);
    } catch (e) {
      log(`OUTBOX_NOTE_ERROR: kind=${kind} ${rpcErrorCode(e)}`);
    }
  }
}

export interface MaintenanceDeps {
  /** Each throws on a database error and resolves to what the function returned. */
  reap: () => Promise<unknown>;
  reconcile: () => Promise<unknown>;
  alertDead?: DispatchDeps["alertDead"];
  log: (line: string) => void;
}

/**
 * Housekeeping before a scheduled run sends: kill exhausted lapsed claims and queue notifications
 * a fenced fault left behind. Either failing is logged and skipped, never thrown: the queue must
 * keep sending even when housekeeping cannot run.
 */
export async function runMaintenance(deps: MaintenanceDeps): Promise<{ reaped: number; reconciled: ReconcileSummary }> {
  let reaped = 0;
  try {
    const killed = await deps.reap();
    reaped = reportReaped(killed, deps.log);
    for (const death of reapedDeaths(killed)) await notifyDead(death, deps);
  } catch (e) {
    deps.log(`OUTBOX_REAP_ERROR: ${rpcErrorCode(e)}`);
  }

  let reconciled: ReconcileSummary = { healed: 0, failed: 0, unqueued: 0 };
  try {
    const reported = reportReconcile(await deps.reconcile(), deps.log);
    if (reported) reconciled = reported;
    else deps.log("OUTBOX_RECONCILE_ERROR: malformed_result");
  } catch (e) {
    deps.log(`OUTBOX_RECONCILE_ERROR: ${rpcErrorCode(e)}`);
  }
  return { reaped, reconciled };
}
