import { useId, useState } from "react";
import { AlertTriangle, ClipboardList, Loader2 } from "lucide-react";
import EligibilityChecks from "@/components/peo/EligibilityChecks";
import type { PeoCatalogStatus } from "@/hooks/usePeoCatalog";
import { findPeo, peoFit, type PeoRecord } from "@/data/peoCatalog";
import {
  groupByCompleteness,
  informationRequestDraft,
  missingLine,
  type CertifiedVersion,
  type InformationRequestDraft,
  type NeededItem,
  type PeoCompletenessEntry,
} from "@/data/peoCompleteness";
import { localToday, staleProfileWarning } from "@/data/peoProfiles";
import { formatDay } from "@/data/quoteRequests";
import type { QuoteRequestRow } from "@/lib/advisorApi";
import type { BuiltFrom } from "@/lib/certificationCheck";
import { supplementFor } from "@/data/peoSupplement";
import CensusDownload from "@/components/CensusDownload";
import SupplementDownload from "@/components/SupplementDownload";
import WorkersCompDownload from "@/components/WorkersCompDownload";
import { workersCompApplication } from "@/data/workersCompApplication";

interface PeoNeedsPanelProps {
  /** The last certified version (lastCertifiedVersion); null before the first certification. */
  certified: CertifiedVersion | null;
  catalog: readonly PeoRecord[];
  catalogStatus: PeoCatalogStatus;
  onRetryCatalog: () => void;
  /** The PEO the prospect chose when they certified, as they named it. */
  chosenPeo: string | null;
  quoteRequests: readonly QuoteRequestRow[];
  /** Why Ask the prospect can't take a request now (informationRequestBlockedReason); null when it can. */
  askBlocked: string | null;
  /** Opens Ask the prospect with this draft in it, for the advisor to edit and send. Sends nothing. */
  onDraft: (draft: InformationRequestDraft) => void;
  /** The submission's File ID and company, which each PEO's supplement is named and headed with. */
  fileId: string;
  companyName: string;
  /** The certification the files were built from, checked again at each download's click. */
  builtFrom: BuiltFrom;
}

const chip = "inline-flex items-center text-xs px-2 py-0.5 rounded-full whitespace-nowrap";

/** "Insperity", "Insperity and Oasis", "ADP, Insperity and Oasis". */
const namesList = (names: readonly string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** One thing a PEO still needs, as the boxes list it: "HRIS system: not provided". */
const itemText = (i: NeededItem) =>
  i.kind === "document" ? `${i.label}: ${i.description} (${i.reason.toLowerCase()})` : `${i.label}: ${i.reason.toLowerCase()}`;
const itemKey = (i: NeededItem) => (i.kind === "answer" ? i.field : i.kind === "question" ? `question-${i.key}` : `${i.category}-${i.description}`);

const MissingBox = ({ title, items, quiet }: { title: string; items: readonly NeededItem[]; quiet?: boolean }) => {
  const id = useId();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className={quiet ? "rounded-lg border border-dashed border-border p-3" : "rounded-lg bg-muted p-3"}>
      <h5 id={id} className={`text-xs font-medium ${quiet ? "text-muted-foreground" : ""}`}>{title}</h5>
      <ul className={`mt-1 space-y-1 text-sm ${quiet ? "text-muted-foreground" : ""}`}>
        {items.map((i) => <li key={itemKey(i)}>{itemText(i)}</li>)}
      </ul>
    </section>
  );
};

