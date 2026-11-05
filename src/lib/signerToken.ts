// Certifying needs a sign-in that isn't a guest's: the database refuses a certification sent with a guest
// (anonymous) token (migration 20261020200000_block_guest_submission.sql, "An email-verified account is required to
// certify an intake"). A prospect who verified their email can still hold a token minted before they did, when they
// verified in another tab or the token wasn't replaced, and the refusal then reads as a broken save (QA F2). So the
// token is checked, and refreshed when it is a guest's, before a certification is sent.

/** The parts of supabase.auth this needs. */
export interface SignerAuth {
  getSession: () => Promise<{ data: { session: { access_token: string } | null } }>;
  refreshSession: () => Promise<{ data: { session: { access_token: string } | null }; error: unknown }>;
}

/** What the token a certification would be sent with says about its holder. */
export type SignerToken = "verified" | "guest" | "unknown";

/** The `is_anonymous` claim of an access token: true for a guest's, false for a verified account's, null when unreadable. */
export function tokenIsGuest(accessToken: string): boolean | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const claims = JSON.parse(atob(base64)) as { is_anonymous?: unknown };
    return typeof claims.is_anonymous === "boolean" ? claims.is_anonymous : null;
  } catch {
    return null;
  }
}

/**
 * The token a certification will be sent with, made current: the session this browser holds now (another tab's
 * sign-in included, as they share it), refreshed once when it is still a guest's. "guest" means the server still
 * calls this sign-in a guest after the refresh, so the prospect has to verify their email; "unknown" means it
 * couldn't be told, and the database decides.
 */
export async function ensureSignerToken(auth: SignerAuth): Promise<SignerToken> {
  try {
    const { data } = await auth.getSession();
    if (!data.session) return "unknown";
    const guest = tokenIsGuest(data.session.access_token);
    if (guest !== true) return guest === false ? "verified" : "unknown";
    const refreshed = await auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) return "unknown";
    const still = tokenIsGuest(refreshed.data.session.access_token);
    return still === true ? "guest" : still === false ? "verified" : "unknown";
  } catch {
    return "unknown";
  }
}

/** Whether a database error is the refusal of a guest's certification (block_guest_submission). */
export const isGuestCertificationRefusal = (error: { code?: string; message?: string } | null | undefined): boolean =>
  Boolean(error) && error!.code === "42501" && /email-verified account is required to certify/i.test(error!.message ?? "");
