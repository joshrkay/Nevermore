import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { fetchFirmName, fetchIsMemberOfFirmAddress, recordFirmSignIn, signUpFirm, fetchWaitingFirms, decideFirm, fetchFirmStates, suspendFirm, liftFirmSuspension, fetchIsMySuspendedFirmAtAddress } = await import("./firmApi");

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

  it("says a firm is already waiting, not that the person must sign in", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "You already have a firm waiting for approval" } });
    await expect(signUpFirm("Fresh", "fresh")).rejects.toThrow("You already have a firm waiting for approval.");
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
      data: [{ firm_id: "f1", name: "Fresh", address: "fresh", signed_up_by_email: "o@example.test", signed_up_at: "2026-11-16T10:00:00Z" }],
      error: null,
    });
    expect(await fetchWaitingFirms()).toEqual([
      { id: "f1", name: "Fresh", address: "fresh", signedUpByEmail: "o@example.test", signedUpAt: "2026-11-16T10:00:00Z" },
    ]);
    expect(rpc).toHaveBeenCalledWith("admin_waiting_firms");
  });

  it("fails rather than showing an empty list when the database can't be reached", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(fetchWaitingFirms()).rejects.toThrow("Couldn't load the waiting firms.");
  });

  it("keeps an ended session and a lost admin role apart from any other failure, on both calls", async () => {
    for (const call of [() => fetchWaitingFirms(), () => decideFirm("f1", true)]) {
      rpc.mockResolvedValue({ data: null, error: { code: "PGRST301", message: "JWT expired" } });
      await expect(call()).rejects.toMatchObject({ unauthenticated: true, forbidden: false });
      rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Admin access required" } });
      await expect(call()).rejects.toMatchObject({ forbidden: true, unauthenticated: false });
      rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
      await expect(call()).rejects.toMatchObject({ forbidden: false, unauthenticated: false });
    }
  });

  it("reads a refusal as a refusal even when its words mention the token", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "jwt role is not admin" } });
    await expect(fetchWaitingFirms()).rejects.toMatchObject({ forbidden: true, unauthenticated: false });
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

  it("says a firm that no longer exists, in words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "That firm does not exist" } });
    await expect(decideFirm("f1", true)).rejects.toThrow("That firm no longer exists.");
  });

  it("says plainly when the caller may not decide", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Admin access required" } });
    await expect(decideFirm("f1", true)).rejects.toThrow("Only a platform admin who isn't a member of the firm can decide on it.");
  });
});

// Suspending a firm and lifting it (story CRM-P1.8): the database applies every rule; these only put its answers into words.
describe("a platform admin suspends a firm and lifts the suspension", () => {
  beforeEach(() => rpc.mockReset());

  it("lists every firm with its approval state and, for a suspended one, why and since when", async () => {
    rpc.mockResolvedValue({
      data: [
        { firm_id: "f1", name: "Fresh", address: "fresh", state: "approved", signed_up_at: "2026-11-16T10:00:00Z", suspended: true, suspended_at: "2026-11-17T09:00:00Z", suspension_reason: "Unpaid" },
        { firm_id: "f2", name: "Waiting", address: "waiting", state: "waiting", signed_up_at: "2026-11-16T11:00:00Z", suspended: false, suspended_at: null, suspension_reason: null },
      ],
      error: null,
    });
    expect(await fetchFirmStates()).toEqual([
      { id: "f1", name: "Fresh", address: "fresh", state: "approved", signedUpAt: "2026-11-16T10:00:00Z", suspended: true, suspendedAt: "2026-11-17T09:00:00Z", suspensionReason: "Unpaid" },
      { id: "f2", name: "Waiting", address: "waiting", state: "waiting", signedUpAt: "2026-11-16T11:00:00Z", suspended: false, suspendedAt: null, suspensionReason: null },
    ]);
    expect(rpc).toHaveBeenCalledWith("admin_firm_states");
  });

  it("keeps an ended session and a lost admin role apart from any other failure, on all three calls", async () => {
    for (const call of [() => fetchFirmStates(), () => suspendFirm("f1", "why"), () => liftFirmSuspension("f1")]) {
      rpc.mockResolvedValue({ data: null, error: { code: "PGRST301", message: "JWT expired" } });
      await expect(call()).rejects.toMatchObject({ unauthenticated: true, forbidden: false });
      rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Admin access required" } });
      await expect(call()).rejects.toMatchObject({ forbidden: true, unauthenticated: false });
      rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
      await expect(call()).rejects.toMatchObject({ forbidden: false, unauthenticated: false });
    }
  });

  it("suspends with the reason and lifts by the firm's id", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await suspendFirm("f1", "Unpaid invoice");
    expect(rpc).toHaveBeenLastCalledWith("admin_suspend_firm", { p_firm_id: "f1", p_reason: "Unpaid invoice" });
    await liftFirmSuspension("f1");
    expect(rpc).toHaveBeenLastCalledWith("admin_lift_firm_suspension", { p_firm_id: "f1" });
  });

  it("says in words that a firm is suspended already, is not suspended, no longer exists, or needs a reason", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "That firm is suspended already" } });
    await expect(suspendFirm("f1", "why")).rejects.toThrow("That firm is suspended already.");
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "That firm is not suspended" } });
    await expect(liftFirmSuspension("f1")).rejects.toThrow("That firm is not suspended.");
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "x" } });
    await expect(suspendFirm("f1", "why")).rejects.toThrow("That firm no longer exists.");
    await expect(liftFirmSuspension("f1")).rejects.toThrow("That firm no longer exists.");
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Give a reason of 1 to 500 characters" } });
    await expect(suspendFirm("f1", "")).rejects.toThrow("Give a reason of 1 to 500 characters.");
  });

  it("says plainly when the caller may not suspend or lift", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Admin access required" } });
    await expect(suspendFirm("f1", "why")).rejects.toThrow("Only a platform admin who isn't a member of the firm can suspend it.");
    await expect(liftFirmSuspension("f1")).rejects.toThrow("Only a platform admin who isn't a member of the firm can lift its suspension.");
  });
});

describe("asking whether the caller's firm at an address is suspended", () => {
  beforeEach(() => rpc.mockReset());

  it("asks for the address and answers true only for true", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await fetchIsMySuspendedFirmAtAddress("acme")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("my_suspended_firm_at_address", { p_address: "acme" });
    for (const data of [false, null, "true", 1]) {
      rpc.mockResolvedValue({ data, error: null });
      expect(await fetchIsMySuspendedFirmAtAddress("acme"), String(data)).toBe(false);
    }
  });

  it("fails rather than guessing when the database can't be reached", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(fetchIsMySuspendedFirmAtAddress("acme")).rejects.toThrow("Couldn't check whether this firm is suspended.");
  });
});
