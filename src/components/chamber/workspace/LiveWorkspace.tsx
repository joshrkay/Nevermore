import { useState } from "react";
import type { ChamberData } from "@/data/chamberTypes";
import type { CertificationState, ChamberSubmission } from "@/data/manuscript";
import UploadTab from "../UploadTab";
import CompanyTab from "./CompanyTab";
import PayrollTab from "./PayrollTab";
import BenefitsTab from "./BenefitsTab";
import CensusWorkspaceTab from "./CensusWorkspaceTab";
import DependentsTab from "./DependentsTab";
import ReviewTab from "./ReviewTab";
import PEOMatchTab from "../PEOMatchTab";
import ReckoningTab from "../ReckoningTab";

const WORKSPACE_TABS = [
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

interface LiveWorkspaceProps {
  data: ChamberData;
  isDemo: boolean;
  sessionId: string | null;
  onSubmit: (submission: ChamberSubmission) => Promise<boolean>;
  certification?: CertificationState;
}

const LiveWorkspace = ({ data, isDemo, sessionId, onSubmit, certification }: LiveWorkspaceProps) => {
  const [activeTab, setActiveTab] = useState("upload");
  // Optional, and never defaulted: we don't rank PEOs, so the prospect picks one or none.
  const [chosenPeo, setChosenPeo] = useState<string | null>(null);

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
      <div className="flex-1 overflow-y-auto">
        {activeTab === "upload" && <UploadTab onFilesUploaded={() => setActiveTab("company")} />}
        {activeTab === "company" && <CompanyTab data={data} isDemo={isDemo} />}
        {activeTab === "payroll" && <PayrollTab data={data} />}
        {activeTab === "benefits" && <BenefitsTab data={data} />}
        {activeTab === "team" && <CensusWorkspaceTab data={data} isDemo={isDemo} />}
        {activeTab === "dependents" && <DependentsTab data={data} />}
        {activeTab === "review" && <ReviewTab data={data} onProceed={() => setActiveTab("match")} />}
        {activeTab === "match" && <PEOMatchTab data={data} selectedPeo={chosenPeo} onSelect={setChosenPeo} onProceed={() => setActiveTab("reckoning")} />}
        {activeTab === "reckoning" && <ReckoningTab data={data} peoName={chosenPeo} sessionId={sessionId} onSubmit={onSubmit} certification={certification} />}
      </div>
    </div>
  );
};

export default LiveWorkspace;
