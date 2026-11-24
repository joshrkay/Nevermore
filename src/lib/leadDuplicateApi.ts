// What the New lead form asks while a person types (BR-5.4; 20261202090000_lead_duplicates.sql): which of the firm's leads and accounts may be the one being
// made. The database decides what the person may see; a record they may not see comes as a mask that says only that one exists and whom to ask, and this
// drops anything of another shape so a mask can never carry a name on to the screen. A check is advice and never stops a save.
import { supabase } from "@/integrations/supabase/client";
import type { WhoToAsk } from "@/lib/duplicateApi";

export type LeadDuplicateReason = "email" | "name" | "website";
export type LeadDuplicateMatch =
  | { visible: true; kind: "lead" | "account"; id: string; name: string; business: string | null; reasons: LeadDuplicateReason[]; owner: string | null }
  | { visible: false; kind: "lead" | "account"; ask: WhoToAsk };
export interface LeadDuplicates { matches: LeadDuplicateMatch[]; more: number }

const isKind = (k: unknown): k is "lead" | "account" => k === "lead" || k === "account";

function readMatch(raw: unknown): LeadDuplicateMatch | null {
  const m = raw as Record<string, unknown> | null;
  if (!m || !isKind(m.kind)) return null;
  if (m.visible === false) {
    const ask = m.ask as { kind?: unknown; names?: unknown } | null;
    if (!ask || (ask.kind !== "owner" && ask.kind !== "firm_owners") || !Array.isArray(ask.names)) return null;
    // A mask is rebuilt from its own two fields: whatever else the answer held is not carried on.
    return { visible: false, kind: m.kind, ask: { kind: ask.kind, names: ask.names.filter((n): n is string => typeof n === "string") } };
  }
  if (m.visible !== true || typeof m.id !== "string" || typeof m.name !== "string" || !Array.isArray(m.reasons)) return null;
  return {
    visible: true, kind: m.kind, id: m.id, name: m.name, business: typeof m.business === "string" ? m.business : null,
    reasons: m.reasons.filter((r): r is LeadDuplicateReason => r === "email" || r === "name" || r === "website"), owner: typeof m.owner === "string" ? m.owner : null,
  };
}

/** The firm's leads and accounts that may be the one being typed. Throws when the check can't be made; the form ignores that. */
export async function checkLeadDuplicates(firmId: string, fields: { name: string; business: string; email: string; state: string }): Promise<LeadDuplicates> {
  const { data, error } = await supabase.rpc("duplicate_lead_check", {
    p_firm_id: firmId, p_name: fields.name, p_business: fields.business || null, p_email: fields.email || null, p_state: fields.state || null,
  });
  const d = data as { matches?: unknown; more?: unknown } | null;
  if (error || !d || !Array.isArray(d.matches)) throw new Error("Couldn't check for a duplicate.");
  return { matches: d.matches.map(readMatch).filter((m): m is LeadDuplicateMatch => m !== null), more: typeof d.more === "number" && d.more > 0 ? d.more : 0 };
}
