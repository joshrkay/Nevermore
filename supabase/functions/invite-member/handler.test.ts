import { describe, expect, it, vi } from "vitest";
import { firmBaseUrl, handleInviteRequest, type InviteClient, type InviteDeps } from "./handler";

const SERVICE = "service-key-abc";
const USER_JWT = "user-jwt-xyz";
const TOKEN = "TOKEN-made-by-the-function-0123456789abcdefg";
const HASH = "a".repeat(64);
const FIRM = "11111111-1111-4111-8111-111111111111";
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
interface Options {
  env?: Record<string, string | undefined>;
  rpc?: Record<string, Rpc>;
  provider?: { status: number; body?: unknown } | "network";
}

const made = { invitation_id: INVITATION, email: "newcomer@example.test", firm_name: "Acme <Brokers>", firm_address: "acme-brokers", expires_at: "2026-11-20T10:00:00Z" };

function setup(o: Options = {}) {
  const calls: { as: "user" | "service"; fn: string; args: Record<string, unknown> }[] = [];
  const logs: string[] = [];
  const sent: { url: string; headers: Record<string, string>; body: { to: string[]; subject: string; text: string; html: string; from: string } }[] = [];
  const client = (as: "user" | "service"): InviteClient => ({
    rpc: async (fn, args) => {
      calls.push({ as, fn, args });
      const r = o.rpc?.[fn] ?? { data: fn === "record_invitation_delivery" ? null : [made] };
      return { data: r.data ?? null, error: r.error ?? null };
    },
  });
  const fetchFake = vi.fn(async (url: string, init: RequestInit) => {
    if (o.provider === "network") throw new Error("down");
    sent.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    const p = o.provider ?? { status: 200, body: { id: "msg_1" } };
    return new Response(JSON.stringify(p.body ?? {}), { status: p.status });
  });
  const createClient = vi.fn((_url: string, key: string, _opts?: unknown) => client(key === SERVICE ? "service" : "user"));
  const deps: InviteDeps = {
    env: (n) => (o.env ?? ENV)[n],
    createClient,
    fetch: fetchFake as unknown as typeof fetch,
    newToken: async () => ({ token: TOKEN, hash: HASH }),
    log: (l) => logs.push(l),
  };
  return { deps, calls, logs, sent, createClient };
}

