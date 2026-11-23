import { formatDay } from "@/data/accountPage";
import type { QuoteLine } from "@/data/lines";
import { adminFeeWords, dollarsWords } from "@/data/opportunityPage";
import type { QuoteRecord, QuoteRequestRow } from "@/lib/advisorApi";
import { PlaceholderLine } from "@/components/workspace/states";

/**
 * The figures a PEO or a carrier quoted (CRM-Q3.2): the admin fee of a PEO's quote, or the premium, the experience modification and the minimum premium of a
 * carrier's (ADR 0029), then when the quote came, when it expires and the proposed start. A figure the quote leaves out reads "Not yet"; 0 is a figure (D-721).
 */
export function QuoteFigures({ request, line = "peo", current, quotes }: {
  request: QuoteRequestRow;
  /** What the opportunity is a search for: a PEO search unless said. */
  line?: QuoteLine;
  /** The current quote on this request (the newest recorded), which holds a workers' comp quote's figures; none before one is recorded. */
  current?: QuoteRecord | null;
  /**
   * How the read of the quotes on this request stands while they are not in hand: being read, or failed. A workers' comp quote's figures are theirs, so each
   * says so: "Not yet" would be a figure made up from a read that has not answered.
   */
  quotes?: "loading" | "failed";
}) {
  const ofCurrent = (figure: string | null): React.ReactNode | null =>
    quotes === "failed" ? "Couldn't load" : quotes === "loading" ? <PlaceholderLine width="name" /> : figure;
  const figures: [string, React.ReactNode | null][] = line === "workers_comp"
    ? [
        ["Annual premium", ofCurrent(current?.annual_premium != null ? dollarsWords(current.annual_premium) : null)],
        ["Experience modification", ofCurrent(current?.experience_mod != null ? String(current.experience_mod) : null)],
        ["Minimum premium", ofCurrent(current?.minimum_premium != null ? dollarsWords(current.minimum_premium) : null)],
      ]
    : [["Admin fee", request.admin_fee_pepm !== null ? adminFeeWords(request.admin_fee_pepm) : null]];
  const rows: [string, React.ReactNode | null][] = [
    ...figures,
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
