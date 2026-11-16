import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Archive } from "lucide-react";
import { AccountActionsProvider } from "@/components/accounts/accountActions";
import { accountPath } from "@/components/accounts/accountColumns";
import { accountKey } from "@/components/accounts/useAccountQueries";
import { CloseOpportunityDialog } from "@/components/opportunities/CloseOpportunityDialog";
import { OutcomeBanner } from "@/components/opportunities/OutcomeBanner";
import { OpportunityContacts } from "@/components/opportunities/ContactsPanel";
import { OpportunityActivity } from "@/components/opportunities/OpportunityActivity";
import { OpportunityDetailsPanel } from "@/components/opportunities/OpportunityDetails";
import { IntakePanel } from "@/components/opportunities/IntakePanel";
import { QuotesPanel } from "@/components/opportunities/QuotesPanel";
import { OpportunityHeader, OpportunityHeaderLoading } from "@/components/opportunities/OpportunityHeader";
import { opportunityKey, useOpportunityOutcomeQuery, useOpportunityPageQuery } from "@/components/opportunities/useOpportunityQueries";
import { LoadFailed, NotAvailable, PlaceholderLines, PlaceholderPanel, RecordLoading, SlowLoadLine, useSlowLoad } from "@/components/workspace/states";
import { useNoteOpened } from "@/components/workspace/useNoteOpened";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import type { OpportunityFields, OpportunityPage as Page } from "@/lib/opportunityPageApi";

/**
 * The opportunity's page (stories CRM-O1.1b and CRM-O1.3b, screen 19; D-37: `/opportunities/:id` inside the workspace layout). The database decides who may see the opportunity
 * (whoever sees its account, D-422) and who may change it (the level rule on its own owner, D-209); this draws what it answers.
 */
