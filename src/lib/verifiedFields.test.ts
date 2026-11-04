import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { fetchVerifiedFields, readVerifiedFields } = await import("./verifiedFields");

const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

describe("fetchVerifiedFields", () => {
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

describe("readVerifiedFields", () => {
  beforeEach(() => {
    rpc.mockReset();
    warn.mockClear();
  });

  it("says it couldn't read them (null), rather than that none are verified, so a caller can keep what it has", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Failed to fetch" } });
    expect(await readVerifiedFields("s1")).toBeNull();
    rpc.mockRejectedValueOnce(new Error("offline"));
    expect(await readVerifiedFields("s1")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("returns the names when it can, and an empty set when the answer is malformed", async () => {
    rpc.mockResolvedValueOnce({ data: ["states"], error: null });
    expect([...(await readVerifiedFields("s1"))!]).toEqual(["states"]);
    rpc.mockResolvedValueOnce({ data: "states", error: null });
    expect((await readVerifiedFields("s1"))!.size).toBe(0);
  });
});
