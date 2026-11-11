// How an answer reads to a person (K-1.1 on): the values the intake stores in a compact form (a FEIN's nine
// digits, an entity type's key, a list of rows) written the way a prospect, an advisor or a PEO would write them.
// Review, the advisor's field review and The Manuscript all show an answer through formatAnswer.
import type { EntityType, LegalEntity } from "./chamberTypes";
import { formatFieldValue, type FieldKey } from "./provenance";
import { naicsTitle } from "../../supabase/functions/_shared/naics2022.ts";

/** A FEIN as it is written: 84-1234567. */
export const formatFein = (fein: string): string => `${fein.slice(0, 2)}-${fein.slice(2)}`;

/**
 * A FEIN for anyone who doesn't need all nine digits: its last four. The prospect, the advisors and the packet a
 * PEO reads see it in full; what is sent to Lenore's model, logged, or listed outside the intake does not.
 */
export const maskFein = (fein: string): string => `**-***${fein.slice(-4)}`;

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  sole_proprietorship: "Sole proprietorship",
  partnership: "Partnership",
  llc: "LLC",
  c_corporation: "C corporation",
  s_corporation: "S corporation",
  nonprofit: "Nonprofit",
  other: "Other",
};

/** The values a "choice" answer is picked from, in the order offered, with what each is called. */
export const FIELD_CHOICES: Partial<Record<FieldKey, readonly { value: string; label: string }[]>> = {
  entity_type: Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => ({ value, label })),
};

const entityLine = (entity: LegalEntity): string => {
  const fein = entity.fein ? `FEIN ${formatFein(entity.fein)}` : "";
  return entity.legal_name ? (fein ? `${entity.legal_name} (${fein})` : entity.legal_name) : fein;
};

/** One answer as text; "—" when there is none. */
export function formatAnswer(field: FieldKey, value: unknown): string {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return "—";
  switch (field) {
    case "fein":
      return typeof value === "string" ? formatFein(value) : formatFieldValue(value);
    case "entity_type":
      return ENTITY_TYPE_LABELS[value as EntityType] ?? formatFieldValue(value);
    case "naics_code":
      return typeof value === "string" && naicsTitle(value) ? `${value} · ${naicsTitle(value)}` : formatFieldValue(value);
    case "entities":
      return (value as LegalEntity[]).map(entityLine).filter(Boolean).join("; ");
    default:
      // Any other table of rows is shown as a table where there is room, and as a count where there isn't.
      return Array.isArray(value) && value.every((row) => typeof row === "object" && row !== null) ? `${value.length} listed` : formatFieldValue(value);
  }
}
