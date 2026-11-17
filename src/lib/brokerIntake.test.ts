import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

const api = await import("./brokerIntake");

beforeEach(() => { rpc.mockReset(); invoke.mockReset(); });

describe("starting the intake of an opportunity", () => {
  // Break caught: the screen names a firm, or reads the intake id from the wrong place.
  it("asks the database for the intake of an opportunity and answers its id", async () => {
    rpc.mockResolvedValue({ data: { intake_id: "i1" }, error: null });
    expect(await api.startBrokerIntake("o1")).toEqual({ intakeId: "i1" });
    expect(rpc).toHaveBeenCalledWith("start_broker_intake", { p_opportunity_id: "o1" });
  });
});
describe("what the database refuses when an intake is started", () => {
  // Break caught: a refusal reaches the broker as a bare error, or an opportunity that isn't there is told apart from one the caller may not see.
  it("says an opportunity that is not available is not available (PT404)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "db words" } });
    await expect(api.startBrokerIntake("o1")).rejects.toThrow("That opportunity isn't available.");
  });

  // Break caught: a second start on an opportunity reads as "not available" and the broker looks for the wrong problem.
  it("says an opportunity that already has an intake has one (PT409)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "db words" } });
    await expect(api.startBrokerIntake("o1")).rejects.toThrow("This opportunity already has an intake.");
  });

  // Break caught: an archived account's refusal reads as a missing opportunity.
  it("says an archived account takes nothing (55000)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "db words" } });
    await expect(api.startBrokerIntake("o1")).rejects.toThrow("This account is archived. Nothing can be added to it.");
  });

  // Break caught: a closing firm's refusal reads as a missing opportunity.
  it("says a closing firm can't be changed (PT423)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT423", message: "db words" } });
    await expect(api.startBrokerIntake("o1")).rejects.toThrow("This firm is closing and can't be changed.");
  });

  // Break caught: a caller with no firm is told the opportunity is missing.
  it("says a caller who is no member of a firm needs to be (42501)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "db words" } });
    await expect(api.startBrokerIntake("o1")).rejects.toThrow("You need to be a member of a firm to start an intake.");
  });

  // Break caught: a member of two firms is told the opportunity is missing instead of being asked which firm.
  it("asks a member of more than one firm to say which (22023)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "db words" } });
    await expect(api.startBrokerIntake("o1")).rejects.toThrow("You belong to more than one firm. Say which.");
  });

  // Break caught: a failure nobody planned for is blamed on the opportunity.
  it("tells the broker to try again for a failure it has no words for", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "db words" } });
    await expect(api.startBrokerIntake("o1")).rejects.toThrow("Couldn't start the intake. Try again.");
  });

  // Break caught: an answer with no intake in it sends the broker to an intake called "undefined".
  it("never reports a start that answered no intake as a success", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(api.startBrokerIntake("o1")).rejects.toThrow("Couldn't start the intake. Try again.");
  });
});
const refusedBy = (status: number, error: string) => ({ data: null, error: { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code", context: new Response(JSON.stringify({ error }), { status }) } });

describe("inviting the client", () => {
  // Break caught: the screen can't tell a link that was saved but not emailed from one that went, or names the wrong function or fields.
  it("asks the server function to invite and says whether the email went", async () => {
    invoke.mockResolvedValue({ data: { ok: true, invitation_id: "v1", delivery: "sent" }, error: null });
    expect(await api.inviteClient({ intakeId: "i1", email: "lucia@client.test", name: "Lucia" })).toEqual({ invitationId: "v1", delivery: "sent" });
    expect(invoke).toHaveBeenCalledWith("invite-client", { body: { action: "invite", intake_id: "i1", email: "lucia@client.test", name: "Lucia" } });
  });
});

describe("Remind", () => {
  // Break caught: Remind names the invite action (making a second invitation that the database refuses), or the wrong intake.
  it("asks the server function to remind about the intake", async () => {
    invoke.mockResolvedValue({ data: { ok: true, invitation_id: "v2", delivery: "sent" }, error: null });
    expect(await api.remindClient("i1")).toEqual({ invitationId: "v2", delivery: "sent" });
    expect(invoke).toHaveBeenCalledWith("invite-client", { body: { action: "remind", intake_id: "i1" } });
  });

  // Break caught: an answer that does not say the email went is reported as a success.
  it("never reports a delivery it was not told of as sent", async () => {
    invoke.mockResolvedValue({ data: { ok: true, invitation_id: "v2" }, error: null });
    expect((await api.remindClient("i1")).delivery).toBe("unknown");
  });

  // Break caught: a send the provider refused reads as unknown, so the broker is never told to send it again.
  it("tells a refused send as failed", async () => {
    invoke.mockResolvedValue({ data: { ok: true, invitation_id: "v2", delivery: "failed" }, error: null });
    expect((await api.remindClient("i1")).delivery).toBe("failed");
  });

  // Break caught: the server's refusal reaches the broker as "Edge Function returned a non-2xx status code".
  it("gives the reason the server gave when it refuses", async () => {
    invoke.mockResolvedValue(refusedBy(409, "This intake already has an invitation waiting. Remind them instead."));
    await expect(api.inviteClient({ intakeId: "i1", email: "a@b.co" })).rejects.toThrow("This intake already has an invitation waiting. Remind them instead.");
  });

  // Break caught: a failure with no readable reason (a network error) reaches the broker as an empty message.
  it("tells the broker to try again when the server's reason can't be read", async () => {
    invoke.mockResolvedValue({ data: null, error: { name: "FunctionsFetchError", message: "Failed to send a request" } });
    await expect(api.remindClient("i1")).rejects.toThrow("Couldn't send the invitation. Try again.");
  });

  // Break caught: an answer with no invitation in it is shown as an invitation that was made.
  it("never reports an answer with no invitation as a success", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(api.inviteClient({ intakeId: "i1", email: "a@b.co" })).rejects.toThrow("Couldn't send the invitation. Try again.");
  });
});
describe("where the invitation stands", () => {
  // Break caught: an intake nobody was invited about is shown as waiting on someone.
  it("answers none for an intake nobody was invited about", async () => {
    rpc.mockResolvedValue({ data: { state: "none" }, error: null });
    expect(await api.fetchIntakeInviteStatus("i1")).toEqual({ state: "none" });
    expect(rpc).toHaveBeenCalledWith("intake_invite_status", { p_intake_id: "i1" });
  });

  // Break caught: step 3 can't show when the client was invited or last opened the link, or shows a date as text.
  it("answers a waiting invitation with its dates as dates", async () => {
    rpc.mockResolvedValue({ data: { state: "waiting", email: "lucia@client.test", contact_name: "Lucia", invited_at: "2026-11-20T10:00:00Z", last_opened_at: null, expires_at: "2026-12-04T10:00:00Z", send_count: 2, accepted_at: null, email_outcome: "sent" }, error: null });
    expect(await api.fetchIntakeInviteStatus("i1")).toEqual({
      state: "waiting", email: "lucia@client.test", contactName: "Lucia", invitedAt: new Date("2026-11-20T10:00:00Z"), lastOpenedAt: null,
      expiresAt: new Date("2026-12-04T10:00:00Z"), sendCount: 2, acceptedAt: null, delivery: "sent",
    });
  });

  // Break caught: step 3 keeps showing an accepted invitation as waiting, or loses when it was accepted.
  it("answers an accepted invitation as accepted, with when", async () => {
    rpc.mockResolvedValue({ data: { state: "accepted", email: "lucia@client.test", contact_name: null, invited_at: "2026-11-20T10:00:00Z", last_opened_at: "2026-11-21T09:00:00Z", expires_at: "2026-12-04T10:00:00Z", send_count: 1, accepted_at: "2026-11-21T09:05:00Z", email_outcome: "sent" }, error: null });
    expect(await api.fetchIntakeInviteStatus("i1")).toMatchObject({ state: "accepted", acceptedAt: new Date("2026-11-21T09:05:00Z"), lastOpenedAt: new Date("2026-11-21T09:00:00Z") });
  });

  // Break caught: an invitation that ran out is shown as still waiting, and the broker never sends it again.
  it("answers an expired invitation as expired", async () => {
    rpc.mockResolvedValue({ data: { state: "expired", email: "lucia@client.test", contact_name: null, invited_at: "2026-11-01T10:00:00Z", last_opened_at: null, expires_at: "2026-11-15T10:00:00Z", send_count: 1, accepted_at: null, email_outcome: "sent" }, error: null });
    expect(await api.fetchIntakeInviteStatus("i1")).toMatchObject({ state: "expired" });
  });

  // Break caught: a link whose send was never recorded is shown with a delivery it never had.
  it("answers no delivery for a link whose send was not recorded", async () => {
    rpc.mockResolvedValue({ data: { state: "waiting", email: "lucia@client.test", contact_name: null, invited_at: "2026-11-20T10:00:00Z", last_opened_at: null, expires_at: "2026-12-04T10:00:00Z", send_count: 1, accepted_at: null, email_outcome: null }, error: null });
    expect(await api.fetchIntakeInviteStatus("i1")).toMatchObject({ delivery: null });
  });

  // Break caught: a word the server never sends is shown to the broker as a delivery state.
  it("answers no delivery for an outcome it does not know", async () => {
    rpc.mockResolvedValue({ data: { state: "waiting", email: "lucia@client.test", contact_name: null, invited_at: "2026-11-20T10:00:00Z", last_opened_at: null, expires_at: "2026-12-04T10:00:00Z", send_count: 1, accepted_at: null, email_outcome: "bounced?" }, error: null });
    expect(await api.fetchIntakeInviteStatus("i1")).toMatchObject({ delivery: null });
  });

  // Break caught: a refusal reaches step 3 as a bare error, or as a crash on an empty answer.
  it("says an intake that is not available is not available (PT404)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "db words" } });
    await expect(api.fetchIntakeInviteStatus("i1")).rejects.toThrow("That intake isn't available.");
  });

  // Break caught: a failure that is not a refusal is blamed on the intake.
  it("tells the broker to try again for any other failure", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "db words" } });
    await expect(api.fetchIntakeInviteStatus("i1")).rejects.toThrow("Couldn't load the invitation. Try again.");
  });

  // Break caught: an empty answer crashes the step instead of reading as not invited.
  it("answers none when the database answers nothing", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await api.fetchIntakeInviteStatus("i1")).toEqual({ state: "none" });
  });
});
describe("the employer opening the link", () => {
  // Break caught: the page can't say whose invitation it is, or asks the database with the wrong address.
  it("peeks at the link and answers the firm's name and who it is for", async () => {
    rpc.mockResolvedValue({ data: [{ firm_name: "Acme Brokers", contact_name: "Lucia", expires_at: "2026-12-04T10:00:00Z" }], error: null });
    expect(await api.peekIntakeInvite("the-token", "acme-brokers")).toEqual({ firmName: "Acme Brokers", contactName: "Lucia" });
    expect(rpc.mock.calls[0][0]).toBe("peek_intake_invite");
    expect((rpc.mock.calls[0][1] as { p_firm_address: string }).p_firm_address).toBe("acme-brokers");
  });

  // Break caught: the token itself goes to the database (it is meant to reach it only as its hash, so a log of requests never holds a working link).
  it("gives the database the token's SHA-256 and never the token", async () => {
    rpc.mockResolvedValue({ data: [{ firm_name: "Acme Brokers", contact_name: null }], error: null });
    await api.peekIntakeInvite("abc", "acme-brokers");
    expect((rpc.mock.calls[0][1] as { p_token_hash: string }).p_token_hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('"abc"');
  });

  // Break caught: a link nobody holds reaches the employer as a bare error.
  it("says a link that is not valid is not valid, and how to get another (PT404)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "" } });
    await expect(api.peekIntakeInvite("t", "acme-brokers")).rejects.toThrow("This invitation link isn't valid. Ask your broker to send a new one.");
  });

  // Break caught: an employer holding an old reminder's link is told it is invalid instead of being pointed to the newest email.
  it("says a replaced link was replaced (PT410)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT410", message: "This link was replaced by a newer one. Use the latest email." } });
    await expect(api.peekIntakeInvite("t", "acme-brokers")).rejects.toThrow("This link was replaced by a newer one. Use the latest email your broker sent.");
  });

  // Break caught: an expired link is told as replaced, and the employer waits for an email that is not coming.
  it("says an expired link has expired and how to get another (PT410)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT410", message: "This invitation has expired" } });
    await expect(api.peekIntakeInvite("t", "acme-brokers")).rejects.toThrow("This invitation has expired. Ask your broker to send a new one.");
  });

  // Break caught: a link already used is told as expired, and the employer asks for a new one when they only need to sign in.
  it("says a used link was already used (PT410)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT410", message: "This invitation has already been used" } });
    await expect(api.peekIntakeInvite("t", "acme-brokers")).rejects.toThrow("This invitation has already been used.");
  });

  // Break caught: a withdrawn invitation is told as used.
  it("says a withdrawn link was withdrawn (PT410)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT410", message: "This invitation was withdrawn" } });
    await expect(api.peekIntakeInvite("t", "acme-brokers")).rejects.toThrow("This invitation was withdrawn. Ask your broker to send a new one.");
  });

  // Break caught: a link opened at another firm's address says nothing, or says something about that firm.
  it("says a link at another firm's address is for a different address (PT422)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT422", message: "" } });
    await expect(api.peekIntakeInvite("t", "other-firm")).rejects.toThrow("This invitation is for a different firm's address. Open the link from your email as it was sent.");
  });

  // Break caught: a failure nobody planned for reaches the employer as an empty message.
  it("tells the employer to try again for a failure it has no words for", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "db words" } });
    await expect(api.peekIntakeInvite("t", "acme-brokers")).rejects.toThrow("Couldn't open the invitation. Try again.");
  });

  // Break caught: an empty answer crashes the page instead of saying it could not open.
  it("never reports an empty peek as an invitation", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(api.peekIntakeInvite("t", "acme-brokers")).rejects.toThrow("Couldn't open the invitation. Try again.");
  });

  // Break caught: an invitation made with no name shows the page a name of "undefined".
  it("answers no name when the invitation had none", async () => {
    rpc.mockResolvedValue({ data: [{ firm_name: "Acme Brokers" }], error: null });
    expect(await api.peekIntakeInvite("t", "acme-brokers")).toEqual({ firmName: "Acme Brokers", contactName: null });
  });

  // Break caught: the database answering one row rather than a list reads as no invitation.
  it("reads a single row as well as a list", async () => {
    rpc.mockResolvedValue({ data: { firm_name: "Acme Brokers", contact_name: "Lucia" }, error: null });
    expect(await api.peekIntakeInvite("t", "acme-brokers")).toEqual({ firmName: "Acme Brokers", contactName: "Lucia" });
  });
});
describe("the employer taking the intake", () => {
  // Break caught: accepting hands the page the wrong intake, or asks the database to accept with the wrong function or address.
  it("accepts at the firm's address and answers the intake that is now theirs", async () => {
    rpc.mockResolvedValue({ data: { intake_id: "i1", firm_address: "acme-brokers" }, error: null });
    expect(await api.acceptIntakeInvite("the-token", "acme-brokers")).toEqual({ intakeId: "i1" });
    expect(rpc.mock.calls[0][0]).toBe("accept_intake_invite");
    expect((rpc.mock.calls[0][1] as { p_firm_address: string }).p_firm_address).toBe("acme-brokers");
  });

  // Break caught: accepting names the token itself to the database.
  it("gives the database the token's SHA-256 and never the token", async () => {
    rpc.mockResolvedValue({ data: { intake_id: "i1" }, error: null });
    await api.acceptIntakeInvite("abc", "acme-brokers");
    expect((rpc.mock.calls[0][1] as { p_token_hash: string }).p_token_hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('"abc"');
  });

  // Break caught: signing in with the wrong address reads as "try again", and the person never learns to sign in with the one the link was sent to.
  it("says an invitation sent to another email address was sent to another (PT403)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT403", message: "This invitation was sent to a different email address than the one you are signed in with" } });
    await expect(api.acceptIntakeInvite("t", "acme-brokers")).rejects.toThrow("This invitation was sent to a different email address than the one you are signed in with. Sign out, then sign in or create your account with the address it was sent to.");
  });

  // Break caught: a broker who opens the client's link is told to switch accounts as if they had used the wrong email, when the firm can never take the client's place.
  it("says a member of the firm can't take the client's place (PT403)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT403", message: "A member of the firm can't take the employer's place" } });
    await expect(api.acceptIntakeInvite("t", "acme-brokers")).rejects.toThrow("A member of the firm can't take the client's place. The client opens this link with their own account.");
  });

  // Break caught: a person with an intake already open is told to try again, forever.
  it("says a person with an intake in progress must finish it first (PT409)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "You already have an intake in progress" } });
    await expect(api.acceptIntakeInvite("t", "acme-brokers")).rejects.toThrow("You already have an intake in progress. Finish it or start over from it, then open this link again.");
  });

  // Break caught: a person with no verified email is told to try again, when only verifying the address will help.
  it("says an unverified sign-in must verify its email (42501)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Sign in with a verified email" } });
    await expect(api.acceptIntakeInvite("t", "acme-brokers")).rejects.toThrow("Sign in with a verified email address to open this invitation.");
  });

  // Break caught: an answer with no intake sends the employer to an intake called "undefined".
  it("never reports an accept that answered no intake as a success", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(api.acceptIntakeInvite("t", "acme-brokers")).rejects.toThrow("Couldn't open the invitation. Try again.");
  });
});
