import { formatDay, quoteStatusLabel, today } from "@/data/accountPage";
import { quoteStatusWords } from "@/data/opportunityPage";
import type { QuoteRequestRow } from "@/lib/advisorApi";
import { PlaceholderLine } from "@/components/workspace/states";

/** The details of a quote request (CRM-Q3.2): the PEO's contact, the status, when it was sent and which version, what it still needs and the reply address. */
export function QuoteDetails({ request, contact, stillNeeds, replyAddress }: {
  request: QuoteRequestRow;
  /** Who the PEO's packet went to, in words. */
  contact: string;
  /** What the PEO still needs (D-424's words), or null while it is being worked out. */
  stillNeeds: string | null;
  replyAddress: string | null;
}) {
  const rows: [string, React.ReactNode][] = [
    ["PEO contact", contact],
    ["Status", quoteStatusWords(request.status, quoteStatusLabel(request.status), request.sent_on, today())],
    ["Sent", request.sent_on ? formatDay(request.sent_on) : "Not yet"],
    ["Version", request.sent_version ?? "Not yet"],
    ["Still needs", stillNeeds ?? <PlaceholderLine width="name" />],
    ["Reply address", replyAddress ?? "Not available"],
  ];
  return (
    <section aria-labelledby="quote-details-heading" className="border border-border rounded-xl p-5 space-y-3">
      <h2 id="quote-details-heading" className="font-display text-lg font-bold">Details</h2>
      <dl className="space-y-2 text-sm">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt className="text-xs text-muted-foreground">{term}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
