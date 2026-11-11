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
  | { ok: true; /** Whether the broker let the product send as them: a refresh token came back. */ mailbox: "granted" | "not_granted" }
  | { ok: false };

/**
 * Redeems the code the provider sent the browser back with, which signs the broker in. Nothing from the provider is
 * kept here: connecting the mailbox (storing what lets the product send) is story M-4.3.
 */
export async function finishBrokerSignIn(code: string): Promise<BrokerSignInResult> {
  const { data, error } = await pkceClient().auth.exchangeCodeForSession(code);
  if (error || !data.session) return { ok: false };
  return { ok: true, mailbox: data.session.provider_refresh_token ? "granted" : "not_granted" };
}
