import { Pill } from "@/components/accounts/accountLists";
import { formatDay, quoteStatusLabel, today } from "@/data/accountPage";
import { quoteStatusWords } from "@/data/opportunityPage";
import type { QuoteRequestRow } from "@/lib/advisorApi";

/** The top of a quote's page (CRM-Q3.2): the PEO, the status in words with the days waiting (D-424), and when it was sent and from which version. */
export function QuoteHeader({ request, actions }: { request: QuoteRequestRow; actions?: React.ReactNode }) {
  return (
    <header className="mb-6 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">{request.peo_name}</h1>
        <Pill>{quoteStatusWords(request.status, quoteStatusLabel(request.status), request.sent_on, today())}</Pill>
      </div>
      {request.sent_on && (
        <p className="text-sm text-muted-foreground">
          {`Sent ${formatDay(request.sent_on)}${request.sent_version !== null ? ` from version ${request.sent_version}` : ""}`}
        </p>
      )}
      {actions && <div className="flex flex-wrap items-start gap-2 pt-1">{actions}</div>}
    </header>
  );
}
