import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) }, from: (...a: unknown[]) => from(...a) } }));

const { inviteMember, resendInvitation, cancelInvitation, fetchPendingInvitations, acceptInvitation, fetchMyFirm } = await import("./invitationApi");

const refusedBy = (status: number, error: string) => ({ data: null, error: { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code", context: new Response(JSON.stringify({ error }), { status }) } });

describe("inviting and resending", () => {
  beforeEach(() => { rpc.mockReset(); invoke.mockReset(); });

  it("asks the server function to invite, with the firm, email, role and team, and says whether the email went", async () => {
    invoke.mockResolvedValue({ data: { ok: true, invitation_id: "i1", emailed: true }, error: null });
    expect(await inviteMember({ firmId: "f1", email: "a@b.co", role: "lead", teamId: "t1" })).toEqual({ invitationId: "i1", emailed: true });
    expect(invoke).toHaveBeenCalledWith("invite-member", { body: { action: "invite", firm_id: "f1", email: "a@b.co", role: "lead", team_id: "t1" } });
  });

  it("says an invitation was saved but its email did not go", async () => {
    invoke.mockResolvedValue({ data: { ok: true, invitation_id: "i1", emailed: false }, error: null });
    expect((await inviteMember({ firmId: "f1", email: "a@b.co", role: "agent" })).emailed).toBe(false);
  });

  it("gives the reason the server gave when it refuses, such as an email already invited", async () => {
    invoke.mockResolvedValue(refusedBy(409, "That email already has a pending invitation to this firm. Resend it instead."));
    await expect(inviteMember({ firmId: "f1", email: "a@b.co", role: "agent" })).rejects.toThrow("That email already has a pending invitation to this firm. Resend it instead.");
  });

  it("falls back to a plain message when the server's reply can't be read", async () => {
    invoke.mockResolvedValue({ data: null, error: { name: "FunctionsFetchError", message: "network", context: undefined } });
    await expect(inviteMember({ firmId: "f1", email: "a@b.co", role: "agent" })).rejects.toThrow("Couldn't send the invitation. Try again.");
  });

  it("asks the server function to resend one invitation", async () => {
    invoke.mockResolvedValue({ data: { ok: true, invitation_id: "i1", emailed: true }, error: null });
    expect(await resendInvitation("i1")).toEqual({ invitationId: "i1", emailed: true });
    expect(invoke).toHaveBeenCalledWith("invite-member", { body: { action: "resend", invitation_id: "i1" } });
  });
});

describe("the owner's list, and withdrawing", () => {
  beforeEach(() => { rpc.mockReset(); invoke.mockReset(); });

  it("lists pending invitations in the shape the page shows", async () => {
    rpc.mockResolvedValue({
      data: [{ invitation_id: "i1", email: "a@b.co", role: "agent", team_id: null, invited_at: "2026-11-16T10:00:00Z", expires_at: "2026-11-23T10:00:00Z", expired: false, resent_at: null, email_sent_at: "2026-11-16T10:00:01Z", email_error: null }],
      error: null,
    });
    expect(await fetchPendingInvitations("f1")).toEqual([
      { id: "i1", email: "a@b.co", role: "agent", invitedAt: "2026-11-16T10:00:00Z", expiresAt: "2026-11-23T10:00:00Z", expired: false, resentAt: null, emailSent: true, emailError: null },
    ]);
    expect(rpc).toHaveBeenCalledWith("firm_pending_invitations", { p_firm_id: "f1" });
  });

  it("says an invitation whose email has not gone out has not been sent", async () => {
    rpc.mockResolvedValue({ data: [{ invitation_id: "i1", email: "a@b.co", role: "agent", team_id: null, invited_at: "x", expires_at: "y", expired: false, resent_at: null, email_sent_at: null, email_error: "provider_error" }], error: null });
    const [one] = await fetchPendingInvitations("f1");
    expect(one.emailSent).toBe(false);
    expect(one.emailError).toBe("provider_error");
  });

  it("says only owners can read the list when the database refuses", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only an owner of the firm can do that" } });
    await expect(fetchPendingInvitations("f1")).rejects.toThrow("Only an owner of the firm can see invitations.");
  });

  it("withdraws an invitation by its id", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await cancelInvitation("i1");
    expect(rpc).toHaveBeenCalledWith("cancel_invitation", { p_invitation_id: "i1" });
  });

  it("says an invitation already used or withdrawn is, and that only owners can withdraw", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT410", message: "x" } });
    await expect(cancelInvitation("i1")).rejects.toThrow("That invitation has already been used or withdrawn.");
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "x" } });
    await expect(cancelInvitation("i1")).rejects.toThrow("Only an owner of the firm can withdraw an invitation.");
  });
});

