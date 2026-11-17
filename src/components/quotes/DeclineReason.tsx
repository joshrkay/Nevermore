import { DECLINE_REASON_LABELS, type DeclineReason } from "@/data/quoteRequests";

/**
 * Why a PEO declined, and its own words (N-1.4): one line wherever a declined quote shows its status. Nothing for a quote that is not declined (the reason
 * is kept when it moves on, but it is the decline's, not the quote's) or for a decline recorded before reasons were kept.
 */
export function DeclineReason({ request, className = "" }: { request: { status: string; decline_reason?: string | null; decline_words?: string | null }; className?: string }) {
  if (request.status !== "declined" || !request.decline_reason) return null;
  const label = DECLINE_REASON_LABELS[request.decline_reason as DeclineReason] ?? request.decline_reason;
  return (
    <div className={className}>
      <p className="text-sm">{`Declined: ${label}`}</p>
      {request.decline_words && <p className="text-sm text-muted-foreground">{`“${request.decline_words}”`}</p>}
    </div>
  );
}
