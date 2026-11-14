import { describe, expect, it, vi } from "vitest";
import { openToken, parseTokenKey } from "../_shared/mailboxCrypto";
import { GOOGLE_SEND_SCOPE } from "../_shared/mailboxScopes";
import { handleMailboxRequest, type MailboxClient, type MailboxDeps } from "./handler";

const KEY_B64 = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 3)));
const KEY = parseTokenKey(KEY_B64)!;
const ENV: Record<string, string> = {
  SUPABASE_URL: "https://p.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", MAILBOX_TOKEN_KEY: KEY_B64,
  GOOGLE_OAUTH_CLIENT_ID: "gid", GOOGLE_OAUTH_CLIENT_SECRET: "gsecret", MICROSOFT_OAUTH_CLIENT_ID: "mid", MICROSOFT_OAUTH_CLIENT_SECRET: "msecret",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

interface Options {
  env?: Record<string, string | undefined>;
  user?: { id: string; email?: string | null } | null;
  rpc?: Record<string, { data?: unknown; error?: { code?: string } | null }>;
  /** Whether the caller's own token belongs to a current member of a firm, as the database answers it (false: no membership, or a password sign-in with no second factor). */
  member?: boolean;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
}

function setup(o: Options = {}) {
  const logs: string[] = [];
  const calls: [string, Record<string, unknown>][] = [];
  const fetchFn = vi.fn(o.fetch ?? (async () => reply(200, { access_token: "at", expires_in: 3600, scope: `openid ${GOOGLE_SEND_SCOPE}` })));
  const client: MailboxClient = {
    rpc: async (fn, args) => {
      calls.push([fn, args]);
      const r = o.rpc?.[fn];
      return { data: r?.data ?? null, error: r?.error ?? null };
    },
    auth: { getUser: async () => ({ data: { user: o.user === undefined ? { id: "u1", email: "Marcus@Advisory.example" } : o.user } }) },
  };
  // The caller's own client asks the database about their token; it does none of the work.
  const asked: string[] = [];
  const userClient: MailboxClient = {
    ...client,
    rpc: async (fn, args) => {
      asked.push(`${fn}:${JSON.stringify(args)}`);
      // my_firms() tells a current member their firms and a person with no membership, or still owing the second factor, none.
      return { data: fn === "my_firms" && (o.member ?? true) ? [{ firm_id: "f1", name: "Alpha", address: "alpha", role: "agent" }] : [], error: null };
    },
  };
  const createClient = vi.fn((_u: string, key: string, _opt?: unknown) => (key === "anon" ? userClient : client));
  const deps: MailboxDeps = { env: (n) => (o.env ?? ENV)[n], createClient, fetch: fetchFn as unknown as MailboxDeps["fetch"], log: (l) => logs.push(l) };
  return { deps, logs, calls, fetchFn, createClient, asked };
}

const post = (body: unknown, token: string | null = "user-jwt", method = "POST") =>
  new Request("https://x.example/mailbox", {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });

describe("mailbox: who may call", () => {
  it("answers preflights, refuses other methods, a missing login, a login that isn't a person, and a bad body", async () => {
    const s = setup();
    expect((await handleMailboxRequest(post("", null, "OPTIONS"), s.deps)).status).toBe(204);
    expect((await handleMailboxRequest(post("", "x", "GET"), s.deps)).status).toBe(405);
    expect((await handleMailboxRequest(post({ action: "check" }, null), s.deps)).status).toBe(401);
    expect((await handleMailboxRequest(post({ action: "check" }), setup({ user: null }).deps)).status).toBe(401);
    expect((await handleMailboxRequest(post("nope"), s.deps)).status).toBe(400);
    expect((await handleMailboxRequest(post("x".repeat(9000)), s.deps)).status).toBe(413);
    expect((await handleMailboxRequest(post({ action: "wipe" }), s.deps)).status).toBe(400);
  });

  it("says so, naming nothing secret, when its settings are missing", async () => {
    const noKey = setup({ env: { ...ENV, MAILBOX_TOKEN_KEY: undefined } });
    const res = await handleMailboxRequest(post({ action: "check" }), noKey.deps);
    expect(res.status).toBe(503);
    expect(noKey.logs.join("\n")).toContain("MAILBOX_CONFIG_MISSING");
    expect(noKey.logs.join("\n")).not.toContain(KEY_B64);
    expect((await handleMailboxRequest(post({ action: "check" }), setup({ env: { SUPABASE_URL: "https://p.supabase.co" } }).deps)).status).toBe(503);
  });

  it("works only for the signed-in broker, never for an id in the body", async () => {
    const s = setup({ rpc: { mailbox_secret: { data: null } } });
    await handleMailboxRequest(post({ action: "check", user_id: "someone-else" }), s.deps);
    expect(s.calls.every(([, args]) => args.p_user_id === "u1")).toBe(true);
  });
});

describe("mailbox: connecting", () => {
  it("tests the token, then keeps it encrypted, for the account's own address, and says nothing of it", async () => {
    const s = setup();
    const res = await handleMailboxRequest(post({ action: "connect", provider: "google", refresh_token: "1//the-refresh-token" }), s.deps);
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toEqual({ connected: true, provider: "google", address: "marcus@advisory.example" });
    const store = s.calls.find(([fn]) => fn === "mailbox_store")![1];
    expect(store).toMatchObject({ p_user_id: "u1", p_provider: "google", p_address: "marcus@advisory.example", p_rotated: false });
    expect(JSON.stringify(store)).not.toContain("the-refresh-token");
    expect(await openToken(KEY, "u1", { ciphertext: store.p_token_ciphertext as string, iv: store.p_token_iv as string })).toBe("1//the-refresh-token");
    expect(s.logs.join("\n")).not.toMatch(/the-refresh-token|marcus@|gmail/i);
    expect(JSON.stringify(out)).not.toContain("refresh");
  });

  it("keeps the rotated token when the provider rotated it while it was tested", async () => {
    const s = setup({ fetch: async () => reply(200, { access_token: "at", scope: "https://graph.microsoft.com/Mail.Send openid", refresh_token: "rt-rotated" }) });
    await handleMailboxRequest(post({ action: "connect", provider: "microsoft", refresh_token: "1//the-refresh-token" }), s.deps);
    const store = s.calls.find(([fn]) => fn === "mailbox_store")![1];
    expect(await openToken(KEY, "u1", { ciphertext: store.p_token_ciphertext as string, iv: store.p_token_iv as string })).toBe("rt-rotated");
  });

  it("keeps nothing when the send permission wasn't allowed", async () => {
    const s = setup({ fetch: async () => reply(200, { access_token: "at", scope: "openid email" }) });
    const res = await handleMailboxRequest(post({ action: "connect", provider: "google", refresh_token: "1//the-refresh-token" }), s.deps);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("no_send");
    expect(s.calls.some(([fn]) => fn === "mailbox_store")).toBe(false);
  });

  it("keeps nothing when the grant carries more than sending", async () => {
    const s = setup({ fetch: async () => reply(200, { access_token: "at", scope: `${GOOGLE_SEND_SCOPE} https://www.googleapis.com/auth/gmail.readonly` }) });
    const res = await handleMailboxRequest(post({ action: "connect", provider: "google", refresh_token: "1//the-refresh-token" }), s.deps);
    expect((await res.json()).code).toBe("too_broad");
    expect(s.calls.some(([fn]) => fn === "mailbox_store")).toBe(false);
  });

  it.each([
    [{ status: 400, error: "invalid_grant" }, 400, "revoked"],
    [{ status: 503, error: "x" }, 502, "unavailable"],
    [{ status: 401, error: "invalid_client" }, 503, "not_configured"],
  ])("answers a refused test %j with %i and keeps nothing", async ({ status, error }, expected, code) => {
    const s = setup({ fetch: async () => reply(status, { error }) });
    const res = await handleMailboxRequest(post({ action: "connect", provider: "google", refresh_token: "1//the-refresh-token" }), s.deps);
    expect(res.status).toBe(expected);
    expect((await res.json()).code).toBe(code);
    expect(s.calls.some(([fn]) => fn === "mailbox_store")).toBe(false);
  });

  it("asks the database whether the caller is a current member of a firm, never whether they hold a platform role", async () => {
    const s = setup({ rpc: { mailbox_secret: { data: null } } });
    const res = await handleMailboxRequest(post({ action: "check" }), s.deps);
    expect(res.status).toBe(200);
    expect(s.asked).toEqual(["my_firms:{}"]);
  });

  it("refuses a bad request: an unknown provider, no token, a huge token, an account with no address", async () => {
    const s = setup();
    for (const body of [{ provider: "yahoo", refresh_token: "1//the-refresh-token" }, { provider: "google" }, { provider: "google", refresh_token: "short" }, { provider: "google", refresh_token: "x".repeat(4001) }]) {
      expect((await handleMailboxRequest(post({ action: "connect", ...body }), s.deps)).status).toBe(400);
    }
    const noMail = setup({ user: { id: "u1", email: null } });
    expect((await handleMailboxRequest(post({ action: "connect", provider: "google", refresh_token: "1//the-refresh-token" }), noMail.deps)).status).toBe(400);
    expect(s.fetchFn).not.toHaveBeenCalled();
  });

  it("tells a person who is no member of a firm so, and stores nothing", async () => {
    const s = setup({ rpc: { mailbox_store: { error: { code: "42501" } } } });
    const res = await handleMailboxRequest(post({ action: "connect", provider: "google", refresh_token: "1//the-refresh-token" }), s.deps);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("not_member");
  });

  it.each(["connect", "check"])("refuses %s with 403 and does nothing when the token is no current member's or has no second factor", async (action) => {
    const s = setup({ member: false, rpc: { mailbox_secret: { data: null } } });
    const res = await handleMailboxRequest(post({ action, provider: "google", refresh_token: "1//the-refresh-token" }), s.deps);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("not_member");
    expect(s.asked).toEqual(["my_firms:{}"]);
    expect(s.calls).toEqual([]);
    expect(s.fetchFn).not.toHaveBeenCalled();
  });

  it("lets a former member disconnect: it only removes their own mailbox, and the token must be revoked at the provider", async () => {
    const sealedRow = await import("../_shared/mailboxCrypto").then((m) => m.sealToken(KEY, "u1", "1//stored"));
    const row = { provider: "google", address: "m@a.example", scope: "s", token_ciphertext: sealedRow.ciphertext, token_iv: sealedRow.iv };
    const s = setup({ member: false, rpc: { mailbox_secret: { data: row }, mailbox_delete: { data: true } } });
    const res = await handleMailboxRequest(post({ action: "disconnect" }), s.deps);
    expect(res.status).toBe(200);
    expect(String((s.fetchFn.mock.calls[0] as unknown[])[0])).toBe("https://oauth2.googleapis.com/revoke");
    expect(s.calls.map(([fn]) => fn)).toEqual(["mailbox_secret", "mailbox_delete"]);
  });

  it("says something went wrong, without detail, when the database fails", async () => {
    const s = setup({ rpc: { mailbox_store: { error: { code: "XX000" } } } });
    const res = await handleMailboxRequest(post({ action: "connect", provider: "google", refresh_token: "1//the-refresh-token" }), s.deps);
    expect(res.status).toBe(500);
    expect(s.logs.join("\n")).toContain("MAILBOX_CONNECT_FAILED user=u1 provider=google code=XX000");
  });
});

describe("mailbox: checking and disconnecting", () => {
  it("says not connected, plainly, when there is no mailbox", async () => {
    const s = setup({ rpc: { mailbox_secret: { data: null } } });
    const out = await (await handleMailboxRequest(post({ action: "check" }), s.deps)).json();
    expect(out).toMatchObject({ connected: false, code: "not_connected" });
    expect(out.message).toMatch(/send by hand/);
  });

  it("never returns an access token from a check", async () => {
    const sealedRow = await import("../_shared/mailboxCrypto").then((m) => m.sealToken(KEY, "u1", "1//stored"));
    const s = setup({ rpc: { mailbox_secret: { data: { provider: "google", address: "m@a.example", scope: "s", token_ciphertext: sealedRow.ciphertext, token_iv: sealedRow.iv } } } });
    const text = await (await handleMailboxRequest(post({ action: "check" }), s.deps)).text();
    expect(JSON.parse(text)).toEqual({ connected: true, provider: "google", address: "m@a.example" });
    expect(text).not.toContain("\"at\"");
  });

  it("disconnects: asks Google to revoke, then deletes, and still deletes when Google can't be reached", async () => {
    const sealedRow = await import("../_shared/mailboxCrypto").then((m) => m.sealToken(KEY, "u1", "1//stored"));
    const row = { provider: "google", address: "m@a.example", scope: "s", token_ciphertext: sealedRow.ciphertext, token_iv: sealedRow.iv };
    const s = setup({ rpc: { mailbox_secret: { data: row }, mailbox_delete: { data: true } } });
    const res = await handleMailboxRequest(post({ action: "disconnect" }), s.deps);
    expect(await res.json()).toEqual({ connected: false });
    expect(String((s.fetchFn.mock.calls[0] as unknown[])[0])).toBe("https://oauth2.googleapis.com/revoke");
    expect(s.calls.map(([fn]) => fn)).toEqual(["mailbox_secret", "mailbox_delete"]);

    const offline = setup({ rpc: { mailbox_secret: { data: row }, mailbox_delete: { data: true } }, fetch: async () => { throw new Error("offline"); } });
    expect((await handleMailboxRequest(post({ action: "disconnect" }), offline.deps)).status).toBe(200);
    expect(offline.calls.some(([fn]) => fn === "mailbox_delete")).toBe(true);
  });

  it("deletes even a token that can't be opened, and with no mailbox answers the same", async () => {
    const s = setup({ rpc: { mailbox_secret: { data: { provider: "google", token_ciphertext: "junk", token_iv: "junk" } }, mailbox_delete: { data: true } } });
    expect((await handleMailboxRequest(post({ action: "disconnect" }), s.deps)).status).toBe(200);
    expect(s.fetchFn).not.toHaveBeenCalled();
    expect(s.calls.some(([fn]) => fn === "mailbox_delete")).toBe(true);
    const none = setup({ rpc: { mailbox_secret: { data: null }, mailbox_delete: { data: false } } });
    expect(await (await handleMailboxRequest(post({ action: "disconnect" }), none.deps)).json()).toEqual({ connected: false });
  });

  it("fails without detail when the delete fails, and says nothing about the token in its logs", async () => {
    const s = setup({ rpc: { mailbox_secret: { data: null }, mailbox_delete: { error: { code: "XX000" } } } });
    expect((await handleMailboxRequest(post({ action: "disconnect" }), s.deps)).status).toBe(500);
    expect(s.logs.join("\n")).toContain("MAILBOX_DISCONNECT_FAILED user=u1 code=XX000");
  });
});
