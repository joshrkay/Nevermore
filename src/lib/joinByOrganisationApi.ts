import { supabase } from "@/integrations/supabase/client";
import { classifyApiError } from "@/lib/advisorApi";

// What the screens ask the database for joining a firm by organisation (story CRM-P1.4). The database decides every rule: only a current
// owner of the firm lists or removes an organisation or decides a request; the match is on what the provider vouches for, never the
// email text; a free-mail domain can't be listed (D-18, D-23). These only put its refusals into words.

export type OrganisationProvider = "google" | "microsoft";
export type JoinRole = "owner" | "lead" | "agent";

export interface ListedOrganisation {
  id: string;
  provider: OrganisationProvider;
  /** A Google domain or a Microsoft tenant ID. */
  orgId: string;
  label: string;
  addedAt: string;
}

export interface JoinRequest {
  id: string;
  email: string;
  askedAt: string;
  provider: OrganisationProvider;
  /** The listed organisation that vouched for the person, by the name the owner gave it. */
  organisation: string;
}

export class JoinByOrganisationError extends Error {}

type DbError = { code?: string; message?: string };

function refusal(error: DbError, fallback: string): Error {
  // A session the server no longer accepts is said in its own words.
  const ended = classifyApiError({ message: error.message ?? "", code: error.code }, "");
  if (ended.unauthenticated) return ended;
  switch (error.code) {
    // The database's own sentences for a value it will not list say what to do instead.
    case "22023": return new JoinByOrganisationError(error.message || fallback);
    case "23505": return new JoinByOrganisationError("That organisation is already listed.");
    case "42501": return new JoinByOrganisationError("Only an owner of the firm can do that.");
    case "PT403": return new JoinByOrganisationError("This firm can't do that.");
    case "PT409": return new JoinByOrganisationError(error.message || fallback);
    case "PT410": return new JoinByOrganisationError("Someone has already decided that request.");
    default: return new JoinByOrganisationError(fallback);
  }
}

/** The organisations the firm lists, oldest first. Owners only. */
export async function fetchOrganisations(firmId: string): Promise<ListedOrganisation[]> {
  const { data, error } = await supabase.rpc("firm_organisations", { p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't load the organisations.");
  return (data ?? []).map((o) => ({ id: o.id, provider: o.provider as OrganisationProvider, orgId: o.org_id, label: o.label, addedAt: o.added_at }));
}

/** Lists a Google domain or a Microsoft tenant. The database refuses free-mail domains and personal-account tenants, and says why. */
export async function addOrganisation(input: { firmId: string; provider: OrganisationProvider; orgId: string; label: string }): Promise<void> {
  const { error } = await supabase.rpc("add_firm_organisation", { p_firm_id: input.firmId, p_provider: input.provider, p_org_id: input.orgId, p_label: input.label });
  if (error) throw refusal(error, "Couldn't list the organisation. Try again.");
}

export async function removeOrganisation(id: string): Promise<void> {
  const { error } = await supabase.rpc("remove_firm_organisation", { p_id: id });
  if (error) throw refusal(error, "Couldn't remove the organisation. Try again.");
}

/** The people who asked to join, oldest first. Owners only. */
export async function fetchJoinRequests(firmId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase.rpc("firm_join_requests", { p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't load the requests.");
  return (data ?? []).map((r) => ({ id: r.request_id, email: r.email, askedAt: r.asked_at, provider: r.provider as OrganisationProvider, organisation: r.org_label }));
}

/**
 * Makes the person a member with the role chosen. The membership has no team until teams have a screen. Resolves with the role the person
 * now holds: the one chosen, or the one they already had if they had become a member another way meanwhile.
 */
export async function approveJoinRequest(id: string, role: JoinRole): Promise<JoinRole> {
  const { data, error } = await supabase.rpc("approve_join_request", { p_request_id: id, p_role: role });
  if (error) throw refusal(error, "Couldn't approve the request. Try again.");
  return data === "owner" || data === "lead" || data === "agent" ? data : role;
}

export async function declineJoinRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("decline_join_request", { p_request_id: id });
  if (error) throw refusal(error, "Couldn't decline the request. Try again.");
}

/**
 * A signed-in person who is not a member, at a firm's address: whether the database now holds their request to join, because the
 * organisation their own sign-in vouches for is one the firm lists. Anything else, a failure included, is "none", so the person sees
 * what they saw before this existed and learns nothing about what the firm lists.
 */
export async function askToJoinFirm(firmAddress: string): Promise<"asked" | "none"> {
  try {
    const { data, error } = await supabase.rpc("ask_to_join_firm", { p_firm_address: firmAddress });
    return !error && data === "asked" ? "asked" : "none";
  } catch {
    return "none";
  }
}
