import { supabase } from "@/integrations/supabase/client";
import { ContactError, refusal } from "@/lib/contactApi";

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
  /** queued: recorded, on its way; sent; failed, with its kind and the reason in the writer's words (D-632). Received mail is "received" (6.4). */
  status: "queued" | "sent" | "failed" | "received";
  failureKind: "mailbox" | "refused" | "uncertain" | "unavailable" | null;
  failureReason: string | null;
  at: string;
  /** Who sent a received message, by name when the mail said (6.4). */
  fromName?: string | null;
  /** The sender was seen on no earlier message of the conversation (6.4): marked on the message. */
  newSender?: boolean;
  /** The sender is offered as a contact of the conversation's account (CRM-E1.3): the database says so, and says it of no lead's conversation (D-662). */
  offerContact?: boolean;
}

export interface Conversation {
  conversationId: string | null;
  /** Mail came in that nobody in the firm has opened since (6.4, D-607): opening the place to write clears it. */
  newMail?: boolean;
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
    status: m.status === "sent" || m.status === "failed" || m.status === "received" ? m.status : "queued",
    failureKind: (m.failure_kind as ConversationMessage["failureKind"]) ?? null,
    failureReason: typeof m.failure_reason === "string" ? m.failure_reason : null,
    at: text(m.sent_at) || text(m.recorded_at),
    fromName: typeof m.from_name === "string" ? m.from_name : null,
    newSender: m.new_sender === true,
    offerContact: m.offer_contact === true,
  };
}

/** A contact's conversation, newest first, and the writer's mailbox. */
export async function getConversation(firmId: string, contactId: string): Promise<Conversation> {
  return conversationOf(await supabase.rpc("conversation_for", { p_contact_id: contactId, p_firm_id: firmId }));
}

/** A lead's conversation, newest first, and the writer's mailbox (the lead's page, slice 8.5, D-603). */
export async function getLeadConversation(firmId: string, leadId: string): Promise<Conversation> {
  return conversationOf(await supabase.rpc("conversation_for", { p_lead_id: leadId, p_firm_id: firmId }));
}

function conversationOf({ data, error }: { data: unknown; error: { code?: string; message?: string } | null }): Conversation {
  if (error) throw refusal(error, "We couldn't load the emails. Try again.");
  const row = (data ?? {}) as { conversation?: Raw | null; messages?: Raw[]; mailbox?: { connected?: boolean; last_send_failed?: boolean } };
  return {
    conversationId: row.conversation ? text(row.conversation.id) : null,
    newMail: row.conversation?.new_mail === true,
    messages: (row.messages ?? []).map(messageOf),
    mailbox: { connected: row.mailbox?.connected === true, lastSendFailed: row.mailbox?.last_send_failed === true },
  };
}

/** A message on an account's (or an opportunity's) page, with the contact whose conversation it is on. */
export interface AccountMessage extends ConversationMessage {
  contactId: string;
}

/**
 * The mail with an account's contacts, newest first, from the one row each message is (account_conversation_messages, 6.4; D-601): for an account, or
 * for an opportunity (its account's contacts).
 */
export async function getAccountMessages(firmId: string, of: { accountId?: string; opportunityId?: string }): Promise<AccountMessage[]> {
  const { data, error } = await supabase.rpc("account_conversation_messages", {
    p_account_id: of.accountId ?? null, p_opportunity_id: of.opportunityId ?? null, p_firm_id: firmId,
  });
  if (error) throw refusal(error, "We couldn't load the emails. Try again.");
  return (((data ?? {}) as { messages?: Raw[] }).messages ?? []).map((m) => ({ ...messageOf(m), contactId: text(m.contact_id) }));
}

/** Clears the conversation's new-mail mark for the firm through the newest message shown (open_conversation, 6.4). A failure leaves the mark: it is no error. */
export async function openConversation(firmId: string, conversationId: string, seenThrough: string): Promise<void> {
  await supabase.rpc("open_conversation", { p_conversation_id: conversationId, p_seen_through: seenThrough, p_firm_id: firmId });
}

export interface MessageToSend {
  /** The contact written to, or, on a lead's page, the lead (a lead's message carries no file, D-685). */
  contactId?: string;
  leadId?: string;
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
    p_contact_id: m.contactId ?? null, p_lead_id: m.leadId ?? null, p_subject: m.subject, p_body: m.body, p_in_reply_to: m.inReplyTo, p_firm_id: firmId,
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

/** What a new sender is added with: the address is the message's own, so it is not asked for. */
export interface SenderAsContact {
  firstName: string;
  lastName: string;
  title: string;
  phone: string;
}

/**
 * Adds the sender of a received message as a contact on the account of the conversation's contact (add_sender_as_contact, 6.4), through add_contact and every
 * one of its rules. Refusals come back in the database's words (a last name wanted, an account archived since, a sender already added).
 */
export async function addSenderAsContact(firmId: string, messageId: string, contact: SenderAsContact): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc("add_sender_as_contact", {
    p_message_id: messageId, p_first_name: contact.firstName, p_last_name: contact.lastName, p_title: contact.title, p_phone: contact.phone, p_firm_id: firmId,
  });
  if (error) throw refusal(error, "Couldn't add the contact. Check your connection and try again.");
  const id = ((data ?? {}) as { record?: { id?: unknown } }).record?.id;
  if (typeof id !== "string" || id === "") throw new ContactError("failed", "Couldn't add the contact. Check your connection and try again.");
  return { id };
}
