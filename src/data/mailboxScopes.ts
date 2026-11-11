// What the product asks Google and Microsoft for when a broker signs in (joshrkay/Nevermore#92, stories M-4.1 and
// M-4.3; docs/adr/0005-brokers-send-through-their-own-mailbox.md). Send only: nothing that reads, lists or searches a
// mailbox. mailboxScopes.test.ts fails if a scope outside the lists below is ever added, so asking for more has to be
// a deliberate edit of that test and of the ADR.

import { GOOGLE_SEND_SCOPE, MICROSOFT_SEND_SCOPE } from "../../supabase/functions/_shared/mailboxScopes.ts";

export { GOOGLE_SEND_SCOPE, MICROSOFT_SEND_SCOPE };

export type BrokerProvider = "google" | "microsoft";

export const BROKER_PROVIDERS: readonly BrokerProvider[] = ["google", "microsoft"];

export const BROKER_PROVIDER_LABELS: Record<BrokerProvider, string> = { google: "Google", microsoft: "Microsoft" };

/** Who the person is, which is what makes it a sign-in. Never a mailbox permission. */
const IDENTITY_SCOPES = ["openid", "email", "profile"] as const;

/** The only scopes a request may carry, besides identity: the send permission, and what lets it be used later. */
export const ALLOWED_SCOPES: readonly string[] = [...IDENTITY_SCOPES, GOOGLE_SEND_SCOPE, MICROSOFT_SEND_SCOPE, "offline_access"];

/** The scopes asked for, space separated, as Supabase's `scopes` option takes them. */
export function brokerScopes(provider: BrokerProvider): string {
  // Google's offline access is a query parameter (brokerQueryParams), not a scope; Microsoft's is `offline_access`.
  return provider === "google" ? GOOGLE_SEND_SCOPE : [MICROSOFT_SEND_SCOPE, "offline_access"].join(" ");
}

/**
 * Extra authorization parameters. Google gives a refresh token only for an offline request, and only when the person
 * is asked each time (`prompt=consent`): without it a broker who signed in before would get none to send with.
 */
export function brokerQueryParams(provider: BrokerProvider): Record<string, string> | undefined {
  return provider === "google" ? { access_type: "offline", prompt: "consent" } : undefined;
}

/** Supabase's name for each provider. */
export const SUPABASE_PROVIDER: Record<BrokerProvider, "google" | "azure"> = { google: "google", microsoft: "azure" };

export const isBrokerProvider = (v: unknown): v is BrokerProvider => v === "google" || v === "microsoft";
