import { supabase } from "@/integrations/supabase/client";

/**
 * Asks the server to send queued submission emails now, rather than at the next scheduled run.
 * The notifications are already queued with the submission itself, so this only affects how soon
 * they go out, never whether: a failure here is logged and otherwise ignored, and must never
 * affect the prospect's confirmation screen.
 */
export function dispatchOutbox(): void {
  supabase.functions.invoke("dispatch-outbox").then(
    ({ error }) => {
      if (error) console.warn("Couldn't start sending submission notifications now:", error.message);
    },
    (e: unknown) => console.warn("Couldn't start sending submission notifications now:", e instanceof Error ? e.message : e),
  );
}
