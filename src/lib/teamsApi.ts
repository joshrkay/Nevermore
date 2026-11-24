// An owner's changes to who is what in the firm (CRM-X1.1, BR-5.3; 20261201090000_roles_teams_visibility.sql): a member's role and team, the teams, and who
// sees what. The database lets only a current owner do any of it; a refusal it put into words is shown in those words.
import { supabase } from "@/integrations/supabase/client";
import { AdvisorApiError } from "@/lib/advisorApi";
import type { MemberRole } from "@/lib/memberApi";

const IN_WORDS = new Set(["22023", "42501", "PT404", "PT423", "55000", "23514"]);
const refusal = (error: { code?: string; message?: string }, fallback: string) =>
  new AdvisorApiError(error.code && IN_WORDS.has(error.code) && error.message ? error.message : fallback, error.code);

export type Visibility = "by_level" | "everyone";
export interface Team { id: string; name: string; parentTeamId: string | null; parentName: string | null; members: number; canDelete: boolean }
export interface TeamMember { userId: string; email: string; name: string | null; role: MemberRole; teamId: string | null; teamName: string | null }
export interface TeamsPage { visibility: Visibility; teams: Team[]; members: TeamMember[] }

interface PageRow {
  visibility: Visibility;
  teams: { id: string; name: string; parent_team_id: string | null; parent_name: string | null; members: number; can_delete: boolean }[];
  members: { user_id: string; email: string; name: string | null; role: MemberRole; team_id: string | null; team_name: string | null }[];
}

/** The firm's teams, each current member's role and team, and the setting. Owners (and a support session reading as one). */
export async function loadTeamsPage(firmId: string): Promise<TeamsPage> {
  const { data, error } = await supabase.rpc("firm_teams_page", { p_firm_id: firmId });
  if (error) throw refusal(error, "Couldn't load the firm's teams. Try again.");
  const d = data as unknown as PageRow;
  return {
    visibility: d.visibility,
    teams: d.teams.map((t) => ({ id: t.id, name: t.name, parentTeamId: t.parent_team_id, parentName: t.parent_name, members: t.members, canDelete: t.can_delete })),
    members: d.members.map((m) => ({ userId: m.user_id, email: m.email, name: m.name, role: m.role, teamId: m.team_id, teamName: m.team_name })),
  };
}

/** Gives a member another role, another team, or both. The membership they had ends and a new one begins. */
export async function changeMember(firmId: string, userId: string, role: MemberRole, teamId: string | null): Promise<void> {
  const { error } = await supabase.rpc("change_member", { p_firm_id: firmId, p_user_id: userId, p_role: role, p_team_id: teamId });
  if (error) throw refusal(error, "That change wasn't saved. Try again.");
}

/** Makes a team (no id) or renames and moves one. */
export async function saveTeam(firmId: string, team: { id: string | null; name: string; parentTeamId: string | null }): Promise<void> {
  const { error } = await supabase.rpc("save_team", { p_firm_id: firmId, p_team_id: team.id, p_name: team.name.trim(), p_parent_team_id: team.parentTeamId });
  if (error) throw refusal(error, "That team wasn't saved. Try again.");
}

export async function deleteTeam(firmId: string, teamId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_team", { p_firm_id: firmId, p_team_id: teamId });
  if (error) throw refusal(error, "That team wasn't deleted. Try again.");
}

export async function setFirmVisibility(firmId: string, visibility: Visibility): Promise<void> {
  const { error } = await supabase.rpc("set_firm_visibility", { p_firm_id: firmId, p_visibility: visibility });
  if (error) throw refusal(error, "That setting wasn't saved. Try again.");
}
