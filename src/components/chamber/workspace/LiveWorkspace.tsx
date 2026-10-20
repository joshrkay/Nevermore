import { useState } from "react";
import type { ChamberData } from "@/data/chamberTypes";
import type { ChamberSubmission } from "@/data/manuscript";
import UploadTab from "../UploadTab";
import CompanyTab from "./CompanyTab";
import CensusWorkspaceTab from "./CensusWorkspaceTab";
import ReviewTab from "./ReviewTab";
import ReckoningTab from "../ReckoningTab";

const WORKSPACE_TABS = [
  { key: "upload", label: "① Upload" },
  { key: "company", label: "② Company" },
  { key: "team", label: "③ Your Team" },
  { key: "review", label: "④ Review" },
  { key: "reckoning", label: "⑤ The Reckoning" },
];

interface LiveWorkspaceProps {
  data: ChamberData;
  isDemo: boolean;
  sessionId: string | null;
  onSubmit: (submission: ChamberSubmission) => Promise<boolean>;
}

const LiveWorkspace = ({ data, isDemo, sessionId, onSubmit }: LiveWorkspaceProps) => {
  const [activeTab, setActiveTab] = useState("upload");

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
        {activeTab === "team" && <CensusWorkspaceTab data={data} isDemo={isDemo} />}
        {activeTab === "review" && <ReviewTab data={data} onProceed={() => setActiveTab("reckoning")} />}
        {activeTab === "reckoning" && <ReckoningTab data={data} sessionId={sessionId} onSubmit={onSubmit} />}
      </div>
    </div>
  );
};

export default LiveWorkspace;
