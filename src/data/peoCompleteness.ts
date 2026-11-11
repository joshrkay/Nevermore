// Complete for a PEO (GLOSSARY.md, L-2.2): whether the last certified version of an intake holds everything one PEO's
// requirement profile needs to quote. Each answer it needs to quote is held and settled (not an open item), and each
// document it requires is on file. What it needs only before signing is listed apart and doesn't count; an eligibility
// check that isn't met is a warning beside it, never part of it.
import { INFORMATION_REQUEST_MAX, type ReviewedDocument } from "./advisor";
import type { ChamberData } from "./chamberTypes";
import { categoryInfo, type DocumentCategory } from "./documentCategories";
import { isScanReleased } from "./documentStatus";
import { openItems } from "./openItems";
import { listedPeos, type PeoRecord } from "./peoCatalog";
import type { RequirementProfile } from "./peoProfiles";
import { FIELD_LABELS, isEmpty, type FieldKey, type ProvenanceMap } from "./provenance";

/** The last certified version of an intake: its answers and their field status, and the fields an advisor verified. */
export interface CertifiedIntake {
  data: ChamberData;
  provenance: ProvenanceMap;
  verified: ReadonlySet<string>;
}

/** Something a PEO's profile needs that the certified version doesn't hold, and why. */
export type NeededItem =
  | { kind: "answer"; field: FieldKey; label: string; reason: string }
  | { kind: "document"; category: DocumentCategory; label: string; description: string; reason: string };

export interface PeoCompleteness {
  /** Every answer and document the PEO needs to quote is on file. */
  complete: boolean;
  /** What it needs to quote and isn't on file: these decide `complete`. */
  toQuote: NeededItem[];
  /** What it needs only before the client signs and isn't on file: listed apart, never counted. */
  beforeSigning: NeededItem[];
}

/**
 * The answers in `fields` the intake doesn't hold settled: with no answer, or one that is still an open item (an
 * advisor's verification settles it, as everywhere). One the prospect marked as not applying is settled.
 */
function missingAnswers(intake: CertifiedIntake, fields: readonly FieldKey[]): NeededItem[] {
  const open = new Map(openItems(intake.data, intake.provenance, intake.verified).map((i) => [i.key, i]));
  return fields.flatMap((field): NeededItem[] => {
    const item = open.get(field);
    if (item) return [{ kind: "answer", field, label: FIELD_LABELS[field], reason: item.reason }];
    // "Doesn't apply" is the prospect's answer: nothing more is owed on it.
    if (intake.provenance[field]?.status === "not_applicable") return [];
    return isEmpty(intake.data[field]) ? [{ kind: "answer", field, label: FIELD_LABELS[field], reason: "Not provided" }] : [];
  });
}

/**
 * Where one document stands for the certified version, nearest to on file first: on file (certified, uploaded and
 * through the virus check; a file that couldn't be read is still on file), still being checked, uploaded only after
 * certifying, or held back by the virus check. A file removed since certifying, or still uploading, isn't there.
 */
const DOCUMENT_STANDINGS = ["on_file", "Still being checked for viruses", "Uploaded after certifying", "Couldn't be checked for viruses", "Blocked by the virus check"] as const;
type DocumentStanding = (typeof DOCUMENT_STANDINGS)[number];

function standing(d: ReviewedDocument): DocumentStanding | null {
  if (d.certification === "removed" || d.status === "uploading") return null;
  if (d.certification === "added") return "Uploaded after certifying";
  if (isScanReleased(d.scan_verdict)) return "on_file";
  if (d.scan_verdict === "infected") return "Blocked by the virus check";
  if (d.scan_verdict === "failed") return "Couldn't be checked for viruses";
  return "Still being checked for viruses";
}

/** The documents the profile lists that the certified version doesn't have on file, each with why. */
function missingDocuments(documents: readonly ReviewedDocument[], profile: RequirementProfile): NeededItem[] {
  return profile.documents.flatMap((wanted): NeededItem[] => {
    // The kind it was certified as, when it has been re-categorised since.
    const ofKind = documents.filter((d) => (d.certifiedCategory ?? d.category) === wanted.category);
    const best = ofKind.map(standing).filter((s): s is DocumentStanding => s !== null).sort((a, b) => DOCUMENT_STANDINGS.indexOf(a) - DOCUMENT_STANDINGS.indexOf(b))[0];
    if (best === "on_file") return [];
    return [{ kind: "document", category: wanted.category, label: categoryInfo(wanted.category).label, description: wanted.description, reason: best ?? "Not uploaded" }];
  });
}

/**
 * Whether the certified version is complete for one PEO, from its profile in use: what it needs to quote and isn't
 * on file, and, apart, what it needs only before signing. `documents` are the intake's, set against the certified
 * list (reconcileDocuments).
 */
export function peoCompleteness(intake: CertifiedIntake, documents: readonly ReviewedDocument[], profile: RequirementProfile): PeoCompleteness {
  const toQuote = [...missingAnswers(intake, profile.neededToQuote), ...missingDocuments(documents, profile)];
  return { complete: toQuote.length === 0, toQuote, beforeSigning: missingAnswers(intake, profile.neededBeforeSigning) };
}

