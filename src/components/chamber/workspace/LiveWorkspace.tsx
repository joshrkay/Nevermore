import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ChamberData } from "@/data/chamberTypes";
import type { CertificationRequest, CertificationState } from "@/data/manuscript";
import type { FieldAction, IntakeState, ProvenanceMap } from "@/data/provenance";
import { resolutionFields, resolveCandidate, type CandidateResolution } from "@/data/documentCandidates";
import { useSessionDocuments, type SessionDocument } from "@/hooks/useSessionDocuments";
import type { SubmitFailure } from "@/hooks/useChamberSession";
import { NO_VERIFIED_FIELDS } from "@/data/requiredItems";
import UploadTab from "../UploadTab";
import CompanyTab from "./CompanyTab";
import PayrollTab from "./PayrollTab";
import BenefitsTab from "./BenefitsTab";
import CensusWorkspaceTab from "./CensusWorkspaceTab";
import DependentsTab from "./DependentsTab";
import ReviewTab from "./ReviewTab";
import { VerifiedFieldsContext } from "./VerifiedFieldsContext";
import PEOMatchTab from "../PEOMatchTab";
import DocumentAnnouncer from "../DocumentAnnouncer";
import ReckoningTab from "../ReckoningTab";

const WORKSPACE_TABS: { key: string; label: string }[] = [
  { key: "upload", label: "① Upload" },
  { key: "company", label: "② Company" },
  { key: "payroll", label: "③ Payroll" },
  { key: "benefits", label: "④ Benefits" },
  { key: "team", label: "⑤ Your Team" },
  { key: "dependents", label: "⑥ Dependents" },
  { key: "review", label: "⑦ Review" },
  { key: "match", label: "⑧ PEO Match" },
  { key: "reckoning", label: "⑨ The Reckoning" },
];

/** The tab the arrow keys, Home and End move to from `index` (the ARIA tabs pattern), or null for any other key. */
function tabForKey(key: string, index: number): number | null {
  const last = WORKSPACE_TABS.length - 1;
  if (key === "ArrowRight") return index === last ? 0 : index + 1;
  if (key === "ArrowLeft") return index === 0 ? last : index - 1;
  if (key === "Home") return 0;
  if (key === "End") return last;
  return null;
}

interface LiveWorkspaceProps {
  data: ChamberData;
  isDemo: boolean;
  sessionId: string | null;
  /** The intake's File ID, for The Reckoning; null while there is no intake. */
  fileId?: string | null;
  onSubmit: (submission: CertificationRequest, signedDataKey: string) => Promise<boolean | SubmitFailure>;
  provenance?: ProvenanceMap;
  /** Fields an advisor verified, still on the answer they saw: settled (`verificationSettles`). */
  verified?: ReadonlySet<string>;
  /** Prospect confirms, edits, or resolves a field. Omit for read-only. */
  onFieldAction?: (action: FieldAction) => void;
  certification?: CertificationState;
  /** Lets the prospect apply what Lenore read from their documents. Omit for read-only. */
  updateIntake?: (updater: (prev: IntakeState) => IntakeState) => void;
  /** The PEO chosen on PEO Match, kept with the intake. With onChoosePeo; without them the choice lasts only for this page. */
  chosenPeo?: string | null;
  onChoosePeo?: (name: string) => void;
  /** Raise it to open Review with the keyboard on its heading (e.g. "Continue manually" when Lenore can't answer). */
  openReview?: number;
  /** Creates the intake when the prospect starts with an upload (useChamberSession's ensureIntake). */
  ensureIntake?: () => Promise<string | null>;
}

