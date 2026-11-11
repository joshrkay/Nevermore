// Complete for a PEO (GLOSSARY.md, L-2.2): whether the last certified version of an intake holds everything one PEO's
// requirement profile needs to quote. Each answer it needs to quote is held and is not an open item (an unknown one is
// still needed; one the prospect marked as not applying is answered), and each
// document it requires is on file. What it needs only before signing is listed apart and doesn't count; an eligibility
// check that isn't met is a warning beside it, never part of it.
import { INFORMATION_REQUEST_MAX, type ReviewedDocument } from "./advisor";
import type { ChamberData } from "./chamberTypes";
import { categoryInfo, type DocumentCategory } from "./documentCategories";
import { isScanReleased } from "./documentStatus";
import { openItems } from "./openItems";
import { listedPeos, type PeoRecord } from "./peoCatalog";
import type { RequirementProfile } from "./peoProfiles";
import { FIELD_LABELS, FIELD_OPEN_REASONS, isEmpty, type FieldKey, type ProvenanceMap } from "./provenance";
import { answerFor, type ExtraAnswers, type ExtraQuestionRef } from "./extraAnswers";

/**
 * The last certified version of an intake: its answers and their field status, the fields an advisor verified, and
 * the answers to PEOs' own extra questions as certified (null when it was certified before they were kept).
 */
export interface CertifiedIntake {
  data: ChamberData;
  provenance: ProvenanceMap;
  verified: ReadonlySet<string>;
  extraAnswers: ExtraAnswers | null;
}

/** Something a PEO's profile needs that the certified version doesn't hold, and why. */
export type NeededItem =
  | { kind: "answer"; field: FieldKey; label: string; reason: string }
  // One of the PEO's own extra questions, by its key, labelled with its wording.
  | { kind: "question"; key: string; label: string; reason: string }
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
 * The answers in `fields` the intake doesn't hold: with no answer, or one that is still an open item (an advisor's
 * verification settles an unconfirmed one, as everywhere). One the prospect marked as not applying is answered.
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
 * The PEO's own extra questions the certified version doesn't answer as worded (answerFor): with no answer, an answer
 * to other wording, or one still an open item, as a field would be. "Doesn't apply" answers it. An advisor's
 * verification is of fields only, so it never settles one.
 */
function missingQuestions(intake: CertifiedIntake, profile: RequirementProfile, peoId: number | undefined): NeededItem[] {
  const certified = intake.extraAnswers;
  return profile.extraQuestions.flatMap((q): NeededItem[] => {
    // A version certified before extra answers were kept can't say whether it answered them.
    if (certified === null) return [{ kind: "question", key: q.key, label: q.text, reason: "Can't tell: certified before these questions were kept" }];
    const a = peoId === undefined ? null : answerFor(certified, peoId, q);
    if (!a) return [{ kind: "question", key: q.key, label: q.text, reason: "Not answered" }];
    if (a.status === "confirmed" || a.status === "not_applicable") return [];
    return [{ kind: "question", key: q.key, label: q.text, reason: FIELD_OPEN_REASONS[a.status] }];
  });
}

/**
 * Where one document stands for the certified version, nearest to on file first: on file (certified, uploaded and
 * through the virus check; a file that couldn't be read is still on file), still being checked, uploaded only after
 * certifying, couldn't be checked, or held back by the virus check. A file removed since certifying, or still
 * uploading, isn't there. The order decides which of several files of a kind speaks for it.
 */
const DOCUMENT_STANDINGS = ["on_file", "scanning", "added_after", "scan_failed", "blocked"] as const;
type DocumentStanding = (typeof DOCUMENT_STANDINGS)[number];

/** Why a document isn't on file, as the PEO's list says it. */
const NOT_ON_FILE: Record<Exclude<DocumentStanding, "on_file">, string> = {
  scanning: "Still being checked for viruses",
  added_after: "Uploaded after certifying",
  scan_failed: "Couldn't be checked for viruses",
  blocked: "Blocked by the virus check",
};

function standing(d: ReviewedDocument): DocumentStanding | null {
  if (d.certification === "removed" || d.status === "uploading") return null;
  if (d.certification === "added") return "added_after";
  if (isScanReleased(d.scan_verdict)) return "on_file";
  if (d.scan_verdict === "infected") return "blocked";
  if (d.scan_verdict === "failed") return "scan_failed";
  return "scanning";
}

/**
 * The uploaded files of each kind the profile lists that count as on file for the certified version (certified, its
 * virus check passed or skipped), in the order given: what a PEO's bundle carries. Never a file blocked or not yet
 * checked, one added after certifying or one removed since.
 */
export function documentsOnFile(documents: readonly ReviewedDocument[], profile: RequirementProfile): ReviewedDocument[] {
  const listed = new Set<string>(profile.documents.map((d) => d.category));
  return documents.filter((d) => listed.has(d.certifiedCategory ?? d.category) && standing(d) === "on_file");
}

/** The documents the profile lists that the certified version doesn't have on file, each with why. */
function missingDocuments(documents: readonly ReviewedDocument[], profile: RequirementProfile): NeededItem[] {
  return profile.documents.flatMap((wanted): NeededItem[] => {
    // The kind it was certified as, when it has been re-categorised since.
    const ofKind = documents.filter((d) => (d.certifiedCategory ?? d.category) === wanted.category);
    const best = ofKind.map(standing).filter((s): s is DocumentStanding => s !== null).sort((a, b) => DOCUMENT_STANDINGS.indexOf(a) - DOCUMENT_STANDINGS.indexOf(b))[0];
    if (best === "on_file") return [];
    return [{ kind: "document", category: wanted.category, label: categoryInfo(wanted.category).label, description: wanted.description, reason: best ? NOT_ON_FILE[best] : "Not uploaded" }];
  });
}

