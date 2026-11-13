import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { fetchFirmName, fetchIsMemberOfFirmAddress } = await import("./firmApi");

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
