import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AdvisorSubmissionPage from "@/pages/advisor/AdvisorSubmissionPage";
import { ChoosePeos } from "@/components/opportunities/ChoosePeos";
import { useStillNeeds } from "@/components/opportunities/useStillNeeds";
import { certifiedViewShows, progressOf, stepToOpenAt } from "@/data/newQuote";
import { sentToPeos } from "@/data/peoSend";
import { getOpportunityPage } from "@/lib/opportunityPageApi";

// New quote opened on an opportunity (its own address, D-1709): the account, contact and opportunity step 1 made, and Save and close. There is no step 2 to 4 here
// (D-1763): the intake is the existing /start chamber, which slice 5.3's start-intake function will open for this opportunity. Step 4 (CRM-Q2.5, D-1780) is the existing choose-and-send, drawn here once certified. The seam is
// `stepToOpenAt(progressOf(page))` in src/data/newQuote.ts (D-1702); nothing is drawn for it until it leads somewhere (D-402).

export function OpportunitySaved({ firmId, opportunityId, onClose }: { firmId: string; opportunityId: string; onClose: () => void }) {
  const found = useQuery({ queryKey: ["new-quote", firmId, opportunityId, "page"], queryFn: () => getOpportunityPage(firmId, opportunityId), retry: false, gcTime: 0 });
  // A certified intake opens at step 4, choosing PEOs (D-1702, D-1780); its certified view is behind "Certified answers" (D-1776).
  const [backToFlow, setBackToFlow] = useState(true);
  const page = found.data;
  // Step 4 (CRM-Q2.5, D-1763): a certified intake opens at the existing choose-and-send, read the way the opportunity's page reads it.
  const atChoosing = !!page && stepToOpenAt(progressOf(page)) === 4 && page.opportunity.stage !== "won" && page.opportunity.stage !== "lost";
  const needs = useStillNeeds(firmId, page?.opportunity.submissionId ?? null, atChoosing);
  if (found.isError) return <p role="alert" className="text-sm">Couldn't load the opportunity.</p>;
  if (found.isSuccess && !page) return <p role="alert" className="text-sm">This opportunity isn't available.</p>;
  if (!page) return <p role="status" className="text-sm text-muted-foreground">Loading the opportunity…</p>;
  if (certifiedViewShows(progressOf(page)) && !backToFlow) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setBackToFlow(true)}>Back to New quote</Button>
          <Button type="button" onClick={onClose}>Save and close</Button>
        </div>
        <AdvisorSubmissionPage submissionId={page.intake!.submissionId} embedded />
      </div>
    );
  }
  return (
    <section aria-label="Saved" className="space-y-4">
      <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Account</dt><dd>{page.account.name}</dd>
        <dt className="text-muted-foreground">Opportunity</dt><dd>{page.opportunity.name}</dd>
        {page.mainContact && <><dt className="text-muted-foreground">Contact</dt><dd>{page.mainContact.name}</dd></>}
      </dl>
      {atChoosing && <ChoosePeos startChosen alreadySent={sentToPeos(page.quotes)} needs={needs} onChoose={() => undefined} returnTo={`/new-quote/${opportunityId}`} onSent={() => void found.refetch()} />}
      <div className="flex gap-2">
        {certifiedViewShows(progressOf(page)) && <Button type="button" variant="outline" onClick={() => setBackToFlow(false)}>Certified answers</Button>}
        <Button type="button" onClick={onClose}>Save and close</Button>
      </div>
    </section>
  );
}
