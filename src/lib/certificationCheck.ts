import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ChamberSubmission } from "@/data/manuscript";

/**
 * The certification a page's files were built from: the intake's status when the page loaded, and the hash and
 * version the database stamped on the certification. A tab left open can outlive it (a withdrawal, a new
 * certification), so each download checks it again at the click, before it gives a file.
 */
export interface BuiltFrom {
  sessionId: string;
  status: string;
  dataSha256: string | null;
  version: number | null;
}

export const certificationOf = (sessionId: string, status: string, submission: Pick<ChamberSubmission, "data_sha256" | "version">): BuiltFrom => ({
  sessionId,
  status,
  dataSha256: submission.data_sha256 ?? null,
  version: submission.version ?? null,
});

export const CHANGED_SINCE_OPENED = "This intake changed since you opened the page. Reload to get the certified version.";
const COULD_NOT_CHECK = "We couldn't check that this is still the certified version. Please try again.";

/**
 * Re-reads the intake's status and certification from the database: true when they are still what the page was built
 * from. Otherwise it says so in a toast and gives false, and the caller gives no file. Every per-PEO file, the answers
 * as JSON and the bundle go through it.
 */
export async function unchangedSinceOpened(built: BuiltFrom): Promise<boolean> {
  // Untyped: the generated types can't follow a select of JSON paths.
  const { data, error } = await (supabase as unknown as SupabaseClient)
    .from("chamber_sessions")
    .select("status, data_sha256:submission->>data_sha256, version:submission->>version")
    .eq("id", built.sessionId)
    .maybeSingle();
  if (error) {
    toast.error(COULD_NOT_CHECK);
    return false;
  }
  const now = data as { status: string; data_sha256: string | null; version: string | null } | null;
  const same = !!now && now.status === built.status && (now.data_sha256 ?? null) === built.dataSha256
    && (now.version ?? null) === (built.version === null ? null : String(built.version));
  if (!same) toast.error(CHANGED_SINCE_OPENED);
  return same;
}
