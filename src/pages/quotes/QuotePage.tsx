import { Link, useParams } from "react-router-dom";
import { accountPath } from "@/components/accounts/accountColumns";
import PeoThreadPanel from "@/components/advisor/PeoThreadPanel";
import { QuoteHeader } from "@/components/quotes/QuoteHeader";
import { OpenStatusButtons, ReplyAddress } from "@/components/advisor/QuoteRequestsPanel";
import { ClosedBanner } from "@/components/quotes/ClosedBanner";
import { DeclineReason } from "@/components/quotes/DeclineReason";
import { CloseQuote } from "@/components/quotes/CloseQuote";
import { WhatWasSent } from "@/components/quotes/WhatWasSent";
import { QuoteFigures } from "@/components/quotes/QuoteFigures";
import { QuoteSendActions } from "@/components/quotes/QuoteSendActions";
import { QuoteDetails } from "@/components/quotes/QuoteDetails";
import { useOpportunityOutcomeQuery } from "@/components/opportunities/useOpportunityQueries";
import { useStillNeeds } from "@/components/opportunities/useStillNeeds";
import { noReplyWords, peoContactWords } from "@/data/quotePage";
import { isOpenQuoteRequest, quoteReplyDomain, replyAddress } from "@/data/quoteRequests";
import { useQuotePageQuery } from "@/components/quotes/useQuoteQueries";
import { LoadFailed, NotAvailable, PlaceholderLine, PlaceholderLines, PlaceholderPanel, RecordLoading } from "@/components/workspace/states";
import { useWorkspace } from "@/components/workspace/useWorkspace";

/**
 * A quote's page (story CRM-Q3.2, screen 11; D-37: `/quotes/:quoteRequestId` inside the workspace layout). A quote is a quote request (D-185): the page is made
 * of the pieces the submission's and the opportunity's pages already have. The database decides who may see it and who may change it; this draws what it answers.
 */
const QuotePage = () => {
  const { quoteRequestId = "" } = useParams();
  const { firm, isSupport } = useWorkspace();
  const firmId = firm?.id ?? null;
  const query = useQuotePageQuery(firmId, quoteRequestId);
  // What the PEO still needs is worked out the way the opportunity's quotes panel does it (D-424), from the submission's last certified version.
  // Why a quote closed when the opportunity's close ended it (D-424), read beside the page so a failure of it never hides the page.
  const outcome = useOpportunityOutcomeQuery(firmId, query.data?.opportunity.opportunity.id ?? "", query.data?.request.status === "closed");
  const needs = useStillNeeds(firmId, query.data?.detail.id ?? null, query.data != null);
  if (query.isError && query.data === undefined) return <Frame><LoadFailed error={query.error as Error} what="this quote" onRetry={() => void query.refetch()} /></Frame>;
  if (query.data === null) return <Frame><NotAvailable noun="quote" backTo="/accounts" backLabel="Back to all accounts" /></Frame>;
  if (query.data === undefined) return <Frame><QuoteLoading /></Frame>;
  const { request, detail, opportunity: page } = query.data;
  // Nothing can be changed during a Nevermore support session (ADR 0024) or on an archived account's opportunity (D-432), and only by someone the level rule lets change
  // the account's records (D-209); the database asks the same.
  const canAct = firmId !== null && !isSupport && !page.account.archived && page.canChange;
  const canClose = canAct && isOpenQuoteRequest(request.status);
  const hasReply = detail.quoteRequestMessages.some((m) => m.quote_request_id === request.id && m.direction === "received");
  const noReply = noReplyWords(request, hasReply);
  // A send the product made is a message of its own on the thread (direction sent); one with none was recorded by hand.
  const outside = request.sent_on !== null && !detail.quoteRequestMessages.some((m) => m.quote_request_id === request.id && m.direction === "sent");
  const local = detail.quoteRequestAddresses.find((a) => a.quote_request_id === request.id)?.local_part;
  const domain = quoteReplyDomain();
  const replyTo = local && domain ? replyAddress(local, domain) : null;
  return (
    <Frame>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted-foreground">
        <Link to="/accounts" className="text-primary hover:underline">Accounts</Link>
        <span aria-hidden="true"> / </span>
        <Link to={accountPath(page.account.id)} className="text-primary hover:underline">{page.account.name}</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/opportunities/${page.opportunity.id}`} className="text-primary hover:underline">{page.opportunity.name}</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{request.peo_name}</span>
      </nav>
      {request.status === "closed" && <ClosedBanner request={request} closeReason={outcome.data?.quotes[request.id]?.closeReason} />}
      <DeclineReason request={request} className="mb-6 rounded-xl border border-border bg-muted/40 p-4" />
      <QuoteHeader request={request} actions={canClose ? (
        <>
          <OpenStatusButtons request={request} onChanged={() => void query.refetch()} />
          <CloseQuote request={request} onClosed={() => void query.refetch()} />
        </>
      ) : undefined} />
      <PeoThreadPanel
        prospectUserId={detail.userId}
        requests={[request]}
        ofRequest={request.id}
        messages={detail.quoteRequestMessages}
        attachments={detail.quoteRequestMailAttachments}
        notes={detail.quoteRequestNotes}
        events={detail.quoteRequestEvents}
        reads={detail.quoteRequestThreadReads}
        footer={(
          <>
            {noReply && <p className="text-sm text-muted-foreground">{noReply}</p>}
            {outside && (
              <div className="space-y-2">
                <p className="text-sm">Sent outside the product: the send was recorded by hand.</p>
                {replyTo && <ReplyAddress request={request} address={replyTo} onChanged={() => void query.refetch()} />}
              </div>
            )}
          </>
        )}
      />
      {canAct && (
        <QuoteSendActions
          request={request}
          messages={detail.quoteRequestMessages}
          needs={needs}
          companyName={detail.data.company_name ?? page.account.name}
          returnTo={`/quotes/${request.id}`}
          onDone={() => void query.refetch()}
        />
      )}
      <QuoteDetails
        request={request}
        contact={peoContactWords(detail.quoteRequestMessages, request.id)}
        stillNeeds={needs.status === "loading" ? null : needs.status === "failed" ? "Not checked" : needs.of(request.peo_name)}
        replyAddress={replyTo}
      />
      <QuoteFigures request={request} />
      <WhatWasSent request={request} currentVersion={detail.currentVersion} messages={detail.quoteRequestMessages} />
    </Frame>
  );
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background">
    <main className="container mx-auto px-6 py-8">{children}</main>
  </div>
);

/** What the page shows while the quote is on its way: the header, and the panels each under its own heading with grey rows. */
const QuoteLoading = () => (
  <RecordLoading name="the quote">
    <header aria-hidden="true" aria-busy="true" className="mb-6 space-y-2">
      <PlaceholderLine width="name" className="h-8 w-72" />
      <PlaceholderLine width="name" className="w-96" />
    </header>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
      <div className="space-y-6 min-w-0">
        <PlaceholderPanel heading="Emails"><PlaceholderLines count={4} /></PlaceholderPanel>
      </div>
      <div className="space-y-6">
        <PlaceholderPanel heading="Details"><PlaceholderLines count={5} /></PlaceholderPanel>
        <PlaceholderPanel heading="Quote"><PlaceholderLines count={3} /></PlaceholderPanel>
        <PlaceholderPanel heading="What was sent"><PlaceholderLines count={3} /></PlaceholderPanel>
      </div>
    </div>
  </RecordLoading>
);

export default QuotePage;
