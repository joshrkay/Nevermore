import { useState } from "react";
import FollowUpOrWithdraw from "@/components/advisor/FollowUpOrWithdraw";
import RecordSendPrompt from "@/components/advisor/RecordSendPrompt";
import SendToPeo from "@/components/advisor/SendToPeo";
import type { useStillNeeds } from "@/components/opportunities/useStillNeeds";
import { peoCompleteness } from "@/data/peoCompleteness";
import { findPeo } from "@/data/peoCatalog";
import { localToday } from "@/data/peoProfiles";
import { isOpenQuoteRequest } from "@/data/quoteRequests";
import type { QuoteRequestMessageRow, QuoteRequestRow } from "@/lib/advisorApi";
import { certificationOf } from "@/lib/certificationCheck";
import { peoLinkIssuer } from "@/lib/peoLinkIssuer";

/**
 * Writing to the PEO from its quote's page (CRM-Q3.2), through the submission page's own pieces, built from what its PEO card is built from (the last certified
 * version, the PEO's profile, the issuer of a link): Follow up or Withdraw (M-2.4, slice 6.9) on a quote request still open or quoted that the product has written to,
 * and Send again (the send of M-2.1, which reopens a closed quote request, D-1622) on a closed one. Offered only where the card would offer them: the submission is
 * certified and the PEO has a profile.
 */
export function QuoteSendActions({ request, messages, needs, companyName, returnTo, onDone }: {
  request: QuoteRequestRow;
  messages: readonly QuoteRequestMessageRow[];
  /** The page's one read of the submission and the PEOs' profiles (useStillNeeds). */
  needs: ReturnType<typeof useStillNeeds>;
  companyName: string;
  /** This page, to come back to after connecting a mailbox. */
  returnTo: string;
  onDone: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const { detail, certified } = needs;
  const peo = findPeo(needs.catalog, request.peo_name);
  const lastSent = messages
    .filter((m) => m.quote_request_id === request.id && m.direction === "sent")
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
  if (!detail?.submission || !certified || certified.cantTell || !peo) return null;
  const fileId = detail.fileId ?? "No File ID";
  const issueLink = peoLinkIssuer({
    audience: "advisor", peo, catalog: needs.catalog, intake: certified.intake, documents: certified.documents,
    submission: detail.submission, fileId, version: certified.version, changedSince: certified.changedSince, today: localToday(),
  });
  if (request.status === "closed" && peo.profile) {
    return (
      <div className="space-y-2">
        <SendToPeo
          sessionId={detail.id}
          peo={peo.name}
          label="Send again"
          companyName={companyName}
          fileId={fileId}
          version={certified.version}
          openItems={peoCompleteness(certified.intake, certified.documents, peo.profile, peo.id).toQuote.map((i) => i.label)}
          returnTo={returnTo}
          issueLink={issueLink}
          onSent={onDone}
          onSendYourself={() => setRecording(true)}
        />
        {recording && (
          <RecordSendPrompt
            sessionId={detail.id}
            peo={peo.name}
            stage={detail.pipelineStatus}
            builtFrom={certificationOf(detail.id, detail.intakeStatus, detail.submission)}
            existing={request}
            onClose={() => setRecording(false)}
            onRecorded={() => { setRecording(false); onDone(); }}
          />
        )}
      </div>
    );
  }
  if (!lastSent || !(isOpenQuoteRequest(request.status) || request.status === "quoted")) return null;
  return (
    <FollowUpOrWithdraw
      quoteRequestId={request.id}
      peo={peo.name}
      companyName={companyName}
      fileId={fileId}
      version={request.sent_version}
      certifiedVersion={certified.version}
      sentOn={request.sent_on}
      lastSent={{ to: lastSent.to_addresses ?? [], subject: lastSent.subject }}
      returnTo={returnTo}
      issueLink={issueLink}
      onDone={onDone}
    />
  );
}
