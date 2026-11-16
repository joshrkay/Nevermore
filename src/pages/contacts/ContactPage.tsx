import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Archive } from "lucide-react";
import { AccountActionsProvider } from "@/components/accounts/accountActions";
import { accountKey } from "@/components/accounts/useAccountQueries";
import { ContactDetailsPanel } from "@/components/contacts/ContactDetails";
import PlaceToWrite from "@/components/conversations/PlaceToWrite";
import { contactName } from "@/data/accountPage";
import { ContactHeader, ContactHeaderLoading } from "@/components/contacts/ContactHeader";
import { ContactActivity, ContactOpportunities } from "@/components/contacts/ContactPanels";
import { contactKey, useContactPageQuery } from "@/components/contacts/useContactQueries";
import { LoadFailed, NotAvailable, PlaceholderLines, PlaceholderPanel, RecordLoading, SlowLoadLine, useSlowLoad } from "@/components/workspace/states";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import type { ContactFields, ContactPage as Page } from "@/lib/contactPageApi";

/**
 * A contact's page (story CRM-C1.1, screen 18; D-37: `/contacts/:id` inside the workspace layout). The database decides who may see the contact (its account's
 * visibility) and who may change it (the level rule on its own owner, D-209); this draws what it answers. The calls, notes and tasks, Log a call, Add a task, Add a
 * note, Move and the edit of each entry are the account page's own, on this contact. The emails with the contact and the place to write are `PlaceToWrite` (CRM-E1.2, D-680).
 */
const ContactPage = () => {
  const { id = "" } = useParams();
  const workspace = useWorkspace();
  const { firm, isSupport } = workspace;
  const { user } = useAuth();
  const firmId = firm?.id ?? null;
  const queryClient = useQueryClient();
  const query = useContactPageQuery(firmId, id);
  const retry = useCallback(() => void query.refetch(), [query]);
  const waiting = firmId === null || (query.data === undefined && !query.isError);
  const slow = useSlowLoad(waiting, retry);

  // The saved fields go on the page at once (the reload that follows confirms them); every list of the contact is asked again, since a save adds to its history, and
  // the account's lists too, since a contact's main mark and name are on them.
  const saved = useCallback((fields: ContactFields, previousMain: { id: string; name: string } | null) => {
    queryClient.setQueryData<Page | null>([...contactKey(firmId, id), "page"], (old) => (old ? { ...old, contact: { ...old.contact, ...fields } } : old));
    void queryClient.invalidateQueries({ queryKey: contactKey(firmId, id) });
    void queryClient.invalidateQueries({ queryKey: accountKey(firmId, fields.accountId) });
    // The contact this one took the main place from is on screen nowhere here, but its own page is cached and shows "Main contact" until it is asked again.
    if (previousMain) void queryClient.invalidateQueries({ queryKey: contactKey(firmId, previousMain.id) });
  }, [queryClient, firmId, id]);

  // Only the answer for this address is drawn: what is held for another contact (or firm) is not shown under it.
  const answered = query.data === null || query.data === undefined || query.data.contact.id === id;
  if (waiting || !answered) return <Frame><ContactLoading slow={slow.slow} onTryAgain={slow.tryAgain} /></Frame>;
  if (query.isError && query.data === undefined) {
    // An address whose id is no id at all (the database refuses it, 22P02) is a contact that isn't there, not a load that could work next time.
    if ((query.error as { code?: string }).code === "22P02") return <Frame><NotAvailable noun="contact" backTo="/accounts" backLabel="Back to all accounts" /></Frame>;
    return <Frame><LoadFailed error={query.error as Error} what="this contact" onRetry={retry} /></Frame>;
  }
  const page = query.data;
  // The same answer for a contact that is gone, another firm's, or one whose account the person's level does not reach.
  if (!page) return <Frame><NotAvailable noun="contact" backTo="/accounts" backLabel="Back to all accounts" /></Frame>;

  const { contact } = page;
  // Calls, notes and tasks can be acted on only where the database will take them: not during a Nevermore support session (ADR 0024). On an archived account nothing
  // can be added (D-222), but an existing call or task can still be changed and a task marked done.
  const canAct = firmId !== null && !isSupport;
  const body = (
    <>
      {contact.account.archived && (
        <div role="note" className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <Archive className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="flex-1"><strong className="font-medium">This account is archived.</strong> Nothing can be added to it.</p>
        </div>
      )}
      <ContactHeader contact={contact} canMove={canAct && page.canMove} />
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] items-start">
        <div className="space-y-6 min-w-0">
          {firmId && <ContactDetailsPanel key={contact.id} firmId={firmId} contact={contact} canChange={page.canChange} onSaved={saved} />}
          <ContactOpportunities opportunities={page.opportunities} />
        </div>
        <div className="min-w-0 space-y-6">
          {firmId && (
            <PlaceToWrite
              key={`emails-${contact.id}`}
              firmId={firmId}
              recipient={{ contactId: contact.id, name: contactName(contact), email: contact.email, doNotEmail: contact.doNotEmail, accountId: contact.account.id }}
              returnTo={`/contacts/${contact.id}`}
            />
          )}
          {firmId && <ContactActivity key={contact.id} firmId={firmId} contactId={contact.id} />}
        </div>
      </div>
    </>
  );
  return (
    <Frame>
      {canAct ? (
        <AccountActionsProvider
          firmId={firmId}
          accountId={contact.account.id}
          accountName={contact.account.name}
          userId={user?.id ?? null}
          person={workspace.person}
          canAdd={page.canAdd}
          canMove={page.canMove}
          alsoRefresh={contactKey(firmId, id)}
        >{body}</AccountActionsProvider>
      ) : body}
    </Frame>
  );
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background">
    <main className="container mx-auto px-6 py-8">{children}</main>
  </div>
);

/** What the page shows while the contact is on its way: the header, and the panels each under its own heading with grey rows. */
const ContactLoading = ({ slow, onTryAgain }: { slow: boolean; onTryAgain: () => void }) => (
  <RecordLoading name="contact">
    <ContactHeaderLoading />
    <SlowLoadLine loading slow={slow} onTryAgain={onTryAgain} />
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] items-start">
      <div className="space-y-6">
        <PlaceholderPanel heading="Details"><PlaceholderLines count={8} /></PlaceholderPanel>
        <PlaceholderPanel heading="Opportunities"><PlaceholderLines count={2} /></PlaceholderPanel>
      </div>
      <PlaceholderPanel heading="Calls, notes and tasks"><PlaceholderLines count={4} /></PlaceholderPanel>
    </div>
  </RecordLoading>
);

export default ContactPage;
