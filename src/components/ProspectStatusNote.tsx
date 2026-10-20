import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { prospectStatusMessage } from "@/data/advisor";

// Tells the prospect where their submission stands, using only the statuses we choose to share.
// The database picks the status (it never returns an internal one); nothing shows if there's none.
const ProspectStatusNote = ({ sessionId }: { sessionId: string }) => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc("prospect_submission_status", { p_session_id: sessionId })
      .then(({ data, error }) => {
        if (!cancelled && !error) setMessage(prospectStatusMessage(data));
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  if (!message) return null;
  return (
    <div role="status" className="bg-primary/5 border border-primary/30 rounded-xl p-4 text-sm text-foreground">
      <span className="font-medium">Status:</span> {message}
    </div>
  );
};

export default ProspectStatusNote;
