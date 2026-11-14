import { verifiedAuthenticatorId } from "@/lib/secondFactor";

// How a person proves they are who they say, again, without leaving the page (story CRM-S3.8a): an export of a whole table asks for a sign-in within
// the last 12 hours (D-218), read by the database from the token's latest proof. There are two ways, and no more:
//  - `code`: they have an authenticator app, and a right code gives a token with a fresh proof, at the level that opens a firm's data;
//  - `sign_in_again`: they have none, so this device's session ends and they sign in again from the sign-in page, which brings them back.
// There is no password step. D-19: a password sign-in that has not done its second factor opens no firm's data (a fresh password-only token is refused
// "Not a member of that firm"), so asking for a password here would swap a working session for a locked-out one. Anyone who uses the console with a
// password already has an authenticator.
export type StepUp = { kind: "code"; factorId: string } | { kind: "sign_in_again" };

/** How this person can step up. Throws when it cannot be found out (the authenticator list could not be read), so the caller says so instead of guessing. */
export async function stepUpWay(): Promise<StepUp> {
  const factorId = await verifiedAuthenticatorId();
  return factorId ? { kind: "code", factorId } : { kind: "sign_in_again" };
}
