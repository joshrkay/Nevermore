import { ListPanel } from "@/components/accounts/accountLists";
import { quoteKindLabel } from "@/data/quoteRequests";
import { formatDay, quoteStatusLabel, today } from "@/data/accountPage";
import type { ComparisonColumn, QuoteComparison as Comparison } from "@/lib/quoteComparisonApi";

// The broker's comparison of an opportunity's quotes (N-3.1, slice 7.7): one column for each PEO, one row for each cost area, the same rows for every PEO.

/** What a quote leaves out reads this, never 0 or blank (D-721). */
const NOT_QUOTED = <span className="text-muted-foreground">Not quoted</span>;

const dollars = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The administrative fee with the basis it is charged on (D-723). A waived fee is a real 0. */
const feeWords = (fee: number, basis: string | null) => (basis === "percent_of_payroll" ? `${fee}% of payroll` : `${dollars(fee)} per employee per month`);

const TIER_WORDS: Record<string, string> = { employee_only: "employee only", employee_spouse: "employee and spouse", employee_children: "employee and children", family: "family" };

/** A list of lines in one cell, or Not quoted when the quote leaves the area out (null, never an empty list). */
const lines = <T,>(items: T[] | null | undefined, words: (item: T) => string) =>
  items ? <ul className="space-y-1">{items.map((item) => <li key={words(item)}>{words(item)}</li>)}</ul> : NOT_QUOTED;

type Row = { label: string; cell: (c: ComparisonColumn) => React.ReactNode };

const ROWS: Row[] = [
  { label: "Status", cell: (c) => (c.quote ? quoteKindLabel(c.quote.kind) : quoteStatusLabel(c.status)) },
  {
    label: "Expires",
    cell: (c) => {
      if (!c.quote) return <span className="text-muted-foreground">Not yet quoted</span>;
      if (!c.quote.expiresOn) return <span className="text-muted-foreground">Not given</span>;
      // An expired quote is marked so it is not compared as if it still stood.
      return c.quote.expiresOn < today() ? <span className="font-medium text-destructive">Expired {formatDay(c.quote.expiresOn)}</span> : formatDay(c.quote.expiresOn);
    },
  },
  { label: "Administrative fee", cell: (c) => (c.quote?.adminFee != null ? feeWords(c.quote.adminFee, c.quote.adminFeeBasis) : NOT_QUOTED) },
  { label: "One-off fees", cell: (c) => lines(c.quote?.oneOffFees, (f) => `${f.name}: ${dollars(f.amount)}`) },
  { label: "Workers' comp", cell: (c) => lines(c.quote?.workersComp, (w) => `${w.state} ${w.classCode}: ${dollars(w.rate)} per $100 of payroll`) },
  {
    label: "Unemployment tax",
    cell: (c) => lines(c.quote?.unemployment, (u) => (u.charge === "peo_rate" ? `${u.state}: the PEO's rate, ${u.rate}% of taxable wages` : `${u.state}: the employer's own rate`)),
  },
  { label: "Medical", cell: (c) => lines(c.quote?.medical, (m) => `${m.plan}, ${TIER_WORDS[m.tier] ?? m.tier}: ${dollars(m.monthly)} a month`) },
];

export function QuoteComparison({ comparison }: { comparison: Comparison; onAddNote: (note: never) => Promise<void> }) {
  return (
    <ListPanel id="quote-comparison" heading="Compare quotes">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <caption className="sr-only">Quotes side by side</caption>
          <thead>
            <tr>
              <th scope="col" className="py-2 pr-4 text-left text-xs font-normal text-muted-foreground">Cost area</th>
              {comparison.columns.map((c) => <th key={c.quoteRequestId} scope="col" className="py-2 pr-4 text-left font-medium">{c.peoName}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t border-border/60 align-top">
                <th scope="row" className="py-2 pr-4 text-left font-normal text-muted-foreground">{row.label}</th>
                {comparison.columns.map((c) => <td key={c.quoteRequestId} className="py-2 pr-4">{row.cell(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListPanel>
  );
}