const LiveWorkspace = ({
  data,
  isDemo,
  sessionId,
  fileId = null,
  onSubmit,
  provenance = {},
  verified = NO_VERIFIED_FIELDS,
  onFieldAction,
  certification,
  updateIntake,
  chosenPeo: savedPeo,
  onChoosePeo,
  openReview = 0,
  ensureIntake,
}: LiveWorkspaceProps) => {
  const onAction = isDemo ? undefined : onFieldAction;
  const [activeTab, setActiveTab] = useState("upload");
  const ids = useId();
  const tabId = (key: string) => `${ids}-tab-${key}`;
  const panelId = `${ids}-panel`;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Only the selected tab is in the Tab order; the arrow keys move between tabs and open the one they reach.
  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = tabForKey(e.key, index);
    if (next === null) return;
    e.preventDefault();
    const { key } = WORKSPACE_TABS[next];
    setActiveTab(key);
    tabRefs.current[key]?.focus();
  };
  useEffect(() => {
    if (openReview > 0) setActiveTab("review");
  }, [openReview]);
  const documentSessionId = isDemo ? null : sessionId;
  const documents = useSessionDocuments(documentSessionId, isDemo ? undefined : ensureIntake);
  const handleResolve =
    !isDemo && updateIntake
      ? (doc: SessionDocument, resolution: CandidateResolution) => {
          updateIntake((prev) => resolveCandidate(prev, doc, resolution));
          const { fields, kept } = resolutionFields(resolution);
          void documents.markApplied(doc, fields, { kept });
        }
      : undefined;
  // Optional, and never defaulted: we don't rank PEOs, so the prospect picks one or none. The live Chamber
  // keeps the choice with the intake, so a reload during the final steps doesn't lose it.
  const [localPeo, setLocalPeo] = useState<string | null>(null);
  const kept = onChoosePeo !== undefined;
  const chosenPeo = kept ? savedPeo ?? null : localPeo;
  const setChosenPeo = kept ? onChoosePeo : setLocalPeo;

  return (
    <div className="flex flex-col h-full">
      {/* Expectation banner */}
      <div className="bg-secondary/10 border-b border-secondary/20 px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
        <span className="text-secondary">ℹ</span>
        There may be a follow-up question or two after submission — that's normal. The goal is to keep it minimal.
      </div>

      {/* Tab bar */}
      <div role="tablist" aria-label="Intake sections" className="border-b border-border flex overflow-x-auto flex-shrink-0">
        {WORKSPACE_TABS.map((tab, index) => {
          const selected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[tab.key] = el;
              }}
              type="button"
              role="tab"
              id={tabId(tab.key)}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(e) => onTabKeyDown(e, index)}
              className={`tap-target shrink-0 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -outline-offset-2 ${
                selected
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <DocumentAnnouncer docs={documents.docs} loading={documents.isLoading} />

      {/* Tab content */}
      <VerifiedFieldsContext.Provider value={verified}>
        <div role="tabpanel" id={panelId} aria-labelledby={tabId(activeTab)} className="flex-1 overflow-y-auto">
          {activeTab === "upload" && <UploadTab documents={documents} sessionId={documentSessionId} canStart={!isDemo && Boolean(ensureIntake)} data={data} provenance={provenance} onResolveCandidates={handleResolve} />}
          {activeTab === "company" && <CompanyTab data={data} isDemo={isDemo} provenance={provenance} onAction={onAction} />}
          {activeTab === "payroll" && <PayrollTab data={data} provenance={provenance} onAction={onAction} />}
          {activeTab === "benefits" && <BenefitsTab data={data} provenance={provenance} onAction={onAction} />}
          {activeTab === "team" && <CensusWorkspaceTab data={data} isDemo={isDemo} provenance={provenance} onAction={onAction} />}
          {activeTab === "dependents" && <DependentsTab data={data} />}
          {activeTab === "review" && (
            <ReviewTab
              data={data}
              provenance={provenance}
              verified={verified}
              onAction={onAction}
              documents={documents.docs}
              onProceed={() => setActiveTab("match")}
              focusRequest={openReview}
            />
          )}
          {activeTab === "match" && <PEOMatchTab data={data} selectedPeo={chosenPeo} onSelect={setChosenPeo} onProceed={() => setActiveTab("reckoning")} />}
          {activeTab === "reckoning" && (
            <ReckoningTab
              data={data}
              provenance={provenance}
              verified={verified}
              peoName={chosenPeo}
              sessionId={sessionId}
              fileId={fileId}
              onSubmit={onSubmit}
              certification={certification}
              onReview={() => setActiveTab("review")}
            />
          )}
        </div>
      </VerifiedFieldsContext.Provider>
    </div>
  );
};

export default LiveWorkspace;
