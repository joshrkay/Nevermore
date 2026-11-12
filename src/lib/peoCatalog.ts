import { supabase } from "@/integrations/supabase/client";
import type { PeoRecord } from "@/data/peoCatalog";
import { parsePeoCatalog } from "@/data/peoProfiles";

/**
 * The PEOs, alphabetically, each with its requirement profile in use (public.peo_catalog(),
 * 20261115090000_peo_requirement_profiles.sql). Signed-in callers only, guests included; never a PEO contact.
 * Throws when the database can't be read.
 */
export async function readPeoCatalog(): Promise<PeoRecord[]> {
  const { data, error } = await supabase.rpc("peo_catalog");
  if (error) throw error;
  return parsePeoCatalog(data);
}
