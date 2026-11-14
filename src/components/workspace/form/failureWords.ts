import { useCallback, useState } from "react";

/**
 * Whether an error's text is meant for a person (CRM-S2.3, D-178; the rule CRM-S4.1 made for forms, now one rule for every failed save and every
 * failed load). The client's own failures are not: a dropped network arrives as "TypeError: Failed to fetch" with no code, and the database's
 * timeouts and gateway faults carry codes of the kinds below (PostgREST "PGRST…", connection, resource, operator-intervention and internal
 * classes). The rules the product raises itself (a code already taken, a role refused) carry their own plain sentences and codes outside those kinds.
 */
const TECHNICAL_MESSAGE = /^(TypeError|FetchError|NetworkError|AbortError|SyntaxError|AuthRetryableFetchError|AuthUnknownError)\b|failed to fetch|load failed|networkerror|network request failed/i;
const TECHNICAL_CODE = /^(PGRST|08|53|54|55|57|58|XX|P0)/i;

export const hasWordsOfItsOwn = (error: Error): boolean => {
  const code = (error as { code?: unknown }).code;
  const message = error.message.trim();
  if (message === "" || TECHNICAL_MESSAGE.test(message)) return false;
  return !(typeof code === "string" && TECHNICAL_CODE.test(code));
};

/** What to tell a person about a failed action: the error's own sentence when it is meant for people, otherwise `fallback`. */
export const failureWords = (error: unknown, fallback: string): string =>
  error instanceof Error && hasWordsOfItsOwn(error) ? error.message.trim() : fallback;

/**
 * The failed-save words of an action that is not a form (a panel's "Add note" button): hold what failed, show it with `SaveFailed` beside the
 * button, clear it when the next try starts. `fallback` is the whole sentence said when the error's own words are not for people.
 */
export function useSaveFailure(fallback: string) {
  const [message, setMessage] = useState<string | null>(null);
  const failed = useCallback((error: unknown) => setMessage(failureWords(error, fallback)), [fallback]);
  const clear = useCallback(() => setMessage(null), []);
  /** Says a sentence of ours as it is (a check the page made itself, before asking the server). */
  const say = useCallback((sentence: string) => setMessage(sentence), []);
  return { message, failed, clear, say };
}
