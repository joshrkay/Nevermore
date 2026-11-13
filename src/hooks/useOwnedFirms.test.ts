import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchOwnedFirms = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/advisorApi", () => ({ fetchOwnedFirms: () => fetchOwnedFirms() }));

const { loadOwnedFirms, clearOwnedFirms } = await import("./useOwnedFirms");

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
