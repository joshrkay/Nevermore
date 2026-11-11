// The answers to a PEO's own extra questions (GLOSSARY.md, Extra question; L-2.3), kept with the intake in
// chamber_sessions.extra_answers (supabase/migrations/20261113090000_extra_answers.sql) by PEO id, then question key.
// Each answer keeps the question's wording as it was answered and how it is answered, beside the same field status and
// source as a field's provenance, so the form and Lenore read and write it the same way.
//
// Identity: an answer belongs to the question with its key AND its wording AND its way of answering (and, for a
// choice, a choice still offered). A reworded question is a new question, unanswered until answered; an answer is
// never read against different wording. The stored wording is what a certification covered and what the PEO's
// supplement prints.
import { TEXT_MAX } from "./chamberValidation";
import { findPeo, type PeoRecord } from "./peoCatalog";
import { PROFILE_PATTERNS } from "./peoEditor";
import { EXTRA_QUESTION_KINDS, PROFILE_CAPS, type ExtraQuestion, type ExtraQuestionKind } from "./peoProfiles";
import { mergeHeard, parseProvenanceEntry, transcriptExtraction, type FieldProvenance, type FieldSource } from "./provenance";

/** An answer to one extra question. `value` is absent while it is unknown or doesn't apply. */
export interface ExtraAnswer extends FieldProvenance {
  /** The question's wording as it was answered. */
  question: string;
  kind: ExtraQuestionKind;
  value?: ExtraValue;
}

export type ExtraValue = string | number | boolean;

/** The extra answers of an intake: by PEO id, then by question key. */
export type ExtraAnswers = Record<string, Record<string, ExtraAnswer>>;

// The database's limits (extra_answers_error, extra_answer_value_is_valid); src/data/schemaSync.test.ts keeps them equal.
export const EXTRA_ANSWER_LIMITS = {
  peos: 50,
  answersPerPeo: 100,
  question: PROFILE_CAPS.text,
  text: TEXT_MAX,
  choice: PROFILE_CAPS.header,
  number: 1_000_000_000_000,
} as const;

const PEO_ID = /^[1-9][0-9]{0,18}$/;
const QUESTION_KEY = new RegExp(PROFILE_PATTERNS.questionKey);
const isRow = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Whether `v` answers a question of `kind`, within the database's limits. */
export function isExtraValue(kind: ExtraQuestionKind, v: unknown): v is ExtraValue {
  switch (kind) {
    case "yes_no":
      return typeof v === "boolean";
    case "number":
      return typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= EXTRA_ANSWER_LIMITS.number;
    case "text":
      return typeof v === "string" && v.trim() !== "" && v.length <= EXTRA_ANSWER_LIMITS.text;
    case "choice":
      return typeof v === "string" && v.trim() !== "" && v.length <= EXTRA_ANSWER_LIMITS.choice;
  }
}

const HOLDS_NO_VALUE = new Set(["unknown", "not_applicable"]);

function parseAnswer(raw: unknown): ExtraAnswer | null {
  if (!isRow(raw)) return null;
  const { question, kind, value } = raw;
  if (typeof question !== "string" || question.trim() === "" || question.length > EXTRA_ANSWER_LIMITS.question) return null;
  if (!(EXTRA_QUESTION_KINDS as readonly unknown[]).includes(kind)) return null;
  const entry = parseProvenanceEntry(raw);
  if (!entry) return null;
  const k = kind as ExtraQuestionKind;
  if (HOLDS_NO_VALUE.has(entry.status) ? value !== undefined : !isExtraValue(k, value)) return null;
  if (entry.candidates?.some((c) => !isExtraValue(k, c.value))) return null;
  return { question, kind: k, ...(value !== undefined ? { value: value as ExtraValue } : {}), ...entry };
}

/** The extra answers as stored, keeping only those the database would accept (extra_answers_error). */
export function parseExtraAnswers(raw: unknown): ExtraAnswers {
  if (!isRow(raw)) return {};
  const out: ExtraAnswers = {};
  for (const [peo, answers] of Object.entries(raw)) {
    if (!PEO_ID.test(peo) || !isRow(answers)) continue;
    const kept: Record<string, ExtraAnswer> = {};
    for (const [key, a] of Object.entries(answers)) {
      const parsed = QUESTION_KEY.test(key) ? parseAnswer(a) : null;
      if (parsed) kept[key] = parsed;
    }
    if (Object.keys(kept).length > 0) out[peo] = kept;
  }
  return out;
}

/** Whether a stored answer is an answer to `q`: its key's entry, with its wording and its way of answering. */
export function answers(a: ExtraAnswer, q: ExtraQuestion): boolean {
  if (a.question !== q.text || a.kind !== q.kind) return false;
  if (q.kind !== "choice") return true;
  const offered = (v: unknown) => q.choices?.includes(v as string) ?? false;
  return (a.value === undefined || offered(a.value)) && (a.candidates ?? []).every((c) => offered(c.value));
}

