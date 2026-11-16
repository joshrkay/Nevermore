// Builds the one RFC 5322 message send-mail sends for a conversation message (story CRM-E1.2a; M-2.1's Reply-To and Message-ID rules). Plain text,
// UTF-8, base64, CRLF line ends. No imports beyond the shared modules, so it runs under Deno and Vitest alike.

/** A message as claim_conversation_mail answers it, with the conversation's reply address. */
export interface ClaimedMessage {
  id: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body_text: string;
  message_id: string;
  in_reply_to: string | null;
  message_references: string[];
  sender_id: string | null;
  reply_address: string;
}

const ENC = new TextEncoder();

const base64 = (bytes: Uint8Array): string => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

/** RFC 5322's date: "Mon, 16 Nov 2026 15:04:05 +0000". */
const mailDate = (d: Date) => d.toUTCString().replace(/GMT$/, "+0000");

/** The body as base64 lines of at most 76 characters, its line ends made CRLF first. */
const bodyLines = (text: string) => (base64(ENC.encode(text.replace(/\r?\n/g, "\r\n"))).match(/.{1,76}/g) ?? []).join("\r\n");

/**
 * A subject as a header value. Short printable ASCII goes as it is; anything else as UTF-8 encoded words (RFC 2047), each of whole characters and at
 * most 39 bytes, so every folded line stays within 78 characters.
 */
function subjectValue(subject: string): string {
  if (/^[\x20-\x7e]*$/.test(subject) && subject.length <= 69) return subject;
  const words: string[] = [];
  let chunk = "";
  for (const ch of subject) {
    if (ENC.encode(chunk + ch).length > 39) {
      words.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${base64(ENC.encode(w))}?=`).join("\r\n ");
}

/** An address list, one address to a folded line, so no line passes 78 characters. */
const list = (addresses: string[]) => addresses.join(",\r\n ");

/** The message's text, ready to send. `replyDomain` is the receiving subdomain the conversation's address is at. */
export function buildMessage(m: ClaimedMessage, replyDomain: string, now: Date): string {
  const headers = [
    `From: ${m.from_address}`,
    `To: ${list(m.to_addresses)}`,
    ...(m.cc_addresses.length > 0 ? [`Cc: ${list(m.cc_addresses)}`] : []),
    // The conversation's address first, so a reply reaches the record even from a mail system that honours only the first; the agent's second (ADR 0005).
    `Reply-To: ${list([`${m.reply_address}@${replyDomain}`, m.from_address])}`,
    `Subject: ${subjectValue(m.subject)}`,
    `Date: ${mailDate(now)}`,
    `Message-ID: ${m.message_id}`,
    // Only when the writer named the message this answers (M-2.1).
    ...(m.in_reply_to ? [`In-Reply-To: ${m.in_reply_to}`] : []),
    ...(m.in_reply_to && m.message_references.length > 0 ? [`References: ${m.message_references.join("\r\n ")}`] : []),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${bodyLines(m.body_text)}`;
}

/** The message as Gmail's `raw`: base64url, no padding. */
export const gmailRaw = (message: string) => base64(ENC.encode(message)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** The message as Microsoft Graph's sendMail takes MIME: base64. */
export const mimeBase64 = (message: string) => base64(ENC.encode(message));
