import { supabase } from "@/integrations/supabase/client";

/**
 * Tells the pilot funnel the prospect downloaded The Manuscript of their own certified intake (the only step only the
 * browser can see; migration 20261105092000). Fire and forget: a measurement never holds up or fails a download.
 */
export function recordManuscriptDownload(sessionId: string): void {
  void Promise.resolve()
    .then(() => supabase.rpc("record_manuscript_download", { p_session_id: sessionId }))
    .then((result) => {
      if (result?.error) console.warn("Couldn't record the Manuscript download:", result.error.code ?? result.error.message);
    })
    .catch((err) => console.warn("Couldn't record the Manuscript download:", err));
}
