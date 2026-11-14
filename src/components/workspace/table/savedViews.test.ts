import { describe, expect, it, vi } from "vitest";
import { judgeAddress, queryFor, readAddress, sameAddress, type TableView } from "./index";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
const { QUEUE_TABLE, QUEUE_VIEWS } = await import("@/components/advisor/queueTable");

// What a view's own sort and columns mean to the frame (story CRM-S3.4a, D-142): the view's sort is the table's order while the address holds none.

const oldestFirst: TableView<never> = {
  id: "saved-1",
  label: "Longest waiting",
  filters: [{ field: "waiting_on_peo", op: "is", value: true }],
  sort: { field: "oldest_waiting_on", direction: "asc" },
  columns: ["company", "waiting_since"],
} as never;
const withView = { ...QUEUE_TABLE, views: [...QUEUE_VIEWS, oldestFirst] } as typeof QUEUE_TABLE;
const at = (search: string) => readAddress(withView, new URLSearchParams(search));

describe("a view's own sort", () => {
  // Catches: a saved view's sort being stored but never asked for, so its rows come back in the table's order.
  it("is the order the rows are asked for while the address holds no sort", () => {
    expect(queryFor(withView, at("view=saved-1")).sort).toEqual({ field: "oldest_waiting_on", direction: "asc" });
  });

  // Catches: a header click being overridden by the view's sort.
  it("gives way to a sort the address holds", () => {
    expect(queryFor(withView, at("view=saved-1&sort=-company_name")).sort).toEqual({ field: "company_name", direction: "desc" });
  });

  // Catches: a view with no sort, or no view, asking for an order nobody chose.
  it("leaves the order alone for a view with none and for no view", () => {
    expect(queryFor(withView, at("view=won")).sort).toBeNull();
    expect(queryFor(withView, at("")).sort).toBeNull();
  });

  // Catches: an address that spells the view's own order out being a different place from the view (a "modified view" nobody modified).
  it("is not written into the address when the address only repeats it", () => {
    expect(judgeAddress(withView, new URLSearchParams("view=saved-1&sort=oldest_waiting_on")).address.sort).toBeNull();
    expect(judgeAddress(withView, new URLSearchParams("view=saved-1&sort=-oldest_waiting_on")).address.sort).toEqual({ field: "oldest_waiting_on", direction: "desc" });
  });

  // Catches: sameAddress ignoring the view's order, so a view and the same view with its own sort written out read as two places.
  it("is part of what makes two addresses the same place", () => {
    const written = { ...at("view=saved-1"), sort: { field: "oldest_waiting_on", direction: "asc" } } as ReturnType<typeof at>;
    expect(sameAddress(withView, at("view=saved-1"), written)).toBe(true);
    expect(sameAddress(withView, at("view=saved-1"), at("view=saved-1&sort=-oldest_waiting_on"))).toBe(false);
    expect(sameAddress(withView, at("filter=needs_action:is:true"), at("filter=needs_action:is:true"))).toBe(true);
    expect(sameAddress(withView, at("filter=needs_action:is:true"), at(""))).toBe(false);
  });
});

const { withSavedViews } = await import("./savedViews");
const saved = (over: Record<string, unknown> = {}) => ({
  id: "saved-1", name: "Mine", filters: [{ field: "needs_action", op: "is", value: true }], sort: null, columns: null,
  shared: false, mine: true, canChange: true, canShare: false, canUnshare: false, updatedAt: "2026-11-01T00:00:00Z", ...over,
});

describe("saved views as the table's views", () => {
  // Catches: a saved view's filters, sort and columns not reaching the table, or its rights being lost (the tab couldn't tell what to offer).
  it("adds each saved view after the built-in ones, with its name, filters, sort, columns and what the person may do with it", () => {
    const table = withSavedViews(QUEUE_TABLE, [saved({ sort: { field: "oldest_waiting_on", direction: "asc" }, columns: ["company"], canShare: true })], "ready");
    expect(table.views.slice(0, QUEUE_VIEWS.length)).toEqual(QUEUE_VIEWS);
    expect(table.views.at(-1)).toEqual({
      id: "saved-1", label: "Mine", filters: [{ field: "needs_action", op: "is", value: true }], sort: { field: "oldest_waiting_on", direction: "asc" },
      columns: ["company"], saved: { mine: true, shared: false, canChange: true, canShare: true, canUnshare: false },
    });
    expect(table.viewsStatus).toBe("ready");
  });

  // Catches: a view that names a field the table no longer has being drawn as a tab whose count would fail every other tab's count (one batch).
  it("leaves out a view whose filter, sort or operator the table can't read", () => {
    const table = withSavedViews(QUEUE_TABLE, [
      saved({ id: "a", filters: [{ field: "nope", op: "is", value: true }] }),
      saved({ id: "b", sort: { field: "nope", direction: "asc" } }),
      saved({ id: "c", filters: [{ field: "needs_action", op: "contains", value: "x" }] }),
      saved({ id: "d" }),
    ], "ready");
    expect(table.views.map((v) => v.id)).toEqual([...QUEUE_VIEWS.map((v) => v.id), "d"]);
  });

  // Catches: the loading state being lost, so a bookmark of a saved view is dropped before the views arrive (D-141).
  it("passes the views' own status on, so the address holds what it can't judge yet", () => {
    expect(withSavedViews(QUEUE_TABLE, [], "loading").viewsStatus).toBe("loading");
    expect(withSavedViews(QUEUE_TABLE, [], "failed").viewsStatus).toBe("failed");
  });
});
