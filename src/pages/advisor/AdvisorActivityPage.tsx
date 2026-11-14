import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import { formatDateTime } from "@/components/advisor/format";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { loadMyFirms, loadOwnedFirms } from "@/hooks/useOwnedFirms";
import { ENTRY_KINDS, kindLabel, recordLabel } from "@/data/firmActivity";
import {
  listFirmActivity, listFirmActivityPeople, NEVERMORE_FILTER,
  type ActivityCursor, type AdvisorApiError, type FirmActivityEntry, type FirmActivityPerson, type OwnedFirm,
} from "@/lib/advisorApi";

type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  | { kind: "not_allowed" }
  | { kind: "choose"; firms: OwnedFirm[] }
  | { kind: "ready"; firms: OwnedFirm[]; firmId: string; people: FirmActivityPerson[]; entries: FirmActivityEntry[]; hasMore: boolean };

const select = "min-h-11 bg-muted border border-border rounded-md px-3 text-sm";
const button = "min-h-11 px-4 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";

/**
 * Who did it: Nevermore for a person at Nevermore (never their name, email or id, D-33), their email, the system for an
 * entry no person made, or a former member whose account is gone.
 */
const who = (byNevermore: boolean, actorId: string | null, email: string | null) =>
  byNevermore ? "Nevermore" : (email ?? (actorId ? "A former member" : "System"));

/** The record an entry was about: what it is and its id, for a membership the person it was about and their role, and for an invitation the role it offered. */
function recordText(e: FirmActivityEntry): string {
  const base = `${recordLabel(e.record_type)} ${e.record_id}`;
  // An invitation sent, sent again or withdrawn is about the firm and records the role it offered.
  if ((e.kind === "invitation_sent" || e.kind === "invitation_withdrawn") && e.role) return `${base} · as ${e.role}`;
  if (e.record_type !== "membership") return base;
  return `${base} · ${e.subject_email ?? "A former member"}${e.role ? ` (${e.role})` : ""}`;
}

/**
 * The firm's record of who did what (story CRM-P2.3), for its owners: when, who, what kind of thing and which record,
 * never content. Filtered by person and kind, newest first, a page at a time. At a firm's address that
 * address's firm is read and named, and no choice of firm is offered; on the bare domain an owner of one firm needn't name
 * it (?firm=<id> or the choice does) and an owner of several is asked. Anyone else is told it is for owners; the database refuses them anyway.
 */