/** The answer to PEO `peoId`'s question `q`, or null when it has none (or only one to other wording). */
export function answerFor(all: ExtraAnswers, peoId: number, q: ExtraQuestion): ExtraAnswer | null {
  const a = all[String(peoId)]?.[q.key];
  return a && answers(a, q) ? a : null;
}

/** No extra answers: a new intake's, and one saved before they were kept. */
export const NO_EXTRA_ANSWERS: ExtraAnswers = {};

/** The answers with PEO `peoId`'s answer under `key` replaced (or removed, for null). A PEO left with none is dropped. */
function withAnswer(all: ExtraAnswers, peoId: number, key: string, answer: ExtraAnswer | null): ExtraAnswers {
  const peo = String(peoId);
  const { [key]: _old, ...rest } = all[peo] ?? {};
  const theirs = answer ? { ...rest, [key]: answer } : rest;
  const { [peo]: _peo, ...others } = all;
  return Object.keys(theirs).length > 0 ? { ...others, [peo]: theirs } : others;
}

const confirmedBy = (now: Date) => ({ status: "confirmed" as const, source: { kind: "prospect_edit" as const }, updated_at: now.toISOString() });

/** Whether `v` answers `q` as asked: of its kind, and for a choice, one of its choices. */
export const fitsQuestion = (q: ExtraQuestion, v: unknown): v is ExtraValue =>
  isExtraValue(q.kind, v) && (q.kind !== "choice" || (q.choices ?? []).includes(v as string));

/**
 * The prospect's own answer to `q`, as they typed or chose it: confirmed, from them, with the question's wording. Null
 * (an emptied answer) removes it. A value that doesn't fit the question changes nothing.
 */
export function answerExtra(all: ExtraAnswers, peoId: number, q: ExtraQuestion, value: ExtraValue | null, now = new Date()): ExtraAnswers {
  if (value === null) return all[String(peoId)]?.[q.key] ? withAnswer(all, peoId, q.key, null) : all;
  if (!fitsQuestion(q, value)) return all;
  return withAnswer(all, peoId, q.key, { question: q.text, kind: q.kind, value, ...confirmedBy(now) });
}

/** The prospect confirming what Lenore heard. Like a field, an answer in conflict must be chosen first. */
export function confirmExtra(all: ExtraAnswers, peoId: number, q: ExtraQuestion, now = new Date()): ExtraAnswers {
  const a = answerFor(all, peoId, q);
  if (!a || a.value === undefined || a.status === "conflicting") return all;
  return withAnswer(all, peoId, q.key, { question: a.question, kind: a.kind, value: a.value, ...confirmedBy(now) });
}

/** The prospect choosing one of the answers in conflict. */
export function resolveExtra(all: ExtraAnswers, peoId: number, q: ExtraQuestion, candidate: number, now = new Date()): ExtraAnswers {
  const value = answerFor(all, peoId, q)?.candidates?.[candidate]?.value;
  return value === undefined ? all : answerExtra(all, peoId, q, value as ExtraValue, now);
}

/** Whether an answer gives one: it holds a value, or the prospect said it doesn't apply. */
export const givesAnswer = (a: ExtraAnswer | null): boolean => !!a && (a.value !== undefined || a.status === "not_applicable");

/** How many of a PEO's questions have an answer to them as worded. */
export function extraProgress(all: ExtraAnswers, peoId: number, questions: readonly ExtraQuestion[]): { answered: number; total: number } {
  return { answered: questions.filter((q) => givesAnswer(answerFor(all, peoId, q))).length, total: questions.length };
}

/** One of a PEO's own extra questions, as an information request names it: by PEO, key and wording. */
export interface ExtraQuestionRef {
  peo_id: number;
  key: string;
  question: string;
}

/** The extra questions a request names, as the database holds them; anything else is left out. */
export function parseExtraQuestionRefs(raw: unknown): ExtraQuestionRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((q): ExtraQuestionRef[] =>
    isRow(q) && typeof q.peo_id === "number" && Number.isInteger(q.peo_id) && typeof q.key === "string" && typeof q.question === "string"
      ? [{ peo_id: q.peo_id, key: q.key, question: q.question }]
      : []);
}

/** A PEO whose extra questions the intake asks, and which of them the advisor's open information request names. */
export interface AskedPeo {
  peo: { id: number; name: string };
  questions: readonly ExtraQuestion[];
  /** The keys of the questions the advisor's open request names. */
  requested: ReadonlySet<string>;
}

/**
 * The PEOs whose extra questions the intake asks (GLOSSARY.md, Extra question): the PEO the prospect chose, and any
 * other the advisor's open information request names (`requested`). Only listed PEOs with a profile in use that has
 * questions; the chosen PEO first, then the others alphabetically (the catalog's order). Never ranked. Each says which
 * of its questions the request names, by key, when the request names them as they are worded now.
 */