/** One PEO with a profile in use, and whether the certified version is complete for it. */
export interface PeoCompletenessEntry {
  peo: PeoRecord & { profile: RequirementProfile };
  completeness: PeoCompleteness;
}

/**
 * Every PEO an admin lists, grouped: complete, something missing, and no profile yet, each alphabetical. Nothing is
 * ranked; a PEO not listed is left out.
 */
export function groupByCompleteness(intake: CertifiedIntake, documents: readonly ReviewedDocument[], catalog: readonly PeoRecord[]): {
  complete: PeoCompletenessEntry[];
  missing: PeoCompletenessEntry[];
  noProfile: PeoRecord[];
} {
  const alphabetical = listedPeos(catalog).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const entries = alphabetical.flatMap((peo): PeoCompletenessEntry[] =>
    peo.profile ? [{ peo: peo as PeoCompletenessEntry["peo"], completeness: peoCompleteness(intake, documents, peo.profile) }] : []);
  return {
    complete: entries.filter((e) => e.completeness.complete),
    missing: entries.filter((e) => !e.completeness.complete),
    noProfile: alphabetical.filter((p) => !p.profile),
  };
}

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** How many answers and documents, such as "3 answers and 1 document"; empty for none. */
function counted(items: readonly NeededItem[]): string {
  const answers = items.filter((i) => i.kind === "answer").length;
  const documents = items.length - answers;
  return [answers ? count(answers, "answer") : "", documents ? count(documents, "document") : ""].filter(Boolean).join(" and ");
}

/** A PEO's standing in one line: what is missing to quote (or that nothing is), then what it needs only before signing. */
export function missingLine(c: PeoCompleteness): string {
  const toQuote = c.toQuote.length ? `${counted(c.toQuote)} missing` : "Everything it needs to quote is on file";
  return c.beforeSigning.length ? `${toQuote} · ${counted(c.beforeSigning)} needed only before signing` : toQuote;
}

/** A draft information request: the answers it names and its message, for the advisor to edit and send. */
export interface InformationRequestDraft {
  /** The answers the request names. */
  fields: FieldKey[];
  message: string;
}

/**
 * What a PEO still needs, as a draft information request, for the advisor to edit and send: the answers it names (those
 * missing to quote, then those needed only before signing) and a message listing the documents to upload,
 * within what a request can hold. It names no PEO: the prospect never sees where the submission goes. Nothing is
 * sent. (L-2.3 adds the PEO's own questions here.)
 */
export function informationRequestDraft(c: PeoCompleteness): InformationRequestDraft {
  const items = [...c.toQuote, ...c.beforeSigning];
  // A profile lists each answer once, to quote or before signing, and a request can name every answer the intake asks.
  const fields = items.flatMap((i) => (i.kind === "answer" ? [i.field] : []));
  const documents = items.filter((i): i is Extract<NeededItem, { kind: "document" }> => i.kind === "document");
  const intro = "We need a few more things from you to get a quote.";
  const answersLine = fields.length ? `\n\nPlease ${documents.length ? "also " : ""}answer or confirm the answers this request is about.` : "";
  let list = "";
  if (documents.length) {
    const head = "\n\nPlease upload these on the Upload tab of your intake:";
    const lines = documents.map((d) => `\n- ${d.label}: ${d.description}`);
    const fits = (n: number) => {
      const rest = documents.length - n;
      const more = rest ? `\n- and ${count(rest, "more document")}` : "";
      const text = head + lines.slice(0, n).join("") + more;
      return Array.from(intro + text + answersLine).length <= INFORMATION_REQUEST_MAX ? text : null;
    };
    for (let n = lines.length; n >= 0; n--) {
      const text = fits(n);
      if (text !== null) { list = text; break; }
    }
  }
  return { fields, message: intro + list + answersLine };
}

/** The last certified version of a submission: its answers, the documents set against what it covered, and its number. */
export interface CertifiedVersion {
  intake: CertifiedIntake;
  documents: readonly ReviewedDocument[];
  version: number | null;
  /** The prospect has changed answers since, which withdrew it: what is shown is still this version. */
  changedSince: boolean;
}

/**
 * What a PEO's list is built from: the last certified version, never answers the prospect gave since. While the
 * certification stands that is the submission as shown; once the prospect has changed answers, it is the copy they
 * certified (`signed`). Null before the first certification. `verified` are the fields an advisor verified.
 */
export function lastCertifiedVersion(
  d: {
    certified: boolean;
    data: ChamberData;
    provenance: ProvenanceMap;
    documents: readonly ReviewedDocument[];
    signed: { data: ChamberData; provenance: ProvenanceMap; documents: readonly ReviewedDocument[] } | null;
    currentVersion: number | null;
  },
  verified: ReadonlySet<string>,
): CertifiedVersion | null {
  if (d.certified) return { intake: { data: d.data, provenance: d.provenance, verified }, documents: d.documents, version: d.currentVersion, changedSince: false };
  if (!d.signed) return null;
  return { intake: { data: d.signed.data, provenance: d.signed.provenance, verified }, documents: d.signed.documents, version: d.currentVersion, changedSince: true };
}
