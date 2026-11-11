import { parseExtraQuestionRefs, type ExtraQuestionRef } from "./extraAnswers";
import type { CertificationState } from "./manuscript";
import { FIELD_LABELS, type FieldKey, type ProvenanceMap } from "./provenance";

/**
 * An advisor's request for more information, as the prospect reads it (public.prospect_information_request): what
 * they asked, the answers it is about, and when. Shown while the pipeline waits on the prospect.
 */
export interface InformationRequest {
  message: string;
  fields: FieldKey[];
  /** A PEO's own extra questions it names (20261113100000): that PEO's section is shown, marked as asked. */
  extraQuestions: ExtraQuestionRef[];
  requestedAt: string;
}

/** A request as the database answers it, or null for anything else. Unknown field names are left out. */
export function parseInformationRequest(raw: unknown): InformationRequest | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.message !== "string" || r.message.trim() === "" || typeof r.requested_at !== "string") return null;
  if (!Number.isFinite(Date.parse(r.requested_at))) return null;
  const fields = Array.isArray(r.fields)
    ? r.fields
        .map((f) => (f === "employees" ? "census" : f))
        .filter((f, i, all): f is FieldKey => typeof f === "string" && f in FIELD_LABELS && all.indexOf(f) === i)
    : [];
  return { message: r.message.trim(), fields, extraQuestions: parseExtraQuestionRefs(r.extra_questions), requestedAt: r.requested_at };
}

/**
 * Whether the prospect has answered the request on screen: they certified after it was made. The database answers
 * it the same way (certifying moves the pipeline back to Submitted), so this only spares a reload.
 */
export function answeredBy(request: InformationRequest, certification: CertificationState): boolean {
  if (certification.status !== "certified") return false;
  const at = certification.submission.certified_at ?? certification.submission.signed_at;
  return Number.isFinite(Date.parse(at)) && Date.parse(at) > Date.parse(request.requestedAt);
}

export const NO_REQUESTED_FIELDS: ReadonlySet<string> = new Set();

/**
 * The fields of a request the prospect hasn't answered since it was made: no field status changed after it. Lenore
 * asks about these first (chamber-extract's `requested`); once the prospect answers, confirms or edits one, it drops
 * out, so she doesn't ask it again.
 */
export function outstandingRequestedFields(request: InformationRequest | null, provenance: ProvenanceMap | undefined): FieldKey[] {
  if (!request) return [];
  const since = Date.parse(request.requestedAt);
  return request.fields.filter((f) => {
    const at = provenance?.[f]?.updated_at;
    return !(at && Date.parse(at) > since);
  });
}
