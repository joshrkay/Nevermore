import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPanel } from "@/components/accounts/accountLists";
import { PanelFailed, PlaceholderLines } from "@/components/workspace/states";
import { opportunityKey } from "./useOpportunityQueries";
import { QuoteComparison } from "./QuoteComparison";
import { OpportunityError } from "@/lib/opportunityPageApi";
import { addComparisonNote, getQuoteComparison } from "@/lib/quoteComparisonApi";

// The comparison of one opportunity's quotes with its notes, asked of the database and drawn (N-3.1, N-3.2, slice 7.7). The opportunity's page mounts it under the quotes
// panel (CRM-Q4.2, slice 7.8, D-780).

export function QuoteComparisonPanel({ firmId, opportunityId, noNotesBecause }: { firmId: string; opportunityId: string; noNotesBecause?: string }) {
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
  return <QuoteComparison comparison={query.data} noNotesBecause={noNotesBecause} onAddNote={async (note) => {
    await addComparisonNote(firmId, opportunityId, note);
    // The list is read again, as the database now has it.
    await client.invalidateQueries({ queryKey: key });
  }} />;
}
