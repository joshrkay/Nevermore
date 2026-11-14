import type { User } from "@supabase/supabase-js";
import { verifiedAuthenticatorId } from "@/lib/secondFactor";

// How a person proves they are who they say, again, without leaving the page (story CRM-S3.8a): an export of a whole table asks for a sign-in within
// the last 12 hours (D-218), read by the database from the token's latest proof. The three ways, in the order they are offered:
//  - `code`: they have an authenticator app, and a right code gives a token with a fresh proof;
//  - `password`: they sign in with a password and have no authenticator, and the password signs them in again;
//  - `sign_in_again`: they signed in with Google or Microsoft, which the app cannot ask again from here: this device's session ends and they sign in
//    again from the sign-in page, which brings them back.
export type StepUp = { kind: "code"; factorId: string } | { kind: "password"; email: string } | { kind: "sign_in_again" };

/** How this person can step up. Throws when it cannot be found out (the authenticator list could not be read), so the caller says so instead of guessing. */
export async function stepUpWay(user: Pick<User, "email" | "app_metadata" | "identities"> | null): Promise<StepUp> {
  const factorId = await verifiedAuthenticatorId();
  if (factorId) return { kind: "code", factorId };
  const hasPassword =
    (Array.isArray(user?.app_metadata?.providers) && user.app_metadata.providers.includes("email")) ||
    (user?.identities ?? []).some((i) => i.provider === "email");
  return user?.email && hasPassword ? { kind: "password", email: user.email } : { kind: "sign_in_again" };
}
