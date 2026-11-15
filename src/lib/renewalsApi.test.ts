import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { listAccountRenewals, addRenewal, updateRenewal, deleteRenewal, linkRenewalOpportunity, RenewalError } = await import("./renewalsApi");

const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected a failure");
};
const refused = (code: string, message = "refused") => ({ data: null, error: { code, message } });

const fields = {
  id: "r1", version: 2, account_id: "a1", kind: "peo_placement", with_whom: "Gusto PEO", renews_on: "2027-06-01", placement_id: "p1", opportunity_id: null,
  not_renewed_on: null, created_at: "2026-11-15T00:00:00Z", updated_at: "2026-11-15T00:00:00Z",
};
const listed = {
  count: 2, can_add: true, can_change: false, archived: false,
  rows: [
    { id: "r1", version: 2, kind: "peo_placement", with_whom: "Gusto PEO", renews_on: "2027-06-01", days_away: 198, state: "working", done: false, overdue: false,
      opportunity: { id: "o1", name: "June 2027 renewal", stage: "qualifying" }, placement_id: "p1", from_win: false, not_renewed_on: null },
    { id: "r2", version: 1, kind: "current_plan", with_whom: "Carrier", renews_on: "2026-11-03", days_away: -12, state: "open", done: false, overdue: true,
      opportunity: null, placement_id: null, from_win: false, not_renewed_on: null },
  ],
};

beforeEach(() => rpc.mockReset());

