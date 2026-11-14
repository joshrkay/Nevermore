import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { fetchFirmMembers, removeMember, suspendMember, liftSuspension } = await import("./memberApi");

describe("the firm's members, as an owner asks the database for them", () => {
  beforeEach(() => rpc.mockReset());

  it("lists the members the database gives, with their role and whether they are current or suspended, and which one is the reader", async () => {
    rpc.mockResolvedValue({
      data: [
        { user_id: "u1", email: "owner@acme.example", role: "owner", state: "current", since: "2026-11-01T10:00:00Z", is_you: true },
        { user_id: "u2", email: "lead@acme.example", role: "lead", state: "suspended", since: "2026-11-05T10:00:00Z", is_you: false },
      ],
      error: null,
    });
    expect(await fetchFirmMembers("f1")).toEqual([
      { userId: "u1", email: "owner@acme.example", role: "owner", state: "current", since: "2026-11-01T10:00:00Z", isYou: true },
      { userId: "u2", email: "lead@acme.example", role: "lead", state: "suspended", since: "2026-11-05T10:00:00Z", isYou: false },
    ]);
    expect(rpc).toHaveBeenCalledWith("firm_members", { p_firm_id: "f1" });
  });

  it("says it is not allowed, rather than failing to load, when the database refuses", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only an owner of the firm can do that" } });
    await expect(fetchFirmMembers("f1")).rejects.toMatchObject({ forbidden: true, message: "Only an owner of the firm can see its members." });
  });

  it("fails with a plain message when the list can't be loaded", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(fetchFirmMembers("f1")).rejects.toMatchObject({ forbidden: false, message: "Couldn't load the members." });
  });
});

describe("removing, suspending and lifting", () => {
  beforeEach(() => rpc.mockReset());

  it.each([
    ["removes", removeMember, "remove_member"],
    ["suspends", suspendMember, "suspend_member"],
    ["lifts the suspension of", liftSuspension, "lift_member_suspension"],
  ] as const)("%s the person the owner chose, in the firm they named, by the database's function for it", async (_what, act, fn) => {
    rpc.mockResolvedValue({ data: null, error: null });
    await act("f1", "u2");
    expect(rpc).toHaveBeenCalledWith(fn, { p_firm_id: "f1", p_user_id: "u2" });
  });

  it("gives the database's own words when it keeps the last owner", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "The last owner of a firm can't be removed. Make someone else an owner first." } });
    await expect(removeMember("f1", "u2")).rejects.toThrow("The last owner of a firm can't be removed. Make someone else an owner first.");
  });

  it("says that only an owner can, when the database refuses", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "x" } });
    await expect(suspendMember("f1", "u2")).rejects.toThrow("Only an owner of the firm can do that.");
  });

  it("says the person is no longer there to act on when someone else got there first", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "x" } });
    await expect(removeMember("f1", "u2")).rejects.toThrow("That person's membership has already changed. Reload the list.");
  });

  it("gives the database's words when the owner tried to act on themselves or on someone already suspended", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "You can't remove yourself" } });
    await expect(removeMember("f1", "me")).rejects.toThrow("You can't remove yourself");
  });

  it("fails with a plain message for anything else", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(liftSuspension("f1", "u2")).rejects.toThrow("Couldn't do that. Try again.");
  });
});
