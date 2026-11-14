import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import { formatDateTime } from "@/components/advisor/format";
import { EmptyBody, LoadingStatus, NothingMatches, NothingYet, PlaceholderBody, PlaceholderLine, SlowLoadLine, useSlowLoad, type PlaceholderColumn } from "@/components/workspace/states";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { loadMyFirms, loadOwnedFirms } from "@/hooks/useOwnedFirms";
import { endTime, fetchFirmSupportUses, type FirmSupportUse } from "@/lib/supportApi";
import { ENTRY_KINDS, entryLabel, kindLabel, recordLabel } from "@/data/firmActivity";
import {
  listFirmActivity, listFirmActivityPeople, NEVERMORE_FILTER,
  type ActivityCursor, type AdvisorApiError, type FirmActivityEntry, type FirmActivityPerson, type OwnedFirm,
} from "@/lib/advisorApi";

type Load =
  // `firms` is what the person could choose from before a change of firm cleared the entries: the choice stays on screen while the new firm loads.
  | { kind: "loading"; firms?: OwnedFirm[] }
  | { kind: "error"; error: Error }
  | { kind: "not_allowed" }
  | { kind: "choose"; firms: OwnedFirm[] }
  | { kind: "ready"; firms: OwnedFirm[]; firmId: string; people: FirmActivityPerson[]; entries: FirmActivityEntry[]; hasMore: boolean; uses: Map<string, FirmSupportUse>; asked: string; firmKey: string | null };

const select = "min-h-11 bg-muted border border-border rounded-md px-3 text-sm";
const button = "min-h-11 px-4 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";

// The record's columns, drawn the same for the real rows and for the grey ones (story CRM-S2.1), so nothing jumps when the rows arrive.
const COLUMNS: (PlaceholderColumn & { header: string })[] = [
  { id: "when", header: "When", width: "date" },
  { id: "who", header: "Who", width: "person" },
  { id: "what", header: "What", width: "text" },
  { id: "record", header: "Record", width: "name" },
];

const ActivityHead = () => (
  <thead className="text-left text-xs text-muted-foreground">
    <tr>
      {COLUMNS.map((c) => <th key={c.id} scope="col" className="px-4 py-2 font-medium">{c.header}</th>)}
    </tr>
  </thead>
);

/**
 * Who did it: Nevermore for a person at Nevermore (never their name, email or id, D-33), their email, the system for an
 * entry no person made, or a former member whose account is gone.
 */
const who = (byNevermore: boolean, actorId: string | null, email: string | null) =>
  byNevermore ? "Nevermore" : (email ?? (actorId ? "A former member" : "System"));

/**
 * The record an entry was about: what it is and its id, for a membership the person it was about and their role, and for an invitation the role it offered.
 * A use of Nevermore support (CRM-P2.4) says why and when, in the words the admin wrote for the firm's owners, never who.
 */
