import { useCallback, useState } from "react";

/**
 * Whether an error's text is meant for a person (CRM-S2.3, D-178; the rule CRM-S4.1 made for forms, now one rule for every failed save and every
 * failed load). Checked against every code the product's own SQL raises (`ERRCODE` in `supabase/migrations`, and the default P0001 of a plain
 * RAISE): 22023, 42501, PT4xx, 55000, P0002, P0001, 23514, 23505, 23502, 40001, 0A000 and EA00x all carry sentences written for people and are shown.
 * What is not for people: the client's own failures (a dropped network is "TypeError: Failed to fetch"; a function call is "Edge Function returned a
 * non-2xx status code"), codes of the kinds PostgREST and the server raise themselves (PGRST, connection 08, resource 53, operator intervention 57,
 * system 58, internal XX, and class 42 except the permission refusal 42501, which are bad SQL, and 22P02 and 22001, bad input the page should have
 * caught), and, for any code, the server's own sentences, which name constraints, columns and relations. A few codes are shared by the product's
 * sentences and the server's (23xxx, 40001), so the text decides there.
 */
const TECHNICAL_MESSAGE = /^(TypeError|FetchError|NetworkError|AbortError|SyntaxError|AuthRetryableFetchError|AuthUnknownError)\b|failed to fetch|load failed|networkerror|network request failed|Edge Function/i;
const TECHNICAL_CODE = /^(PGRST|08|53|57|58|XX|42(?!501)|22P02|22001)/i;
const SERVER_TEXT = /violates .* constraint|duplicate key value|null value in column|could not serialize|deadlock detected|invalid input syntax|value too long|\b(relation|function|column|table|type|schema|operator) \S+ does not exist/i;

export const hasWordsOfItsOwn = (error: Error): boolean => {
  const code = (error as { code?: unknown }).code;
  const message = error.message.trim();
  if (message === "" || TECHNICAL_MESSAGE.test(message) || SERVER_TEXT.test(message)) return false;
  return !(typeof code === "string" && TECHNICAL_CODE.test(code));
};

/** What to tell a person about a failed action: the error's own sentence when it is meant for people, otherwise `fallback`. */
export const failureWords = (error: unknown, fallback: string): string =>
  error instanceof Error && hasWordsOfItsOwn(error) ? error.message.trim() : fallback;

/** The sentence for an action that did not go through when the error has no words for people. */
export const DID_NOT_GO_THROUGH = "That didn't go through. Check your connection and try again.";

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
