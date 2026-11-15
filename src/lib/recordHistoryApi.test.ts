import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { listRecordHistory, RecordHistoryError } = await import("./recordHistoryApi");

const row = (over: Record<string, unknown> = {}) => ({
  entry_key: "e1", at: "2026-11-01T10:00:00Z", change_id: "c1", kind: "changed", who: "dana@x.example", who_kind: "member", field: "employees", from_value: 40, to_value: 45, ...over,
});

beforeEach(() => rpc.mockReset());

describe("recordHistoryApi", () => {
  // Catches: the page asked for the wrong record or table, or a cursor sent in two halves.
  it("asks for one page of a record's history", async () => {
    rpc.mockResolvedValue({ data: [row()], error: null });
    const page = await listRecordHistory("f1", "contacts", "c1", { limit: 10 });
    expect(rpc).toHaveBeenCalledWith("record_history_list", { p_firm_id: "f1", p_table: "contacts", p_key: "c1", p_limit: 10, p_after_at: null, p_after_key: null });
    expect(page.entries).toHaveLength(1);
    expect(page.next).toBeNull();
  });

  // Catches (CRM-S4.3b): an entry a merge moved from another record shown as the record's own, so the screen can not say "from <name>".
  it("keeps the name of the record an entry came from when a merge moved it", async () => {
    rpc.mockResolvedValue({ data: [row({ merged_from: "Harborview East" }), row({ entry_key: "e2" })], error: null });
    const page = await listRecordHistory("f1", "accounts", "a1");
    expect(page.entries.map((e) => e.mergedFrom)).toEqual(["Harborview East", null]);
  });

  it("says in words that a record's history is not available", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "x" } });
    await expect(listRecordHistory("f1", "accounts", "a1")).rejects.toBeInstanceOf(RecordHistoryError);
  });
});
