/** How long refreshes may keep failing before a count stops being shown. A number nobody can confirm is not worth the trust it asks for. */
export const COUNTS_FAILING_FOR_MS = 5 * 60_000;

/**
 * How long refreshes have been failing, so a number nobody can confirm is not shown for ever (D-134): the run of failures begins at the
 * first failure after the last good answer, for one key (the firm), and the numbers go only once it has lasted `limitMs`. Old is not
 * failing: a tab that sat in the background keeps its numbers until the refresh on return answers.
 */
export interface FailureClock {
  /** A refresh answered. */
  succeeded(): void;
  /** A refresh failed for this key. */
  failed(key: string | null): void;
  /** Whether the refreshes for this key have been failing for longer than the limit. */
  expired(key: string | null): boolean;
}

export function createFailureClock(limitMs: number): FailureClock {
  let since: { key: string | null; at: number } | null = null;
  return {
    succeeded: () => { since = null; },
    failed: (key) => { if (since?.key !== key) since = { key, at: Date.now() }; },
    expired: (key) => !!since && since.key === key && Date.now() - since.at > limitMs,
  };
}
