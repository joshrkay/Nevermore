import { formatDay } from "@/data/accountPage";
import { MARKET_WORDS, type QuoteLine } from "@/data/lines";
import { olderVersionNote } from "@/data/quoteRequests";
import type { QuoteRequestMessageRow, QuoteRequestRow } from "@/lib/advisorApi";

/**
 * What the PEO, or the carrier on a workers' comp search (ADR 0029), was sent (CRM-Q3.2, M-2.1, M-2.3): the version of the packet and the day, and a warning
 * when a newer version is certified since.
 */
export function WhatWasSent({ request, line = "peo", currentVersion, messages }: {
  request: QuoteRequestRow;
  /** What the opportunity is a search for: a PEO search unless said. */
  line?: QuoteLine;
  currentVersion: number | null;
  messages: readonly QuoteRequestMessageRow[];
}) {
  const older = olderVersionNote(request, currentVersion);
  // The emails the product sent through the agent's own mailbox (direction sent), newest first.
  const sent = messages
    .filter((m) => m.quote_request_id === request.id && m.direction === "sent")
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  return (
    <section aria-labelledby="quote-sent-heading" className="border border-border rounded-xl p-5 space-y-3">
      <h2 id="quote-sent-heading" className="font-display text-lg font-bold">What was sent</h2>
      {request.sent_on && request.sent_version !== null && <p className="text-sm">{`Version ${request.sent_version} of the packet, sent ${formatDay(request.sent_on)}`}</p>}
      {older && <p className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning inline-block">{older}</p>}
      {sent.length > 0 && (
        <ul aria-label="Emails sent" className="space-y-2">
          {sent.map((m) => (
            <li key={m.id} className="text-sm space-y-0.5 border border-border rounded-md p-2">
              <p className="text-xs text-muted-foreground">{`${formatDay((m.sent_at ?? m.recorded_at).slice(0, 10))} · to ${m.to_addresses.join(", ")}`}</p>
              {m.subject && <p className="font-medium">{m.subject}</p>}
              {m.update_from_version != null && <p className="text-xs">{`Update to ${MARKET_WORDS[line].a} holding version ${m.update_from_version}`}</p>}
              {m.bundle_link_id != null && <p className="text-xs">With a link to the packet</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
