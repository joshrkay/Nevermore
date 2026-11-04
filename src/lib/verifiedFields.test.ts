import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { fetchVerifiedFields } = await import("./verifiedFields");

describe("fetchVerifiedFields", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  beforeEach(() => {
    rpc.mockReset();
    warn.mockClear();
  });

  it("asks for the intake's verified fields and returns their names", async () => {
    rpc.mockResolvedValue({ data: ["census", "company_name"], error: null });
    expect([...(await fetchVerifiedFields("s1"))]).toEqual(["census", "company_name"]);
    expect(rpc).toHaveBeenCalledWith("session_verified_fields", { p_session_id: "s1" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns none, and only logs, when the answer is an error, malformed, or never comes", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
    expect((await fetchVerifiedFields("s1")).size).toBe(0);
    rpc.mockResolvedValueOnce({ data: "company_name", error: null });
    expect((await fetchVerifiedFields("s1")).size).toBe(0);
    rpc.mockRejectedValueOnce(new Error("offline"));
    expect((await fetchVerifiedFields("s1")).size).toBe(0);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("keeps only names", async () => {
    rpc.mockResolvedValue({ data: ["states", 7, null], error: null });
    expect([...(await fetchVerifiedFields("s1"))]).toEqual(["states"]);
  });
});
