/**
 * A quote request's quotes, as a PEO revises its quote (N-2.4, D-733). A revision is a second row of `quotes` (D-720): the earlier one is kept, never overwritten. The newest
 * recorded quote (the highest id, which is the order they were recorded in, whatever date the PEO put on them) is the current one; the rest are superseded.
 */
export function quoteRevisions<Q extends { id: number }>(quotes: readonly Q[]): { current: Q | null; superseded: Q[] } {
  const newestFirst = [...quotes].sort((a, b) => b.id - a.id);
  return { current: newestFirst[0] ?? null, superseded: newestFirst.slice(1) };
}
