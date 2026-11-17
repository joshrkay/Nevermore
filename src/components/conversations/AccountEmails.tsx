import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AddSenderAsContact } from "@/components/conversations/AddSenderAsContact";
import { PanelFailed, PlaceholderLines } from "@/components/workspace/states";
import { formatDay } from "@/data/accountPage";
import { getAccountMessages } from "@/lib/conversationApi";

/**
 * The mail with an account's contacts, on the account's page (and, once it is built, the opportunity's: `opportunityId`), newest first (CRM-E1.3's third
 * criterion, read by 6.4's account_conversation_messages; slice 6.3 draws it). Each message names its contact and opens the contact's page, where it is
 * written to; it is the one row each message is, never a copy.
 */
export function AccountEmails({ firmId, accountId, opportunityId, contactName }: {
  firmId: string;
  accountId?: string;
  opportunityId?: string;
  /** The contact's name as the page holds it; null when the page doesn't hold it. */
  contactName: (contactId: string) => string | null;
}) {
  const query = useQuery({
    queryKey: ["account-emails", firmId, accountId ?? null, opportunityId ?? null],
    queryFn: () => getAccountMessages(firmId, opportunityId ? { opportunityId } : { accountId }),
  });
  return (
    <section aria-label="Emails with the account's contacts" className="border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-display text-lg font-bold">Emails</h2>
      {query.isError && <PanelFailed what="the emails" error={query.error as Error} onRetry={() => void query.refetch()} />}
      {!query.data && !query.isError && <PlaceholderLines count={3} />}
      {query.data && query.data.length === 0 && <p className="text-sm text-muted-foreground">No emails yet</p>}
      {query.data && query.data.length > 0 && (
        <ol aria-label="Emails with the account's contacts" className="space-y-2">
          {query.data.map((m) => (
            <li key={m.id} className="text-sm border-b border-border pb-2 last:border-0">
              <p className="text-xs text-muted-foreground">
                {m.direction === "inbound" && m.newSender ? (
                  // A new sender wrote to a contact's conversation address: the mail is theirs, and sits on that contact's emails.
                  <>
                    Received from {m.fromName?.trim() || m.from} on{" "}
                    <Link to={`/contacts/${m.contactId}`} className="text-primary underline underline-offset-2">{contactName(m.contactId) ?? "the contact"}&apos;s emails</Link>
                  </>
                ) : (
                  <>
                    {m.direction === "inbound" ? "Received from" : "Sent to"}{" "}
                    <Link to={`/contacts/${m.contactId}`} className="text-primary underline underline-offset-2">{contactName(m.contactId) ?? "the contact"}</Link>
                  </>
                )}
                {" · "}{formatDay(m.at)}
              </p>
              <p className="font-medium">{m.subject}</p>
              {m.offerContact && (
                <p className="text-xs">
                  <AddSenderAsContact
                    firmId={firmId}
                    message={{ id: m.id, from: m.from, fromName: m.fromName ?? null }}
                    onAdded={() => {
                      toast.success("Contact added");
                      void query.refetch();
                    }}
                  />
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
