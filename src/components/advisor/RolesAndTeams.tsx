// Who is what in the firm, for its owners (CRM-X1.1, BR-5.3): each member's role and team, the teams, and whether everyone sees every record. The level rule
// (an agent their own, a lead their teams', an owner everything) already goes by these; this is where an owner sets them after a person has joined.
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { changeMember, deleteTeam, loadTeamsPage, saveTeam, setFirmVisibility, type Team, type TeamMember, type TeamsPage, type Visibility } from "@/lib/teamsApi";
import type { MemberRole } from "@/lib/memberApi";
import { LoadFailed } from "@/components/workspace/states";
import { failureWords, SaveFailed } from "@/components/workspace/form";

const input = "w-full min-h-11 bg-muted border border-border rounded-md px-3 py-2 text-sm";
const button = "inline-flex items-center justify-center min-h-11 px-3 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";
const primary = "inline-flex items-center justify-center min-h-11 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50";
const panel = "rounded-lg border border-border bg-card p-4 space-y-3";

const ROLE_LABELS: Record<MemberRole, string> = { owner: "Owner", lead: "Lead", agent: "Agent" };
const SEES: Record<MemberRole, string> = { owner: "Sees everything", lead: "Sees their own and their teams'", agent: "Sees their own" };
const VISIBILITY_WORDS: Record<Visibility, string> = {
  by_level: "Each person sees their own records, a lead their teams', an owner everything",
  everyone: "Everyone in the firm sees every record",
};

type Load = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; page: TeamsPage };

