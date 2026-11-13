import { describe, expect, it, vi } from "vitest";
import { firmBaseUrl, handleInviteRequest, type InviteClient, type InviteDeps } from "./handler";

const SERVICE = "service-key-abc";
const USER_JWT = "user-jwt-xyz";
const TOKEN = "TOKEN-made-by-the-function-0123456789abcdefg";
const HASH = "c0ffee".padEnd(64, "0");
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
  provider?: Provider | Provider[];
}
type Provider = { status: number; body?: unknown } | "network";

const made = { invitation_id: INVITATION, email: "newcomer@example.test", firm_name: "Acme <Brokers>", firm_address: "acme-brokers", expires_at: "2026-11-20T10:00:00Z" };

function setup(o: Options = {}) {
  const calls: { as: "user" | "service"; fn: string; args: Record<string, unknown> }[] = [];
  const logs: string[] = [];
  const sent: { url: string; headers: Record<string, string>; body: { to: string[]; subject: string; text: string; html: string; from: string } }[] = [];
  const client = (as: "user" | "service"): InviteClient => ({
    rpc: async (fn, args) => {
      calls.push({ as, fn, args });
      const r = o.rpc?.[fn] ?? { data: fn === "record_invitation_delivery" ? true : [made] };
      return { data: r.data ?? null, error: r.error ?? null };
    },
  });
  let attempts = 0;
  const fetchFake = vi.fn(async (url: string, init: RequestInit) => {
    const plan = Array.isArray(o.provider) ? o.provider : [o.provider ?? { status: 200, body: { id: "msg_1" } }];
    const p = plan[Math.min(attempts++, plan.length - 1)];
    sent.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    if (p === "network") throw new Error("down");
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
    expect(await res.json()).toEqual({ ok: true, invitation_id: INVITATION, delivery: "sent" });
    const made1 = t.calls.find((c) => c.fn === "invite_member")!;
    expect(made1.as).toBe("user");
    expect(made1.args).toEqual({ p_firm_id: FIRM, p_email: "newcomer@example.test", p_role: "agent", p_team_id: null, p_token_hash: HASH });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].url).toBe("https://api.resend.com/emails");
    expect(t.sent[0].body.to).toEqual(["newcomer@example.test"]);
    expect(t.sent[0].body.text).toContain(`https://acme-brokers.nevermorepeo.com/join#token=${TOKEN}`);
    expect(t.sent[0].body.html).toContain(`https://acme-brokers.nevermorepeo.com/join#token=${TOKEN}`);
    // The secret is in the part after the #, which a browser never sends to a server: no route and no request log holds it (D-34).
    expect(t.sent[0].body.text).not.toContain(`/join/${TOKEN}`);
    expect(t.sent[0].body.subject).toContain("Acme <Brokers>");
    expect(t.sent[0].body.html).not.toContain("<Brokers>");
    expect(t.sent[0].body.html).toContain("&lt;Brokers&gt;");
  });

  it("records that the email went out, as the service, and the token and the address appear in no call but the email and no log line", async () => {
    const t = setup();
    await handleInviteRequest(post(invite), t.deps);
    const delivery = t.calls.find((c) => c.fn === "record_invitation_delivery")!;
    expect(delivery.as).toBe("service");
    expect(delivery.args).toEqual({ p_invitation_id: INVITATION, p_token_hash: HASH, p_outcome: "sent", p_error: null });
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

  it("says the email did not go, recording a short kind and no more, when the provider certainly refused it, and does not try again", async () => {
    for (const [status, kind] of [[403, "auth"], [422, "provider_error"], [429, "rate_limited"]] as const) {
      const t = setup({ provider: { status } });
      const res = await handleInviteRequest(post(invite), t.deps);
      expect(res.status).toBe(200);
      expect(await res.json(), String(status)).toEqual({ ok: true, invitation_id: INVITATION, delivery: "failed" });
      expect(t.sent, String(status)).toHaveLength(1);
      expect(t.calls.find((c) => c.fn === "record_invitation_delivery")!.args, String(status))
        .toEqual({ p_invitation_id: INVITATION, p_token_hash: HASH, p_outcome: "failed", p_error: kind });
      expect(t.logs.join("\n")).not.toContain(TOKEN);
      expect(t.logs.join("\n")).not.toContain("newcomer@example.test");
    }
  });

  it("says it is unknown whether the email was delivered, not that it did not go, when the provider may have accepted it, after one more try with the same message and key", async () => {
    for (const provider of [{ status: 500 }, { status: 409 }, { status: 408 }, "network"] as Provider[]) {
      const t = setup({ provider });
      const res = await handleInviteRequest(post(invite), t.deps);
      expect(await res.json(), JSON.stringify(provider)).toEqual({ ok: true, invitation_id: INVITATION, delivery: "unknown" });
      const delivery = t.calls.find((c) => c.fn === "record_invitation_delivery")!;
      expect(delivery.args.p_outcome, JSON.stringify(provider)).toBe("unknown");
      expect(t.sent, JSON.stringify(provider)).toHaveLength(2);
      expect(t.sent[1].headers["Idempotency-Key"]).toBe(t.sent[0].headers["Idempotency-Key"]);
      expect(t.sent[1].body).toEqual(t.sent[0].body);
      expect(t.calls.filter((c) => c.fn === "invite_member")).toHaveLength(1);
      expect(t.logs.join("\n")).not.toContain(TOKEN);
    }
  });

  it("keeps the same link and key for the retry after an unclear first answer, and reports success when the retry is accepted", async () => {
    const t = setup({ provider: [{ status: 500 }, { status: 200, body: { id: "msg_2" } }] });
    const res = await handleInviteRequest(post(invite), t.deps);
    expect((await res.json()).delivery).toBe("sent");
    expect(t.sent).toHaveLength(2);
    expect(t.sent[1].body.text).toContain(`#token=${TOKEN}`);
    expect(t.sent[1].headers["Idempotency-Key"]).toBe(t.sent[0].headers["Idempotency-Key"]);
    expect(t.calls.find((c) => c.fn === "record_invitation_delivery")!.args.p_outcome).toBe("sent");
  });

  it("makes no invitation when the mail provider is not set up, since it could not be sent", async () => {
    const t = setup({ env: { ...ENV, RESEND_API_KEY: undefined } });
    const res = await handleInviteRequest(post(invite), t.deps);
    expect(res.status).toBe(503);
    expect(t.calls).toEqual([]);
  });

  it("rejects a request that is not an invitation or a resend, before the database is asked", async () => {
    for (const body of [{}, { action: "delete" }, { action: "invite", firm_id: "nope", email: "a@b.co", role: "agent" }, { action: "invite", firm_id: FIRM, role: "agent" }, { action: "resend", invitation_id: 7 }, { action: "resend", invitation_id: "not-an-id" }]) {
      const t = setup();
      const res = await handleInviteRequest(post(body), t.deps);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(t.calls).toEqual([]);
    }
  });

  it("still answers that the email went out when recording that fails, and logs neither the address nor the token", async () => {
    const t = setup({ rpc: { record_invitation_delivery: { error: { code: "XX000", message: "newcomer@example.test boom" } } } });
    const res = await handleInviteRequest(post(invite), t.deps);
    expect((await res.json()).delivery).toBe("sent");
    expect(t.logs).toHaveLength(1);
    expect(t.logs[0]).toContain("record_delivery");
    expect(t.logs.join("\n")).not.toContain("newcomer@example.test");
    expect(t.logs.join("\n")).not.toContain(TOKEN);
  });

  it("tells the owner of a refused firm that the firm can't invite, in the database's words, and the owner of a waiting firm at its cap why", async () => {
    const refused = setup({ rpc: { invite_member: { error: { code: "PT403", message: "This firm can't invite people" } } } });
    const res = await handleInviteRequest(post(invite), refused.deps);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("This firm can't invite people");
    const cap = setup({ rpc: { invite_member: { error: { code: "PT409", message: "A firm waiting for approval can hold at most five pending invitations" } } } });
    expect((await (await handleInviteRequest(post(invite), cap.deps)).json()).error).toBe("A firm waiting for approval can hold at most five pending invitations");
    const rate = "A firm waiting for approval can send at most twenty invitation emails in 24 hours. It can send again at 2026-11-17 09:30 UTC";
    const limited = setup({ rpc: { invite_member: { error: { code: "PT409", message: rate } } } });
    const limitedRes = await handleInviteRequest(post(invite), limited.deps);
    expect(limitedRes.status).toBe(409);
    expect((await limitedRes.json()).error).toBe(rate);
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

describe("what is checked before anything is made (claims 5 and 6 of the review)", () => {
  it("refuses an address the mail sender would refuse, before a token is made or the database is asked, so it can't block a corrected one", async () => {
    for (const email of ["not an email", 'a"b@example.test', "a,b@example.test", "<a>@example.test", "a@b", "x".repeat(250) + "@example.test", ""]) {
      const t = setup();
      const newToken = vi.spyOn(t.deps, "newToken");
      const res = await handleInviteRequest(post({ ...invite, email }), t.deps);
      expect(res.status, email).toBe(400);
      expect((await res.json()).error, email).toBe("Check the email address and the role.");
      expect(t.calls, email).toEqual([]);
      expect(newToken, email).not.toHaveBeenCalled();
      expect(t.sent, email).toEqual([]);
    }
  });

  it("hands the database the address in the form it keeps (lower case, no surrounding spaces) and refuses a role that isn't one", async () => {
    const t = setup();
    await handleInviteRequest(post({ ...invite, email: "  NewComer@Example.TEST " }), t.deps);
    expect(t.calls.find((c) => c.fn === "invite_member")!.args.p_email).toBe("newcomer@example.test");
    const bad = setup();
    expect((await handleInviteRequest(post({ ...invite, role: "admin" }), bad.deps)).status).toBe(400);
    expect(bad.calls).toEqual([]);
  });

  it("makes nothing when the sender or the app's address is malformed or not https, before a token is made or the database is asked", async () => {
    const cases: Record<string, string>[] = [
      { EMAIL_FROM: "not a sender" },
      { EMAIL_FROM: "Nevermore <hello@mail.nevermorepeo.com" },
      { EMAIL_FROM: "Nevermore\r\nBcc: x@y.co <hello@mail.nevermorepeo.com>" },
      { APP_BASE_URL: "http://nevermorepeo.com" },
      { APP_BASE_URL: "nevermorepeo.com" },
      { APP_BASE_URL: "https://user:pw@nevermorepeo.com" },
      { APP_BASE_URL: "ftp://nevermorepeo.com" },
    ];
    for (const override of cases) {
      const t = setup({ env: { ...ENV, ...override } });
      const newToken = vi.spyOn(t.deps, "newToken");
      const res = await handleInviteRequest(post(invite), t.deps);
      expect(res.status, JSON.stringify(override)).toBe(503);
      expect(t.calls, JSON.stringify(override)).toEqual([]);
      expect(newToken, JSON.stringify(override)).not.toHaveBeenCalled();
      expect(t.sent, JSON.stringify(override)).toEqual([]);
    }
  });

  it("still accepts a plain http address for a local app, as the dispatch configuration does", async () => {
    const t = setup({ env: { ...ENV, APP_BASE_URL: "http://localhost:8080" } });
    expect((await handleInviteRequest(post(invite), t.deps)).status).toBe(200);
  });
});

describe("resending an invitation (request and response)", () => {
  it("makes a new token, asks the database as the caller to replace the old one, and emails the new link", async () => {
    const t = setup();
    const res = await handleInviteRequest(post({ action: "resend", invitation_id: INVITATION }), t.deps);
    expect(await res.json()).toEqual({ ok: true, invitation_id: INVITATION, delivery: "sent" });
    const call = t.calls.find((c) => c.fn === "resend_invitation")!;
    expect(call.as).toBe("user");
    expect(call.args).toEqual({ p_invitation_id: INVITATION, p_token_hash: HASH });
    expect(t.sent[0].body.text).toContain(`/join#token=${TOKEN}`);
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

describe("sending the same invitation again", () => {
  it("never repeats the provider's idempotency key for a resend, which would make it drop the new email, and never puts the token in it", async () => {
    const first = setup();
    await handleInviteRequest(post(invite), first.deps);
    const second = setup();
    second.deps.newToken = async () => ({ token: "ANOTHER-TOKEN-0123456789abcdefghijklmnop", hash: "b".repeat(64) });
    await handleInviteRequest(post({ action: "resend", invitation_id: INVITATION }), second.deps);
    const keys = [first.sent[0].headers["Idempotency-Key"], second.sent[0].headers["Idempotency-Key"]];
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBeTruthy();
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys.join(" ")).not.toContain(TOKEN);
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
