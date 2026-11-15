import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const { exportTable, ExportRefusal } = await import("./exportApi");

const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e as InstanceType<typeof ExportRefusal>;
  }
  throw new Error("expected a failure");
};

beforeEach(() => rpc.mockReset());

describe("exportTable", () => {
  // Catches: the call drops the filters, the selection or the time zone, sends the columns in another order, or reads the answer wrongly.
  it("sends the table, the columns in order, the filters, the selection and the time zone, and reads the rows and the count", async () => {
    rpc.mockResolvedValue({
      data: { table: "referral_partners", columns: ["name", "code"], rows: [["Bay Law", "bay-law"]], row_count: 1, whole_table: false, exported_at: "2026-11-14T09:30:00.000Z" },
      error: null,
    });
    const filters = [{ field: "kind", op: "any_of", value: ["law_firm"] }];
    const result = await exportTable("firm-1", "referral_partners", ["name", "code"], { filters, keys: ["bay-law"], timeZone: "America/New_York" });
    expect(rpc).toHaveBeenCalledWith("export_table", {
      p_firm_id: "firm-1",
      p_table: "referral_partners",
      p_columns: ["name", "code"],
      p_filters: filters,
      p_keys: ["bay-law"],
      p_time_zone: "America/New_York",
    });
    expect(result).toEqual({
      table: "referral_partners", columns: ["name", "code"], rows: [["Bay Law", "bay-law"]], rowCount: 1, wholeTable: false, exportedAt: "2026-11-14T09:30:00.000Z",
    });
  });

  // Catches: an empty selection is sent as "nothing selected" ([]), which the database refuses, instead of "every row that matches".
  it("asks for every matching row when nothing is selected", async () => {
    rpc.mockResolvedValue({ data: { table: "firm_activity", columns: ["who"], rows: [], row_count: 0, whole_table: false, exported_at: "x" }, error: null });
    await exportTable("firm-1", "firm_activity", ["who"]);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_filters: [], p_keys: null });
  });

  // Catches: an empty selection is sent, or read as "every row that matches" (D-212): a selection that lost its rows must never become
  // the whole table. It is refused here, before the database is asked, so nothing is recorded.
  it("refuses an empty selection without asking the database", async () => {
    const e = await caught(() => exportTable("firm-1", "referral_partners", ["code"], { keys: [] }));
    expect([e.reason, e.message]).toEqual(["invalid", "Select at least one row to export, or clear the selection to export every row that matches."]);
    expect(rpc).not.toHaveBeenCalled();
  });

  // Catches: a refusal is read as a generic failure, so the screen can't offer "Sign in again" or ask to narrow the export.
  it.each([
    ["PT428", "sign_in_again", "Sign in again to export the whole table: you last signed in more than 12 hours ago."],
    ["54000", "too_many", "This export would hold more than 10000 rows, the most one export holds. Narrow it with a filter."],
    ["PT423", "support", "Nevermore support can look, not export."],
    ["42501", "forbidden", "You can't export this table."],
    ["22023", "invalid", "This export would hold more than 10000 rows, the most one export holds. Narrow it with a filter."],
    ["XX000", "failed", "Couldn't export. Try again."],
  ])("reads %s as %s", async (code, reason, message) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "This export would hold more than 10000 rows, the most one export holds. Narrow it with a filter." } });
    const e = await caught(() => exportTable("firm-1", "referral_partners", ["code"]));
    expect(e).toBeInstanceOf(ExportRefusal);
    expect([e.reason, e.message, e.unauthenticated]).toEqual([reason, message, false]);
  });

  // Catches: an ended session is shown as "Try again" for ever instead of signing the person out.
  it("reads an ended session as signed out", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST301", message: "JWT expired" } });
    const e = await caught(() => exportTable("firm-1", "referral_partners", ["code"]));
    expect(e.unauthenticated).toBe(true);
  });
});
