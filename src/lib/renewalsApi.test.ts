import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { addRenewal, deleteRenewal, getAccountRenewals, markNotRenewed, RenewalError, undoNotRenewed, updateRenewal } = await import("./renewalsApi");

const row = (over: Record<string, unknown> = {}) => ({
  id: "r1", account_id: "a1", kind: "peo_placement", with_whom: "Justworks", renews_on: "2027-01-01", days_away: 45, placement_id: "p1",
  opportunity: { id: "o1", name: "January 2027 renewal", stage: "qualifying" }, not_renewed_on: null, done: false, outcome: null, made_by_win: false, version: 2, ...over,
});
const screenRow = {
  id: "r1", version: 2, kind: "peo_placement", withWhom: "Justworks", renewsOn: "2027-01-01", daysAway: 45, opportunity: { id: "o1", name: "January 2027 renewal", stage: "qualifying" },
  notRenewedOn: null, done: false, outcome: null, madeByWin: false,
};
const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};

beforeEach(() => rpc.mockReset());

describe("getAccountRenewals", () => {
  // Catches: the renewals asked of the wrong call or without the person's time zone (days away would be worked out in UTC), or an answer read into the wrong names.
  it("asks account_renewals with the time zone and answers the renewals in the screen's names", async () => {
    rpc.mockResolvedValue({ data: { count: 1, can_change: true, rows: [row()] }, error: null });
    expect(await getAccountRenewals("f1", "a1")).toEqual({ count: 1, canChange: true, rows: [screenRow] });
    expect(rpc).toHaveBeenCalledWith("account_renewals", { p_firm_id: "f1", p_account_id: "a1", p_time_zone: expect.any(String) });
  });
  // Catches: an account that is not there drawn as one with no renewals, or an answer of another shape drawn as renewals.
  it("is null for an account that is not there, and a failed load for an answer of another shape", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getAccountRenewals("f1", "a1")).toBeNull();
    rpc.mockResolvedValue({ data: { count: "x", rows: [] }, error: null });
    await expect(getAccountRenewals("f1", "a1")).rejects.toThrow("Couldn't load the renewals.");
  });
});

describe("addRenewal", () => {
  // Catches: a field dropped or under another name, a start date sent for the employer's current plan (the database refuses it), a blank date sent as text.
  it("sends the kind, who with, the date and a PEO placement's start, and none for a current plan", async () => {
    rpc.mockResolvedValue({ data: { renewal: row(), placement: null }, error: null });
    expect(await addRenewal("f1", "a1", { kind: "peo_placement", withWhom: "Justworks", renewsOn: "2027-01-01", placementStartOn: "2026-01-01" })).toEqual(screenRow);
    expect(rpc).toHaveBeenLastCalledWith("add_renewal", expect.objectContaining({ p_account_id: "a1", p_kind: "peo_placement", p_with_whom: "Justworks", p_renews_on: "2027-01-01", p_placement_start_on: "2026-01-01", p_firm_id: "f1" }));
    await addRenewal("f1", "a1", { kind: "current_plan", withWhom: "Aetna", renewsOn: "2027-01-01", placementStartOn: "2026-01-01" });
    expect(rpc).toHaveBeenLastCalledWith("add_renewal", expect.objectContaining({ p_placement_start_on: null }));
    await addRenewal("f1", "a1", { kind: "peo_placement", withWhom: "Gusto", renewsOn: "2027-01-01", placementStartOn: "" });
    expect(rpc).toHaveBeenLastCalledWith("add_renewal", expect.objectContaining({ p_placement_start_on: null }));
  });
  // Catches: a refusal told as a lost connection (the person retries a save that cannot work), or its kind not named for the form to place.
  it("keeps the database's words and names each refusal's kind", async () => {
    for (const [code, kind] of [["22023", "invalid"], ["42501", "notAllowed"], ["55000", "archived"], ["PT423", "readOnly"], ["PT404", "notFound"], ["PT409", "taken"]] as const) {
      rpc.mockResolvedValue({ data: null, error: { code, message: "In words." } });
      const e = await caught(() => addRenewal("f1", "a1", { kind: "current_plan", withWhom: "A", renewsOn: "2027-01-01", placementStartOn: "" }));
      expect(e).toBeInstanceOf(RenewalError);
      expect(e).toMatchObject({ kind });
    }
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    expect(await caught(() => addRenewal("f1", "a1", { kind: "current_plan", withWhom: "A", renewsOn: "2027-01-01", placementStartOn: "" }))).toMatchObject({ kind: "failed", message: "Couldn't save the renewal. Check your connection and try again." });
  });
});

