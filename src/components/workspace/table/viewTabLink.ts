/** The link of a view's tab (`null` is the table's "all" tab), when it is on the page: where focus goes when the control that had it went with a view. */
export const viewTabLink = (view: string | null): HTMLElement | null =>
  [...document.querySelectorAll<HTMLElement>("[data-view-tab]")].find((el) => el.dataset.viewTab === (view ?? "all")) ?? null;
