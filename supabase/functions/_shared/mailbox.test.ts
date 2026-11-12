import { describe, expect, it, vi } from "vitest";
import { getMailboxAccess, readMailboxConfig, refreshAccessToken, revokeAtProvider, type MailboxConfig } from "./mailbox";
import { openToken, parseTokenKey, sealToken } from "./mailboxCrypto";
import { excessScopes, grantsSend, GOOGLE_SEND_SCOPE } from "./mailboxScopes";

const KEY = parseTokenKey(btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 7))))!;
const config: MailboxConfig = { key: KEY, google: { clientId: "gid", clientSecret: "gsecret" }, microsoft: { clientId: "mid", clientSecret: "msecret", tenant: "organizations" } };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("the scopes a grant may carry", () => {
  it("recognises the send permission, Google's and Microsoft's, in the forms providers return it", () => {
    expect(grantsSend("google", `openid email ${GOOGLE_SEND_SCOPE}`)).toBe(true);
    expect(grantsSend("microsoft", "https://graph.microsoft.com/Mail.Send openid profile email")).toBe(true);
    expect(grantsSend("microsoft", "Mail.Send offline_access")).toBe(true);
    expect(grantsSend("google", "openid email")).toBe(false);
    expect(grantsSend("google", null)).toBe(false);
    expect(grantsSend("microsoft", "Mail.ReadWrite")).toBe(false);
  });

  it("calls anything but sending and identity excess", () => {
    expect(excessScopes("google", `openid email profile ${GOOGLE_SEND_SCOPE} https://www.googleapis.com/auth/userinfo.email`)).toEqual([]);
    expect(excessScopes("microsoft", "https://graph.microsoft.com/Mail.Send offline_access User.Read")).toEqual([]);
    expect(excessScopes("google", `${GOOGLE_SEND_SCOPE} https://www.googleapis.com/auth/gmail.readonly`)).toEqual(["https://www.googleapis.com/auth/gmail.readonly"]);
    expect(excessScopes("google", "https://mail.google.com/")).toEqual(["https://mail.google.com/"]);
    expect(excessScopes("microsoft", "Mail.Send Mail.Read")).toEqual(["Mail.Read"]);
    expect(excessScopes("microsoft", "Mail.Send Mail.ReadWrite Contacts.Read")).toEqual(["Mail.ReadWrite", "Contacts.Read"]);
  });
});

describe("the mailbox settings", () => {
  const env = (o: Record<string, string>) => (n: string) => o[n];
  const keyB64 = btoa(String.fromCharCode(...Array.from({ length: 32 }, () => 9)));

  it("needs the key, and takes each provider only when both its parts are set", () => {
    expect(readMailboxConfig(env({}))).toEqual({ ok: false, problem: expect.stringContaining("MAILBOX_TOKEN_KEY") });
    const r = readMailboxConfig(env({ MAILBOX_TOKEN_KEY: keyB64, GOOGLE_OAUTH_CLIENT_ID: "g", GOOGLE_OAUTH_CLIENT_SECRET: "s", MICROSOFT_OAUTH_CLIENT_ID: "m" }));
    expect(r.ok && r.config.google).toEqual({ clientId: "g", clientSecret: "s" });
    expect(r.ok && r.config.microsoft).toBeNull();
  });

  it("defaults Microsoft's tenant to organisations and refuses an odd one", () => {
    const base = { MAILBOX_TOKEN_KEY: keyB64, MICROSOFT_OAUTH_CLIENT_ID: "m", MICROSOFT_OAUTH_CLIENT_SECRET: "s" };
    const a = readMailboxConfig(env(base));
    expect(a.ok && a.config.microsoft?.tenant).toBe("organizations");
    const b = readMailboxConfig(env({ ...base, MICROSOFT_OAUTH_TENANT: "../evil" }));
    expect(b.ok && b.config.microsoft).toBeNull();
  });
});

describe("refreshing an access token", () => {
  it("asks Google with the app's id and secret, and returns the token and what was granted", async () => {
    const fetchFn = vi.fn(async () => reply(200, { access_token: "at", expires_in: 3599, scope: `openid ${GOOGLE_SEND_SCOPE}` }));
    const r = await refreshAccessToken(fetchFn, config, "google", "rt");
    expect(r).toEqual({ ok: true, accessToken: "at", expiresIn: 3599, scope: `openid ${GOOGLE_SEND_SCOPE}`, refreshToken: null });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const form = new URLSearchParams(init.body as URLSearchParams);
    expect(Object.fromEntries(form)).toEqual({ client_id: "gid", client_secret: "gsecret", grant_type: "refresh_token", refresh_token: "rt" });
  });

  it("asks Microsoft on its tenant's endpoint and returns a rotated refresh token", async () => {
    const fetchFn = vi.fn(async () => reply(200, { access_token: "at", expires_in: 3600, scope: "Mail.Send", refresh_token: "rt2" }));
    const r = await refreshAccessToken(fetchFn, config, "microsoft", "rt");
    expect(r).toMatchObject({ ok: true, refreshToken: "rt2" });
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe("https://login.microsoftonline.com/organizations/oauth2/v2.0/token");
  });

  it("does not call a token the provider handed back unchanged a rotation", async () => {
    const r = await refreshAccessToken(async () => reply(200, { access_token: "at", refresh_token: "rt" }), config, "microsoft", "rt");
    expect(r).toMatchObject({ ok: true, refreshToken: null });
  });

  it("says revoked when the provider refuses the token for good, not configured for a bad app, unavailable otherwise", async () => {
    expect(await refreshAccessToken(async () => reply(400, { error: "invalid_grant" }), config, "google", "rt")).toEqual({ ok: false, reason: "revoked" });
    expect(await refreshAccessToken(async () => reply(400, { error: "interaction_required" }), config, "microsoft", "rt")).toEqual({ ok: false, reason: "revoked" });
    expect(await refreshAccessToken(async () => reply(401, { error: "invalid_client" }), config, "google", "rt")).toEqual({ ok: false, reason: "not_configured" });
    expect(await refreshAccessToken(async () => reply(503, { error: "temporarily_unavailable" }), config, "google", "rt")).toEqual({ ok: false, reason: "unavailable" });
    expect(await refreshAccessToken(async () => new Response("<html>", { status: 502 }), config, "google", "rt")).toEqual({ ok: false, reason: "unavailable" });
    expect(await refreshAccessToken(async () => { throw new Error("offline"); }, config, "google", "rt")).toEqual({ ok: false, reason: "unavailable" });
    expect(await refreshAccessToken(async () => reply(200, {}), { ...config, google: null }, "google", "rt")).toEqual({ ok: false, reason: "not_configured" });
  });

  it("revokes at Google only, and never waits on it", async () => {
    const fetchFn = vi.fn(async () => reply(200, {}));
    await revokeAtProvider(fetchFn, "google", "rt");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await revokeAtProvider(fetchFn, "microsoft", "rt");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await expect(revokeAtProvider(async () => { throw new Error("offline"); }, "google", "rt")).resolves.toBeUndefined();
  });
});

