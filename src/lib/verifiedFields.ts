import { supabase } from "@/integrations/supabase/client";
import { NO_VERIFIED_FIELDS } from "@/data/requiredItems";

// The fields an advisor verified on a prospect's intake (B-2.2). A verified field is settled whatever its
// status, so the Chamber and the Manuscript stop asking the prospect about it. The database's
// session_verified_fields answers only the intake's owner (and advisors), with the field names alone.

/**
 * The fields an advisor verified on the intake. None when they can't be read: that only means a field
 * stays on the prospect's list a little longer, so it is never an error the prospect sees.
 */
export async function fetchVerifiedFields(sessionId: string): Promise<ReadonlySet<string>> {
  try {
    const { data, error } = await supabase.rpc("session_verified_fields", { p_session_id: sessionId });
    if (error) throw error;
    return Array.isArray(data) ? new Set(data.filter((f): f is string => typeof f === "string")) : NO_VERIFIED_FIELDS;
  } catch (err) {
    console.warn("Couldn't read the fields an advisor verified:", err);
    return NO_VERIFIED_FIELDS;
  }
}
