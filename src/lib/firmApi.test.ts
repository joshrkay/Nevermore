import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { fetchFirmName, fetchIsMemberOfFirmAddress, recordFirmSignIn } = await import("./firmApi");

describe("asking the database about a firm address", () => {
  beforeEach(() => rpc.mockReset());

  it("asks for the name an address shows, and gets the name", async () => {
    rpc.mockResolvedValue({ data: "Acme Brokers", error: null });
    expect(await fetchFirmName("acme-brokers")).toBe("Acme Brokers");
    expect(rpc).toHaveBeenCalledWith("firm_public_name", { p_address: "acme-brokers" });
  });

  it("gets null when the database answers with anything but a name", async () => {
    for (const data of [42, true, {}]) {
      rpc.mockResolvedValue({ data, error: null });
      expect(await fetchFirmName("acme-brokers"), String(data)).toBeNull();
    }
  });

  it("gets null for an address with no firm to show, however the database words it", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await fetchFirmName("nobody-here")).toBeNull();
  });

  it("fails, rather than saying the firm does not exist, when the database can't be reached", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(fetchFirmName("acme-brokers")).rejects.toThrow();
    await expect(fetchIsMemberOfFirmAddress("acme-brokers")).rejects.toThrow();
  });

  it("asks whether the caller is a member, and only a plain true counts", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await fetchIsMemberOfFirmAddress("acme-brokers")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("is_member_of_firm_address", { p_address: "acme-brokers" });
    for (const data of [false, null, "true", 1]) {
      rpc.mockResolvedValue({ data, error: null });
      expect(await fetchIsMemberOfFirmAddress("acme-brokers"), String(data)).toBe(false);
    }
  });
});

describe("reporting a sign-in to the firm at an address", () => {
  beforeEach(() => rpc.mockReset());

  it("asks the database for the firm at the address, then reports a sign-in to that firm by its id alone", async () => {
    rpc.mockResolvedValueOnce({ data: "firm-1", error: null }).mockResolvedValueOnce({ data: null, error: null });
    await expect(recordFirmSignIn("acme-brokers")).resolves.toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(1, "my_firm_at_address", { p_address: "acme-brokers" });
    expect(rpc).toHaveBeenNthCalledWith(2, "record_member_activity", { p_kind: "sign_in", p_record_type: "firm", p_record_id: "firm-1" });
  });

  it("reports nothing when the caller isn't a member (no firm comes back)", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(recordFirmSignIn("acme-brokers")).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("says it wasn't written, and never throws, when the database refuses or can't be reached", async () => {
    rpc.mockResolvedValueOnce({ data: "firm-1", error: null }).mockResolvedValueOnce({ data: null, error: { message: "Sign in to continue", code: "42501" } });
    await expect(recordFirmSignIn("acme-brokers")).resolves.toBe(false);
    rpc.mockRejectedValueOnce(new Error("offline"));
    await expect(recordFirmSignIn("acme-brokers")).resolves.toBe(false);
  });
});
