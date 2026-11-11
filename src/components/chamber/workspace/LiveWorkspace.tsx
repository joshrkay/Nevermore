import { useEffect, useState } from "react";
import type { ChamberData } from "@/data/chamberTypes";
import type { CertificationRequest, CertificationState } from "@/data/manuscript";
import type { FieldAction, IntakeState, ProvenanceMap } from "@/data/provenance";
import { resolutionFields, resolveCandidate, type CandidateResolution } from "@/data/documentCandidates";
import { useSessionDocuments, type SessionDocument } from "@/hooks/useSessionDocuments";
import { usePeoCatalog, type PeoCatalogStatus } from "@/hooks/usePeoCatalog";
import type { PeoRecord } from "@/data/peoCatalog";
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
import { RequestedFieldsContext } from "./RequestedFieldsContext";
import { NO_REQUESTED_FIELDS } from "@/data/informationRequest";
import PEOMatchTab, { type PEOMatchTabProps } from "../PEOMatchTab";
import ReckoningTab from "../ReckoningTab";
import ExtraQuestionsSection from "../ExtraQuestionsSection";
import { askedPeos, NO_EXTRA_ANSWERS, type ExtraAnswers, type ExtraQuestionRef } from "@/data/extraAnswers";

const WORKSPACE_TABS = [
  { key: "upload", label: "① Upload" },
  { key: "company", label: "② Company" },
  { key: "payroll", label: "③ Payroll" },
  { key: "benefits", label: "④ Benefits" },
  { key: "team", label: "⑤ Your Team" },
  { key: "dependents", label: "⑥ Dependents" },
  { key: "review", label: "⑦ Review" },
  { key: "match", label: "⑧ PEO Match" },
  { key: "reckoning", label: "⑨ Certify & sign" },
];

interface LiveWorkspaceProps {
  data: ChamberData;
  isDemo: boolean;
  sessionId: string | null;
  /** The intake's File ID, for Certify & sign; null while there is no intake. */
  fileId?: string | null;
  onSubmit: (submission: CertificationRequest, signedDataKey: string) => Promise<boolean | SubmitFailure>;
  provenance?: ProvenanceMap;
  /** Fields an advisor verified, still on the answer they saw: settled (`verificationSettles`). */
  verified?: ReadonlySet<string>;
  /** Fields the advisor's open request for information is about: each row says the advisor asked about it. */
  requested?: ReadonlySet<string>;
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
  /** The answers to PEOs' own extra questions, kept with the intake. */
  extraAnswers?: ExtraAnswers;
  /** Changes them (useChamberSession's updateExtraAnswers). Omit to show them read-only. */
  onExtraAnswers?: (update: (prev: ExtraAnswers) => ExtraAnswers) => void;
  /** The PEOs' own questions the advisor's open request names: their PEO's section is shown too, each marked. */
  requestedQuestions?: readonly ExtraQuestionRef[];
  /** The PEOs the database lists, when the page already reads them (usePeoCatalog); otherwise PEO Match reads them. */
  peoCatalog?: { peos: PeoRecord[]; status: PeoCatalogStatus };
}

const NO_REQUESTED_QUESTIONS: readonly ExtraQuestionRef[] = [];

/**
 * PEO Match over the PEOs the database lists, read when the tab opens, with the chosen PEO's own extra questions under
 * it (Questions from <PEO>).
 */
const PeoMatchFromDatabase = ({ extraAnswers, onExtraAnswers, requestedQuestions, given, ...props }: Omit<PEOMatchTabProps, "catalog" | "catalogStatus" | "children"> & {
  extraAnswers: ExtraAnswers;
  onExtraAnswers?: LiveWorkspaceProps["onExtraAnswers"];
  requestedQuestions: readonly ExtraQuestionRef[];
  given: LiveWorkspaceProps["peoCatalog"];
}) => {
  // Read here only when the page didn't pass the PEOs it already read.
  const own = usePeoCatalog(given === undefined);
  const { peos, status } = given ?? own;
  return (
    <PEOMatchTab {...props} catalog={peos} catalogStatus={status}>
      {askedPeos(peos, props.selectedPeo, requestedQuestions).map((asked) => (
        <ExtraQuestionsSection key={asked.peo.id} peo={asked.peo} questions={asked.questions} answers={extraAnswers} onChange={onExtraAnswers} requested={asked.requested} />
      ))}
    </PEOMatchTab>
  );
};

const LiveWorkspace = ({
  data,
  isDemo,
  sessionId,
  fileId = null,
  onSubmit,
  provenance = {},
  verified = NO_VERIFIED_FIELDS,
  requested = NO_REQUESTED_FIELDS,
  onFieldAction,
  certification,
  updateIntake,
  chosenPeo: savedPeo,
  onChoosePeo,
  openReview = 0,
  ensureIntake,
  extraAnswers = NO_EXTRA_ANSWERS,
  onExtraAnswers,
  requestedQuestions = NO_REQUESTED_QUESTIONS,
  peoCatalog,
}: LiveWorkspaceProps) => {
  const onAction = isDemo ? undefined : onFieldAction;
  const [activeTab, setActiveTab] = useState("upload");
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
      <div className="border-b border-border flex overflow-x-auto flex-shrink-0">
        {WORKSPACE_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            aria-current={activeTab === tab.key ? "step" : undefined}
            className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <VerifiedFieldsContext.Provider value={verified}>
        <RequestedFieldsContext.Provider value={requested}>
        <div className="flex-1 overflow-y-auto">
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
          {activeTab === "match" && (
            <PeoMatchFromDatabase
              data={data}
              selectedPeo={chosenPeo}
              onSelect={setChosenPeo}
              onProceed={() => setActiveTab("reckoning")}
              extraAnswers={extraAnswers}
              onExtraAnswers={isDemo ? undefined : onExtraAnswers}
              requestedQuestions={requestedQuestions}
              given={peoCatalog}
            />
          )}
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
        </RequestedFieldsContext.Provider>
      </VerifiedFieldsContext.Provider>
    </div>
  );
};

export default LiveWorkspace;
