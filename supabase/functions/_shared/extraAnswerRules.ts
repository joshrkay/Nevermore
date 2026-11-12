// What a PEO's extra question and an answer to it may hold (GLOSSARY.md, Extra question; L-2.3), in one place for the
// browser (src/data/extraAnswers.ts) and chamber-extract (chamber-extract/extraQuestions.ts). The database holds the
// same limits (peo_profile_version_error in 20261115090000, extra_answer_value_is_valid and extra_answers_error in
// 20261115120000); src/data/schemaSync.test.ts keeps them equal.
//
// Text is measured as the database measures it, char_length(btrim(text)): spaces at either end don't count, and a
// character is a code point, so an emoji is one character, not two. Measured any other way, a question the profile
// store took could be refused here, or an answer it holds dropped on load. Relative imports only, so it runs under
// Deno and Vitest alike.

export type ExtraAnswerKind = "text" | "yes_no" | "number" | "choice";

export const EXTRA_LIMITS = {
  /** A question's wording (the profile's max_text). */
  question: 500,
  /** One of a choice question's choices (the profile's max_header), and so a choice answer. */
  choice: 100,
  /** A text answer (the intake's TEXT_MAX). */
  text: 1000,
  /** The largest number a number answer holds, either side of zero. */
  number: 1_000_000_000_000,
} as const;

/** `s` without the spaces at either end, as Postgres's btrim(s) leaves it (only spaces: a tab or line break stays). */
const btrim = (s: string) => s.replace(/^ +| +$/g, "");

/** How long the database says `s` is: char_length(btrim(s)), in code points. */
export const textLength = (s: string): number => [...btrim(s)].length;

/** Whether `v` is text the database takes for a limit of `max`: 1 to `max` characters once trimmed. */
export const isTextWithin = (v: unknown, max: number): v is string => typeof v === "string" && textLength(v) >= 1 && textLength(v) <= max;

/** Whether `v` is an answer of `kind` within the database's limits (extra_answer_value_is_valid). */
export function isExtraValue(kind: ExtraAnswerKind, v: unknown): v is string | number | boolean {
  switch (kind) {
    case "yes_no":
      return typeof v === "boolean";
    case "number":
      return typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= EXTRA_LIMITS.number;
    case "text":
      return isTextWithin(v, EXTRA_LIMITS.text);
    case "choice":
      return isTextWithin(v, EXTRA_LIMITS.choice);
  }
}

/** Whether `v` answers a question of `kind` as asked: of its kind, and for a choice, one of the choices offered. */
export const answersAsAsked = (kind: ExtraAnswerKind, choices: readonly string[] | undefined, v: unknown): v is string | number | boolean =>
  isExtraValue(kind, v) && (kind !== "choice" || (choices ?? []).includes(v as string));