function recordText(e: FirmActivityEntry, uses: Map<string, FirmSupportUse>): string {
  if (e.record_type === "support_session" || e.record_type === "support_session_end") {
    const use = uses.get(e.record_id);
    if (!use) return recordLabel(e.record_type);
    const until = use.endedAt ?? use.endsAt;
    return e.record_type === "support_session"
      ? `Reason: ${use.reason} · ${formatDateTime(use.startedAt)} to ${endTime(until)}${use.endedAt === null ? " (open)" : ""}`
      : `Ended ${formatDateTime(until)} · Reason: ${use.reason}`;
  }
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
  const [loaded, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [person, setPerson] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  // Where each page after the first starts: after the last entry the reader saw on the page before.
  const [trail, setTrail] = useState<ActivityCursor[]>([]);
  const page = trail.length + 1;
  const after = trail.length > 0 ? trail[trail.length - 1] : null;
  // What the page is asking for now, and (in `load.asked`) what the entries on screen answer: they differ while the next page or filter loads.
  const asking = JSON.stringify([person, kind, after]);
  // Another firm is never "the same list, dimmed" (D-144): whichever way the firm changed (the list, a link, the address), the entries and the people
  // of the firm left are gone at once and the grey rows show, before the new firm's answer arrives.
  const firmKey = address ?? firmParam;
  const load: Load = loaded.kind === "ready" && loaded.firmKey !== firmKey ? { kind: "loading", firms: loaded.firms } : loaded;

  useEffect(() => {
    let cancelled = false;
    setLoad((prev) => (prev.kind === "ready" || prev.kind === "loading" ? prev : { kind: "loading" }));
    (async (): Promise<Load> => {
      const owned = await loadOwnedFirms(userId, sessionKey);
      // The address's firm, as the person's own memberships name it; a firm they aren't in at all is no firm here.
      const here = address === null ? null : (await loadMyFirms(userId, sessionKey)).find((f) => f.address === address);
      const atAddress = address === null ? null : here?.firm_id ?? "none";
      // Nevermore support, on a support session, reads the record as an owner does (story CRM-P2.4).
      const supporting = here?.role === "support";
      const firms = supporting && here ? [...owned, { firm_id: here.firm_id, name: here.name }] : owned;
      const firmId = atAddress ?? firmParam ?? (firms.length === 1 ? firms[0].firm_id : null);
      if (firmId === null) return firms.length > 1 ? { kind: "choose", firms } : { kind: "not_allowed" };
      if (!firms.some((f) => f.firm_id === firmId)) return { kind: "not_allowed" };
      const [people, result, useList] = await Promise.all([
        listFirmActivityPeople(firmId), listFirmActivity(firmId, { person, kind, after }), fetchFirmSupportUses(firmId),
      ]);
      return { kind: "ready", firms, firmId, people, entries: result.entries, hasMore: result.hasMore, uses: new Map(useList.map((u) => [u.id, u])), asked: JSON.stringify([person, kind, after]), firmKey: address ?? firmParam };
    })()
      .then((next) => !cancelled && setLoad(next))
      .catch((error: Error) => !cancelled && setLoad((error as Partial<AdvisorApiError>).forbidden ? { kind: "not_allowed" } : { kind: "error", error }));
    return () => {
      cancelled = true;
    };
  }, [attempt, person, kind, after, firmParam, address, userId, sessionKey]);

  const chooseFirm = (firmId: string) => {
    // Another firm's entries and people are never "the same list, dimmed": clear them at once, and keep only the choice of firms.
    setLoad((prev) => ({ kind: "loading", firms: prev.kind === "ready" || prev.kind === "choose" ? prev.firms : prev.kind === "loading" ? prev.firms : undefined }));
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
  // Ten seconds with nothing to show (not a changed filter or the next page, which keep the entries on screen, D-49).
  const retryLoad = useCallback(() => setAttempt((n) => n + 1), []);
  const slowLoad = useSlowLoad(load.kind === "loading", retryLoad);
  const people = load.kind === "ready" ? load.people : null;
  // The entries on screen answer a different question than the one now asked (the next page, another filter): dimmed and marked busy until the answer arrives.
  const stale = load.kind === "ready" && load.asked !== asking;
  const firmChoice = load.kind === "choose" || load.kind === "ready" || load.kind === "loading" ? load.firms : undefined;
  const isEmpty = load.kind === "ready" && load.entries.length === 0;
  // Empty (CRM-S2.2). The rule: the record has no totals, so a narrowed question that comes back empty is worded to be true either way ("No entries match
  // these filters"), never as "nothing recorded". Only the unfiltered first page that comes back empty is NOTHING YET, and its words stay true for a firm
  // whose entries have all aged out (the record is pruned at ninety days). The page after the first coming back empty is neither: older entries are gone.
  // The words are for the question the (empty) entries ANSWERED, which is the previous one while the next is on its way, never one not yet answered.
  const [answeredPerson, answeredKind, answeredAfter] = (load.kind === "ready" ? JSON.parse(load.asked) : [person, kind, after]) as [string | null, string | null, ActivityCursor | null];
  const answeredFiltered = answeredPerson !== null || answeredKind !== null;
  const personInWords = answeredPerson === NEVERMORE_FILTER ? "Nevermore" : (people?.find((p) => p.user_id === answeredPerson)?.email ?? "A former member");
  const clearFilters = () => { setPerson(null); setKind(null); setTrail([]); personList.current?.focus(); };
  const emptyState = !isEmpty ? null : answeredAfter !== null ? (
    <NothingMatches plural="entries" by={{ search: false, filters: false }} inForce={[]} headline="There are no older entries." clearLabel="Back to the newest" onClear={() => { setTrail([]); personList.current?.focus(); }} />
  ) : answeredFiltered ? (
    <NothingMatches
      plural="entries"
      by={{ search: false, filters: true }}
      inForce={[...(answeredPerson !== null ? [`Person: ${personInWords}`] : []), ...(answeredKind !== null ? [`Kind: ${kindLabel(answeredKind)}`] : [])]}
      onClear={clearFilters}
    />
  ) : (
    <NothingYet sentence="Nothing has been recorded for your firm in the last 90 days: entries appear here as its people sign in, open submissions or change who belongs." />
  );
  const personList = useRef<HTMLSelectElement>(null);

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8 max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">Who did what</h1>
          <p className="text-sm text-muted-foreground">
            What your firm's people did, newest first: signing in, opening a submission, downloading a file, recording a send and every change to who
            belongs to the firm. It says what happened and to which record, never what was in it. Only your firm's owners can read it, and no one can change it.
          </p>
          <SlowLoadLine loading={load.kind === "loading"} slow={slowLoad.slow} onTryAgain={slowLoad.tryAgain} />
        </div>

        {load.kind === "loading" && <LoadingStatus name="the record of who did what" />}
        {load.kind === "error" && <AdvisorLoadError error={load.error} what="the record of who did what" onRetry={() => setAttempt((n) => n + 1)} />}
        {load.kind === "not_allowed" && (
          <p role="status" className="text-sm">Only a firm's owners can read its record of who did what.</p>
        )}

        {address !== null && load.kind === "ready" && (
          <p className="text-sm text-muted-foreground">
            Firm: <span className="font-medium text-foreground">{load.firms.find((f) => f.firm_id === load.firmId)?.name}</span>
          </p>
        )}
        {/* The line the firm's name will fill is held while it loads, so the filters and the table don't move down when it arrives. */}
        {address !== null && load.kind === "loading" && <p aria-hidden="true" className="flex h-5 items-center"><PlaceholderLine width="person" /></p>}

        {/* The choice of firm is for the bare domain: at a firm's address that address's firm is the one shown, whatever a link names. */}
        {address === null && (load.kind === "choose" || ((load.kind === "ready" || load.kind === "loading") && (firmChoice?.length ?? 0) > 1)) && (
          <div>
            <label htmlFor="activity-firm" className="block text-xs text-muted-foreground">Firm</label>
            <select id="activity-firm" value={firmParam ?? ""} onChange={(e) => chooseFirm(e.target.value)} className={select}>
              {load.kind === "choose" && <option value="">Choose a firm</option>}
              {(firmChoice ?? []).map((f) => <option key={f.firm_id} value={f.firm_id}>{f.name}</option>)}
            </select>
          </div>
        )}

        {(load.kind === "loading" || load.kind === "ready") && (
          <>
            {/* The Kind list is the page's own, so it changes the question at once; the Person list comes with the answer, so it waits for it. */}
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label htmlFor="activity-person" className="block text-xs text-muted-foreground">Person</label>
                <select
                  id="activity-person"
                  ref={personList}
                  value={person ?? ""}
                  // Not usable until the people have arrived: it stays in the tab order, says why, and ignores a choice.
                  aria-disabled={people === null || undefined}
                  aria-describedby={people === null ? "activity-person-unavailable" : undefined}
                  onChange={(e) => { if (people !== null) { setPerson(e.target.value || null); setTrail([]); } }}
                  className={`${select} ${people === null ? "opacity-50" : ""}`}
                >
                  <option value="">Everyone</option>
                  {(people ?? []).map((p) =>
                    p.is_nevermore
                      ? <option key="nevermore" value={NEVERMORE_FILTER}>Nevermore</option>
                      : <option key={p.user_id} value={p.user_id ?? ""}>{p.email ?? "A former member"}</option>)}
                </select>
                {people === null && <span id="activity-person-unavailable" className="sr-only">Available when the record has loaded</span>}
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

            {/* One table, whether its rows are grey, real or none (CRM-S2.2): an empty answer is one cell under the same headers, so nothing is rebuilt.
                Real entries that answer another question than the one now asked are dimmed and marked busy until the answer comes. */}
            <div className={`overflow-x-auto border border-border rounded-xl ${stale ? "opacity-70" : ""}`} aria-busy={load.kind === "loading" || (stale && !isEmpty) || undefined}>
              <table aria-label="Who did what" className="w-full text-sm">
                <ActivityHead />
                {load.kind === "loading" ? (
                  <PlaceholderBody columns={COLUMNS} />
                ) : isEmpty ? (
                  <EmptyBody columns={COLUMNS.length}>{emptyState}</EmptyBody>
                ) : (
                  <tbody>
                    {load.kind === "ready" && load.entries.map((e) => (
                      <tr key={e.entry_key} className="border-t border-border align-top">
                        <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(e.at)}</td>
                        <td className="px-4 py-2">{who(e.by_nevermore, e.actor_id, e.actor_email)}</td>
                        <td className="px-4 py-2">{entryLabel(e.kind, e.record_type)}</td>
                        <td className="px-4 py-2 font-mono text-xs break-all">{recordText(e, load.uses)}</td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>

            {load.kind === "ready" && (page > 1 || load.hasMore) && (
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
