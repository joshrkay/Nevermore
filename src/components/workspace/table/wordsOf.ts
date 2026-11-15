/** What a refusal says: the words of the error the call threw (the database's own, put into a sentence by `tableSettingsApi`), or the fallback. */
export const wordsOf = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback);
