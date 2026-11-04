import type { ReviewEvent } from "@/lib/advisorApi";
import { actorName, describeReviewEvent, formatDateTime } from "./format";

const AuditTrail = ({ events, prospectUserId }: { events: ReviewEvent[]; prospectUserId: string }) => (
  <section aria-labelledby="audit-heading" className="border border-border rounded-xl p-5">
    <h2 id="audit-heading" className="font-display text-lg font-bold mb-3">Review audit trail</h2>
    {events.length === 0 ? (
      <p className="text-sm text-muted-foreground">No review changes yet.</p>
    ) : (
      <ol className="space-y-2 text-sm">
        {events.map((e) => (
          <li key={e.id}>
            <p>
              <span className="font-medium">{actorName(e.actor_id, e.actor_email, prospectUserId)}</span> {describeReviewEvent(e)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(e.created_at)}
              {e.reason && ` · “${e.reason}”`}
            </p>
          </li>
        ))}
      </ol>
    )}
  </section>
);

export default AuditTrail;

