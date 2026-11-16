import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getOpportunityPage } from "@/lib/opportunityPageApi";

// New quote opened on an opportunity (its own address, D-1709): the account, contact and opportunity step 1 made, and Save and close. There is no step 2 to 4 here
// (D-1763): the intake is the existing /start chamber, which slice 5.3's start-intake function will open for this opportunity. The seam for a Continue is
// `stepToOpenAt(progressOf(page))` in src/data/newQuote.ts (D-1702); nothing is drawn for it until it leads somewhere (D-402).

export function OpportunitySaved({ firmId, opportunityId, onClose }: { firmId: string; opportunityId: string; onClose: () => void }) {
  const found = useQuery({ queryKey: ["new-quote", firmId, opportunityId, "page"], queryFn: () => getOpportunityPage(firmId, opportunityId), retry: false, gcTime: 0 });
  const page = found.data;
  if (found.isError) return <p role="alert" className="text-sm">Couldn't load the opportunity.</p>;
  if (found.isSuccess && !page) return <p role="alert" className="text-sm">This opportunity isn't available.</p>;
  if (!page) return <p role="status" className="text-sm text-muted-foreground">Loading the opportunity…</p>;
  return (
    <section aria-label="Saved" className="space-y-4">
      <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Account</dt><dd>{page.account.name}</dd>
        <dt className="text-muted-foreground">Opportunity</dt><dd>{page.opportunity.name}</dd>
        {page.mainContact && <><dt className="text-muted-foreground">Contact</dt><dd>{page.mainContact.name}</dd></>}
      </dl>
      <Button type="button" onClick={onClose}>Save and close</Button>
    </section>
  );
}
