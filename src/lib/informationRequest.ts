import { supabase } from "@/integrations/supabase/client";
import { parseInformationRequest, type InformationRequest } from "@/data/informationRequest";

/**
 * The advisor's open request on the prospect's own intake, or null when there is none or it can't be read: a
 * request the page fails to show is still in the prospect's email. Never an error the prospect sees.
 */
export async function readInformationRequest(sessionId: string): Promise<InformationRequest | null> {
  try {
    const { data, error } = await supabase.rpc("prospect_information_request", { p_session_id: sessionId });
    if (error) throw error;
    return parseInformationRequest(data);
  } catch (err) {
    console.warn("Couldn't read the advisor's request:", err);
    return null;
  }
}
