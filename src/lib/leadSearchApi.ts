// Leads in the menu's search (BR-5.4; public.search_leads, 20261205090000_search_leads.sql): the firm's leads the person may see that hold every word
// typed, five at most. Asked beside search_records, which finds the other kinds; the database decides who is found.
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export interface LeadHit { id: string; name: string; business: string | null; email: string | null; status: string }
export interface LeadSearch { query: string; rows: LeadHit[]; more: boolean }

const answer = z.object({
  query: z.string(),
  rows: z.array(z.object({ id: z.string(), name: z.string(), business: z.string().nullable(), email: z.string().nullable(), status: z.string() })),
  more: z.boolean(),
});

/** The leads found for the words typed. Throws when the database refuses or answers in another shape: the box then shows no leads. */
export async function searchLeads(firmId: string, words: string): Promise<LeadSearch> {
  const { data, error } = await supabase.rpc("search_leads", { p_firm_id: firmId, p_query: words });
  if (error) throw new Error("Couldn't search leads.");
  const parsed = answer.safeParse(data);
  if (!parsed.success) throw new Error("Couldn't search leads.");
  return {
    query: parsed.data.query, more: parsed.data.more,
    rows: parsed.data.rows.map((r) => ({ id: r.id, name: r.name, business: r.business, email: r.email, status: r.status })),
  };
}