describe("getting access for a send", () => {
  async function row(token = "rt", provider = "google") {
    const sealed = await sealToken(KEY, "u1", token);
    return { provider, address: "marcus@advisory.example", scope: GOOGLE_SEND_SCOPE, token_ciphertext: sealed.ciphertext, token_iv: sealed.iv };
  }
  const db = (secret: unknown) => {
    const calls: [string, Record<string, unknown>][] = [];
    return { calls, rpc: async (fn: string, args: Record<string, unknown>) => { calls.push([fn, args]); return { data: fn === "mailbox_secret" ? secret : null, error: null }; } };
  };

  it("is not connected when there is no row", async () => {
    expect(await getMailboxAccess(db(null), async () => reply(200, {}), config, "u1")).toEqual({ ok: false, reason: "not_connected" });
  });

  it("returns an access token and nothing that reads", async () => {
    const d = db(await row());
    const r = await getMailboxAccess(d, async () => reply(200, { access_token: "at", expires_in: 3000, scope: `openid ${GOOGLE_SEND_SCOPE}` }), config, "u1");
    expect(r).toEqual({ ok: true, accessToken: "at", expiresIn: 3000, provider: "google", address: "marcus@advisory.example" });
    expect(d.calls.map(([fn]) => fn)).toEqual(["mailbox_secret"]);
  });

  it("deletes the token when the provider took the permission back, so a send says so plainly", async () => {
    const d = db(await row());
    expect(await getMailboxAccess(d, async () => reply(400, { error: "invalid_grant" }), config, "u1")).toEqual({ ok: false, reason: "revoked" });
    expect(d.calls.map(([fn]) => fn)).toEqual(["mailbox_secret", "mailbox_delete"]);
  });

  it("keeps the token when the provider is only down", async () => {
    const d = db(await row());
    expect(await getMailboxAccess(d, async () => reply(503, {}), config, "u1")).toEqual({ ok: false, reason: "unavailable" });
    expect(d.calls.map(([fn]) => fn)).toEqual(["mailbox_secret"]);
  });

  it("deletes a token that can't be opened: the key changed, or it belongs to someone else", async () => {
    const other = await sealToken(KEY, "someone-else", "rt");
    const d = db({ provider: "google", address: "a@b.example", scope: "s", token_ciphertext: other.ciphertext, token_iv: other.iv });
    expect(await getMailboxAccess(d, async () => reply(200, {}), config, "u1")).toEqual({ ok: false, reason: "unreadable" });
    expect(d.calls.map(([fn]) => fn)).toEqual(["mailbox_secret", "mailbox_delete"]);
    const bad = db({ provider: "yahoo", address: "a", token_ciphertext: "x", token_iv: "y" });
    expect(await getMailboxAccess(bad, async () => reply(200, {}), config, "u1")).toEqual({ ok: false, reason: "unreadable" });
  });

  it("deletes a token whose grant now carries more than sending, or no longer sending", async () => {
    const wide = db(await row());
    expect(await getMailboxAccess(wide, async () => reply(200, { access_token: "at", scope: `${GOOGLE_SEND_SCOPE} https://mail.google.com/` }), config, "u1")).toEqual({ ok: false, reason: "too_broad" });
    expect(wide.calls.map(([fn]) => fn)).toContain("mailbox_delete");
    const gone = db(await row());
    expect(await getMailboxAccess(gone, async () => reply(200, { access_token: "at", scope: "openid email" }), config, "u1")).toEqual({ ok: false, reason: "revoked" });
    expect(gone.calls.map(([fn]) => fn)).toContain("mailbox_delete");
  });

  it("stores a refresh token the provider rotated, encrypted, without marking a new connection", async () => {
    const d = db(await row("rt", "microsoft"));
    const r = await getMailboxAccess(d, async () => reply(200, { access_token: "at", scope: "Mail.Send", refresh_token: "rt-new" }), config, "u1");
    expect(r.ok).toBe(true);
    const store = d.calls.find(([fn]) => fn === "mailbox_store")![1];
    expect(store).toMatchObject({ p_user_id: "u1", p_provider: "microsoft", p_rotated: true });
    expect(JSON.stringify(store)).not.toContain("rt-new");
    expect(await openToken(KEY, "u1", { ciphertext: store.p_token_ciphertext as string, iv: store.p_token_iv as string })).toBe("rt-new");
  });
});
