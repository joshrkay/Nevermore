import { formatDay } from "@/data/accountPage";
import { quoteKindLabel } from "@/data/quoteRequests";
import type { QuoteRecord } from "@/lib/advisorApi";

/**
 * The quotes a PEO has since revised (N-2.4, D-733): each one the PEO sent before the current quote, kept as it was and marked superseded, newest first, with the day it was
 * received ("no received date" when the agent recorded none). Listed from the quotes table; nothing here changes a quote.
 */
export function EarlierQuotes({ superseded }: { superseded: readonly QuoteRecord[] }) {
  if (superseded.length === 0) return null;
  return (
    <section aria-labelledby="earlier-quotes-heading" className="border border-border rounded-xl p-5 space-y-3">
      <h2 id="earlier-quotes-heading" className="font-display text-lg font-bold">Earlier quotes</h2>
      <ul className="space-y-2 text-sm">
        {superseded.map((q) => (
          <li key={q.id}>
            {[quoteKindLabel(q.kind), q.received_on ? `received ${formatDay(q.received_on)}` : "no received date", "Superseded", q.document?.file_name].filter(Boolean).join(" · ")}
          </li>
        ))}
      </ul>
    </section>
  );
}
