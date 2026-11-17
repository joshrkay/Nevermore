import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AddSenderAsContact } from "@/components/conversations/AddSenderAsContact";
import MailboxForWriting from "@/components/mailbox/MailboxForWriting";
import { useFirstSend } from "@/components/mailbox/useFirstSend";
import { failureWords } from "@/components/workspace/form";
import { PlaceholderLines } from "@/components/workspace/states";
import { formatDay } from "@/data/accountPage";
import {
  getConversation, getLeadConversation, listAttachableFiles, openConversation, sendConversationMessage, workTheQueue, type ConversationMessage,
} from "@/lib/conversationApi";
import { useDraft } from "./useDraft";

/** Who the place to write writes to: a contact, or a lead (its page mounts the same place to write, slice 8.5, D-603). */
export type Recipient = {
  name: string;
  email: string | null;
  doNotEmail: boolean;
} & (
  /** A contact, and the account whose files a message may carry (D-605). */
  | { contactId: string; accountId: string; leadId?: never }
  /** A lead: it has no account, so a message carries no file (D-685). */
  | { leadId: string; contactId?: never; accountId?: never }
);

export interface PlaceToWriteProps {
  firmId: string;
  recipient: Recipient;
  /** The page to come back to after connecting a mailbox (brokerNext keeps it, D-650). */
  returnTo: string;
  /** The section's id, for a link to it (a lead's Email, slice 8.5). */
  anchorId?: string;
}

/** Which way a message went and where it is: received, on its way (recorded, queued), sent, or didn't go (D-632). */
const statusWords = (m: ConversationMessage) =>
  m.direction === "inbound" ? "Received" : m.status === "queued" ? "On its way" : m.status === "failed" ? "Didn't go" : "Sent";

export const conversationKey = (firmId: string, contactId: string) => ["conversation", firmId, contactId] as const;

/** The record a recipient is, for the conversation's key and the draft's: a contact's id, or "lead:<id>". */
const recordOf = (r: Recipient): string => (r.leadId !== undefined ? `lead:${r.leadId}` : r.contactId);

/**
 * The place to write on a contact's page, and in the account's and the opportunity's Email (story CRM-E1.2, slice 6.3): the conversation newest first,
 * sent and received, and a subject and a message sent through `send_conversation_message`.
 */
