// mailbox connects, checks and disconnects a broker's own mailbox (joshrkay/Nevermore#92, story M-4.3;
// docs/adr/0005-brokers-send-through-their-own-mailbox.md). The broker's browser hands over, once, the refresh token
// Google or Microsoft gave at sign-in; this function checks it works and grants only sending, encrypts it (a key only
// this function holds) and stores the ciphertext. Nothing here, or anywhere else, can read the broker's mail. The
// browser never gets a token back: it learns only whether a mailbox is connected (public.my_mailbox).
//
// The caller is a signed-in broker, and only for themselves: who they are comes from their own login. The database
// refuses the connection of anyone who isn't an advisor or admin. Logs carry the broker's id, the provider and a
// failure kind, never a token, an address or a scope. index.ts wires in Deno and the real Supabase client; the tests
// wire in fakes.

import { getMailboxAccess, MAILBOX_PROBLEMS, readMailboxConfig, refreshAccessToken, revokeAtProvider, type MailboxDb, type MailboxConfig } from "../_shared/mailbox.ts";
import { openToken, sealToken } from "../_shared/mailboxCrypto.ts";
import { excessScopes, grantsSend, type MailboxProvider } from "../_shared/mailboxScopes.ts";
import { bearerToken } from "../_shared/serviceAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_BODY = 8192;
const NOT_MEMBER = "Only a member of a firm can connect a mailbox. Ask a firm's owner to invite you first.";

export interface MailboxClient extends MailboxDb {
  auth: { getUser: () => PromiseLike<{ data: { user: { id: string; email?: string | null } | null } }> };
}

export interface MailboxDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options?: { global?: { headers?: Record<string, string> } }) => MailboxClient;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  log: (line: string) => void;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isProvider = (v: unknown): v is MailboxProvider => v === "google" || v === "microsoft";

export async function handleMailboxRequest(req: Request, deps: MailboxDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = deps.env("SUPABASE_URL");
  const anonKey = deps.env("SUPABASE_ANON_KEY");
  const serviceKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    deps.log("MAILBOX_CONFIG_MISSING: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set");
    return json({ error: "Mailboxes aren't available right now." }, 503);
  }
  const authorization = req.headers.get("Authorization");
  if (!bearerToken(authorization)) return json({ error: "Unauthorized" }, 401);

  const text = await req.text();
  if (text.length > MAX_BODY) return json({ error: "Request too large" }, 413);
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Send a JSON object." }, 400);
  }

  const user = deps.createClient(url, anonKey, { global: { headers: { Authorization: authorization as string } } });
  const { data: { user: who } } = await user.auth.getUser();
  if (!who) return json({ error: "Unauthorized" }, 401);

  // Who they are comes from their id; whether their token belongs to a current member of a firm is asked of the database with
  // their own login (my_firms() answers a password sign-in that has not completed a second factor with no firm), so that
  // is refused here too. A platform role is not asked: a founder or an invited member holds none.
  if (body.action === "connect" || body.action === "check" || body.action === "disconnect") {
    const mine = await user.rpc("my_firms", {});
    if (mine.error || !Array.isArray(mine.data) || mine.data.length === 0) return json({ error: NOT_MEMBER, code: "not_member" }, 403);
  }

  const configured = readMailboxConfig(deps.env);
  if (!configured.ok) {
    deps.log(`MAILBOX_CONFIG_MISSING: ${configured.problem}`);
    return json({ error: MAILBOX_PROBLEMS.not_configured, code: "not_configured" }, 503);
  }
  const config = configured.config;
  const db = deps.createClient(url, serviceKey);

  switch (body.action) {
    case "connect":
      return connect(db, deps, config, who, body);
    case "check": {
      const access = await getMailboxAccess(db, deps.fetch, config, who.id);
      if (!access.ok) deps.log(`MAILBOX_CHECK user=${who.id} result=${access.reason}`);
      // Never the access token: a check says whether sending would work.
      return access.ok ? json({ connected: true, provider: access.provider, address: access.address }) : json({ connected: false, code: access.reason, message: MAILBOX_PROBLEMS[access.reason] });
    }
    case "disconnect":
      return disconnect(db, deps, config, who.id);
    default:
      return json({ error: "Unknown action." }, 400);
  }
}

