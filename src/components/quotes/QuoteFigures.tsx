import { formatDay } from "@/data/accountPage";
import { adminFeeWords } from "@/data/opportunityPage";
import type { QuoteRequestRow } from "@/lib/advisorApi";

/** The figures a PEO quoted (CRM-Q3.2): the admin fee, when the quote came, when it expires and the proposed start. Recording them is Epic 7's (D-1706). */
export function QuoteFigures({ request }: { request: QuoteRequestRow }) {
  const rows: [string, string | null][] = [
    ["Admin fee", request.admin_fee_pepm !== null ? adminFeeWords(request.admin_fee_pepm) : null],
    ["Received", request.quote_received_on ? formatDay(request.quote_received_on) : null],
    ["Expires", request.quote_expires_on ? formatDay(request.quote_expires_on) : null],
    ["Proposed start", request.proposed_start_on ? formatDay(request.proposed_start_on) : null],
  ];
  return (
    <section aria-labelledby="quote-figures-heading" className="border border-border rounded-xl p-5 space-y-3">
      <h2 id="quote-figures-heading" className="font-display text-lg font-bold">Quote</h2>
      <dl className="space-y-2 text-sm">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt className="text-xs text-muted-foreground">{term}</dt>
            <dd className={value ? undefined : "text-muted-foreground"}>{value ?? "Not yet"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
