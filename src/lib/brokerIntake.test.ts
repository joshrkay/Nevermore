import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

const { startBrokerIntake, inviteClient, remindClient, fetchIntakeInviteStatus, peekIntakeInvite, acceptIntakeInvite } = await import("./brokerIntake");

const refusedBy = (status: number, error: string) => ({ data: null, error: { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code", context: new Response(JSON.stringify({ error }), { status }) } });

describe("starting the intake of an opportunity", () => {
  beforeEach(() => { rpc.mockReset(); invoke.mockReset(); });

  // Break caught: the broker's screen names a firm (the database must take it from the opportunity and the caller's membership), or reads the intake id from the wrong place.
  it("asks the database for the intake of an opportunity and answers its id", async () => {
    rpc.mockResolvedValue({ data: { intake_id: "i1" }, error: null });
    expect(await startBrokerIntake("o1")).toEqual({ intakeId: "i1" });
    expect(rpc).toHaveBeenCalledWith("start_broker_intake", { p_opportunity_id: "o1" });
  });

  // Break caught: a refusal reaches the broker as a bare database code.
  it.each([
    ["PT404", /isn.t available/i],
    ["PT409", /already has an intake/i],
    ["55000", /archived/i],
    ["PT423", /closing/i],
    ["42501", /member of a firm/i],
  ])("says what %s means, in words", async (code, words) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "db words" } });
    await expect(startBrokerIntake("o1")).rejects.toThrow(words);
  });
});

describe("inviting the client, and Remind", () => {
  beforeEach(() => { rpc.mockReset(); invoke.mockReset(); });

  // Break caught: the broker's screen can't tell a link that was saved but not emailed from one that went.
  it("asks the server function to invite and says whether the email went", async () => {
    invoke.mockResolvedValue({ data: { ok: true, invitation_id: "v1", delivery: "sent" }, error: null });
    expect(await inviteClient({ intakeId: "i1", email: "lucia@client.test", name: "Lucia" })).toEqual({ invitationId: "v1", delivery: "sent" });
    expect(invoke).toHaveBeenCalledWith("invite-client", { body: { action: "invite", intake_id: "i1", email: "lucia@client.test", name: "Lucia" } });
  });

  // Break caught: an answer that does not say it went is reported as a success.
  it("never reports a delivery it was not told of as a success", async () => {
    invoke.mockResolvedValue({ data: { ok: true, invitation_id: "v1" }, error: null });
    expect((await remindClient("i1")).delivery).toBe("unknown");
    expect(invoke).toHaveBeenCalledWith("invite-client", { body: { action: "remind", intake_id: "i1" } });
  });

  it("gives the reason the server gave when it refuses", async () => {
    invoke.mockResolvedValue(refusedBy(409, "This intake already has an invitation waiting. Remind them instead."));
    await expect(inviteClient({ intakeId: "i1", email: "a@b.co" })).rejects.toThrow("This intake already has an invitation waiting. Remind them instead.");
  });
});

describe("where the invitation stands", () => {
  beforeEach(() => { rpc.mockReset(); });

  // Break caught: step 3 can't show when the client was invited or last opened the link, or reads a date as text.
  it("answers the state with the dates as dates", async () => {
    rpc.mockResolvedValue({ data: { state: "waiting", email: "lucia@client.test", contact_name: "Lucia", invited_at: "2026-11-20T10:00:00Z", last_opened_at: null, expires_at: "2026-12-04T10:00:00Z", send_count: 2, accepted_at: null, email_outcome: "sent" }, error: null });
    expect(await fetchIntakeInviteStatus("i1")).toEqual({
      state: "waiting", email: "lucia@client.test", contactName: "Lucia", invitedAt: new Date("2026-11-20T10:00:00Z"), lastOpenedAt: null,
      expiresAt: new Date("2026-12-04T10:00:00Z"), sendCount: 2, acceptedAt: null, delivery: "sent",
    });
    expect(rpc).toHaveBeenCalledWith("intake_invite_status", { p_intake_id: "i1" });
  });

  it("answers none for an intake nobody was invited about", async () => {
    rpc.mockResolvedValue({ data: { state: "none" }, error: null });
    expect(await fetchIntakeInviteStatus("i1")).toEqual({ state: "none" });
  });
});

describe("the employer opening the link", () => {
  beforeEach(() => { rpc.mockReset(); });

  // Break caught: the token itself goes to the database (it is meant to reach it only as its hash), or the page can't say whose invitation it is.
  it("peeks at the link with the token's hash and answers the firm's name and who it is for", async () => {
    rpc.mockResolvedValue({ data: [{ firm_name: "Acme Brokers", contact_name: "Lucia", expires_at: "2026-12-04T10:00:00Z" }], error: null });
    expect(await peekIntakeInvite("the-token", "acme-brokers")).toEqual({ firmName: "Acme Brokers", contactName: "Lucia" });
    const args = rpc.mock.calls[0][1] as { p_token_hash: string; p_firm_address: string };
    expect(rpc.mock.calls[0][0]).toBe("peek_intake_invite");
    expect(args.p_firm_address).toBe("acme-brokers");
    expect(args.p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("the-token");
  });

  // Break caught: a refused link reaches the employer as a bare code, or says something about whether an email has an account.
  it.each([
    ["PT404", "", /isn.t valid/i],
    ["PT410", "This link was replaced by a newer one. Use the latest email.", /replaced by a newer one/i],
    ["PT410", "This invitation has expired", /has expired/i],
    ["PT410", "This invitation has already been used", /already been used/i],
    ["PT422", "", /different firm's address/i],
  ])("says what %s means (%s)", async (code, message, words) => {
    rpc.mockResolvedValue({ data: null, error: { code, message } });
    await expect(peekIntakeInvite("t", "acme-brokers")).rejects.toThrow(words);
  });

  // Break caught: accepting hands the page the wrong intake, or names the token to the database.
  it("accepts with the hash and answers the intake that is now theirs", async () => {
    rpc.mockResolvedValue({ data: { intake_id: "i1", firm_address: "acme-brokers" }, error: null });
    expect(await acceptIntakeInvite("the-token", "acme-brokers")).toEqual({ intakeId: "i1" });
    expect(rpc.mock.calls[0][0]).toBe("accept_intake_invite");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("the-token");
  });

  // Break caught: a member of the firm, another address, an open intake and an unverified sign-in all read as "try again".
  it.each([
    ["PT403", "This invitation was sent to a different email address than the one you are signed in with", /different email address/i],
    ["PT403", "A member of the firm can't take the employer's place", /member of the firm/i],
    ["PT409", "You already have an intake in progress", /intake in progress/i],
    ["42501", "Sign in with a verified email", /verified email/i],
  ])("says why accepting was refused (%s)", async (code, message, words) => {
    rpc.mockResolvedValue({ data: null, error: { code, message } });
    await expect(acceptIntakeInvite("t", "acme-brokers")).rejects.toThrow(words);
  });
});
