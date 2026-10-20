import { REVIEW_LABELS, type ReviewState } from "@/data/advisor";
import { FIELD_LABELS, formatFieldValue, type FieldKey } from "@/data/provenance";
import type { ReviewEvent } from "@/lib/advisorApi";

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Who made a recorded change: the advisor's email, the prospect, or the system. */
export function actorName(actorId: string | null, email: string | null, prospectUserId: string): string {
  if (actorId && actorId === prospectUserId) return "Prospect";
  if (email) return email;
  return actorId ? "Advisor" : "System";
}

const stateLabel = (s: string | null) => (s && s in REVIEW_LABELS ? REVIEW_LABELS[s as ReviewState] : "unreviewed");

/** One line per recorded review change. */
export function describeReviewEvent(e: ReviewEvent): string {
  const field = FIELD_LABELS[e.field as FieldKey] ?? e.field;
  const parts: string[] = [];
  if (e.correction_changed) {
    if (!e.has_correction) parts.push(`removed the correction to ${field} (was ${formatFieldValue(e.from_value)})`);
    else if (!e.had_correction) parts.push(`corrected ${field} to ${formatFieldValue(e.to_value)}`);
    else parts.push(`changed the correction to ${field} from ${formatFieldValue(e.from_value)} to ${formatFieldValue(e.to_value)}`);
  }
  if (e.from_state !== e.to_state) {
    parts.push(`marked ${field} ${stateLabel(e.to_state)}${e.from_state ? ` (was ${stateLabel(e.from_state)})` : ""}`);
  }
  return parts.length ? parts.join("; ") : `re-saved the review of ${field}`;
}

export const messageAnchor = (id: string) => `message-${id}`;
