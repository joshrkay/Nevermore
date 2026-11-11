// A PEO's supplement (GLOSSARY.md, Supplement; L-2.3): "Additional questions from <PEO>", its own extra questions and
// the answers to them in the last certified version, for that PEO only. It is its own file beside the packet: the
// packet (The Manuscript), the emails and every other PEO's files never carry these answers.
import { answerFor, answers, type ExtraAnswer, type ExtraAnswers } from "./extraAnswers";
import { findPeo, type PeoRecord } from "./peoCatalog";
import type { ExtraQuestion } from "./peoProfiles";
import { formatFieldValue } from "./provenance";

export interface SupplementRow {
  /** The question as the PEO asks it now. */
  question: string;
  /** The certified answer, in words; null when the certified version doesn't answer it. */
  answer: string | null;
}

export interface Supplement {
  title: string;
  peo: string;
  companyName: string;
  fileId: string;
  /** The certified version it is built from; null when none is recorded. */
  version: number | null;
  /** Each question the PEO's profile in use asks, in its order. */
  rows: SupplementRow[];
  /** The questions it lists as not answered, for the line beside the download. */
  notAnswered: string[];
  /** Answers certified to wording the PEO no longer asks (a dropped or reworded question), under that wording. */
  earlier: SupplementRow[];
}

/** A certified answer in words, or null when it gives none: unknown, or answers still in conflict. */
function inWords(a: ExtraAnswer | null): string | null {
  if (!a) return null;
  if (a.status === "not_applicable") return "Doesn't apply";
  if (a.value === undefined || a.status === "unknown" || a.status === "conflicting") return null;
  const value = formatFieldValue(a.value);
  if (a.status === "inferred") return `${value} (not confirmed by the prospect)`;
  if (a.status === "incomplete") return `${value} (incomplete)`;
  return value;
}

/**
 * One PEO's supplement from the last certified version's extra answers (`certified`): every question its profile in
 * use asks, each with the answer certified to it as worded, or none; and, apart, what was certified to wording it no
 * longer asks. Only that PEO's answers are read.
 */
export function buildSupplement(o: {
  peo: { id: number; name: string };
  questions: readonly ExtraQuestion[];
  certified: ExtraAnswers;
  fileId: string;
  version: number | null;
  companyName: string;
}): Supplement {
  const rows = o.questions.map((q) => ({ question: q.text, answer: inWords(answerFor(o.certified, o.peo.id, q)) }));
  const theirs = o.certified[String(o.peo.id)] ?? {};
  const earlier = Object.entries(theirs)
    .filter(([key, a]) => !o.questions.some((q) => q.key === key && answers(a, q)))
    .flatMap(([, a]) => {
      const answer = inWords(a);
      return answer === null ? [] : [{ question: a.question, answer }];
    });
  return {
    title: `Additional questions from ${o.peo.name}`,
    peo: o.peo.name,
    companyName: o.companyName,
    fileId: o.fileId,
    version: o.version,
    rows,
    notAnswered: rows.filter((r) => r.answer === null).map((r) => r.question),
    earlier,
  };
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** "EAA-2026-0007-additional-questions-trinet-v3.pdf". */
export const supplementFilename = (s: Supplement) =>
  `${s.fileId}-additional-questions-${slug(s.peo)}${s.version !== null ? `-v${s.version}` : ""}.pdf`;

/**
 * The PEOs whose supplement is offered for a certified version: the PEO chosen, then each other PEO whose questions it
 * answers (an advisor's request asked them), alphabetically. Only listed PEOs whose profile in use asks questions of
 * its own.
 */
export function supplementPeos(catalog: readonly PeoRecord[], chosen: string | null, certified: ExtraAnswers): (PeoRecord & { id: number; profile: NonNullable<PeoRecord["profile"]> })[] {
  const asks = (p: PeoRecord | undefined): p is PeoRecord & { id: number; profile: NonNullable<PeoRecord["profile"]> } =>
    !!p && p.listed && p.id !== undefined && !!p.profile && p.profile.extraQuestions.length > 0;
  const choice = chosen ? findPeo(catalog, chosen) : undefined;
  const others = catalog
    .filter((p) => p !== choice && p.id !== undefined && Object.keys(certified[String(p.id)] ?? {}).length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return [choice, ...others].filter(asks);
}