/**
 * Whether the certified version is complete for one PEO, from its profile in use: what it needs to quote and isn't
 * on file (its own extra questions included: an unanswered one counts against it), and, apart, what it needs only
 * before signing. `documents` are the intake's, set against the certified list (reconcileDocuments). `peoId` is the
 * PEO's, which its extra answers are kept under.
 */
export function peoCompleteness(intake: CertifiedIntake, documents: readonly ReviewedDocument[], profile: RequirementProfile, peoId?: number): PeoCompleteness {
  const toQuote = [...missingAnswers(intake, profile.neededToQuote), ...missingQuestions(intake, profile, peoId), ...missingDocuments(documents, profile)];
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
    peo.profile ? [{ peo: peo as PeoCompletenessEntry["peo"], completeness: peoCompleteness(intake, documents, peo.profile, peo.id) }] : []);
  return {
    complete: entries.filter((e) => e.completeness.complete),
    missing: entries.filter((e) => !e.completeness.complete),
    noProfile: alphabetical.filter((p) => !p.profile),
  };
}

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** How many answers, questions and documents, such as "3 answers, 1 of its own questions and 1 document"; empty for none. */
export function counted(items: readonly NeededItem[]): string {
  const answers = items.filter((i) => i.kind === "answer").length;
  const questions = items.filter((i) => i.kind === "question").length;
  const documents = items.filter((i) => i.kind === "document").length;
  const parts = [answers ? count(answers, "answer") : "", questions ? `${questions} of its own questions` : "", documents ? count(documents, "document") : ""].filter(Boolean);
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
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
  /** The PEO's own extra questions it names. */
  questions: ExtraQuestionRef[];
  message: string;
}

/**
 * What a PEO still needs, as a draft information request, for the advisor to edit and send: the answers it names (those
 * missing to quote, then those needed only before signing) and a message listing the documents to upload,
 * within what a request can hold, and the PEO's own extra questions it still needs (`peoId` is the PEO's), which the
 * prospect then sees under the PEO's name in the intake. The message names no PEO. Nothing is sent.
 */
export function informationRequestDraft(c: PeoCompleteness, peoId?: number): InformationRequestDraft {
  const items = [...c.toQuote, ...c.beforeSigning];
  // A profile lists each answer once, to quote or before signing, and a request can name every answer the intake asks.
  const fields = items.flatMap((i) => (i.kind === "answer" ? [i.field] : []));
  const questions = peoId === undefined ? [] : items.flatMap((i) => (i.kind === "question" ? [{ peo_id: peoId, key: i.key, question: i.label }] : []));
  const documents = items.filter((i): i is Extract<NeededItem, { kind: "document" }> => i.kind === "document");
  const intro = "We need a few more things from you to get a quote.";
  const also = documents.length ? "also " : "";
  const onMatch = "the extra questions it names on the PEO Match tab";
  const answersLine = fields.length
    ? `\n\nPlease ${also}answer or confirm the answers this request is about${questions.length ? `, and ${onMatch}` : ""}.`
    : questions.length ? `\n\nPlease ${also}answer ${onMatch.replace("it names", "this request names")}.` : "";
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
  return { fields, questions, message: intro + list + answersLine };
}

/** The last certified version of a submission: its answers, the documents set against what it covered, and its number. */
export interface CertifiedVersion {
  intake: CertifiedIntake;
  documents: readonly ReviewedDocument[];
  version: number | null;
  /** The prospect has changed answers since, which withdrew it: what is shown is still this version. */
  changedSince: boolean;
  /**
   * The certification was recorded before each answer's status and the documents it covered were kept with it
   * (20261104117000, 20261104120000), so nothing can say what it held: the prospect has to certify again.
   */
  cantTell: boolean;
}

/**
 * What a PEO's list is built from: the last certified version, never answers the prospect gave since. While the
 * certification stands that is the submission as shown; once the prospect has changed answers, it is the copy they
 * certified (`signed`). Null before the first certification. `verified` are the fields an advisor verified, each on
 * the answer the intake held when they did: once the prospect has changed answers, a verification counts for the
 * certified copy only where the answer now is still the one certified (a changed answer resets its review, so one
 * verified since was made on the new answer).
 */
export function lastCertifiedVersion(
  d: {
    certified: boolean;
    data: ChamberData;
    provenance: ProvenanceMap;
    documents: readonly ReviewedDocument[];
    /** The extra answers shown: the certified copy while the certification stands (null: kept none, can't tell). */
    extraAnswers: ExtraAnswers | null;
    signed: { data: ChamberData; provenance: ProvenanceMap; documents: readonly ReviewedDocument[]; extraAnswers: ExtraAnswers | null } | null;
    currentVersion: number | null;
    /** The certification on record kept no field status or no document list (SubmissionDetail). */
    certificationLacksSnapshot: boolean;
  },
  verified: ReadonlySet<string>,
): CertifiedVersion | null {
  const cantTell = d.certificationLacksSnapshot;
  if (d.certified) return { intake: { data: d.data, provenance: d.provenance, verified, extraAnswers: d.extraAnswers }, documents: d.documents, version: d.currentVersion, changedSince: false, cantTell };
  if (!d.signed) return null;
  const signed = d.signed;
  const onCertified = new Set([...verified].filter((f) => JSON.stringify(signed.data[f as FieldKey]) === JSON.stringify(d.data[f as FieldKey])));
  return { intake: { data: signed.data, provenance: signed.provenance, verified: onCertified, extraAnswers: signed.extraAnswers }, documents: signed.documents, version: d.currentVersion, changedSince: true, cantTell };
}
