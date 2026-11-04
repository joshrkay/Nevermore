import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INTAKE_CONSENT_VERSION, intakeConsentText } from "@/data/intakeConsent";

/**
 * Whether the signed-in account has agreed to the intake consent in force (src/data/intakeConsent.ts), and a
 * way to agree. The database is the record: an agreement only counts once the server has received it.
 *
 * - `checking`: looking it up (also while there is no user yet).
 * - `needed`: no agreement to this version yet.
 * - `agreed`: recorded; the Chamber may open.
 * - `unavailable`: the lookup failed; `retry` tries again. The Chamber stays closed rather than guessing.
 */
export type IntakeConsentStatus = "checking" | "needed" | "agreed" | "unavailable";

export interface UseIntakeConsent {
  status: IntakeConsentStatus;
  agree: () => Promise<void>;
  agreeing: boolean;
  /** Why the last agreement didn't go through, in words for the prospect. */
  agreeError: string | null;
  retry: () => void;
}

export function useIntakeConsent(): UseIntakeConsent {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [status, setStatus] = useState<IntakeConsentStatus>("checking");
  const [agreeing, setAgreeing] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  // The account the current answer is about, so a sign-in as someone else never inherits it.
  const forRef = useRef<string | null>(null);

  useEffect(() => {
    forRef.current = userId;
    setStatus("checking");
    setAgreeError(null);
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("intake_consents")
        .select("accepted_at")
        .eq("user_id", userId)
        .eq("consent_version", INTAKE_CONSENT_VERSION)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Couldn't check intake consent:", error.message);
        setStatus("unavailable");
        return;
      }
      setStatus(data ? "agreed" : "needed");
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, run]);

  const agree = useCallback(async () => {
    const asked = forRef.current;
    if (!asked) return;
    setAgreeing(true);
    setAgreeError(null);
    const { error } = await supabase.rpc("record_intake_consent", {
      p_version: INTAKE_CONSENT_VERSION,
      p_text: intakeConsentText(),
    });
    if (forRef.current !== asked) return;
    setAgreeing(false);
    if (!error) {
      setStatus("agreed");
      return;
    }
    const code = (error as { code?: string }).code;
    console.error("Couldn't record intake consent:", code ?? error.message);
    setAgreeError(
      code === "EA005"
        ? "This page is out of date. Reload it to read the current wording, then agree again."
        : "We couldn't record your agreement. Check your connection and try again.",
    );
  }, []);

  const retry = useCallback(() => setRun((n) => n + 1), []);

  return { status, agree, agreeing, agreeError, retry };
}
