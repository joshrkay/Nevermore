import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { previewBulkChange, applyBulkChange, undoBulkChange, firmLabels, BulkChangeError, BULK_LIMIT, BULK_FIELDS } = await import("./bulkChangeApi");

const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};
const answer = (extra: Record<string, unknown> = {}) => ({
  data: { action: "owner", selected: 3, limit: 1000, too_many: false, unavailable: 1, will_change: 2, unchanged: 0,
    skipped: [{ id: "a3", name: "Acme", code: "level", reason: "Only the account's owner can change it." }], ...extra },
  error: null,
});

beforeEach(() => rpc.mockReset());

describe("bulkChangeApi", () => {
  // Catches: the ids sent with the filters (the database refuses both), the filters sent when "all" is not chosen, or the firm left off.
  it("sends the ids, or the filters and no ids", async () => {
    rpc.mockResolvedValue(answer());
    await previewBulkChange("f1", { action: "archive" }, { ids: ["a1", "a2"] });
    expect(rpc).toHaveBeenLastCalledWith("bulk_accounts_preview", { p_firm_id: "f1", p_action: "archive", p_params: {}, p_filters: null, p_ids: ["a1", "a2"] });
    await applyBulkChange("f1", { action: "archive" }, { filters: { filters: [{ field: "state", op: "any_of", value: ["TX"] }], search: "acme" } });
    expect(rpc).toHaveBeenLastCalledWith("bulk_accounts_change", {
      p_firm_id: "f1", p_action: "archive", p_params: {}, p_filters: { filters: [{ field: "state", op: "any_of", value: ["TX"] }], search: "acme" }, p_ids: null,
    });
  });

  // Catches: an action's details lost or sent under the wrong name.
  it.each([
    [{ action: "owner", ownerId: "u2", changeOpenOpportunities: true } as const, { owner_id: "u2", change_open_opportunities: true }],
    [{ action: "owner", ownerId: "u2" } as const, { owner_id: "u2", change_open_opportunities: false }],
    [{ action: "field", field: "city", value: "Austin" } as const, { field: "city", value: "Austin" }],
    [{ action: "field", field: "employees", value: null } as const, { field: "employees", value: null }],
    [{ action: "label_add", name: "VIP" } as const, { name: "VIP" }],
    [{ action: "label_remove", name: "VIP" } as const, { name: "VIP" }],
  ])("sends %j", async (change, expected) => {
    rpc.mockResolvedValue(answer());
    await applyBulkChange("f1", change, { ids: ["a1"] });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_action: change.action, p_params: expected });
  });

  // Catches: skipped accounts dropped (they must be named), the counts mixed up, the opportunities lost.
  it("reads what the dialog says", async () => {
    rpc.mockResolvedValue(answer({ owner: { id: "u2", name: "Marcus Hale" }, opportunities: { will_change: 2, skipped: 1 } }));
    expect(await previewBulkChange("f1", { action: "owner", ownerId: "u2", changeOpenOpportunities: true }, { ids: ["a1"] })).toEqual({
      selected: 3, tooMany: false, changed: 2, unchanged: 0, unavailable: 1,
      skipped: [{ id: "a3", name: "Acme", code: "level", reason: "Only the account's owner can change it." }],
      ownerName: "Marcus Hale", label: null, opportunities: { changed: 2, skipped: 1 }, changeId: null, undoUntil: null,
    });
  });

  it("reads the change to undo and until when", async () => {
    rpc.mockResolvedValue(answer({ changed: 2, change_id: "c1", undo_until: "2026-11-15T10:10:00+00:00", label: "VIP" }));
    const done = await applyBulkChange("f1", { action: "label_add", name: "vip" }, { ids: ["a1"] });
    expect([done.changed, done.changeId, done.undoUntil, done.label]).toEqual([2, "c1", "2026-11-15T10:10:00+00:00", "VIP"]);
  });

  it("says a selection over the limit without throwing in the preview", async () => {
    rpc.mockResolvedValue(answer({ too_many: true, selected: 1200, unavailable: 0, will_change: 0, skipped: [] }));
    const p = await previewBulkChange("f1", { action: "archive" }, { filters: { filters: [] } });
    expect([p.tooMany, p.selected, BULK_LIMIT]).toEqual([true, 1200, 1000]);
  });

  // Catches: a refusal whose words are lost, or refusals the screen must tell apart (too many, expired, already undone) read as one failure.
  it.each([
    ["PT413", "tooMany"], ["PT423", "readOnly"], ["42501", "notAllowed"], ["22023", "invalid"], ["PT404", "notFound"], ["PT409", "alreadyUndone"], ["PT410", "expired"], ["XX000", "failed"],
  ])("reads %s as %s", async (code, kind) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "In words." } });
    const e = await caught(() => applyBulkChange("f1", { action: "archive" }, { ids: ["a1"] }));
    expect(e).toBeInstanceOf(BulkChangeError);
    expect((e as InstanceType<typeof BulkChangeError>).kind).toBe(kind);
    if (code !== "XX000") expect((e as Error).message).toBe("In words.");
  });

  it("reads a malformed answer as a failure", async () => {
    rpc.mockResolvedValue({ data: { selected: "many" }, error: null });
    expect(((await caught(() => previewBulkChange("f1", { action: "archive" }, { ids: ["a1"] }))) as InstanceType<typeof BulkChangeError>).kind).toBe("failed");
  });

  it("undoes by the change's id and names what it left", async () => {
    rpc.mockResolvedValue({ data: { restored: 2, skipped: [{ id: "a3", name: "Acme", code: "changed_since", reason: "Its owner has changed since." }], gone: 2, opportunities: { restored: 1, skipped: 0, gone: 1 } }, error: null });
    const u = await undoBulkChange("f1", "c1");
    expect(rpc).toHaveBeenCalledWith("bulk_accounts_undo", { p_change_id: "c1", p_firm_id: "f1" });
    expect([u.restored, u.skipped[0].code, u.opportunities.restored, u.gone, u.opportunities.gone]).toEqual([2, "changed_since", 1, 2, 1]);
  });

  it("lists the firm's labels", async () => {
    rpc.mockResolvedValue({ data: [{ id: "l1", name: "East" }], error: null });
    expect(await firmLabels("f1")).toEqual([{ id: "l1", name: "East" }]);
    expect(rpc).toHaveBeenCalledWith("firm_labels", { p_firm_id: "f1" });
  });
});

// The database refuses a field it doesn't list, so the list "Set a field" offers must be the database's (never the name or a worked-out field).
describe("the fields and the limit agree with the database", () => {
  const sql = readFileSync("supabase/migrations/20261119210000_bulk_changes.sql", "utf8");
  it("lists the same fields as the account's own edit form, less its name", () => {
    const m = sql.match(/field NOT IN \(([^)]*)\) THEN/);
    expect(m).not.toBeNull();
    expect([...m![1].matchAll(/'(\w+)'/g)].map((x) => x[1])).toEqual([...BULK_FIELDS]);
    expect(BULK_FIELDS as readonly string[]).not.toContain("name");
  });
  it("takes the same most accounts", () => {
    expect(BULK_LIMIT).toBe(Number(sql.match(/cap constant integer := (\d+)/)![1]));
  });
});