const post = (body: unknown, auth: string | null = `Bearer ${USER_JWT}`) =>
  new Request("https://f.example/invite-member", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
const invite = { action: "invite", firm_id: FIRM, email: "newcomer@example.test", role: "agent" };

describe("inviting a member (request and response)", () => {
  it("asks the database as the caller, with the token's hash and never the token, and emails the link at the firm's address", async () => {
    const t = setup();
    const res = await handleInviteRequest(post(invite), t.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, invitation_id: INVITATION, emailed: true });
    const made1 = t.calls.find((c) => c.fn === "invite_member")!;
    expect(made1.as).toBe("user");
    expect(made1.args).toEqual({ p_firm_id: FIRM, p_email: "newcomer@example.test", p_role: "agent", p_team_id: null, p_token_hash: HASH });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].url).toBe("https://api.resend.com/emails");
    expect(t.sent[0].body.to).toEqual(["newcomer@example.test"]);
    expect(t.sent[0].body.text).toContain(`https://acme-brokers.nevermorepeo.com/join/${TOKEN}`);
    expect(t.sent[0].body.html).toContain(`https://acme-brokers.nevermorepeo.com/join/${TOKEN}`);
    expect(t.sent[0].body.subject).toContain("Acme <Brokers>");
    expect(t.sent[0].body.html).not.toContain("<Brokers>");
    expect(t.sent[0].body.html).toContain("&lt;Brokers&gt;");
  });

  it("records that the email went out, as the service, and the token and the address appear in no call but the email and no log line", async () => {
    const t = setup();
    await handleInviteRequest(post(invite), t.deps);
    const delivery = t.calls.find((c) => c.fn === "record_invitation_delivery")!;
    expect(delivery.as).toBe("service");
    expect(delivery.args).toEqual({ p_invitation_id: INVITATION, p_sent: true, p_error: null });
    expect(JSON.stringify(t.calls)).not.toContain(TOKEN);
    expect(t.logs.join("\n")).not.toContain(TOKEN);
    expect(t.logs.join("\n")).not.toContain("newcomer@example.test");
  });

  it("refuses a request with no sign-in before asking anyone anything", async () => {
    const t = setup();
    const res = await handleInviteRequest(post(invite, null), t.deps);
    expect(res.status).toBe(401);
    expect(t.calls).toEqual([]);
    expect(t.sent).toEqual([]);
  });

  it("sends nothing when the database refuses: not an owner, an address already invited, a current member", async () => {
    for (const [code, status] of [["42501", 403], ["PT409", 409], ["23514", 400], ["23503", 400]] as const) {
      const t = setup({ rpc: { invite_member: { error: { code, message: "Only an owner" } } } });
      const res = await handleInviteRequest(post(invite), t.deps);
      expect(res.status, code).toBe(status);
      expect(t.sent, code).toEqual([]);
      expect(t.calls.some((c) => c.fn === "record_invitation_delivery"), code).toBe(false);
    }
  });

  it("passes on what the database said to a refused owner, so the owner sees why (already invited, already a member)", async () => {
    const t = setup({ rpc: { invite_member: { error: { code: "PT409", message: "That person is already a member of this firm" } } } });
    const res = await handleInviteRequest(post(invite), t.deps);
    expect((await res.json()).error).toBe("That person is already a member of this firm");
  });

  it("keeps the invitation and says the email did not go, recording a short kind and no more, when the mail provider fails", async () => {
    const t = setup({ provider: { status: 500 } });
    const res = await handleInviteRequest(post(invite), t.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, invitation_id: INVITATION, emailed: false });
    const delivery = t.calls.find((c) => c.fn === "record_invitation_delivery")!;
    expect(delivery.args).toEqual({ p_invitation_id: INVITATION, p_sent: false, p_error: "provider_error" });
    expect(t.logs.join("\n")).not.toContain(TOKEN);
    expect(t.logs.join("\n")).not.toContain("newcomer@example.test");
  });

  it("does the same when the provider cannot be reached at all", async () => {
    const t = setup({ provider: "network" });
    const res = await handleInviteRequest(post(invite), t.deps);
    expect((await res.json()).emailed).toBe(false);
    expect(t.calls.find((c) => c.fn === "record_invitation_delivery")!.args.p_error).toBe("network");
  });

  it("makes no invitation when the mail provider is not set up, since it could not be sent", async () => {
    const t = setup({ env: { ...ENV, RESEND_API_KEY: undefined } });
    const res = await handleInviteRequest(post(invite), t.deps);
    expect(res.status).toBe(503);
    expect(t.calls).toEqual([]);
  });

  it("rejects a request that is not an invitation or a resend, before the database is asked", async () => {
    for (const body of [{}, { action: "delete" }, { action: "invite", firm_id: "nope", email: "a@b.co", role: "agent" }, { action: "invite", firm_id: FIRM, role: "agent" }, { action: "resend", invitation_id: 7 }]) {
      const t = setup();
      const res = await handleInviteRequest(post(body), t.deps);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(t.calls).toEqual([]);
    }
  });

  it("passes a team on when one is named", async () => {
    const t = setup();
    await handleInviteRequest(post({ ...invite, team_id: "33333333-3333-4333-8333-333333333333" }), t.deps);
    expect(t.calls.find((c) => c.fn === "invite_member")!.args.p_team_id).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("answers the browser's preflight and refuses other methods", async () => {
    const t = setup();
    expect((await handleInviteRequest(new Request("https://f.example/x", { method: "OPTIONS" }), t.deps)).status).toBe(200);
    expect((await handleInviteRequest(new Request("https://f.example/x", { method: "GET" }), t.deps)).status).toBe(405);
  });
});

describe("resending an invitation (request and response)", () => {
  it("makes a new token, asks the database as the caller to replace the old one, and emails the new link", async () => {
    const t = setup();
    const res = await handleInviteRequest(post({ action: "resend", invitation_id: INVITATION }), t.deps);
    expect(await res.json()).toEqual({ ok: true, invitation_id: INVITATION, emailed: true });
    const call = t.calls.find((c) => c.fn === "resend_invitation")!;
    expect(call.as).toBe("user");
    expect(call.args).toEqual({ p_invitation_id: INVITATION, p_token_hash: HASH });
    expect(t.sent[0].body.text).toContain(`/join/${TOKEN}`);
  });

  it("emails whom the invitation was made for, which the database says", async () => {
    const t = setup({ rpc: { resend_invitation: { data: [{ ...made, email: "someone.else@example.test" }] } } });
    await handleInviteRequest(post({ action: "resend", invitation_id: INVITATION }), t.deps);
    expect(t.sent[0].body.to).toEqual(["someone.else@example.test"]);
  });

  it("sends nothing for an invitation that is used, withdrawn or not the caller's to resend", async () => {
    for (const [code, status] of [["PT410", 409], ["42501", 403]] as const) {
      const t = setup({ rpc: { resend_invitation: { error: { code, message: "no" } } } });
      const res = await handleInviteRequest(post({ action: "resend", invitation_id: INVITATION }), t.deps);
      expect(res.status, code).toBe(status);
      expect(t.sent, code).toEqual([]);
    }
  });
});

describe("where an invitation's link opens", () => {
  it("is the firm's own address under the app's domain, without a www", () => {
    expect(firmBaseUrl("https://nevermorepeo.com", "acme-brokers")).toBe("https://acme-brokers.nevermorepeo.com");
    expect(firmBaseUrl("https://www.nevermorepeo.com/", "acme-brokers")).toBe("https://acme-brokers.nevermorepeo.com");
  });

  it("is the app's own origin where there are no firm addresses (a local or numeric host)", () => {
    expect(firmBaseUrl("http://localhost:8080", "acme-brokers")).toBe("http://localhost:8080");
    expect(firmBaseUrl("http://127.0.0.1:8080", "acme-brokers")).toBe("http://127.0.0.1:8080");
  });
});
