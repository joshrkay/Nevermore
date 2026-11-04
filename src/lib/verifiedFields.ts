import { supabase } from "@/integrations/supabase/client";
import { NO_VERIFIED_FIELDS } from "@/data/requiredItems";

// The fields an advisor verified on a prospect's intake (B-2.2). A verified field is settled, so the Chamber and
// the Manuscript stop asking the prospect about it (`verificationSettles` says for which statuses). The database's
// session_verified_fields answers only the intake's owner (and advisors), with the field names alone.

/**
 * The fields an advisor verified on the intake, or null when they can't be read. A caller that already holds a set
 * keeps it on null rather than showing every field as unverified. Never an error the prospect sees.
 */
export async function readVerifiedFields(sessionId: string): Promise<ReadonlySet<string> | null> {
  try {
    const { data, error } = await supabase.rpc("session_verified_fields", { p_session_id: sessionId });
    if (error) throw error;
    return Array.isArray(data) ? new Set(data.filter((f): f is string => typeof f === "string")) : NO_VERIFIED_FIELDS;
  } catch (err) {
    console.warn("Couldn't read the fields an advisor verified:", err);
    return null;
  }
}
