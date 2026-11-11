import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { capitalised, isStaleDraftError, PART_LABELS, profileChanges, profileProblems, publishProblems, type PeoContact, type ProfileProblem, type ProfileVersion } from "@/data/peoEditor";
import { formatCheckedOn, PROFILE_PARTS, utcToday, type ProfilePart } from "@/data/peoProfiles";
import { discardPeoDraft, loadVersionContacts, publishPeoDraft, recheckPeoProfile } from "@/lib/advisorApi";
import { checkCensusLayout } from "@/lib/censusLayoutCheck";
import { listCensusTemplates } from "@/lib/censusTemplates";
import { buttonClass, primaryClass, sourceDraft, sourceFrom, type SourceDraft } from "./shared";
import { SourceFields } from "./SourceFields";

/** The review before publishing: what the draft changes from the version in use, and what still stops it. */
export const ReviewAndPublish = ({ peo, draft, inUse, onDone, onCancel, onReload }: {
  peo: { id: number; name: string };
  draft: ProfileVersion;
  inUse: ProfileVersion | null;
  onDone: () => void;
  onCancel: () => void;
  /** Reads the PEO again, leaving the review open on the draft as it now is. */
  onReload: () => void;
}) => {
  const [publishing, setPublishing] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  // The draft changed since this review opened: it publishes only the draft reviewed.
  const [stale, setStale] = useState(false);
  // The templates' names, so a change of template reads as the file, not its number.
  const [templateNames, setTemplateNames] = useState<ReadonlyMap<number, string>>(new Map());
  const namesTemplate = Boolean(draft.profile.censusLayout?.template || inUse?.profile.censusLayout?.template);
  useEffect(() => {
    if (!namesTemplate) return;
    let cancelled = false;
    listCensusTemplates(peo.id)
      .then((list) => { if (!cancelled) setTemplateNames(new Map(list.map((t) => [t.id, t.fileName]))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [peo.id, namesTemplate]);
  const changes = profileChanges(inUse?.profile ?? null, draft.profile, templateNames);
  const blockers = publishProblems(draft.profile);
  const id = `peo-${peo.id}-review`;

  const publish = async () => {
    setPublishing(true);
    setFailed(null);
    setStale(false);
    try {
      // A census layout is published only once the census, written in it on sample rows, reads back the same.
      const layout = draft.profile.censusLayout;
      if (layout) {
        const check = await checkCensusLayout(peo.id, layout);
        if (check.ok === false) {
          setFailed(`The census layout didn't pass its check, so it isn't published: ${check.message}`);
          return;
        }
      }
      await publishPeoDraft(peo.id, draft.revision);
      toast.success(`Version ${draft.version} of ${peo.name}'s profile is published.`);
      onDone();
    } catch (err) {
      if (isStaleDraftError(err)) setStale(true);
      else setFailed((err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section aria-labelledby={id} className="border border-primary/40 rounded-xl p-4 space-y-3">
      <h3 id={id} className="font-display text-base font-bold">Publish version {draft.version}?</h3>
      {changes.length === 0 ? <p className="text-sm text-muted-foreground">Nothing changes from version {inUse?.version}.</p> : (
        <>
          <p className="text-sm">What changes{inUse ? ` from version ${inUse.version}` : ""}:</p>
          <ul className="list-disc pl-5 text-sm space-y-1">{changes.map((c) => <li key={c}>{c}</li>)}</ul>
        </>
      )}
      {blockers.length > 0 && (
        <div role="alert" className="text-sm rounded-md bg-warning/10 text-warning px-3 py-2 space-y-1">
          {blockers.map((b) => <p key={b.path}>{b.message}</p>)}
          <p className="text-xs">Edit the section and give its source, then publish.</p>
        </div>
      )}
      {failed && <p role="alert" className="text-sm rounded-md bg-destructive/10 text-destructive px-3 py-2">{failed}</p>}
      {stale && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm rounded-md bg-warning/10 text-warning px-3 py-2">
          <p className="flex-1 min-w-48">This draft changed since you reviewed it. Reload to review the latest before you publish.</p>
          <button onClick={() => { setStale(false); onReload(); }} className={buttonClass}>Reload</button>
        </div>
      )}
      <p className="text-sm text-muted-foreground">Once published, version {draft.version} is what advisors and prospects see, and it can't be changed.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void publish()} disabled={publishing || blockers.length > 0} className={primaryClass}>
          {publishing && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Publish version {draft.version}
        </button>
        <button onClick={onCancel} disabled={publishing} className={buttonClass}>Not yet</button>
      </div>
    </section>
  );
};

/** Asks before discarding the draft, since what it changed is lost. */
export const DiscardDraft = ({ peoId, draft, inUse, onDone, onCancel }: { peoId: number; draft: ProfileVersion; inUse: ProfileVersion | null; onDone: () => void; onCancel: () => void }) => {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const discard = async () => {
    setBusy(true);
    try {
      await discardPeoDraft(peoId);
      toast.success("Draft discarded.");
      onDone();
    } catch (err) {
      setFailed((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="border border-border rounded-lg p-3 space-y-2 text-sm">
      <p>Discard your draft of version {draft.version}? What it changed is lost{inUse ? `; version ${inUse.version} stays in use` : ""}.</p>
      {failed && <p role="alert" className="text-destructive">{failed}</p>}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void discard()} disabled={busy} className={buttonClass}>Yes, discard it</button>
        <button onClick={onCancel} disabled={busy} className={buttonClass}>Keep it</button>
      </div>
    </div>
  );
};

/**
 * "Checked again, nothing changed": the parts re-checked and where and when, published as a new version with the
 * same content (published versions are never edited, dates included).
 */
export const RecheckForm = ({ peoId, inUse, today, onDone, onCancel }: { peoId: number; inUse: ProfileVersion; today: string; onDone: () => void; onCancel: () => void }) => {
  const sourced = PROFILE_PARTS.filter((p) => inUse.profile.sources[p]);
  const [parts, setParts] = useState<ProfilePart[]>(sourced);
  const [source, setSource] = useState<SourceDraft>(() => ({ ...sourceDraft(undefined, today), kind: "document" }));
  const [problems, setProblems] = useState<ProfileProblem[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const id = `peo-${peoId}-recheck`;

  const record = async () => {
    const next = sourceFrom(source)!;
    // The database's rules for a source, checked against the first part re-checked.
    const found = parts.length === 0 ? [] : profileProblems({ ...inUse.profile, sources: { ...inUse.profile.sources, [parts[0]]: next } }, utcToday())
      .filter((p) => p.path.startsWith(`sources.${parts[0]}`))
      .map((p) => ({ ...p, path: p.path.replace(`sources.${parts[0]}`, "sources.recheck") }));
    setProblems(found);
    setFailed(parts.length === 0 ? "Tick at least one part you checked again." : null);
    if (found.length > 0 || parts.length === 0) return;
    setBusy(true);
    try {
      await recheckPeoProfile(peoId, parts, next);
      toast.success(`Recorded. Version ${inUse.version + 1} is in use, checked ${formatCheckedOn(next.checkedOn)}.`);
      onDone();
    } catch (err) {
      setFailed((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={id} className="border border-primary/40 rounded-xl p-4 space-y-3">
      <h3 id={id} className="font-display text-base font-bold">Checked again, nothing changed</h3>
      <p className="text-sm text-muted-foreground">
        Version {inUse.version + 1} is published at once with the same content, and the date and source below for the parts you tick.
        Every other part keeps its own.
      </p>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">The parts you checked again</legend>
        {sourced.map((part) => (
          <label key={part} className="flex items-center gap-2 min-h-11 text-sm">
            <input type="checkbox" name={part} checked={parts.includes(part)}
              onChange={(e) => setParts(e.target.checked ? sourced.filter((p) => p === part || parts.includes(p)) : parts.filter((p) => p !== part))} />
            {capitalised(PART_LABELS[part])}
          </label>
        ))}
      </fieldset>
      <SourceFields id={`${id}-source`} label="Where you checked them" value={source} onChange={setSource} problems={problems} path="sources.recheck" allowNone={false} />
      {failed && <p role="alert" className="text-sm rounded-md bg-destructive/10 text-destructive px-3 py-2">{failed}</p>}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void record()} disabled={busy} className={primaryClass}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Record the re-check
        </button>
        <button onClick={onCancel} disabled={busy} className={buttonClass}>Cancel</button>
      </div>
    </section>
  );
};

/**
 * Every published version, newest first, each with when it was published and what it changed. Older versions'
 * contacts aren't read with the page, so the history reads every version's when it is opened, and compares each
 * version with its own.
 */
export const History = ({ id, published }: { id: string; published: ProfileVersion[] }) => {
  const [contacts, setContacts] = useState<Map<number, PeoContact[]> | null>(null);
  const [state, setState] = useState<"closed" | "loading" | "failed">("closed");
  const open = async () => {
    setState("loading");
    try {
      setContacts(await loadVersionContacts(published.map((v) => v.id)));
    } catch {
      setState("failed");
    }
  };
  const versions = contacts ? published.map((v) => ({ ...v, profile: { ...v.profile, contacts: contacts.get(v.id) ?? [] } })) : null;
  return (
    <section id={`${id}-history`} aria-labelledby={`${id}-history-heading`} className="border border-border rounded-xl p-4 space-y-3">
      <h3 id={`${id}-history-heading`} className="font-display text-base font-bold">History</h3>
      {published.length === 0 ? <p className="text-sm text-muted-foreground">No version published yet.</p> : !versions ? (
        <>
          {state === "failed" && <p role="alert" className="text-sm text-destructive">Couldn't read the history. Try again.</p>}
          <button onClick={() => void open()} disabled={state === "loading"} className={buttonClass}>
            {state === "loading" && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Show the history
          </button>
        </>
      ) : (
        <ol className="space-y-3">
          {versions.map((v, i) => {
            const before = versions[i + 1] ?? null;
            const changes = profileChanges(before?.profile ?? null, v.profile);
            return (
              <li key={v.id} aria-label={`Version ${v.version}`} className="text-sm border-t border-border pt-2 first:border-t-0 first:pt-0">
                <p className="font-medium">Version {v.version}</p>
                <p className="text-xs text-muted-foreground">Published {v.publishedAt ? formatCheckedOn(v.publishedAt.slice(0, 10)) : "on a day not recorded"}</p>
                {before === null ? <p className="text-xs">The first version.</p> : changes.length === 0 ? <p className="text-xs">Nothing changed.</p> : (
                  <ul className="list-disc pl-5 text-xs space-y-0.5">{changes.map((c) => <li key={c}>{c}</li>)}</ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
