import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchOwnedFirms = vi.fn();
const fetchMyFirms = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/advisorApi", () => ({ fetchOwnedFirms: () => fetchOwnedFirms(), fetchMyFirms: () => fetchMyFirms() }));

const { loadOwnedFirms, clearOwnedFirms, loadMyFirms, clearMyFirms } = await import("./useOwnedFirms");

const alpha = [{ firm_id: "f1", name: "Alpha" }];

// The header link, the page guard and the page itself all ask which firms the person owns; one load of a page asks once.
describe("loadOwnedFirms", () => {
  beforeEach(() => {
    clearOwnedFirms();
    fetchOwnedFirms.mockReset().mockResolvedValue(alpha);
  });

  it("asks the database once for the same person, however many places ask at the same time", async () => {
    const answers = await Promise.all([loadOwnedFirms("u1"), loadOwnedFirms("u1"), loadOwnedFirms("u1")]);
    expect(answers).toEqual([alpha, alpha, alpha]);
    expect(fetchOwnedFirms).toHaveBeenCalledTimes(1);
  });

  it("asks again for another person, so one person's answer is never given to the next to sign in", async () => {
    await loadOwnedFirms("u1");
    fetchOwnedFirms.mockResolvedValue([]);
    expect(await loadOwnedFirms("u2")).toEqual([]);
    expect(fetchOwnedFirms).toHaveBeenCalledTimes(2);
  });

  it("asks again once the sign-in has changed, such as after the second factor: an answer given before it is not kept", async () => {
    fetchOwnedFirms.mockResolvedValue([]);
    expect(await loadOwnedFirms("u1", "password-token")).toEqual([]);
    fetchOwnedFirms.mockResolvedValue(alpha);
    expect(await loadOwnedFirms("u1", "second-factor-token")).toEqual(alpha);
    expect(fetchOwnedFirms).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failure: the next ask goes to the database again", async () => {
    fetchOwnedFirms.mockRejectedValueOnce(new Error("offline"));
    await expect(loadOwnedFirms("u1")).rejects.toThrow("offline");
    expect(await loadOwnedFirms("u1")).toEqual(alpha);
    expect(fetchOwnedFirms).toHaveBeenCalledTimes(2);
  });

  it("does not keep an answer for long: ownership that ended is asked about again", async () => {
    vi.useFakeTimers();
    try {
      await loadOwnedFirms("u1");
      vi.advanceTimersByTime(60_000);
      await loadOwnedFirms("u1");
      expect(fetchOwnedFirms).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

// The guard, the header and the page each need to know which firms the person belongs to; one load of a page asks once.
describe("loadMyFirms", () => {
  const mine = [{ firm_id: "f1", name: "Alpha", address: "alpha", role: "agent" }];
  beforeEach(() => {
    clearMyFirms();
    clearOwnedFirms();
    fetchMyFirms.mockReset().mockResolvedValue(mine);
    fetchOwnedFirms.mockReset().mockResolvedValue(alpha);
  });

  it("asks the database once however many places ask at the same time, and keeps it apart from the owned firms", async () => {
    expect(await Promise.all([loadMyFirms("u1"), loadMyFirms("u1")])).toEqual([mine, mine]);
    expect(await loadOwnedFirms("u1")).toEqual(alpha);
    expect(fetchMyFirms).toHaveBeenCalledTimes(1);
    expect(fetchOwnedFirms).toHaveBeenCalledTimes(1);
  });

  it("asks again for another person, and once the sign-in has changed, such as after the second factor", async () => {
    fetchMyFirms.mockResolvedValue([]);
    expect(await loadMyFirms("u1", "password-token")).toEqual([]);
    fetchMyFirms.mockResolvedValue(mine);
    expect(await loadMyFirms("u1", "second-factor-token")).toEqual(mine);
    expect(await loadMyFirms("u2", "second-factor-token")).toEqual(mine);
    expect(fetchMyFirms).toHaveBeenCalledTimes(3);
  });

  it("does not keep a failure", async () => {
    fetchMyFirms.mockRejectedValueOnce(new Error("offline"));
    await expect(loadMyFirms("u1")).rejects.toThrow("offline");
    expect(await loadMyFirms("u1")).toEqual(mine);
  });
});