async function connect(
  db: MailboxClient, deps: MailboxDeps, config: MailboxConfig, who: { id: string; email?: string | null }, body: Record<string, unknown>,
): Promise<Response> {
  const provider = body.provider;
  const refreshToken = body.refresh_token;
  if (!isProvider(provider)) return json({ error: "provider must be google or microsoft." }, 400);
  if (typeof refreshToken !== "string" || refreshToken.length < 10 || refreshToken.length > 4000) return json({ error: "refresh_token is required." }, 400);
  // The mailbox is the one the broker signed in with: the account's own verified address.
  const address = who.email?.trim().toLowerCase();
  if (!address) return json({ error: "This account has no email address." }, 400);

  // The token has to work, and its grant has to be sending and nothing more, before it is kept.
  const refreshed = await refreshAccessToken(deps.fetch, config, provider, refreshToken);
  if (!refreshed.ok) {
    deps.log(`MAILBOX_CONNECT_REFUSED user=${who.id} provider=${provider} reason=${refreshed.reason}`);
    const status = refreshed.reason === "unavailable" ? 502 : refreshed.reason === "not_configured" ? 503 : 400;
    return json({ error: MAILBOX_PROBLEMS[refreshed.reason], code: refreshed.reason }, status);
  }
  if (!grantsSend(provider, refreshed.scope)) {
    deps.log(`MAILBOX_CONNECT_REFUSED user=${who.id} provider=${provider} reason=no_send`);
    return json({ error: "The send permission wasn't allowed, so nothing was connected. You can still send by hand from your own mail with the thread address in CC.", code: "no_send" }, 400);
  }
  if (excessScopes(provider, refreshed.scope).length > 0) {
    deps.log(`MAILBOX_CONNECT_REFUSED user=${who.id} provider=${provider} reason=too_broad`);
    return json({ error: MAILBOX_PROBLEMS.too_broad, code: "too_broad" }, 400);
  }

  // If the provider rotated the token while we tested it, the new one is the one to keep.
  const sealed = await sealToken(config.key, who.id, refreshed.refreshToken ?? refreshToken);
  const stored = await db.rpc("mailbox_store", {
    p_user_id: who.id, p_provider: provider, p_address: address, p_scope: refreshed.scope,
    p_token_ciphertext: sealed.ciphertext, p_token_iv: sealed.iv, p_rotated: false,
  });
  if (stored.error) {
    deps.log(`MAILBOX_CONNECT_FAILED user=${who.id} provider=${provider} code=${stored.error.code ?? "unexpected"}`);
    if (stored.error.code === "42501") return json({ error: NOT_MEMBER, code: "not_member" }, 403);
    return json({ error: "Something went wrong. Try again.", code: "store_failed" }, 500);
  }
  deps.log(`MAILBOX_CONNECTED user=${who.id} provider=${provider}`);
  return json({ connected: true, provider, address });
}

async function disconnect(db: MailboxClient, deps: MailboxDeps, config: MailboxConfig, userId: string): Promise<Response> {
  // Ask the provider to revoke it when it can be opened, then delete it whether or not that worked.
  const secret = await db.rpc("mailbox_secret", { p_user_id: userId });
  const row = secret.data as { provider?: unknown; token_ciphertext?: unknown; token_iv?: unknown } | null;
  if (row && isProvider(row.provider) && typeof row.token_ciphertext === "string" && typeof row.token_iv === "string") {
    const token = await openToken(config.key, userId, { ciphertext: row.token_ciphertext, iv: row.token_iv });
    if (token !== null) await revokeAtProvider(deps.fetch, row.provider, token);
  }
  const deleted = await db.rpc("mailbox_delete", { p_user_id: userId });
  if (deleted.error) {
    deps.log(`MAILBOX_DISCONNECT_FAILED user=${userId} code=${deleted.error.code ?? "unexpected"}`);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
  deps.log(`MAILBOX_DISCONNECTED user=${userId}`);
  return json({ connected: false });
}