const OpportunityPage = () => {
  const { id = "" } = useParams();
  const workspace = useWorkspace();
  const { firm, isSupport } = workspace;
  const { user } = useAuth();
  const firmId = firm?.id ?? null;
  const query = useOpportunityPageQuery(firmId, id);
  const queryClient = useQueryClient();
  const retry = useCallback(() => void query.refetch(), [query]);
  // How it ended, what the win made and each quote's close reason (CRM-O1.3b). Read beside the page, so a failure of it never hides the page.
  const outcome = useOpportunityOutcomeQuery(firmId, id, query.data ? query.data.opportunity.submissionId : undefined);
  const [closing, setClosing] = useState<"won" | "lost" | "" | null>(null);
  const waiting = firmId === null || (query.data === undefined && !query.isError);
  const slow = useSlowLoad(waiting, retry);
  // The opportunity is now among the menu search's recent records (CRM-S1.2a, D-620): noted once its page has loaded.
  useNoteOpened(firmId, "opportunity", id, query.data?.opportunity.id === id);

  // The saved fields go on the page at once (the reload that follows confirms them); every list of the opportunity is asked again, since a save adds to its history,
  // and so are the account's lists and the contacts' pages, which name the opportunity, its stage and its main contact.
  const saved = useCallback((fields: OpportunityFields) => {
    queryClient.setQueryData<Page | null>([...opportunityKey(firmId, id), "page"], (old) => (old ? { ...old, opportunity: { ...old.opportunity, ...fields } } : old));
    void queryClient.invalidateQueries({ queryKey: opportunityKey(firmId, id) });
    void queryClient.invalidateQueries({ queryKey: accountKey(firmId, fields.accountId) });
    void queryClient.invalidateQueries({ queryKey: ["contact", firmId] });
  }, [queryClient, firmId, id]);

  // A close, a reopen or a payment changes the stage, the history, the account's status and renewals: all of it is asked again.
  const closed = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: opportunityKey(firmId, id) });
    if (query.data) void queryClient.invalidateQueries({ queryKey: accountKey(firmId, query.data.opportunity.accountId) });
    void queryClient.invalidateQueries({ queryKey: ["contact", firmId] });
  }, [queryClient, firmId, id, query.data]);

  // Only the answer for this address is drawn: what is held for another opportunity (or firm) is not shown under it.
  const answered = query.data === null || query.data === undefined || query.data.opportunity.id === id;
  if (waiting || !answered) return <Frame><OpportunityLoading slow={slow.slow} onTryAgain={slow.tryAgain} /></Frame>;
  if (query.isError && query.data === undefined) {
    // An address whose id is no id at all (the database refuses it, 22P02) is an opportunity that isn't there, not a load that could work next time.
    if ((query.error as { code?: string }).code === "22P02") return <Frame><NotAvailable noun="opportunity" backTo="/accounts" backLabel="Back to all accounts" /></Frame>;
    return <Frame><LoadFailed error={query.error as Error} what="this opportunity" onRetry={retry} /></Frame>;
  }
  const page = query.data;
  // The same answer for an opportunity that is gone, another firm's, or one whose account the person's level does not reach (D-421).
  if (!page) return <Frame><NotAvailable noun="opportunity" backTo="/accounts" backLabel="Back to all accounts" /></Frame>;

  const { account, opportunity } = page;
  // Calls, notes and tasks can be acted on only where the database will take them: not during a Nevermore support session (ADR 0024), and, as D-432 says, nothing on
  // an archived account's opportunity can be changed, so there are no actions to offer there: no Add, Mark done, Open again or Edit.
  const canAct = firmId !== null && !isSupport && !account.archived;
  const isClosed = opportunity.stage === "won" || opportunity.stage === "lost";
  // D-431: whoever may change an open opportunity may mark it won or lost. D-462: reopening is for its record owner or a firm owner.
  const canClose = canAct && page.canChange && !isClosed;
  const canReopen = canAct && isClosed && (workspace.isOwner || (opportunity.ownerId !== null && opportunity.ownerId === user?.id));
  const body = (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted-foreground">
        <Link to="/accounts" className="text-primary hover:underline">Accounts</Link>
        <span aria-hidden="true"> / </span>
        <Link to={accountPath(account.id)} className="text-primary hover:underline">{account.name}</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{opportunity.name}</span>
      </nav>
      {account.archived && (
        <div role="note" className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <Archive className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="flex-1"><strong className="font-medium">This account is archived.</strong> Nothing can be added to it.</p>
        </div>
      )}
      <OpportunityHeader page={page} onMarkWonOrLost={canClose ? () => setClosing("") : undefined} />
      {isClosed && firmId && (
        <OutcomeBanner
          firmId={firmId}
          page={page}
          outcome={outcome.data}
          loading={outcome.isPending}
          failed={outcome.isError}
          onRetry={() => void outcome.refetch()}
          canReopen={canReopen}
          onChanged={closed}
        />
      )}
      {closing !== null && firmId && (
        <CloseOpportunityDialog
          firmId={firmId}
          target={{ id: opportunity.id, version: opportunity.version, name: opportunity.name, targetStart: opportunity.targetStart, employees: opportunity.employees ?? page.intake?.censusSize ?? null }}
          accountName={account.name}
          quotes={page.quotes}
          proposedStarts={Object.fromEntries(Object.entries(outcome.data?.quotes ?? {}).map(([k, v]) => [k, v.proposedStart]))}
          brokerDefault={workspace.firm?.name ?? ""}
          initial={closing}
          onClose={() => setClosing(null)}
          onDone={closed}
        />
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
        <div className="space-y-6 min-w-0">
          {firmId && <QuotesPanel key={opportunity.id} firmId={firmId} page={page} closeReasons={Object.fromEntries(Object.entries(outcome.data?.quotes ?? {}).map(([k, v]) => [k, v.closeReason]))} />}
          <IntakePanel page={page} />
          {firmId && <OpportunityActivity key={opportunity.id} firmId={firmId} opportunityId={opportunity.id} />}
        </div>
        <div className="space-y-6 min-w-0">
          {firmId && <OpportunityDetailsPanel key={opportunity.id} firmId={firmId} page={page} onSaved={saved} />}
          <OpportunityContacts contacts={page.contacts} />
        </div>
      </div>
    </>
  );
  return (
    <Frame>
      {canAct ? (
        <AccountActionsProvider
          firmId={firmId}
          accountId={account.id}
          accountName={account.name}
          userId={user?.id ?? null}
          person={workspace.person}
          canAdd={page.canAdd}
          canMove={false}
          alsoRefresh={opportunityKey(firmId, opportunity.id)}
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

/** What the page shows while the opportunity is on its way: the header, and the panels each under its own heading with grey rows. */
const OpportunityLoading = ({ slow, onTryAgain }: { slow: boolean; onTryAgain: () => void }) => (
  <RecordLoading name="the opportunity">
    <OpportunityHeaderLoading />
    <SlowLoadLine loading slow={slow} onTryAgain={onTryAgain} />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
      <div className="space-y-6 min-w-0">
        <PlaceholderPanel heading="Quotes"><PlaceholderLines count={3} /></PlaceholderPanel>
        <PlaceholderPanel heading="Intake"><PlaceholderLines count={3} /></PlaceholderPanel>
        <PlaceholderPanel heading="Activity"><PlaceholderLines count={4} /></PlaceholderPanel>
      </div>
      <div className="space-y-6">
        <PlaceholderPanel heading="Details"><PlaceholderLines count={8} /></PlaceholderPanel>
        <PlaceholderPanel heading="Contacts on this search"><PlaceholderLines count={2} /></PlaceholderPanel>
      </div>
    </div>
  </RecordLoading>
);

export default OpportunityPage;
