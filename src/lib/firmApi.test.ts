import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { fetchFirmName, fetchIsMemberOfFirmAddress, signUpFirm, fetchWaitingFirms, decideFirm } = await import("./firmApi");

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

describe("signing up a firm", () => {
  beforeEach(() => rpc.mockReset());

  it("sends the name and the address as typed, and gets the firm's id", async () => {
    rpc.mockResolvedValue({ data: "firm-1", error: null });
    expect(await signUpFirm("Fresh Benefits", "Fresh-Benefits")).toBe("firm-1");
    expect(rpc).toHaveBeenCalledWith("sign_up_firm", { p_name: "Fresh Benefits", p_address: "Fresh-Benefits" });
  });

  it("says an address is taken, in words, for a unique violation", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } });
    await expect(signUpFirm("Fresh", "taken")).rejects.toThrow("That address is taken. Choose another.");
  });

  it("gives the database's own reason when a rule refuses the name or address", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "A firm address can't read as a PEO (Justworks)" } });
    await expect(signUpFirm("Fresh", "justworks")).rejects.toThrow("A firm address can't read as a PEO (Justworks)");
  });

  it("explains a refused address without leaking the constraint's name", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: 'new row for relation "firms" violates check constraint "firms_address_check"' } });
    await expect(signUpFirm("Fresh", "www")).rejects.toThrow(
      "That address can't be used. Use 3 to 40 letters, digits or hyphens, not starting or ending with a hyphen, and not a reserved word or the name of Nevermore.",
    );
  });

  it("asks the person to sign in with a verified email when the database refuses the caller", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Sign in with a verified email to sign up a firm" } });
    await expect(signUpFirm("Fresh", "fresh")).rejects.toThrow("Sign in with a verified email to sign up a firm.");
  });

  it("says it could not sign the firm up for anything else", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(signUpFirm("Fresh", "fresh")).rejects.toThrow("Couldn't sign your firm up. Try again.");
  });
});

describe("the platform admin's firm approvals", () => {
  beforeEach(() => rpc.mockReset());

  it("lists the waiting firms in the shape the page shows", async () => {
    rpc.mockResolvedValue({
      data: [{ firm_id: "f1", name: "Fresh", address: "fresh", owner_email: "o@example.test", signed_up_at: "2026-11-16T10:00:00Z" }],
      error: null,
    });
    expect(await fetchWaitingFirms()).toEqual([
      { id: "f1", name: "Fresh", address: "fresh", ownerEmail: "o@example.test", signedUpAt: "2026-11-16T10:00:00Z" },
    ]);
    expect(rpc).toHaveBeenCalledWith("admin_waiting_firms");
  });

  it("fails rather than showing an empty list when the database can't be reached", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(fetchWaitingFirms()).rejects.toThrow("Couldn't load the waiting firms.");
  });

  it("approves or refuses with a note, and trims nothing the database trims itself", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await decideFirm("f1", true, "Known");
    expect(rpc).toHaveBeenLastCalledWith("admin_decide_firm", { p_firm_id: "f1", p_approve: true, p_note: "Known" });
    await decideFirm("f1", false);
    expect(rpc).toHaveBeenLastCalledWith("admin_decide_firm", { p_firm_id: "f1", p_approve: false, p_note: null });
  });

  it("says a firm has been decided already, in words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "That firm has been decided already" } });
    await expect(decideFirm("f1", true)).rejects.toThrow("That firm has been decided already.");
  });

  it("says plainly when the caller may not decide", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Admin access required" } });
    await expect(decideFirm("f1", true)).rejects.toThrow("Only a platform admin who isn't a member of the firm can decide on it.");
  });
});
