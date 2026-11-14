// A broker signing in with Google or Microsoft (joshrkay/Nevermore#92, story M-4.1; docs/adr/0005).
//
// This uses its own Supabase client, for one reason: an OAuth sign-in has to use the PKCE flow (the provider sends the
// browser back with `?code=…`, which only this browser can redeem), whereas the app's main client keeps the implicit
// flow and never reads a session out of the address, so that a link someone sends can't sign a browser in as them
// (client.ts, client.test.ts). The two share storage, so once the code is redeemed the page reloads and the main client
// picks the session up. This client never refreshes a session or stays around after the redirect.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { brokeredPreviewStorage } from "@/integrations/supabase/previewAuthStorage";
import { brokerQueryParams, brokerScopes, SUPABASE_PROVIDER, type BrokerProvider } from "@/data/mailboxScopes";

export const BROKER_CALLBACK_PATH = "/broker/callback";
export const BROKER_DEFAULT_NEXT = "/advisor";

let client: SupabaseClient | null = null;

function pkceClient(): SupabaseClient {
  client ??= createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: false, storage: brokeredPreviewStorage() },
  });
  return client;
}

/** Where to go after signing in: a page of the advisor console, never anywhere else on or off this site. */
export function brokerNext(raw: string | null | undefined): string {
  if (!raw || !/^\/advisor(\/[A-Za-z0-9._~\-/]*)?$/.test(raw) || raw.includes("..") || raw.includes("//")) return BROKER_DEFAULT_NEXT;
  return raw;
}

/** The address the provider sends the broker back to. It must be on Supabase's Redirect URLs list (docs/SUPABASE_SETUP.md). */
export function brokerCallbackUrl(origin: string, next?: string | null): string {
  const target = brokerNext(next);
  return target === BROKER_DEFAULT_NEXT
    ? `${origin}${BROKER_CALLBACK_PATH}`
    : `${origin}${BROKER_CALLBACK_PATH}?next=${encodeURIComponent(target)}`;
}

/** Sends the browser to Google or Microsoft to sign in, asking for the send-only permission with it. Throws if Supabase refuses to start. */
export async function startBrokerSignIn(provider: BrokerProvider, next?: string | null): Promise<void> {
  const { error } = await pkceClient().auth.signInWithOAuth({
    provider: SUPABASE_PROVIDER[provider],
    options: {
      redirectTo: brokerCallbackUrl(window.location.origin, next),
      scopes: brokerScopes(provider),
      queryParams: brokerQueryParams(provider),
    },
  });
  if (error) throw error;
}

export type BrokerSignInResult =
  | {
      ok: true;
      /**
       * What became of the mailbox: `connected` (the product keeps what lets it send), `not_granted` (the broker
       * didn't allow sending, so there is nothing to keep), `waiting` (they belong to no firm yet, so there is no
       * mailbox to connect until an owner approves them) or `failed` (they allowed it but it couldn't be kept).
       */
      mailbox: "connected" | "not_granted" | "waiting" | "failed";
    }
  | { ok: false };

const providerOf = (appProvider: unknown): BrokerProvider | null =>
  appProvider === "google" ? "google" : appProvider === "azure" ? "microsoft" : null;

/**
 * Hands the refresh token to the mailbox function, which tests it, encrypts it and keeps it (story M-4.3). The token
 * goes once, over this request, and is never stored in the browser; the function never sends it back.
 */
async function connectMailbox(accessJwt: string, provider: BrokerProvider, refreshToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mailbox`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessJwt}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect", provider, refresh_token: refreshToken }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Redeems the code the provider sent the browser back with, which signs the broker in, and connects their mailbox if
 * they allowed the product to send. A broker who didn't still has an account; one whose mailbox couldn't be connected
 * is told so on their mailbox page.
 */
export async function finishBrokerSignIn(code: string): Promise<BrokerSignInResult> {
  const { data, error } = await pkceClient().auth.exchangeCodeForSession(code);
  if (error || !data.session) return { ok: false };
  const { session } = data;
  // Whether they belong to a firm yet. A mailbox is kept only for a member of a firm (the database refuses anyone else), so a broker who has
  // only asked to join one (CRM-P1.4: asking happens at the firm's address, not here) has nothing to connect until an owner approves them.
  // A failure just leaves the broker waiting, as before.
  const firms = await pkceClient().rpc("my_firms");
  const hasRole = !firms.error && Array.isArray(firms.data) && firms.data.length > 0;
  const refreshToken = session.provider_refresh_token;
  if (!hasRole) return { ok: true, mailbox: "waiting" };
  if (!refreshToken) return { ok: true, mailbox: "not_granted" };
  const provider = providerOf(session.user?.app_metadata?.provider);
  if (!provider) return { ok: true, mailbox: "failed" };
  return { ok: true, mailbox: (await connectMailbox(session.access_token, provider, refreshToken)) ? "connected" : "failed" };
}