describe("the saves from a version", () => {
  // Catches: the version the person started from not sent (a save over someone else's change), or the answer's new version not given back for the next save.
  it("sends the version and answers the saved renewal", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: row({ version: 5 }) }, error: null });
    expect(await updateRenewal("f1", "r1", { withWhom: "Justworks", renewsOn: "2027-01-01" }, 4)).toMatchObject({ conflict: false, renewal: { version: 5 } });
    expect(rpc).toHaveBeenLastCalledWith("update_renewal", expect.objectContaining({ p_renewal_id: "r1", p_version: 4, p_with_whom: "Justworks", p_renews_on: "2027-01-01", p_firm_id: "f1" }));
    await markNotRenewed("f1", "r1", "2026-12-01", 5);
    expect(rpc).toHaveBeenLastCalledWith("mark_renewal_not_renewed", expect.objectContaining({ p_renewal_id: "r1", p_not_renewed_on: "2026-12-01", p_version: 5 }));
    await undoNotRenewed("f1", "r1", 6);
    expect(rpc).toHaveBeenLastCalledWith("undo_renewal_not_renewed", expect.objectContaining({ p_renewal_id: "r1", p_version: 6 }));
  });
  // Catches: a conflict told as a failure (the person loses what they typed), or its current values and who changed them dropped.
  it("answers a conflict with what is there now and who changed it", async () => {
    const changed = [{ field: "with_whom", value: "Theirs", who: "marcus@example.com", at: "2026-11-14T10:00:00Z" }];
    rpc.mockResolvedValue({ data: { conflict: true, currentVersion: 6, current: { with_whom: "Theirs", renews_on: "2027-02-01" }, changed }, error: null });
    expect(await updateRenewal("f1", "r1", { withWhom: "Mine", renewsOn: "2027-01-01" }, 4)).toEqual({
      conflict: true, currentVersion: 6, current: { withWhom: "Theirs", renewsOn: "2027-02-01", notRenewedOn: null }, changed,
    });
  });
  // Catches: an answer that is neither a save nor a conflict taken as a save.
  it("is a failed save for an answer of another shape", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    expect(await caught(() => updateRenewal("f1", "r1", { withWhom: "A", renewsOn: "2027-01-01" }, 1))).toMatchObject({ kind: "failed" });
  });
});

describe("deleteRenewal", () => {
  // Catches: the version not sent, a delete told as done when someone saved first (nothing was deleted), or a conflict told as a failure.
  it("sends the version, and tells a delete from a conflict", async () => {
    rpc.mockResolvedValue({ data: { deleted: true, with_whom: "Justworks" }, error: null });
    expect(await deleteRenewal("f1", "r1", 2)).toEqual({ conflict: false });
    expect(rpc).toHaveBeenLastCalledWith("delete_renewal", { p_renewal_id: "r1", p_firm_id: "f1", p_version: 2 });
    rpc.mockResolvedValue({ data: { conflict: true, currentVersion: 3, current: { with_whom: "X", renews_on: "2027-01-01" }, changed: [] }, error: null });
    expect(await deleteRenewal("f1", "r1", 2)).toMatchObject({ conflict: true, currentVersion: 3 });
  });
  // Catches: the win's renewal deleted from the screen, or its refusal (PT409) shown as a lost connection.
  it("says a renewal a win made is deleted only by reopening that win", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "This renewal was made by a win. Reopen the win to delete it." } });
    expect(await caught(() => deleteRenewal("f1", "r1", 2))).toMatchObject({ kind: "taken", message: "This renewal was made by a win. Reopen the win to delete it." });
  });
});