const PlaceToWrite = ({ firmId, recipient, returnTo, anchorId }: PlaceToWriteProps) => {
  const record = recordOf(recipient);
  const query = useQuery({
    queryKey: conversationKey(firmId, record),
    queryFn: () => (recipient.leadId !== undefined ? getLeadConversation(firmId, recipient.leadId) : getConversation(firmId, recipient.contactId)),
  });
  // Showing the conversation is opening it: its new-mail mark is cleared for the firm through the newest message shown, never past it (6.4, D-607).
  const newest = query.data?.newMail ? query.data.messages[0]?.at : undefined;
  const conversationId = query.data?.conversationId;
  useEffect(() => {
    if (conversationId && newest) void openConversation(firmId, conversationId, newest).catch(() => undefined);
  }, [firmId, conversationId, newest]);
  const hasAddress = (recipient.email ?? "").trim() !== "";
  // Do not email and no address are the database's refusals too (PT409); here they hide the place to write and say why.
  const writable = hasAddress && !recipient.doNotEmail;
  // What is written is kept across leaving the page to connect a mailbox and coming back (D-653).
  const [draft, setDraft, clearDraft] = useDraft(`draft:conversation:${record}`);
  const { subject, body } = draft;
  const setSubject = (s: string) => setDraft((d) => ({ ...d, subject: s }));
  const setBody = (b: string) => setDraft((d) => ({ ...d, body: b }));
  const [sending, setSending] = useState(false);
  const { beforeSend, choice } = useFirstSend({ returnTo });
  const queryClient = useQueryClient();

  const [refused, setRefused] = useState<string | null>(null);
  // The message this one answers: it goes with In-Reply-To and References (D-635), so the client's mail program threads it.
  const [replyingTo, setReplyingTo] = useState<{ id: string; subject: string } | null>(null);
  const canWrite = query.data?.mailbox.connected === true && writable;
  // The files the database lets go with a message to this contact (D-605): the account's own, past the virus check, ones the agent may open.
  const files = useQuery({
    queryKey: [...conversationKey(firmId, record), "files"],
    queryFn: () => listAttachableFiles(firmId, recipient.contactId as string),
    enabled: canWrite && recipient.contactId !== undefined,
  });
  const [chosen, setChosen] = useState<string[]>([]);

  const answer = (m: ConversationMessage) => {
    setReplyingTo({ id: m.id, subject: m.subject });
    setSubject(/^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`);
  };

  const send = async () => {
    setSending(true);
    setRefused(null);
    try {
      const to = recipient.leadId !== undefined ? { leadId: recipient.leadId } : { contactId: recipient.contactId };
      await sendConversationMessage(firmId, { ...to, subject, body, inReplyTo: replyingTo?.id ?? null, documentIds: chosen });
    } catch (err) {
      // Nothing was recorded: what was written stays, and the database's words say why.
      setRefused(failureWords(err, "We couldn't send that. Check your connection and try again."));
      setSending(false);
      return;
    }
    clearDraft();
    setChosen([]);
    setReplyingTo(null);
    // The queue is worked at once, as a signed-in person may (D-638), so the message doesn't wait for the minute schedule; then the conversation is
    // asked again for its state.
    await workTheQueue();
    await queryClient.invalidateQueries({ queryKey: conversationKey(firmId, record) });
    setSending(false);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void beforeSend(send);
  };
  return (
    <section id={anchorId} aria-label="Emails" className="border border-border rounded-xl p-4 space-y-4 scroll-mt-6">
      <h2 className="text-lg font-semibold">Emails</h2>
      {!query.data && (
        <div role="status" aria-label="Loading emails">
          <PlaceholderLines count={4} />
        </div>
      )}
      {query.data && query.data.messages.length === 0 && <p className="text-sm text-muted-foreground">No emails yet</p>}
      {query.data && query.data.messages.length > 0 && (
        <ol aria-label={`Emails with ${recipient.name}`} className="space-y-3">
          {query.data.messages.map((m) => (
            <li key={m.id} className="rounded-lg border border-border p-3 text-sm space-y-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">{statusWords(m)}</span> · {m.from} · {formatDay(m.at)}
              </p>
              {m.offerContact && (
                <p className="text-xs">
                  <AddSenderAsContact
                    firmId={firmId}
                    message={{ id: m.id, from: m.from, fromName: m.fromName ?? null }}
                    onAdded={() => {
                      toast.success("Contact added");
                      void queryClient.invalidateQueries({ queryKey: conversationKey(firmId, record) });
                    }}
                  />
                </p>
              )}
              <p className="font-medium">{m.subject}</p>
              <p className="whitespace-pre-wrap">{m.body}</p>
              {m.status === "failed" && m.failureReason && <p role="alert" className="text-destructive">{m.failureReason}</p>}
              {canWrite && (
                <button type="button" onClick={() => answer(m)} className="text-primary underline underline-offset-2">Reply</button>
              )}
            </li>
          ))}
        </ol>
      )}
      {recipient.doNotEmail && <p role="note" className="text-sm">This contact is marked Do not email, so nothing can be written to them from here.</p>}
      {!recipient.doNotEmail && !hasAddress && <p role="note" className="text-sm">No email address on file. Add one to write from here.</p>}
      {query.data && writable && <MailboxForWriting returnTo={returnTo} lastSendFailed={query.data.mailbox.lastSendFailed} />}
      {canWrite && <form className="space-y-3" onSubmit={submit}>
        {replyingTo && (
          <p className="text-sm">
            Replying to “{replyingTo.subject}”{" "}
            <button type="button" onClick={() => setReplyingTo(null)} className="text-primary underline underline-offset-2">Write a new message instead</button>
          </p>
        )}
        <label className="block text-sm">
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2" />
        </label>
        <label className="block text-sm">
          Message
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2" rows={6} />
        </label>
        {(files.data ?? []).length > 0 && (
          <fieldset aria-label="Files from the account" className="space-y-1 text-sm">
            <legend className="font-medium">Files from the account</legend>
            <p className="text-xs text-muted-foreground">Each goes as a link that stops working after 30 days, never as an attachment.</p>
            {(files.data ?? []).map((f) => (
              <label key={f.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={chosen.includes(f.id)}
                  onChange={(e) => setChosen((c) => (e.target.checked ? [...c, f.id] : c.filter((x) => x !== f.id)))}
                />
                <span className="break-all">{f.fileName}</span>
              </label>
            ))}
          </fieldset>
        )}
        {refused && <p role="alert" className="text-sm text-destructive">{refused}</p>}
        <button type="submit" disabled={sending} className="min-h-11 px-4 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
          {sending ? "Sending…" : "Send"}
        </button>
      </form>}
      {choice}
    </section>
  );
};

export default PlaceToWrite;