describe("accepting an invitation", () => {
  beforeEach(() => { rpc.mockReset(); invoke.mockReset(); });

  it("gives the database the token's hash and never the token itself", async () => {
    rpc.mockResolvedValue({ data: [{ firm_id: "f1", firm_address: "acme-brokers", role: "agent" }], error: null });
    expect(await acceptInvitation("abc")).toEqual({ firmAddress: "acme-brokers", role: "agent" });
    expect(rpc).toHaveBeenCalledWith("accept_invitation", { p_token_hash: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('"abc"');
  });

  it("says in plain words why a link can't be used, and nothing about any account", async () => {
    const cases: [string, string, string][] = [
      ["PT404", "This invitation link is not valid", "This invitation link isn't valid. Ask the person who invited you to send a new one."],
      ["PT410", "This invitation has expired", "This invitation has expired. Ask the person who invited you to send a new one."],
      ["PT410", "This invitation was withdrawn", "This invitation was withdrawn. Ask the person who invited you to send a new one."],
      ["PT410", "This invitation has already been used", "This invitation has already been used."],
      ["PT403", "x", "This invitation was sent to a different email address than the one you are signed in with. Sign out, then sign in or create your account with the address it was sent to."],
      ["PT409", "x", "You're already a member of this firm."],
      ["42501", "x", "Sign in with a verified email address to accept an invitation."],
    ];
    for (const [code, message, want] of cases) {
      rpc.mockResolvedValue({ data: null, error: { code, message } });
      await expect(acceptInvitation("abc"), message).rejects.toThrow(want);
    }
  });

  it("says it could not be accepted for anything else", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(acceptInvitation("abc")).rejects.toThrow("Couldn't accept the invitation. Try again.");
  });
});

describe("finding the firm at an address, and the caller's place in it", () => {
  const firmsTable = (result: { data: unknown; error: unknown }) => {
    const eq = vi.fn(() => ({ maybeSingle: async () => result }));
    from.mockReturnValue({ select: () => ({ eq }) });
    return eq;
  };
  beforeEach(() => { rpc.mockReset(); from.mockReset(); });

  it("reads the firm at the address and asks the database for the caller's own role in it", async () => {
    const eq = firmsTable({ data: { id: "f1", name: "Acme Brokers" }, error: null });
    rpc.mockResolvedValue({ data: "owner", error: null });
    expect(await fetchMyFirm("acme-brokers")).toEqual({ id: "f1", name: "Acme Brokers", role: "owner" });
    expect(from).toHaveBeenCalledWith("firms");
    expect(eq).toHaveBeenCalledWith("address", "acme-brokers");
    expect(rpc).toHaveBeenCalledWith("firm_role", { p_firm_id: "f1" });
  });

  it("has no role when the database gives none", async () => {
    firmsTable({ data: { id: "f1", name: "Acme Brokers" }, error: null });
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await fetchMyFirm("acme-brokers"))?.role).toBeNull();
  });

  it("finds nothing at an address whose firm the caller can't read, and asks nothing more", async () => {
    firmsTable({ data: null, error: null });
    expect(await fetchMyFirm("elsewhere")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails, rather than saying there is no firm, when either question fails", async () => {
    firmsTable({ data: null, error: { message: "boom" } });
    await expect(fetchMyFirm("acme-brokers")).rejects.toThrow("Couldn't load your firm.");
    firmsTable({ data: { id: "f1", name: "Acme Brokers" }, error: null });
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(fetchMyFirm("acme-brokers")).rejects.toThrow("Couldn't load your firm.");
  });
});
