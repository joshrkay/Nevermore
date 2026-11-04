// One status per section of the Review step (C-1): where the prospect should look next. Built on the one list of
// open items (src/data/openItems.ts) and Review's sections (src/data/reviewFields.ts), so it never disagrees with
// what Review, The Manuscript and the advisor queue list as open.
import type { ChamberData } from "./chamberTypes";
import { openItems, type OpenItem } from "./openItems";
import type { FieldKey, ProvenanceMap } from "./provenance";
import type { ReviewSection } from "./readiness";
import { NO_VERIFIED_FIELDS } from "./requiredItems";
import { REVIEW_FIELDS } from "./reviewFields";

export type SectionStatus = "complete" | "needs_confirmation" | "incomplete" | "not_applicable";

export const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  complete: "Complete",
  needs_confirmation: "Needs confirmation",
  incomplete: "Incomplete",
  not_applicable: "Not applicable",
};

const SECTION_OF_FIELD = new Map<string, ReviewSection>(
  (Object.entries(REVIEW_FIELDS) as [ReviewSection, FieldKey[]][]).flatMap(([section, fields]) => fields.map((field) => [field, section] as const)),
);

/**
 * The section an open item belongs to. The census sits in Workforce, whether it is listed as the recommended
 * file still to upload (no field) or by its own status (field `census`, which Review's field list leaves out).
 */
const sectionOfItem = (item: OpenItem): ReviewSection | undefined =>
  item.key === "census" ? "workforce" : item.field ? SECTION_OF_FIELD.get(item.field) : undefined;

/**
 * Not applicable once the prospect marked every answer in the section as not applying; incomplete while any
 * answer is still owed (missing, conflicting, incomplete, not known yet, or the recommended census); needs
 * confirmation while the only thing left is an answer Lenore took from the conversation; complete otherwise.
 */
export function sectionStatus(
  section: ReviewSection,
  data: ChamberData,
  provenance: ProvenanceMap,
  verified: ReadonlySet<string> = NO_VERIFIED_FIELDS,
  items: readonly OpenItem[] = openItems(data, provenance, verified),
): SectionStatus {
  const fields = REVIEW_FIELDS[section];
  if (fields.length > 0 && fields.every((field) => provenance[field]?.status === "not_applicable")) return "not_applicable";
  const here = items.filter((item) => sectionOfItem(item) === section);
  if (here.some((item) => item.reason !== "Please confirm")) return "incomplete";
  return here.length > 0 ? "needs_confirmation" : "complete";
}
