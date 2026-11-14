import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { exportRows, ExportError } = await import("./exportApi");
const { AdvisorApiError } = await import("./advisorApi");

const refused = (code: string, message = "refused") => ({ data: null, error: { code, message } });

const partners = {
  table: "referral_partners",
  label: "Referral partners",
  columns: [{ id: "code", label: "Code" }, { id: "name", label: "Name" }, { id: "kind", label: "Kind" }],
  rows: [{ code: "acme-cfo", name: "Acme CFO", kind: "accounting" }, { code: "acme-law", name: "Acme Law", kind: "law_firm" }],
  count: 2,
  skipped: 0,
  exportedAt: "2026-11-19T10:00:00+00:00",
};

const activity = {
  table: "firm_activity",
  label: "The firm's record",
  columns: [{ id: "at", label: "When" }, { id: "subject", label: "About" }, { id: "row_count", label: "Rows" }, { id: "flag", label: "Flag" }],
  rows: [{ at: "2026-11-19T10:00:00+00:00", subject: null, row_count: 3, flag: true }],
  count: 1,
  skipped: 0,
  exportedAt: "2026-11-19T10:00:00+00:00",
};

describe("exportRows", () => {
  beforeEach(() => rpc.mockReset());

  it("asks for a whole table with no filters and no ids, naming the firm and the table and nothing else", async () => {
    rpc.mockResolvedValue({ data: partners, error: null });
    await exportRows({ firmId: "f1", table: "referral_partners" });
    // A caller that says nothing asks for every row, never for an empty selection: the ids are null, not [].
    expect(rpc).toHaveBeenCalledWith("export_rows", { p_firm_id: "f1", p_table: "referral_partners", p_filters: {}, p_ids: null });
  });

  it("sends the filters as they are and a selection as the list of ids", async () => {
    rpc.mockResolvedValue({ data: activity, error: null });
    await exportRows({ firmId: "f1", table: "firm_activity", filters: { kind: "sign_in", person: "nevermore" }, ids: ["k1", "k2"] });
    expect(rpc).toHaveBeenCalledWith("export_rows", { p_firm_id: "f1", p_table: "firm_activity", p_filters: { kind: "sign_in", person: "nevermore" }, p_ids: ["k1", "k2"] });
  });

  it("keeps an empty selection empty: nothing selected is not everything", async () => {
    rpc.mockResolvedValue({ data: { ...partners, rows: [], count: 0 }, error: null });
    await exportRows({ firmId: "f1", table: "referral_partners", ids: [] });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_ids: [] });
  });

  it("gives back the columns in their order and the rows, as the database sent them", async () => {
    rpc.mockResolvedValue({ data: partners, error: null });
    const result = await exportRows({ firmId: "f1", table: "referral_partners" });
    expect(result).toEqual(partners);
    expect(result.columns.map((c) => c.id)).toEqual(["code", "name", "kind"]);
  });

  it("takes a value that is nothing, a number or a yes or no, which the record's rows hold", async () => {

    rpc.mockResolvedValue({ data: activity, error: null });
    expect((await exportRows({ firmId: "f1", table: "firm_activity" })).rows[0]).toEqual({ at: "2026-11-19T10:00:00+00:00", subject: null, row_count: 3, flag: true });
  });

  it("says how many ids of a selection gave no row", async () => {
    rpc.mockResolvedValue({ data: { ...partners, skipped: 3 }, error: null });
    expect((await exportRows({ firmId: "f1", table: "referral_partners", ids: ["a", "b", "c", "d", "e"] })).skipped).toBe(3);
  });

  it.each([
    ["an answer that is not one", "nothing"],
    ["a missing part", { ...partners, columns: undefined }],
    ["a table that is not one it knows", { ...partners, table: "chamber_sessions" }],
    ["a row holding something that is not a value", { ...partners, rows: [{ code: { nested: true } }, { code: "x" }] }],
    ["a count that is not the rows", { ...partners, count: 5 }],
    ["a count below nothing", { ...partners, count: -1, rows: [] }],
    ["another table than the one asked for", { ...partners, table: "firm_activity" }],
    ["two columns with one id", { ...partners, columns: [{ id: "code", label: "Code" }, { id: "code", label: "Name" }], rows: [{ code: "acme-cfo" }, { code: "acme-law" }] }],
    ["a row with a column missing", { ...partners, rows: [{ code: "acme-cfo", name: "Acme CFO" }, partners.rows[1]] }],
    ["a row with a column that was not declared", { ...partners, rows: [{ ...partners.rows[0], email: "x@example.test" }, partners.rows[1]] }],
  ])("is a failed export, not a file with something missing, for %s", async (_what, data) => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(exportRows({ firmId: "f1", table: "referral_partners" })).rejects.toMatchObject({ kind: "failed", message: "Couldn't export. Try again." });
  });

  it("says a sign-in too long ago must be done again, as its own kind so the page can send the person to sign in", async () => {
    rpc.mockResolvedValue(refused("PT401", "Sign in again to export a whole table"));
    const error = await exportRows({ firmId: "f1", table: "referral_partners" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExportError);
    expect(error).toMatchObject({ kind: "signInAgain", message: "Sign in again to export a whole table." });
  });

  it("says Nevermore support can't export", async () => {
    rpc.mockResolvedValue(refused("PT423", "Nevermore support can look, not change"));
    await expect(exportRows({ firmId: "f1", table: "referral_partners" })).rejects.toMatchObject({ kind: "support", message: "Nevermore support can look, not change, so it can't export." });
  });

  it("gives the database's own words for too many rows and for filters or ids it doesn't take", async () => {
    rpc.mockResolvedValue(refused("PT413", "That is more than 50,000 rows. Narrow it with a filter and export again."));
    await expect(exportRows({ firmId: "f1", table: "referral_partners" })).rejects.toMatchObject({ kind: "tooMany", message: "That is more than 50,000 rows. Narrow it with a filter and export again." });
    rpc.mockResolvedValue(refused("22023", "Pick at most 1,000 records to export"));
    await expect(exportRows({ firmId: "f1", table: "referral_partners", ids: ["a"] })).rejects.toMatchObject({ kind: "invalid", message: "Pick at most 1,000 records to export" });
  });

  it("tells a person who isn't a member, and an agent who asked for the firm's record, apart", async () => {
    rpc.mockResolvedValue(refused("42501", "Not a member of that firm"));
    await expect(exportRows({ firmId: "f1", table: "referral_partners" })).rejects.toMatchObject({ kind: "notAllowed", message: "You aren't a member of this firm." });
    rpc.mockResolvedValue(refused("42501", "Only an owner of the firm can export that"));
    await expect(exportRows({ firmId: "f1", table: "firm_activity" })).rejects.toMatchObject({ kind: "notAllowed", message: "Only an owner of the firm can export that." });
  });

  it("signs the person out when the session has ended, as every other call does", async () => {
    rpc.mockResolvedValue(refused("PGRST301", "JWT expired"));
    const error = await exportRows({ firmId: "f1", table: "referral_partners" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdvisorApiError);
    expect(error).toMatchObject({ unauthenticated: true });
  });

  it("falls back to a plain message for any other failure, never the database's text", async () => {
    rpc.mockResolvedValue(refused("XX000", "internal detail"));
    await expect(exportRows({ firmId: "f1", table: "referral_partners" })).rejects.toMatchObject({ kind: "failed", message: "Couldn't export. Try again." });
  });
});
