import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { previewLeadsBulk, applyLeadsBulk, undoLeadsBulk } = await import("./leadsBulkApi");

const answer = (extra: Record<string, unknown> = {}) => ({
  data: { action: "delete", selected: 2, limit: 1000, too_many: false, unavailable: 0, will_change: 1, unchanged: 0,
    skipped: [{ id: "l2", name: "Kim", code: "converted", reason: "It is converted, so it can be read but not changed or deleted." }], ...extra },
  error: null,
});

beforeEach(() => rpc.mockReset());

describe("leadsBulkApi", () => {
  // Catches: a lead's change sent to the accounts' function, or its details sent under the wrong names.
  it.each([
    [{ action: "delete" } as const, {}],
    [{ action: "status", status: "working" } as const, { status: "working" }],
    [{ action: "not_fit", reason: "too_small" } as const, { reason: "too_small" }],
    [{ action: "owner", ownerId: "u2" } as const, { owner_id: "u2" }],
    [{ action: "field", field: "city", value: "Bend" } as const, { field: "city", value: "Bend" }],
    [{ action: "label_add", name: "Hot" } as const, { name: "Hot" }],
  ])("previews %j with the leads' function", async (change, expected) => {
    rpc.mockResolvedValue(answer());
    const outcome = await previewLeadsBulk("f1", change, { ids: ["l1", "l2"] });
    expect(rpc).toHaveBeenLastCalledWith("bulk_leads_preview", { p_firm_id: "f1", p_action: change.action, p_params: expected, p_filters: null, p_ids: ["l1", "l2"] });
    expect(outcome.changed).toBe(1);
    expect(outcome.skipped[0].code).toBe("converted");
  });

  // Catches: a change sent to the preview, or a lead's undo (which has no opportunities) read as a failure.
  it("makes the change and undoes it with the leads' functions", async () => {
    rpc.mockResolvedValueOnce(answer({ changed: 1, change_id: "c1", undo_until: "2026-11-16T10:10:00Z" }));
    const made = await applyLeadsBulk("f1", { action: "delete" }, { filters: { filters: [], search: "kim" } });
    expect(rpc).toHaveBeenLastCalledWith("bulk_leads_change", { p_firm_id: "f1", p_action: "delete", p_params: {}, p_filters: { filters: [], search: "kim" }, p_ids: null });
    expect(made.changeId).toBe("c1");
    rpc.mockResolvedValueOnce({ data: { action: "delete", restored: 1, skipped: [], gone: 0 }, error: null });
    const undone = await undoLeadsBulk("f1", "c1");
    expect(rpc).toHaveBeenLastCalledWith("bulk_leads_undo", { p_change_id: "c1", p_firm_id: "f1" });
    expect(undone.restored).toBe(1);
    expect(undone.opportunities).toEqual({ restored: 0, skipped: 0, gone: 0 });
  });
});
