/**
 * What narrows the list. A view is a tab; a search and the filters are what the person typed and chose. They decide the words ("this search",
 * "these filters", "this search and these filters") and what the one way back is called and does (see `clearLabelFor`).
 */
export interface NarrowedBy {
  search: boolean;
  filters: boolean;
  /** A tab (or the outbox's status) narrows the list. */
  view?: boolean;
}

/**
 * What the one way back is called, so each button does the one thing its label names: "Clear search" when a search is in force, "Clear filters" for
 * filters, "Clear filters and search" for both (the tab stays), and, when only the tab narrows the list, "Show <the all view's name>", which leaves it.
 */
export function clearLabelFor(by: NarrowedBy, showAll: string): string {
  if (by.search && by.filters) return "Clear filters and search";
  if (by.search) return "Clear search";
  if (by.filters) return "Clear filters";
  return showAll;
}