/** `readOnly`: a support session, which reads and changes nothing. `onChanged`: tells the page its list of members may read differently now. */
export const RolesAndTeams = ({ firmId, readOnly, onChanged }: { firmId: string; readOnly: boolean; onChanged?: () => void }) => {
  const id = useId();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // What the owner has chosen and not yet saved: a member's role and team by their id, a team's name and parent by its id, and the new team.
  const [memberDrafts, setMemberDrafts] = useState<Record<string, { role: MemberRole; teamId: string | null }>>({});
  const [teamDrafts, setTeamDrafts] = useState<Record<string, { name: string; parentTeamId: string | null }>>({});
  const [newTeam, setNewTeam] = useState({ name: "", parentTeamId: "" });

  useEffect(() => {
    let cancelled = false;
    setLoad((now) => (now.kind === "ready" ? now : { kind: "loading" }));
    loadTeamsPage(firmId).then((page) => !cancelled && setLoad({ kind: "ready", page }), (error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => { cancelled = true; };
  }, [firmId, attempt]);

  const run = useCallback(async (what: () => Promise<void>, done: string, fallback: string, after?: () => void) => {
    setBusy(true);
    setProblem(null);
    try {
      await what();
      toast.success(done);
      after?.();
      setAttempt((n) => n + 1);
      onChanged?.();
    } catch (err) {
      setProblem(failureWords(err, fallback));
    } finally {
      setBusy(false);
    }
  }, [onChanged]);

  if (load.kind === "loading") return <p role="status" className="text-sm text-muted-foreground">Loading roles and teams…</p>;
  if (load.kind === "error") return <LoadFailed error={load.error} what="roles and teams" onRetry={() => setAttempt((n) => n + 1)} />;
  const { page } = load;

  const memberDraft = (m: TeamMember) => memberDrafts[m.userId] ?? { role: m.role, teamId: m.teamId };
  const teamDraft = (t: Team) => teamDrafts[t.id] ?? { name: t.name, parentTeamId: t.parentTeamId };
  const forget = <T,>(drafts: Record<string, T>, key: string) => Object.fromEntries(Object.entries(drafts).filter(([k]) => k !== key));
  const who = (m: TeamMember) => m.name ?? m.email;

  const addTeam = (e: FormEvent) => {
    e.preventDefault();
    void run(() => saveTeam(firmId, { id: null, name: newTeam.name, parentTeamId: newTeam.parentTeamId || null }), `${newTeam.name.trim()} is a team.`,
      "That team wasn't saved. Check your connection and try again.", () => setNewTeam({ name: "", parentTeamId: "" }));
  };

  return (
    <div className="space-y-4">
      <SaveFailed message={problem} className="font-normal" />

      <section aria-labelledby={`${id}-sees`} className={panel}>
        <h3 id={`${id}-sees`} className="font-semibold">Who sees what</h3>
        <fieldset disabled={readOnly || busy} className="space-y-2">
          <legend className="sr-only">Who sees what</legend>
          {(Object.keys(VISIBILITY_WORDS) as Visibility[]).map((v) => (
            <label key={v} className="flex items-center gap-3 min-h-11 text-sm">
              <input type="radio" name={`${id}-visibility`} className="h-5 w-5" checked={page.visibility === v}
                onChange={() => void run(() => setFirmVisibility(firmId, v), "Saved: " + VISIBILITY_WORDS[v].toLowerCase() + ".", "That setting wasn't saved. Check your connection and try again.")} />
              {VISIBILITY_WORDS[v]}
            </label>
          ))}
        </fieldset>
      </section>

      <section aria-labelledby={`${id}-roles`} className={panel}>
        <h3 id={`${id}-roles`} className="font-semibold">Roles and teams</h3>
        <p className="text-sm text-muted-foreground">A change takes effect at once. The membership the person had is ended and kept in the firm's record, and a new one begins.</p>
        <ul aria-label="Members' roles and teams" className="divide-y divide-border">
          {page.members.map((m) => {
            const d = memberDraft(m);
            const changed = d.role !== m.role || d.teamId !== m.teamId;
            return (
              <li key={m.userId} className="py-3 grid gap-2 sm:grid-cols-[1fr_9rem_12rem_auto] sm:items-end">
                <span className="min-w-0">
                  <span className="block font-medium break-all">{who(m)}</span>
                  <span className="block text-sm text-muted-foreground">{page.visibility === "everyone" ? "Sees everything" : SEES[d.role]}</span>
                </span>
                <span className="space-y-1">
                  <label htmlFor={`${id}-role-${m.userId}`} className="text-xs text-muted-foreground">{`Role of ${who(m)}`}</label>
                  <select id={`${id}-role-${m.userId}`} value={d.role} disabled={readOnly || busy} className={input}
                    onChange={(e) => setMemberDrafts({ ...memberDrafts, [m.userId]: { ...d, role: e.target.value as MemberRole } })}>
                    {(Object.keys(ROLE_LABELS) as MemberRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </span>
                <span className="space-y-1">
                  <label htmlFor={`${id}-team-${m.userId}`} className="text-xs text-muted-foreground">{`Team of ${who(m)}`}</label>
                  <select id={`${id}-team-${m.userId}`} value={d.teamId ?? ""} disabled={readOnly || busy} className={input}
                    onChange={(e) => setMemberDrafts({ ...memberDrafts, [m.userId]: { ...d, teamId: e.target.value || null } })}>
                    <option value="">No team</option>
                    {page.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </span>
                {!readOnly && (
                  <button type="button" className={button} disabled={busy || !changed} aria-label={`Save the role and team of ${who(m)}`}
                    onClick={() => void run(() => changeMember(firmId, m.userId, d.role, d.teamId), `${who(m)} is now ${ROLE_LABELS[d.role].toLowerCase() === "owner" ? "an owner" : `a${d.role === "agent" ? "n" : ""} ${ROLE_LABELS[d.role].toLowerCase()}`}${d.teamId ? ` in ${page.teams.find((t) => t.id === d.teamId)?.name ?? "their team"}` : ""}.`,
                      "That change wasn't saved. Check your connection and try again.", () => setMemberDrafts((now) => forget(now, m.userId)))}>
                    Save
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby={`${id}-teams`} className={panel}>
        <h3 id={`${id}-teams`} className="font-semibold">Teams</h3>
        <p className="text-sm text-muted-foreground">A lead sees the records of the people in their team and in the teams inside it.</p>
        {page.teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">The firm has no teams yet.</p>
        ) : (
          <ul aria-label="Teams" className="divide-y divide-border">
            {page.teams.map((t) => {
              const d = teamDraft(t);
              const changed = d.name.trim() !== t.name || d.parentTeamId !== t.parentTeamId;
              return (
                <li key={t.id} className="py-3 grid gap-2 sm:grid-cols-[1fr_12rem_auto_auto] sm:items-end">
                  <span className="space-y-1">
                    <label htmlFor={`${id}-name-${t.id}`} className="text-xs text-muted-foreground">{`Name of ${t.name} (${t.members === 1 ? "1 member" : `${t.members} members`})`}</label>
                    <input id={`${id}-name-${t.id}`} value={d.name} maxLength={80} disabled={readOnly || busy} className={input} autoComplete="off"
                      onChange={(e) => setTeamDrafts({ ...teamDrafts, [t.id]: { ...d, name: e.target.value } })} />
                  </span>
                  <span className="space-y-1">
                    <label htmlFor={`${id}-parent-${t.id}`} className="text-xs text-muted-foreground">{`${t.name} sits in`}</label>
                    <select id={`${id}-parent-${t.id}`} value={d.parentTeamId ?? ""} disabled={readOnly || busy} className={input}
                      onChange={(e) => setTeamDrafts({ ...teamDrafts, [t.id]: { ...d, parentTeamId: e.target.value || null } })}>
                      <option value="">No team</option>
                      {page.teams.filter((x) => x.id !== t.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </span>
                  {!readOnly && (
                    <button type="button" className={button} disabled={busy || !changed || d.name.trim() === ""} aria-label={`Save ${t.name}`}
                      onClick={() => void run(() => saveTeam(firmId, { id: t.id, name: d.name, parentTeamId: d.parentTeamId }), `${d.name.trim()} is saved.`,
                        "That team wasn't saved. Check your connection and try again.", () => setTeamDrafts((now) => forget(now, t.id)))}>
                      Save
                    </button>
                  )}
                  {!readOnly && t.canDelete && (
                    <button type="button" className={button} disabled={busy} aria-label={`Delete ${t.name}`}
                      onClick={() => void run(() => deleteTeam(firmId, t.id), `${t.name} is deleted.`, "That team wasn't deleted. Check your connection and try again.")}>
                      Delete
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!readOnly && (
          <form onSubmit={addTeam} className="grid gap-2 sm:grid-cols-[1fr_12rem_auto] sm:items-end" aria-label="Add a team">
            <span className="space-y-1">
              <label htmlFor={`${id}-new-name`} className="text-sm font-medium">New team's name</label>
              <input id={`${id}-new-name`} required maxLength={80} value={newTeam.name} onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })} className={input} autoComplete="off" />
            </span>
            <span className="space-y-1">
              <label htmlFor={`${id}-new-parent`} className="text-sm font-medium">It sits in</label>
              <select id={`${id}-new-parent`} value={newTeam.parentTeamId} onChange={(e) => setNewTeam({ ...newTeam, parentTeamId: e.target.value })} className={input}>
                <option value="">No team</option>
                {page.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </span>
            <button type="submit" className={primary} disabled={busy}>Add team</button>
          </form>
        )}
      </section>
    </div>
  );
};
