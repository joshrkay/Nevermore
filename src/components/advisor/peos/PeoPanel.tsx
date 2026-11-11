import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { EMPTY_PROFILE, versionsOf } from "@/data/peoEditor";
import { oldestCheck, staleProfileWarning } from "@/data/peoProfiles";
import { setPeoListed, type PeoDirectoryEntry } from "@/lib/advisorApi";
import { DiscardDraft, History, RecheckForm, ReviewAndPublish } from "./PeoActions";
import { buttonClass, primaryClass, type SectionKey } from "./shared";
import { Section, SectionContents } from "./ProfileSections";
import { AnswersEditor, CensusEditor, ContactsEditor, DocumentsEditor, QuestionsEditor, RulesEditor, type EditorProps } from "./SectionEditors";

const SECTIONS: SectionKey[] = ["rules", "answers", "census", "documents", "questions", "contacts"];

const EDITORS: Record<SectionKey, (props: EditorProps) => JSX.Element> = {
  rules: RulesEditor,
  answers: AnswersEditor,
  census: CensusEditor,
  documents: DocumentsEditor,
  questions: QuestionsEditor,
  contacts: ContactsEditor,
};

interface PeoPanelProps {
  peo: PeoDirectoryEntry;
  isAdmin: boolean;
  today: string;
  onChanged: () => void;
}

/**
 * One PEO: its profile in use, section by section, with where and when each part was checked, and its history. An
 * admin edits a section into the PEO's draft (made on the first save) and sees the draft in place of the version in
 * use until it is published or discarded.
 */
const PeoPanel = ({ peo, isAdmin, today, onChanged }: PeoPanelProps) => {
  const { inUse, draft, published } = versionsOf(peo.versions);
  const [editing, setEditing] = useState<SectionKey | null>(null);
  const [mode, setMode] = useState<"review" | "discard" | "recheck" | null>(null);
  const [listing, setListing] = useState(false);
  const done = () => { setMode(null); onChanged(); };

  const toggleListed = async () => {
    setListing(true);
    try {
      await setPeoListed(peo.id, !peo.listed);
      toast.success(peo.listed
        ? `${peo.name} is off the list. Prospects and advisors aren't offered it; what was sent to it still reads.`
        : `${peo.name} is back on the list.`);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setListing(false);
    }
  };
  const shown = (isAdmin ? draft?.profile : null) ?? inUse?.profile ?? EMPTY_PROFILE;
  const stale = inUse ? staleProfileWarning({ name: peo.name, lastVerified: oldestCheck(inUse.profile) }, today) : null;
  const id = `peo-${peo.id}`;

  return (
    <section aria-labelledby={`${id}-name`} className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`${id}-name`} className="font-display text-2xl font-bold mr-2">{peo.name}</h2>
        <span className="text-xs px-2 py-1 rounded-full bg-muted">{inUse ? `Version ${inUse.version} in use` : "No profile yet"}</span>
        <span className={`text-xs px-2 py-1 rounded-full ${peo.listed ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
          {peo.listed ? "Listed" : "Not listed · hidden from prospects"}
        </span>
        {inUse && <a href={`#${id}-history`} className="text-sm text-primary underline min-h-11 inline-flex items-center">History</a>}
      </div>
      {stale && (
        <p role="status" className="flex items-start gap-2 text-sm rounded-lg bg-warning/10 text-warning px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> {stale}
        </p>
      )}
      {isAdmin && draft && (
        <div className="rounded-lg border border-primary/40 bg-highlight/40 px-4 py-3 space-y-2 text-sm">
          <p>
            You have a draft of version {draft.version}.{" "}
            {inUse ? `Advisors and prospects keep seeing version ${inUse.version} until you publish.` : "Advisors and prospects see nothing for this PEO until you publish."}{" "}
            Once published, a version can't be changed.
          </p>
          <p className="text-xs text-muted-foreground">The sections below show your draft.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setMode("discard")} className={buttonClass}>Discard draft</button>
            <button onClick={() => setMode("review")} className={primaryClass}>Review and publish</button>
          </div>
          {mode === "discard" && <DiscardDraft peoId={peo.id} draft={draft} inUse={inUse} onDone={done} onCancel={() => setMode(null)} />}
        </div>
      )}
      {isAdmin && draft && mode === "review" && <ReviewAndPublish peo={peo} draft={draft} inUse={inUse} onDone={done} onCancel={() => setMode(null)} />}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          {inUse && (
            <button onClick={() => setMode("recheck")} disabled={!!draft || mode === "recheck"} className={buttonClass}>Checked again, nothing changed</button>
          )}
          <button onClick={() => void toggleListed()} disabled={listing} className={buttonClass}>
            {peo.listed ? "Take off the list" : "Put back on the list"}
          </button>
          {inUse && draft && <p className="text-xs text-muted-foreground">Publish or discard the draft before recording a re-check.</p>}
        </div>
      )}
      {isAdmin && inUse && !draft && mode === "recheck" && <RecheckForm peoId={peo.id} inUse={inUse} today={today} onDone={done} onCancel={() => setMode(null)} />}
      {!inUse && !(isAdmin && draft) && (
        <p className="text-sm text-muted-foreground">
          Nothing is published for {peo.name} yet, so every eligibility check against it reads can't tell yet.
        </p>
      )}
      {SECTIONS.map((section) => {
        const Editor = EDITORS[section];
        return (
          <Section
            key={section}
            id={id}
            section={section}
            onEdit={isAdmin && Editor ? () => setEditing(section) : undefined}
            editor={editing === section && Editor ? (
              <Editor
                peoId={peo.id}
                base={draft?.profile ?? inUse?.profile ?? EMPTY_PROFILE}
                today={today}
                onSaved={() => { setEditing(null); onChanged(); }}
                onCancel={() => setEditing(null)}
              />
            ) : undefined}
          >
            <SectionContents section={section} profile={shown} />
          </Section>
        );
      })}
      <History id={id} published={published} />
    </section>
  );
};

export default PeoPanel;
