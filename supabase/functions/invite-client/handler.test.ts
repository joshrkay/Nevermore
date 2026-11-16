import { describe, expect, it, vi } from "vitest";
import { handleInviteClientRequest, type InviteClientClient, type InviteClientDeps } from "./handler";

const SERVICE = "service-key-abc";
const USER_JWT = "user-jwt-xyz";
const TOKEN = "TOKEN-made-by-the-function-0123456789abcdefg";
const HASH = "c0ffee".padEnd(64, "0");
const INTAKE = "33333333-3333-4333-8333-333333333333";
const INVITATION = "22222222-2222-4222-8222-222222222222";
const ENV: Record<string, string> = {
  SUPABASE_URL: "https://p.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: SERVICE,
  RESEND_API_KEY: "re_key",
  EMAIL_FROM: "Nevermore <hello@mail.nevermorepeo.com>",
  APP_BASE_URL: "https://nevermorepeo.com",
};

type Rpc = { data?: unknown; error?: { code?: string; message?: string } | null };
type Provider = { status: number; body?: unknown } | "network";
interface Options {
  env?: Record<string, string | undefined>;
  rpc?: Record<string, Rpc>;
  provider?: Provider | Provider[];
}

const made = {
  invitation_id: INVITATION, email: "lucia@client.test", contact_name: "Lucia Perez", firm_name: "Acme <Brokers>", firm_address: "acme-brokers", expires_at: "2026-12-04T10:00:00Z",
};

function setup(o: Options = {}) {
  const calls: { as: "user" | "service"; fn: string; args: Record<string, unknown> }[] = [];
  const logs: string[] = [];
  const sent: { url: string; body: { to: string[]; subject: string; text: string; html: string; from: string } }[] = [];
  const client = (as: "user" | "service"): InviteClientClient => ({
    rpc: async (fn, args) => {
      calls.push({ as, fn, args });
      const r = o.rpc?.[fn] ?? { data: fn === "record_intake_invite_delivery" ? true : [made] };
      return { data: r.data ?? null, error: r.error ?? null };
    },
  });
  let attempts = 0;
  const fetchFake = vi.fn(async (url: string, init: RequestInit) => {
    const plan = Array.isArray(o.provider) ? o.provider : [o.provider ?? { status: 200, body: { id: "msg_1" } }];
    const p = plan[Math.min(attempts++, plan.length - 1)];
    sent.push({ url, body: JSON.parse(String(init.body)) });
    if (p === "network") throw new Error("down");
    return new Response(JSON.stringify(p.body ?? {}), { status: p.status });
  });
  const createClient = vi.fn((_url: string, key: string, _opts?: unknown) => client(key === SERVICE ? "service" : "user"));
  const deps: InviteClientDeps = {
    env: (n) => (o.env ?? ENV)[n],
    createClient,
    fetch: fetchFake as unknown as typeof fetch,
    newToken: async () => ({ token: TOKEN, hash: HASH }),
    log: (l) => logs.push(l),
  };
  return { deps, calls, logs, sent, createClient };
}

const post = (body: unknown, auth: string | null = `Bearer ${USER_JWT}`) =>
  new Request("https://f.example/invite-client", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
const invite = { action: "invite", intake_id: INTAKE, email: "Lucia@Client.Test", name: "Lucia Perez" };

describe("inviting the client to finish and certify (request and response)", () => {
  // Break caught: the database is asked as the service role (so any caller could invite for any firm), or is given the token itself.
  it("asks the database as the caller with the token's hash, and emails the link at the firm's address", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, invitation_id: INVITATION, delivery: "sent" });
    const asked = t.calls.find((c) => c.fn === "invite_intake_client")!;
    expect(asked.as).toBe("user");
    expect(asked.args).toEqual({ p_intake_id: INTAKE, p_email: "lucia@client.test", p_contact_name: "Lucia Perez", p_token_hash: HASH });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].body.to).toEqual(["lucia@client.test"]);
    expect(t.sent[0].body.text).toContain(`https://acme-brokers.nevermorepeo.com/intake-invite#token=${TOKEN}`);
    expect(t.sent[0].body.html).toContain(`https://acme-brokers.nevermorepeo.com/intake-invite#token=${TOKEN}`);
  });
});

describe("Remind (request and response)", () => {
  // Break caught: Remind goes out under the old link (the old token is reused), or is asked as the service role, or names the wrong database function.
  it("makes a new token, asks the database as the caller to replace the old link, and emails the new one", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post({ action: "remind", intake_id: INTAKE }), t.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, invitation_id: INVITATION, delivery: "sent" });
    const asked = t.calls.find((c) => c.fn === "remind_intake_invite")!;
    expect(asked.as).toBe("user");
    expect(asked.args).toEqual({ p_intake_id: INTAKE, p_token_hash: HASH });
    expect(t.calls.some((c) => c.fn === "invite_intake_client")).toBe(false);
    expect(t.sent[0].body.text).toContain(`#token=${TOKEN}`);
    expect(t.sent[0].body.subject).toMatch(/reminder/i);
  });
});