const AdvisorActivityPage = () => {
  const [params, setParams] = useSearchParams();
  const { user, session } = useAuth();
  const userId = user?.id ?? "";
  const sessionKey = session?.access_token ?? "";
  // At a firm's own address the firm is that address's, which wins over the link's ?firm= and the choice of firm: those are for the bare domain.
  const firmAddress = useFirmAddress();
  const address = firmAddress.status === "known" ? firmAddress.address : null;
  const firmParam = params.get("firm");
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [person, setPerson] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  // Where each page after the first starts: after the last entry the reader saw on the page before.
  const [trail, setTrail] = useState<ActivityCursor[]>([]);
  const page = trail.length + 1;
  const after = trail.length > 0 ? trail[trail.length - 1] : null;

  useEffect(() => {
    let cancelled = false;
    setLoad((prev) => (prev.kind === "ready" ? prev : { kind: "loading" }));
    (async (): Promise<Load> => {
      const firms = await loadOwnedFirms(userId, sessionKey);
      // The address's firm, as the person's own memberships name it; a firm they aren't in at all is no firm here.
      const atAddress = address === null ? null : (await loadMyFirms(userId, sessionKey)).find((f) => f.address === address)?.firm_id ?? "none";
      const firmId = atAddress ?? firmParam ?? (firms.length === 1 ? firms[0].firm_id : null);
      if (firmId === null) return firms.length > 1 ? { kind: "choose", firms } : { kind: "not_allowed" };
      if (!firms.some((f) => f.firm_id === firmId)) return { kind: "not_allowed" };
      const [people, result] = await Promise.all([listFirmActivityPeople(firmId), listFirmActivity(firmId, { person, kind, after })]);
      return { kind: "ready", firms, firmId, people, entries: result.entries, hasMore: result.hasMore };
    })()
      .then((next) => !cancelled && setLoad(next))
      .catch((error: Error) => !cancelled && setLoad((error as Partial<AdvisorApiError>).forbidden ? { kind: "not_allowed" } : { kind: "error", error }));
    return () => {
      cancelled = true;
    };
  }, [attempt, person, kind, after, firmParam, address, userId, sessionKey]);

  const chooseFirm = (firmId: string) => {
    setPerson(null);
    setKind(null);
    setTrail([]);
    setParams(firmId ? { firm: firmId } : {}, { replace: true });
  };

  const older = () => {
    if (load.kind !== "ready" || load.entries.length === 0) return;
    const last = load.entries[load.entries.length - 1];
    setTrail((t) => [...t, { at: last.at, key: last.entry_key }]);
  };

  const filtered = person !== null || kind !== null;

  return (
    <div className="min-h-screen bg-background">
      <AdvisorHeader />
      <main className="container mx-auto px-6 py-8 max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">Who did what</h1>
          <p className="text-sm text-muted-foreground">
            What your firm's people did, newest first: signing in, opening a submission, downloading a file, recording a send and every change to who
            belongs to the firm. It says what happened and to which record, never what was in it. Only your firm's owners can read it, and no one can change it.
          </p>
        </div>

        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-12 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading…
          </div>
        )}
        {load.kind === "error" && <AdvisorLoadError error={load.error} what="the record of who did what" onRetry={() => setAttempt((n) => n + 1)} />}
        {load.kind === "not_allowed" && (
          <p role="status" className="text-sm">Only a firm's owners can read its record of who did what.</p>
        )}

        {address !== null && load.kind === "ready" && (
          <p className="text-sm text-muted-foreground">
            Firm: <span className="font-medium text-foreground">{load.firms.find((f) => f.firm_id === load.firmId)?.name}</span>
          </p>
        )}

        {/* The choice of firm is for the bare domain: at a firm's address that address's firm is the one shown, whatever a link names. */}
        {address === null && (load.kind === "choose" || (load.kind === "ready" && load.firms.length > 1)) && (
          <div>
            <label htmlFor="activity-firm" className="block text-xs text-muted-foreground">Firm</label>
            <select id="activity-firm" value={firmParam ?? ""} onChange={(e) => chooseFirm(e.target.value)} className={select}>
              {load.kind === "choose" && <option value="">Choose a firm</option>}
              {load.firms.map((f) => <option key={f.firm_id} value={f.firm_id}>{f.name}</option>)}
            </select>
          </div>
        )}

        {load.kind === "ready" && (
          <>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label htmlFor="activity-person" className="block text-xs text-muted-foreground">Person</label>
                <select
                  id="activity-person"
                  value={person ?? ""}
                  onChange={(e) => { setPerson(e.target.value || null); setTrail([]); }}
                  className={select}
                >
                  <option value="">Everyone</option>
                  {load.people.map((p) =>
                    p.is_nevermore
                      ? <option key="nevermore" value={NEVERMORE_FILTER}>Nevermore</option>
                      : <option key={p.user_id} value={p.user_id ?? ""}>{p.email ?? "A former member"}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="activity-kind" className="block text-xs text-muted-foreground">Kind</label>
                <select
                  id="activity-kind"
                  value={kind ?? ""}
                  onChange={(e) => { setKind(e.target.value || null); setTrail([]); }}
                  className={select}
                >
                  <option value="">Every kind</option>
                  {ENTRY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
            </div>

            {load.entries.length === 0 ? (
              <p role="status" className="text-sm text-muted-foreground">
                {filtered ? "No entries match these filters." : "Nothing has been recorded for your firm yet."}
              </p>
            ) : (
              <div className="overflow-x-auto border border-border rounded-xl">
                <table aria-label="Who did what" className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-medium">When</th>
                      <th scope="col" className="px-4 py-2 font-medium">Who</th>
                      <th scope="col" className="px-4 py-2 font-medium">What</th>
                      <th scope="col" className="px-4 py-2 font-medium">Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {load.entries.map((e) => (
                      <tr key={e.entry_key} className="border-t border-border align-top">
                        <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(e.at)}</td>
                        <td className="px-4 py-2">{who(e.by_nevermore, e.actor_id, e.actor_email)}</td>
                        <td className="px-4 py-2">{kindLabel(e.kind)}</td>
                        <td className="px-4 py-2 font-mono text-xs break-all">{recordText(e)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(page > 1 || load.hasMore) && (
              <div className="flex items-center gap-3">
                <button type="button" className={button} disabled={page <= 1} onClick={() => setTrail((t) => t.slice(0, -1))}>Newer</button>
                <span className="text-sm text-muted-foreground">Page {page}</span>
                <button type="button" className={button} disabled={!load.hasMore} onClick={older}>Older</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AdvisorActivityPage;
