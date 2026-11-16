import { supabase } from "@/integrations/supabase/client";
import { refusal } from "@/lib/contactApi";

// What the place to write asks the database (story CRM-E1.2, slice 6.3; 20261122090000_conversations.sql, 20261122160000_conversation_files.sql). The
// database decides every rule (who may write, Do not email, the files a message may carry, a closing firm, Nevermore support); this only puts its answers
// and refusals into the screen's shape and words.

/** One message of a conversation, as conversation_for answers it (newest first). */
export interface ConversationMessage {
  id: string;
  direction: "outbound" | "inbound";
  from: string;
  to: string[];
  subject: string;
  body: string;
  /** queued: recorded, on its way; sent; failed, with its kind and the reason in the writer's words (D-632). Received mail is always sent. */
  status: "queued" | "sent" | "failed";
  failureKind: "mailbox" | "refused" | "uncertain" | "unavailable" | null;
  failureReason: string | null;
  at: string;
}

export interface Conversation {
  conversationId: string | null;
  messages: ConversationMessage[];
  /** The writer's own mailbox (D-634): not connected after a send failed for a mailbox reason is Reconnect. */
  mailbox: { connected: boolean; lastSendFailed: boolean };
}

type Raw = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v : "");
const texts = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function messageOf(m: Raw): ConversationMessage {
  return {
    id: text(m.id),
    direction: m.direction === "inbound" ? "inbound" : "outbound",
    from: text(m.from_address),
    to: texts(m.to_addresses),
    subject: text(m.subject),
    body: text(m.body_text),
    status: m.status === "sent" || m.status === "failed" ? m.status : "queued",
    failureKind: (m.failure_kind as ConversationMessage["failureKind"]) ?? null,
    failureReason: typeof m.failure_reason === "string" ? m.failure_reason : null,
    at: text(m.sent_at) || text(m.recorded_at),
  };
}

/** A contact's conversation, newest first, and the writer's mailbox. */
export async function getConversation(firmId: string, contactId: string): Promise<Conversation> {
  const { data, error } = await supabase.rpc("conversation_for", { p_contact_id: contactId, p_firm_id: firmId });
  if (error) throw refusal(error, "We couldn't load the emails. Try again.");
  const row = (data ?? {}) as { conversation?: Raw | null; messages?: Raw[]; mailbox?: { connected?: boolean; last_send_failed?: boolean } };
  return {
    conversationId: row.conversation ? text(row.conversation.id) : null,
    messages: (row.messages ?? []).map(messageOf),
    mailbox: { connected: row.mailbox?.connected === true, lastSendFailed: row.mailbox?.last_send_failed === true },
  };
}

export interface MessageToSend {
  contactId: string;
  subject: string;
  body: string;
  /** The message this one answers (its id), so it carries In-Reply-To and References (D-635); null for a new message. */
  inReplyTo: string | null;
  /** Files from the account's files, each sent as an expiring link (D-605). */
  documentIds: string[];
}

/** Records one message queued on the contact's conversation (send_conversation_message) and answers it. */
export async function sendConversationMessage(firmId: string, m: MessageToSend): Promise<ConversationMessage> {
  const { data, error } = await supabase.rpc("send_conversation_message", {
    p_contact_id: m.contactId, p_subject: m.subject, p_body: m.body, p_in_reply_to: m.inReplyTo, p_firm_id: firmId,
    ...(m.documentIds.length > 0 ? { p_document_ids: m.documentIds } : {}),
  });
  if (error) throw refusal(error, "We couldn't send that. Try again.");
  return messageOf((data ?? {}) as Raw);
}

/** A file that may go with a message, as a link (D-605). */
export interface AttachableFile {
  id: string;
  fileName: string;
  category: string;
}

/**
 * The files that may go with a message to this contact (conversation_files_for): its account's files that passed the virus check and that the agent may
 * open, a packet or a census only its own employer's. The database decides, and refuses any other at the send.
 */
export async function listAttachableFiles(firmId: string, contactId: string): Promise<AttachableFile[]> {
  const { data, error } = await supabase.rpc("conversation_files_for", { p_contact_id: contactId, p_firm_id: firmId });
  if (error) throw refusal(error, "We couldn't load the account's files. Try again.");
  return ((data ?? []) as Raw[]).map((f) => ({ id: text(f.id), fileName: text(f.file_name), category: text(f.category) }));
}

/**
 * Asks send-mail to work the queue now (D-638: any signed-in person may; it only decides when). The message is already recorded and queued, so a
 * failure here changes nothing: the minute schedule sends it.
 */
export async function workTheQueue(): Promise<void> {
  try {
    await supabase.functions.invoke("send-mail", { body: {} });
  } catch {
    /* the schedule sends it */
  }
}
