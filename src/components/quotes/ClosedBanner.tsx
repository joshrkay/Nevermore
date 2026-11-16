import { Lock } from "lucide-react";
import { quoteCloseWords } from "@/data/opportunityClose";
import { WITHDRAWAL_REASON_LABELS, type WithdrawalReason } from "@/data/quoteRequests";
import type { QuoteRequestRow } from "@/lib/advisorApi";

/** A closed quote request says so, and why (CRM-Q3.2): the reason a withdrawal recorded (D-1624, advisors only) and the note the closing carried. */
export function ClosedBanner({ request, closeReason, children }: { request: QuoteRequestRow; closeReason?: string | null; children?: React.ReactNode }) {
  const reason = request.withdrawn_reason ? WITHDRAWAL_REASON_LABELS[request.withdrawn_reason as WithdrawalReason] ?? request.withdrawn_reason : quoteCloseWords(closeReason ?? null);
  return (
    <div role="note" aria-label="This quote is closed" className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
      <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p><strong className="font-medium">This quote is closed.</strong></p>
        {reason && <p>{reason}</p>}
        {request.note && <p className="text-muted-foreground">{request.note}</p>}
        {children}
      </div>
    </div>
  );
}
