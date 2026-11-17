import type { ChamberData } from "./chamberTypes";
import type { ProvenanceMap } from "./provenance";
import { certificationBlockingItems, NO_VERIFIED_FIELDS } from "./requiredItems";

// What New quote's step 2 says of an intake as it is worked (CRM-Q2.2, D-1871): how many answers are in, who entered them, and what is still needed before it can be certified.

export interface EntrySummary {
  answered: number;
  /** Answers a member of the firm entered (a broker entry stands on them). */
  byFirm: number;
  /** The rest: the employer's own typing, what Lenore heard from them, a document they applied, and answers with no record. */
  byContact: number;
  /** The labels of what holds certification back, in the intake's own order (the database refuses to certify without them). */
  stillNeeded: string[];
}

// An answer is any value that is not null, blank text, an empty list or an empty object: an explicit false or 0 is one (intake_holds_nothing, 20261104133000).
const holdsAnswer = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

export function entrySummary(data: ChamberData, provenance: ProvenanceMap): EntrySummary {
  const answers = Object.entries(data).filter(([, value]) => holdsAnswer(value));
  const byFirm = answers.filter(([field]) => provenance[field as keyof ProvenanceMap]?.source.kind === "broker_entry").length;
  return { answered: answers.length, byFirm, byContact: answers.length - byFirm,
    stillNeeded: certificationBlockingItems(data, provenance, NO_VERIFIED_FIELDS).map((item) => item.label) };
}