const PeoCard = ({ entry, certified, chosen, sent, askBlocked, onDraft, today, fileId, companyName, builtFrom }: {
  entry: PeoCompletenessEntry;
  certified: CertifiedVersion;
  chosen: boolean;
  sent: QuoteRequestRow | undefined;
  askBlocked: string | null;
  onDraft: (draft: InformationRequestDraft) => void;
  today: string;
  fileId: string;
  companyName: string;
  builtFrom: BuiltFrom;
}) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const { peo, completeness: c } = entry;
  const stale = staleProfileWarning(peo, today);
  const anything = c.toQuote.length + c.beforeSigning.length > 0;
  const census = certified.intake.data.census;
  const supplement = supplementFor(peo, { certified: certified.intake.extraAnswers, fileId, version: certified.version, companyName });
  // The same for every PEO: no profile asks anything else of it.
  const application = workersCompApplication({ intake: certified.intake, fileId, version: certified.version, changedSince: certified.changedSince });
  return (
    <article aria-labelledby={`${id}-name`} className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 id={`${id}-name`} className="font-medium">{peo.name}</h4>
        {chosen && <span className={`${chip} bg-highlight text-highlight-foreground`}>Prospect's choice</span>}
        {sent?.sent_on && (
          <span className={`${chip} bg-muted`}>{`Sent ${formatDay(sent.sent_on)}${sent.sent_version !== null ? ` · version ${sent.sent_version}` : ""}`}</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{missingLine(c)}</p>
      {stale && (
        <p className="text-xs text-warning flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          {stale}
        </p>
      )}
      {anything && (
        <>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={`${id}-missing`}
            className="min-h-11 text-sm text-primary underline hover:text-primary/90"
          >
            {open ? "Hide what's missing" : "Show what's missing"}
          </button>
          {open && (
            <div id={`${id}-missing`} className="grid gap-2 sm:grid-cols-2">
              <MissingBox title="Needed to quote" items={c.toQuote} />
              <MissingBox title="Needed only before signing" items={c.beforeSigning} quiet />
            </div>
          )}
        </>
      )}
      <EligibilityChecks peo={peo.name} checks={peoFit(certified.intake.data, peo, today)} />
      {/* Its files, built from the last certified version: the census in its layout, the workers' comp application
          data, and its own questions, which go to it alone. */}
      <div className="space-y-3 border-t border-border pt-3">
        {application.changedNotice && <p className="text-xs text-muted-foreground">{application.changedNotice}</p>}
        {census.length > 0 && <CensusDownload census={census} fileId={fileId} version={certified.version} peo={peo.name} catalog={[peo]} builtFrom={builtFrom} />}
        {supplement && <SupplementDownload supplement={supplement} builtFrom={builtFrom} />}
        <WorkersCompDownload application={application} builtFrom={builtFrom} />
      </div>
      {!c.complete && askBlocked !== null && (
        <p className="text-sm text-muted-foreground">{`The prospect can't be asked for it now: ${askBlocked.charAt(0).toLowerCase()}${askBlocked.slice(1)}`}</p>
      )}
      {!c.complete && askBlocked === null && (
        <button
          type="button"
          onClick={() => onDraft(informationRequestDraft(c, peo.id))}
          className="min-h-11 w-full sm:w-auto px-4 inline-flex items-center justify-center gap-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Draft information request
        </button>
      )}
    </article>
  );
};

/**
 * What each PEO still needs (L-2.2): every PEO an admin lists, grouped by whether the last certified version is
 * complete for it (GLOSSARY.md, Complete for a PEO), alphabetical in each group. Each says what is missing to quote and,
 * apart, what it needs only before signing, with its eligibility checks as warnings beside it, and drafts an
 * information request from what is missing. Nothing here ranks a PEO or sends anything.
 */
const PeoNeedsPanel = ({ certified, catalog, catalogStatus, onRetryCatalog, chosenPeo, quoteRequests, askBlocked, onDraft, fileId, companyName, builtFrom }: PeoNeedsPanelProps) => {
  const today = localToday();
  const body = () => {
    if (!certified) return <p className="text-sm text-muted-foreground">Available once the prospect has certified their intake: each PEO's list is built from what they certified.</p>;
    if (certified.cantTell) {
      return (
        <p className="text-sm text-muted-foreground">
          {`Version ${certified.version ?? "on record"} was certified before we kept each answer's status and the documents it covered, so we can't tell what each PEO still needs from it. Ask the prospect to certify again.`}
        </p>
      );
    }
    if (catalogStatus === "loading") {
      return (
        <p aria-live="polite" className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading the PEOs' profiles to see what each still needs.
        </p>
      );
    }
    if (catalogStatus === "failed") {
      return (
        <div role="alert" className="text-sm space-y-1">
          <p>We couldn't load the PEOs' profiles, so we can't say what each still needs.</p>
          <button type="button" onClick={onRetryCatalog} className="min-h-11 text-primary underline hover:text-primary/90">Load the profiles again</button>
        </div>
      );
    }
    const groups = groupByCompleteness(certified.intake, certified.documents, catalog);
    const chosen = chosenPeo ? findPeo(catalog, chosenPeo) : undefined;
    const isChosen = (p: PeoRecord) => chosen === p;
    const sentTo = (p: PeoRecord) => quoteRequests.find((r) => findPeo(catalog, r.peo_name) === p);
    const group = (title: string, entries: readonly PeoCompletenessEntry[]) => (
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{`${title} · ${entries.length}`}</h3>
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul aria-label={title} className="space-y-3">
            {entries.map((e) => (
              <li key={e.peo.name}>
                <PeoCard entry={e} certified={certified} chosen={isChosen(e.peo)} sent={sentTo(e.peo)} askBlocked={askBlocked} onDraft={onDraft} today={today} fileId={fileId} companyName={companyName} builtFrom={builtFrom} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
    const noProfile = groups.noProfile.map((p) => (isChosen(p) ? `${p.name} (the prospect's choice)` : p.name));
    return (
      <>
        <p className="text-xs text-muted-foreground">
          {certified.changedSince
            ? `The prospect has changed answers since certifying. What's listed here is as of version ${certified.version ?? "on record"}.`
            : `From version ${certified.version ?? "on record"}, the prospect's last certification.`}{" "}
          Alphabetical in each group. Nothing here is a ranking.
        </p>
        {group("Complete", groups.complete)}
        {group("Something missing", groups.missing)}
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{`No profile yet · ${groups.noProfile.length}`}</h3>
          <p className="text-sm text-muted-foreground">
            {groups.noProfile.length === 0 ? "Every listed PEO has a profile." : `No profile yet for ${namesList(noProfile)}, so there's nothing to check against.`}
          </p>
        </div>
        {chosenPeo && !chosen && (
          <p className="text-sm text-muted-foreground">{`The prospect named ${chosenPeo}, which isn't on the PEO list, so it has no profile.`}</p>
        )}
        {chosen && !chosen.listed && (
          <p className="text-sm text-muted-foreground">{`The prospect chose ${chosen.name}, which has been taken off the PEO list, so it isn't shown here.`}</p>
        )}
      </>
    );
  };
  return (
    <section aria-labelledby="peo-needs-heading" className="border border-border rounded-xl p-5 space-y-4">
      <h2 id="peo-needs-heading" className="font-display text-lg font-bold flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        What each PEO still needs
      </h2>
      {body()}
    </section>
  );
};

export default PeoNeedsPanel;