describe("what is refused before anything is made", () => {
  // Break caught: a request with no login reaches the database, or makes a token and sends mail.
  it("refuses a call with no login (401) and makes and sends nothing", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post(invite, null), t.deps);
    expect(res.status).toBe(401);
    expect(t.calls).toEqual([]);
    expect(t.sent).toEqual([]);
  });

  // Break caught: a malformed request is sent on to the database, or an address that could never be emailed becomes the waiting invitation.
  it.each([
    ["an intake id that isn't one", { ...invite, intake_id: "not-an-id" }],
    ["an address that could never be emailed", { ...invite, email: "not an address" }],
    ["no action at all", { intake_id: INTAKE }],
    ["a remind with no intake", { action: "remind" }],
  ])("refuses %s (400) and makes and sends nothing", async (_name, body) => {
    const t = setup();
    const res = await handleInviteClientRequest(post(body), t.deps);
    expect(res.status).toBe(400);
    expect(t.calls).toEqual([]);
    expect(t.sent).toEqual([]);
  });

  // Break caught: an invitation is made that no email can carry, so it sits waiting and blocks the corrected one.
  it("makes nothing when mail isn't set up (503)", async () => {
    const t = setup({ env: { ...ENV, RESEND_API_KEY: undefined } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(503);
    expect(t.calls).toEqual([]);
    expect(t.logs.join("\n")).toContain("INVITE_CLIENT_CONFIG_MISSING");
  });
});

describe("what the database refuses", () => {
  // Break caught: a refusal becomes a 500 the broker can't act on, or the link is emailed although the database refused it.
  it.each([
    ["PT404", 404, /isn.t available/i],
    ["PT409", 409, /already has an invitation/i],
    ["55000", 409, /closed|already belongs/i],
    ["PT423", 423, /closing|can.t be changed/i],
    ["42501", 403, /members of the firm/i],
    ["22023", 400, /email address/i],
  ])("answers %s as %i, in words, and emails nothing", async (code, status, words) => {
    const t = setup({ rpc: { invite_intake_client: { error: { code, message: "db words" } } } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(status);
    expect(((await res.json()) as { error: string }).error).toMatch(words);
    expect(t.sent).toEqual([]);
    expect(t.calls.some((c) => c.fn === "record_intake_invite_delivery")).toBe(false);
  });

  it("answers anything else as a failure to try again, and logs only the code", async () => {
    const t = setup({ rpc: { remind_intake_invite: { error: { code: "XX000", message: `boom ${TOKEN}` } } } });
    const res = await handleInviteClientRequest(post({ action: "remind", intake_id: INTAKE }), t.deps);
    expect(res.status).toBe(500);
    expect(t.logs.join("\n")).toContain("INVITE_CLIENT_REFUSED");
    expect(t.logs.join("\n")).not.toContain(TOKEN);
  });
});

describe("sending the link", () => {
  // Break caught: the mail looks as if it came from Nevermore alone (the client can't tell whose intake it is), or carries the firm's name unescaped into a header.
  it("comes from \"<Firm> via Nevermore\" at Nevermore's own sender address, with the firm's name cleaned", async () => {
    const t = setup();
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.sent[0].body.from).toBe("Acme Brokers via Nevermore <hello@mail.nevermorepeo.com>");
    expect(t.sent[0].body.html).toContain("Acme &lt;Brokers&gt;");
  });

  // Break caught: how the send went is never recorded (the broker's step shows a link as sent that was refused), or is recorded against another link, or as the caller.
  it("records how the send went, as the service role, against this link", async () => {
    const t = setup({ provider: { status: 422, body: { message: "rejected" } } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(await res.json()).toMatchObject({ ok: true, delivery: "failed" });
    const recorded = t.calls.find((c) => c.fn === "record_intake_invite_delivery")!;
    expect(recorded.as).toBe("service");
    expect(recorded.args).toMatchObject({ p_invitation_id: INVITATION, p_token_hash: HASH, p_outcome: "failed" });
  });

  // Break caught: an unclear answer from the provider is given up on (the client never hears) or tried twice without the same key (they hear twice).
  it("tries once more after an unclear answer, with the same message and key", async () => {
    const t = setup({ provider: ["network", { status: 200, body: { id: "msg_2" } }] });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(await res.json()).toMatchObject({ delivery: "sent" });
    expect(t.sent).toHaveLength(2);
  });

  // Break caught: the one secret the link carries leaks into the answer or the log.
  it("never returns or logs the token", async () => {
    const t = setup({ provider: { status: 500 } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(JSON.stringify(await res.json())).not.toContain(TOKEN);
    expect(t.logs.join("\n")).not.toContain(TOKEN);
  });
});
