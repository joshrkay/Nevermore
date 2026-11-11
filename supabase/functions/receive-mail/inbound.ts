// What the receive-mail function reads out of the email provider's inbound webhook and the message it fetches,
// apart from the runtime: which of a message's addresses are ours, whether it was written by a person, its plain
// text, the few headers worth keeping, and which attachments are worth downloading. Pure, and no imports beyond
// a sibling shared module, so it runs under Deno and Vitest alike.

import { sniffUpload, MAX_UPLOAD_BYTES } from "../_shared/fileSignature.ts";

/** The longest text kept for a message; the database refuses a longer one. src/data/schemaSync.test.ts keeps them equal. */
export const MAX_BODY_CHARS = 100_000;

/** Most attachments recorded for one message. */
export const MAX_ATTACHMENTS = 50;

const text = (v: unknown, max = 2000): string => (typeof v === "string" ? v.slice(0, max) : "");
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 100) : []);

/** One address out of `Name <a@b.example>` or a bare address: lower case, with the name when there is one. Null if it isn't an address. */
export function parseAddress(value: string): { address: string; name: string | null } | null {
  const angled = /^\s*(?:"?([^"<]*?)"?\s*)?<\s*([^<>\s]+)\s*>\s*$/.exec(value);
  const raw = (angled ? angled[2] : value).trim().toLowerCase();
  if (!/^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(raw) || raw.length > 320) return null;
  const name = angled?.[1]?.trim();
  return { address: raw, name: name ? name.slice(0, 200) : null };
}

/** The addresses in a list of address strings, lower case, with no repeats and nothing that isn't an address. */
export function addressesOf(values: string[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const a = parseAddress(v)?.address;
    if (a && !out.includes(a)) out.push(a);
  }
  return out;
}

/**
 * The part before the @ of each address on our receiving domain (lower case, no repeats): the reply addresses a
 * message was sent to. An address on another domain, or on a subdomain of ours, is not one of ours.
 */
export function replyLocalParts(addresses: string[], domain: string): string[] {
  const wanted = domain.trim().toLowerCase();
  const out: string[] = [];
  for (const raw of addresses) {
    const a = parseAddress(raw)?.address;
    if (!a) continue;
    const at = a.lastIndexOf("@");
    if (a.slice(at + 1) !== wanted) continue;
    const local = a.slice(0, at);
    if (local && !out.includes(local)) out.push(local);
  }
  return out;
}

export interface ReceivedEvent {
  /** The provider's id for the received email: what it is fetched by, and what makes a replay harmless. */
  emailId: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  receivedFor: string[];
  subject: string;
  createdAt: string | null;
  attachmentCount: number;
}

export type ParsedEvent = { kind: "ignore" } | { kind: "unusable"; reason: string } | { kind: "event"; event: ReceivedEvent };

/** Reads an `email.received` webhook. Any other event is ignored: the delivery-event function handles those. */
export function parseReceivedEvent(json: unknown): ParsedEvent {
  const body = json as { type?: unknown; data?: Record<string, unknown> } | null;
  if (!body || typeof body !== "object" || body.type !== "email.received") return { kind: "ignore" };
  const d = body.data;
  if (!d || typeof d !== "object") return { kind: "unusable", reason: "no_data" };
  const emailId = text(d.email_id, 200);
  if (!emailId) return { kind: "unusable", reason: "no_email_id" };
  const from = text(d.from, 500);
  if (!from) return { kind: "unusable", reason: "no_sender" };
  const created = text(d.created_at, 40);
  return {
    kind: "event",
    event: {
      emailId, from, to: list(d.to), cc: list(d.cc), bcc: list(d.bcc), receivedFor: list(d.received_for),
      subject: text(d.subject, 998),
      createdAt: created && !Number.isNaN(Date.parse(created)) ? new Date(created).toISOString() : null,
      attachmentCount: Array.isArray(d.attachments) ? d.attachments.length : 0,
    },
  };
}

export interface ReceivedEmail {
  text: string | null;
  html: string | null;
  headers: Record<string, string>;
}

/** The part of the provider's message the function uses; null when it isn't one. */
export function parseReceivedEmail(json: unknown): ReceivedEmail | null {
  const d = json as Record<string, unknown> | null;
  if (!d || typeof d !== "object") return null;
  const headers: Record<string, string> = {};
  if (d.headers && typeof d.headers === "object" && !Array.isArray(d.headers)) {
    for (const [k, v] of Object.entries(d.headers as Record<string, unknown>)) {
      if (typeof v === "string") headers[k.toLowerCase()] = v;
    }
  }
  return {
    text: typeof d.text === "string" ? d.text : null,
    html: typeof d.html === "string" ? d.html : null,
    headers,
  };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** A message's HTML as plain text, for the rare one with no text part. Nothing from it is ever rendered as HTML. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The message's text as kept: its text part, or its HTML turned to text, cut to what the database takes. */
export function bodyText(email: ReceivedEmail): { text: string; truncated: boolean } {
  const raw = (email.text && email.text.trim() !== "" ? email.text : email.html ? htmlToText(email.html) : "").replace(/\0/g, "").trim();
  return raw.length > MAX_BODY_CHARS ? { text: raw.slice(0, MAX_BODY_CHARS), truncated: true } : { text: raw, truncated: false };
}

/** The headers worth keeping: the ones that thread a message, and the ones that say a machine wrote it. */
const KEPT_HEADERS = ["message-id", "in-reply-to", "references", "date", "reply-to", "auto-submitted", "precedence", "list-id", "x-autoreply", "x-autorespond"];

export function keptHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of KEPT_HEADERS) {
    const v = headers[name];
    if (typeof v === "string" && v !== "") out[name] = v.slice(0, 998);
  }
  return out;
}

/**
 * Whether a machine wrote the message: an out-of-office reply, a delivery failure, a list or bulk sender
 * (RFC 3834's Auto-Submitted, the Precedence header, the autoreply headers some systems send, or a mailer-daemon).
 */
export function isAutomatic(headers: Record<string, string>, fromAddress: string): boolean {
  const auto = headers["auto-submitted"]?.trim().toLowerCase();
  if (auto && auto !== "no") return true;
  if (/^(bulk|junk|list|auto_reply)$/i.test(headers["precedence"]?.trim() ?? "")) return true;
  if ("x-autoreply" in headers || "x-autorespond" in headers) return true;
  return /^(mailer-daemon|postmaster)@/i.test(fromAddress);
}

export type AttachmentDecision = { keep: true } | { keep: false; reason: "too_large" | "unsupported_type" };

/**
 * Whether an attachment is worth downloading: the same limits as an upload (supabase/functions/_shared/fileSignature.ts)
 * but judged by name and size. Its bytes are checked after the download.
 */
export function attachmentDecision(file: { name: string; size: number }): AttachmentDecision {
  if (file.size > MAX_UPLOAD_BYTES) return { keep: false, reason: "too_large" };
  // With no bytes to judge, only a type uploads never take is refused here.
  const sniffed = sniffUpload(new Uint8Array(0), file.name);
  return sniffed.ok === false && sniffed.reason === "unsupported" ? { keep: false, reason: "unsupported_type" } : { keep: true };
}