export function askedPeos(catalog: readonly PeoRecord[], chosen: string | null, requested: readonly ExtraQuestionRef[] = []): AskedPeo[] {
  const choice = chosen ? findPeo(catalog, chosen) : undefined;
  const ask = (p: PeoRecord): AskedPeo[] => {
    if (!p.listed || p.id === undefined || !p.profile || p.profile.extraQuestions.length === 0) return [];
    const questions = p.profile.extraQuestions;
    const named = new Set(requested.filter((r) => r.peo_id === p.id && questions.some((q) => q.key === r.key && q.text === r.question)).map((r) => r.key));
    return [{ peo: { id: p.id, name: p.name }, questions, requested: named }];
  };
  const others = catalog.filter((p) => p !== choice && requested.some((r) => r.peo_id === p.id));
  return [...(choice ? ask(choice) : []), ...others.flatMap(ask)];
}

/** One extra question as Lenore's chat sends it to chamber-extract (its extraQuestions.ts). */
export interface ExtraQuestionForLenore {
  id: string;
  peo: string;
  text: string;
  kind: ExtraQuestionKind;
  choices?: string[];
  /** The intake holds an answer to it as worded (one the prospect doesn't know counts): Lenore doesn't ask again. */
  answered: boolean;
}

/** As many questions as one chat call carries (chamber-extract's MAX_EXTRA_QUESTIONS). */
export const LENORE_MAX_EXTRA_QUESTIONS = 40;

/**
 * The extra questions Lenore is to ask (askedPeos: the chosen PEO's first, then those a request names), by
 * "<PEO id>.<key>", at most LENORE_MAX_EXTRA_QUESTIONS.
 */
export function extraQuestionsForLenore(asked: readonly AskedPeo[], all: ExtraAnswers): ExtraQuestionForLenore[] {
  return asked
    .flatMap(({ peo, questions }) => questions.map((q) => ({
      id: `${peo.id}.${q.key}`,
      peo: peo.name,
      text: q.text,
      kind: q.kind,
      ...(q.kind === "choice" ? { choices: q.choices ?? [] } : {}),
      answered: answerFor(all, peo.id, q) !== null,
    })))
    .slice(0, LENORE_MAX_EXTRA_QUESTIONS);
}

/**
 * What Lenore heard for the extra questions in one message (chamber-extract's `extra_answers`), merged as a field's
 * answer is (mergeHeard, transcriptExtraction): a value of the question's kind only, inferred unless the model says it
 * was stated, never confirmed from speech, never over the prospect's own answer or "Doesn't apply", a disagreement
 * between two answers from the conversation kept as a conflict. "Unknown" only on a question with no answer as worded.
 * An answer held to other wording isn't this question's, so it is replaced.
 */
export function applyExtraExtraction(
  all: ExtraAnswers,
  asked: readonly AskedPeo[],
  response: unknown,
  message: { id: string; text: string; spoken?: boolean },
  now = new Date(),
): ExtraAnswers {
  const r = isRow(response) ? response : {};
  const heard = Array.isArray(r.extra_answers) ? r.extra_answers : [];
  const meta = transcriptExtraction(message, { prompt_version: r.prompt_version });
  const updated_at = now.toISOString();
  let next = all;
  for (const h of heard) {
    if (!isRow(h) || typeof h.id !== "string") continue;
    const [peoText, key] = h.id.split(".");
    const peo = asked.find((p) => String(p.peo.id) === peoText);
    const q = peo?.questions.find((x) => x.key === key);
    if (!peo || !q) continue;
    const held = answerFor(next, peo.peo.id, q);
    const evidence = typeof h.evidence === "string" && h.evidence.trim() ? h.evidence.trim() : null;
    if (h.value === undefined) {
      if (h.field_status !== "unknown" || held) continue;
      const { quote: _quote, ...source } = meta.source as Extract<FieldSource, { kind: "transcript" }>;
      next = withAnswer(next, peo.peo.id, q.key, { question: q.text, kind: q.kind, status: "unknown", source, updated_at });
      continue;
    }
    if (!fitsQuestion(q, h.value)) continue;
    const stated = h.field_status === "confirmed" && !message.spoken ? "confirmed" : h.field_status === "incomplete" ? "incomplete" : "inferred";
    const source: FieldSource = evidence && meta.source.kind === "transcript" ? { ...meta.source, quote: evidence.slice(0, 200) } : meta.source;
    const { question: _q, kind: _k, value: heldValue, ...heldEntry } = held ?? ({} as Partial<ExtraAnswer>);
    const merged = mergeHeard(held ? (heldEntry as FieldProvenance) : undefined, held ? heldValue : undefined, h.value, { source, status: stated, corrected: false, updated_at });
    if (!merged) continue;
    next = withAnswer(next, peo.peo.id, q.key, { question: q.text, kind: q.kind, value: merged.value as ExtraValue, ...merged.entry });
  }
  return next;
}
