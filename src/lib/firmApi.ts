import { supabase } from "@/integrations/supabase/client";

// What the screens at a firm address ask the database (story CRM-P1.3a). Both answers only choose what to show;
// the database still checks membership on every row and function (D-18).

/** The name an address shows before sign-in: the firm's name for any firm that exists, approved or not, or null when no firm holds it. */
export async function fetchFirmName(address: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("firm_public_name", { p_address: address });
  if (error) throw new Error("Couldn't look up this firm address.");
  return typeof data === "string" ? data : null;
}

/** Whether the signed-in caller is a current member of the firm at this address. */
export async function fetchIsMemberOfFirmAddress(address: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_member_of_firm_address", { p_address: address });
  if (error) throw new Error("Couldn't check your membership.");
  return data === true;
}
