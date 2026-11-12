// What a broker's mailbox permission may be (joshrkay/Nevermore#92, stories M-4.1 and M-4.3; docs/adr/0005): send only.
// The browser's sign-in (src/data/mailboxScopes.ts) asks for these, and the mailbox function refuses to keep a token
// whose grant carries more, so the product never holds a permission to read a mailbox even if an app was set up with
// one. No imports, so it runs under Deno and Vitest alike.

/** Google's send-only permission. A sensitive scope, not a restricted one (ADR 0005). */
export const GOOGLE_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

/** Microsoft's send-only permission, on Microsoft Graph. */
export const MICROSOFT_SEND_SCOPE = "Mail.Send";

export type MailboxProvider = "google" | "microsoft";

// Scopes that say who the person is, or let a token be used later. None reads a mailbox.
const HARMLESS = new Set(["openid", "email", "profile", "offline_access", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile", "user.read"]);

const normalise = (s: string) => s.trim().toLowerCase().replace(/^https:\/\/graph\.microsoft\.com\//, "");

/** The scopes in a provider's space-separated grant. */
export const grantedScopes = (scope: string | null | undefined): string[] => (scope ?? "").split(/\s+/).filter(Boolean);

/** Whether the grant lets the product send as the broker. */
export function grantsSend(provider: MailboxProvider, scope: string | null | undefined): boolean {
  const scopes = grantedScopes(scope).map(normalise);
  return scopes.includes(normalise(provider === "google" ? GOOGLE_SEND_SCOPE : MICROSOFT_SEND_SCOPE));
}

/** The scopes in the grant that are neither the send permission nor harmless: anything that could reach a mailbox or more. */
export function excessScopes(provider: MailboxProvider, scope: string | null | undefined): string[] {
  const send = normalise(provider === "google" ? GOOGLE_SEND_SCOPE : MICROSOFT_SEND_SCOPE);
  return grantedScopes(scope).filter((s) => {
    const n = normalise(s);
    return n !== send && !HARMLESS.has(n);
  });
}
