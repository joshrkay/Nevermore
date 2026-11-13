import { supabase } from "@/integrations/supabase/client";

// A second sign-in step with an authenticator app (TOTP), through Supabase Auth's multi-factor calls.
// Whether one is *required* is the database's call (advisor_needs_second_factor); this only does the steps.

export type CodeResult = "ok" | "wrong_code" | "failed";

/** The id of the authenticator app this account has already set up, if any. */
export async function verifiedAuthenticatorId(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp[0]?.id ?? null;
}

/** Checks the 6-digit code from the person's authenticator app. A new sign-in is at the higher level once it is right. */
export async function checkCode(factorId: string, code: string): Promise<CodeResult> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (!error) return "ok";
  return (error as { code?: string }).code === "mfa_verification_failed" ? "wrong_code" : "failed";
}

export interface Enrolment {
  factorId: string;
  /** An image address (an SVG data URL) for the app to scan. */
  qrCode: string;
  /** The same key as text, for typing into the app when scanning isn't possible. */
  secret: string;
}

const AUTHENTICATOR_NAME = "Authenticator app";

/** Starts setting up an authenticator app. A setup that was started and never finished is removed first, or its name would be refused. */
export async function beginEnrolment(): Promise<Enrolment> {
  const { data: existing, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw listError;
  for (const factor of existing.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: AUTHENTICATOR_NAME });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}
