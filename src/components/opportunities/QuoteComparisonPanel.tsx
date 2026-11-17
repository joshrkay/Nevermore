import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPanel } from "@/components/accounts/accountLists";
import { PanelFailed, PlaceholderLines } from "@/components/workspace/states";
import { opportunityKey } from "./useOpportunityQueries";
import { QuoteComparison } from "./QuoteComparison";
import { OpportunityError } from "@/lib/opportunityPageApi";
import { addComparisonNote, getQuoteComparison } from "@/lib/quoteComparisonApi";

// The comparison of one opportunity's quotes with its notes, asked of the database and drawn (N-3.1, N-3.2, slice 7.7). It is not mounted on a screen yet: the
// "Compare quotes" button and its place in the menu are slice 7.8 (CRM-Q4.2), and the opportunity page's Compare is off until then (D-402).

export function QuoteComparisonPanel({ firmId, opportunityId }: { firmId: string; opportunityId: string }) {
  const client = useQueryClient();
  const key = [...opportunityKey(firmId, opportunityId), "comparison"];
  const query = useQuery({
    queryKey: key,
    queryFn: () => getQuoteComparison(firmId, opportunityId),
  });
  if (!query.data) {
    return (
      <ListPanel id="quote-comparison" heading="Compare quotes">
        {query.error instanceof OpportunityError && query.error.kind === "notFound" ? (
          <p role="alert" className="text-sm text-muted-foreground">That opportunity isn't available.</p>
        ) : query.isError ? (
          <PanelFailed what="the comparison" error={query.error} message="We couldn't load the comparison." onRetry={() => void query.refetch()} />
        ) : (
          <PlaceholderLines />
        )}
      </ListPanel>
    );
  }
  return <QuoteComparison comparison={query.data} onAddNote={async (note) => {
    await addComparisonNote(firmId, opportunityId, note);
    // The list is read again, as the database now has it.
    await client.invalidateQueries({ queryKey: key });
  }} />;
}
