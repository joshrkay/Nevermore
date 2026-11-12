// A broker's connected mailbox (joshrkay/Nevermore#92, story M-4.3; docs/adr/0005): turning the stored, encrypted
// refresh token into an access token that can send, and keeping the token honest. Supabase does not store or refresh a
// provider's tokens, so the product does. The sending function (story M-2.1) calls getMailboxAccess(); the mailbox
// function calls it to check a connection. No imports beyond the shared modules, so it runs under Deno and Vitest alike.

import { excessScopes, grantsSend, type MailboxProvider } from "./mailboxScopes.ts";
import { openToken, parseTokenKey, sealToken } from "./mailboxCrypto.ts";

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const microsoftTokenUrl = (tenant: string) => `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

export interface MailboxConfig {
  key: Uint8Array;
  google: OAuthClient | null;
  microsoft: (OAuthClient & { tenant: string }) | null;
}

/** The settings the mailbox needs: the encryption key, and each provider's app only if both its parts are set. */
export function readMailboxConfig(env: (name: string) => string | undefined): { ok: true; config: MailboxConfig } | { ok: false; problem: string } {
  const key = parseTokenKey(env("MAILBOX_TOKEN_KEY"));
  if (!key) return { ok: false, problem: "MAILBOX_TOKEN_KEY is not set to 32 random bytes, base64 encoded" };
  const gId = env("GOOGLE_OAUTH_CLIENT_ID")?.trim();
  const gSecret = env("GOOGLE_OAUTH_CLIENT_SECRET")?.trim();
  const mId = env("MICROSOFT_OAUTH_CLIENT_ID")?.trim();
  const mSecret = env("MICROSOFT_OAUTH_CLIENT_SECRET")?.trim();
  const tenant = env("MICROSOFT_OAUTH_TENANT")?.trim() || "organizations";
  return {
    ok: true,
    config: {
      key,
      google: gId && gSecret ? { clientId: gId, clientSecret: gSecret } : null,
      microsoft: mId && mSecret && /^[A-Za-z0-9.-]+$/.test(tenant) ? { clientId: mId, clientSecret: mSecret, tenant } : null,
    },
  };
}

export type RefreshResult =
  | { ok: true; accessToken: string; expiresIn: number; scope: string; /** A new refresh token, when the provider rotated it. */ refreshToken: string | null }
  | { ok: false; reason: "revoked" | "not_configured" | "unavailable" };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Trades a refresh token for an access token. `revoked` means the broker or their organisation took the permission back. */
export async function refreshAccessToken(fetchFn: Fetch, config: MailboxConfig, provider: MailboxProvider, refreshToken: string): Promise<RefreshResult> {
  const app = provider === "google" ? config.google : config.microsoft;
  if (!app) return { ok: false, reason: "not_configured" };
  const url = provider === "google" ? GOOGLE_TOKEN_URL : microsoftTokenUrl(config.microsoft!.tenant);
  const form = new URLSearchParams({ client_id: app.clientId, client_secret: app.clientSecret, grant_type: "refresh_token", refresh_token: refreshToken });
  let res: Response;
  try {
    res = await fetchFn(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  let body: Record<string, unknown> | null = null;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  if (res.ok && body && typeof body.access_token === "string") {
    return {
      ok: true,
      accessToken: body.access_token,
      expiresIn: typeof body.expires_in === "number" ? body.expires_in : 3600,
      scope: typeof body.scope === "string" ? body.scope : "",
      refreshToken: typeof body.refresh_token === "string" && body.refresh_token !== refreshToken ? body.refresh_token : null,
    };
  }
  const error = typeof body?.error === "string" ? body.error : "";
  // The provider looked at the token and refused it: the permission is gone for good.
  if (res.status >= 400 && res.status < 500 && ["invalid_grant", "interaction_required", "consent_required", "invalid_token"].includes(error)) return { ok: false, reason: "revoked" };
  if (error === "invalid_client" || error === "unauthorized_client") return { ok: false, reason: "not_configured" };
  return { ok: false, reason: "unavailable" };
}

/** Asks Google to revoke a token. Best effort: Microsoft has no equivalent for one app's token, so a Microsoft broker removes the app from their account page. */
export async function revokeAtProvider(fetchFn: Fetch, provider: MailboxProvider, token: string): Promise<void> {
  if (provider !== "google") return;
  try {
    await fetchFn(GOOGLE_REVOKE_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
  } catch {
    // Disconnecting here never waits on Google.
  }
}

type Rpc = { data: unknown; error: { code?: string } | null };

export interface MailboxDb {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<Rpc>;
}

export type MailboxAccess =
  | { ok: true; accessToken: string; expiresIn: number; provider: MailboxProvider; address: string }
  | { ok: false; reason: "not_connected" | "revoked" | "too_broad" | "unreadable" | "not_configured" | "unavailable" };

/** Why a send can't go through the mailbox, in words a broker reads. Nothing is sent to a PEO in any of these cases. */
export const MAILBOX_PROBLEMS: Record<Exclude<MailboxAccess, { ok: true }>["reason"], string> = {
  not_connected: "No mailbox is connected. Connect your mailbox, or send by hand from your own mail with the thread address in CC.",
  revoked: "Google or Microsoft no longer lets Nevermore send as you. Connect your mailbox again, or send by hand from your own mail with the thread address in CC.",
  too_broad: "This sign-in gave Nevermore more access than it asks for, so it was not kept. Connect again and allow only sending.",
  unreadable: "Your mailbox connection could not be read and was removed. Connect your mailbox again.",
  not_configured: "Sending through a mailbox isn't set up yet. Send by hand from your own mail with the thread address in CC.",
  unavailable: "Google or Microsoft didn't answer. Nothing was sent; try again in a minute.",
};

const isProvider = (v: unknown): v is MailboxProvider => v === "google" || v === "microsoft";

/**
 * A fresh access token for a broker's mailbox, from the stored token. A token the provider took back, one that doesn't
 * decrypt, or one whose grant carries more than sending is deleted, so the broker sees "not connected" and not a
 * connection that can never work. A refresh token the provider rotated replaces the stored one.
 */
export async function getMailboxAccess(db: MailboxDb, fetchFn: Fetch, config: MailboxConfig, userId: string): Promise<MailboxAccess> {
  const secret = await db.rpc("mailbox_secret", { p_user_id: userId });
  if (secret.error) return { ok: false, reason: "unavailable" };
  const row = secret.data as { provider?: unknown; address?: unknown; scope?: unknown; token_ciphertext?: unknown; token_iv?: unknown } | null;
  if (!row) return { ok: false, reason: "not_connected" };
  if (!isProvider(row.provider) || typeof row.address !== "string" || typeof row.token_ciphertext !== "string" || typeof row.token_iv !== "string") {
    await db.rpc("mailbox_delete", { p_user_id: userId });
    return { ok: false, reason: "unreadable" };
  }
  const provider = row.provider;
  const token = await openToken(config.key, userId, { ciphertext: row.token_ciphertext, iv: row.token_iv });
  if (token === null) {
    await db.rpc("mailbox_delete", { p_user_id: userId });
    return { ok: false, reason: "unreadable" };
  }
  const refreshed = await refreshAccessToken(fetchFn, config, provider, token);
  if (!refreshed.ok) {
    if (refreshed.reason === "revoked") await db.rpc("mailbox_delete", { p_user_id: userId });
    return { ok: false, reason: refreshed.reason };
  }
  if (excessScopes(provider, refreshed.scope).length > 0 || (refreshed.scope !== "" && !grantsSend(provider, refreshed.scope))) {
    await db.rpc("mailbox_delete", { p_user_id: userId });
    return { ok: false, reason: refreshed.scope !== "" && !grantsSend(provider, refreshed.scope) ? "revoked" : "too_broad" };
  }
  if (refreshed.refreshToken !== null) {
    const sealed = await sealToken(config.key, userId, refreshed.refreshToken);
    await db.rpc("mailbox_store", {
      p_user_id: userId, p_provider: provider, p_address: row.address, p_scope: refreshed.scope || String(row.scope ?? ""),
      p_token_ciphertext: sealed.ciphertext, p_token_iv: sealed.iv, p_rotated: true,
    });
  }
  return { ok: true, accessToken: refreshed.accessToken, expiresIn: refreshed.expiresIn, provider, address: row.address };
}