describe("renewalsApi", () => {
  // Catches: the firm or the caller's time zone left off the call (days away would be counted from the wrong day), or a column the database does not have.
  it("asks for the account's renewals in the caller's time zone, in the firm named", async () => {
    rpc.mockResolvedValue({ data: listed, error: null });
    const r = await listAccountRenewals("f1", "a1", "Europe/Paris");
    expect(rpc).toHaveBeenCalledWith("account_renewals", { p_firm_id: "f1", p_account_id: "a1", p_time_zone: "Europe/Paris" });
    expect(r?.rows.map((x) => [x.withWhom, x.daysAway, x.overdue, x.state])).toEqual([["Gusto PEO", 198, false, "working"], ["Carrier", -12, true, "open"]]);
    expect(r?.rows[0].opportunity).toEqual({ id: "o1", name: "June 2027 renewal", stage: "qualifying" });
    expect(r?.canAdd).toBe(true);
    expect(r?.canChange).toBe(false);
  });

  // Catches: an account the person may not see read as an empty list (it says "No renewal on file" about an account that may well have some).
  it("reads no answer as no account, not as no renewals", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await listAccountRenewals("f1", "a1", "UTC")).toBeNull();
  });

  // Catches: a malformed answer shown as a list (a state nobody knows, a date that is not a day, a missing count).
  it.each([
    ["a state nobody knows", { ...listed, rows: [{ ...listed.rows[0], state: "maybe" }] }],
    ["a date that is not a day", { ...listed, rows: [{ ...listed.rows[0], renews_on: "June" }] }],
    ["no count", { rows: [] }],
    ["days away as text", { ...listed, rows: [{ ...listed.rows[0], days_away: "198" }] }],
  ])("refuses %s", async (_label, data) => {
    rpc.mockResolvedValue({ data, error: null });
    const e = await caught(() => listAccountRenewals("f1", "a1", "UTC"));
    expect(e).toBeInstanceOf(RenewalError);
    expect((e as InstanceType<typeof RenewalError>).kind).toBe("failed");
  });

  // Catches: the start date sent for the employer's plan, or dropped for a PEO placement; the placement a hand-added PEO renewal made not reported.
  it("adds a renewal and reports the placement it made", async () => {
    rpc.mockResolvedValue({ data: { record: fields, placement_id: "p1" }, error: null });
    const r = await addRenewal("f1", "a1", { kind: "peo_placement", withWhom: "Gusto PEO", renewsOn: "2027-06-01", startDate: "2026-06-01" });
    expect(rpc).toHaveBeenCalledWith("renewal_add", {
      p_account_id: "a1", p_kind: "peo_placement", p_with_whom: "Gusto PEO", p_renews_on: "2027-06-01", p_start_date: "2026-06-01", p_firm_id: "f1",
    });
    expect(r.placementId).toBe("p1");
    expect(r.renewal).toMatchObject({ id: "r1", version: 2, withWhom: "Gusto PEO", renewsOn: "2027-06-01" });
    await addRenewal("f1", "a1", { kind: "current_plan", withWhom: "Carrier", renewsOn: "2027-06-01" });
    expect(rpc).toHaveBeenLastCalledWith("renewal_add", expect.objectContaining({ p_start_date: null }));
  });

  // Catches: the version left off a save (it would overwrite), "Didn't renew" lost, or a conflict read as a failure.
  it("saves from a version, with the day it did not renew, and reads a conflict as an answer", async () => {
    rpc.mockResolvedValue({ data: { conflict: false, record: { ...fields, version: 3, not_renewed_on: "2027-06-01" } }, error: null });
    const saved = await updateRenewal("f1", "r1", { withWhom: "Gusto PEO", renewsOn: "2027-06-01", notRenewedOn: "2027-06-01" }, 2);
    expect(rpc).toHaveBeenCalledWith("renewal_update", {
      p_renewal_id: "r1", p_with_whom: "Gusto PEO", p_renews_on: "2027-06-01", p_not_renewed_on: "2027-06-01", p_firm_id: "f1", p_version: 2,
    });
    expect(saved).toMatchObject({ conflict: false, renewal: { version: 3, notRenewedOn: "2027-06-01" } });

    rpc.mockResolvedValue({
      data: { conflict: true, currentVersion: 4, current: { with_whom: "Other", renews_on: "2027-07-01", not_renewed_on: null }, changed: [{ field: "with_whom", value: "Other", who: "a@b.test", at: "2026-11-15T00:00:00Z" }] },
      error: null,
    });
    const conflict = await updateRenewal("f1", "r1", { withWhom: "Mine", renewsOn: "2027-06-01", notRenewedOn: null }, 2);
    expect(conflict).toMatchObject({ conflict: true, currentVersion: 4, current: { withWhom: "Other", renewsOn: "2027-07-01", notRenewedOn: null } });
  });

  it("deletes a renewal and says whether its placement went too, and names the opportunity when linking", async () => {
    rpc.mockResolvedValue({ data: { deleted: true, placement_deleted: true }, error: null });
    expect(await deleteRenewal("f1", "r1")).toEqual({ placementDeleted: true });
    expect(rpc).toHaveBeenLastCalledWith("renewal_delete", { p_renewal_id: "r1", p_firm_id: "f1" });
    rpc.mockResolvedValue({ data: { record: { ...fields, opportunity_id: "o1" } }, error: null });
    expect((await linkRenewalOpportunity("f1", "r1", "o1")).opportunityId).toBe("o1");
    expect(rpc).toHaveBeenLastCalledWith("renewal_link_opportunity", { p_renewal_id: "r1", p_opportunity_id: "o1", p_firm_id: "f1" });
  });

  // Catches: a refusal whose words are lost, or a renewal a win made not told apart from a failure (the screen says to reopen the win).
  it.each([
    ["PT404", "notFound"], ["PT423", "readOnly"], ["22023", "invalid"], ["42501", "notAllowed"], ["55000", "archived"], ["PT409", "fromWin"], ["XX000", "failed"],
  ])("reads %s as %s", async (code, kind) => {
    rpc.mockResolvedValue(refused(code, "In words."));
    const e = await caught(() => deleteRenewal("f1", "r1"));
    expect(e).toBeInstanceOf(RenewalError);
    expect((e as InstanceType<typeof RenewalError>).kind).toBe(kind);
    if (code !== "XX000" && code !== "PT404") expect((e as Error).message).toBe("In words.");
  });
});
