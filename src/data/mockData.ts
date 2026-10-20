export interface Employee {
  id: number;
  name: string;
  state: string;
  jobClassification: string;
  annualSalary: number;
  dob: string;
  dependents: number | null;
  status: "confirmed" | "flagged" | "missing";
  flag?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  status: "uploading" | "uploaded" | "parsing" | "parsed" | "needs-confirmation";
  metadata?: string;
}

export interface PEORecommendation {
  name: string;
  matchScore: number;
  matchLabel: string;
  rationale: string;
  pepmRange: string;
}

export interface ChatMessage {
  id: string;
  sender: "lenore" | "user";
  text: string;
  timestamp: string;
}

export function createChatMessage(sender: ChatMessage["sender"], text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    sender,
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

export const MOCK_EMPLOYEES: Employee[] = [
  { id: 1, name: "Sarah Chen", state: "CA", jobClassification: "Senior Designer", annualSalary: 105000, dob: "1988-03-15", dependents: 2, status: "confirmed" },
  { id: 2, name: "Marcus Rivera", state: "CA", jobClassification: "Art Director", annualSalary: 125000, dob: "1985-07-22", dependents: 1, status: "confirmed" },
  { id: 3, name: "Aisha Patel", state: "CA", jobClassification: "UX Researcher", annualSalary: 98000, dob: "1990-11-08", dependents: null, status: "flagged", flag: "Missing dependent data" },
  { id: 4, name: "James O'Brien", state: "TX", jobClassification: "Copywriter", annualSalary: 78000, dob: "1992-01-30", dependents: 0, status: "confirmed" },
  { id: 5, name: "Lisa Tanaka", state: "CA", jobClassification: "Project Manager", annualSalary: 110000, dob: "1987-09-12", dependents: 3, status: "confirmed" },
  { id: 6, name: "David Kim", state: "CA", jobClassification: "Frontend Engineer", annualSalary: 115000, dob: "1991-04-25", dependents: null, status: "flagged", flag: "Missing dependent data" },
  { id: 7, name: "Elena Vasquez", state: "TX", jobClassification: "Account Manager", annualSalary: 85000, dob: "1989-06-18", dependents: 1, status: "confirmed" },
  { id: 8, name: "Ryan Foster", state: "CA", jobClassification: "Motion Designer", annualSalary: 92000, dob: "1993-12-05", dependents: 0, status: "confirmed" },
  { id: 9, name: "Priya Sharma", state: "CA", jobClassification: "Brand Strategist", annualSalary: 101000, dob: "1986-08-20", dependents: null, status: "flagged", flag: "Missing dependent data" },
  { id: 10, name: "Tom Bradley", state: "TX", jobClassification: "Freelance Illustrator", annualSalary: 72000, dob: "1994-02-14", dependents: 0, status: "missing", flag: "1099 contractor — AB5 classification risk detected" },
  { id: 11, name: "Megan Wu", state: "CA", jobClassification: "Creative Director", annualSalary: 140000, dob: "1983-05-10", dependents: 2, status: "confirmed" },
  { id: 12, name: "Carlos Mendez", state: "TX", jobClassification: "Video Editor", annualSalary: 76000, dob: "1995-10-03", dependents: 0, status: "confirmed" },
];

export const MOCK_FILES: UploadedFile[] = [
  { id: "1", name: "meridian_census_2024.xlsx", size: "245 KB", type: "Employee Census", status: "parsed", metadata: "28 employees detected" },
  { id: "2", name: "blueshield_invoice_q4.pdf", size: "1.2 MB", type: "Benefits Invoice", status: "parsed", metadata: "Blue Shield PPO · $18,240/mo" },
  { id: "3", name: "wc_loss_runs_2021-2024.pdf", size: "890 KB", type: "W/C Loss Runs", status: "parsed", metadata: "3-year W/C history · 2 claims" },
  { id: "4", name: "plan_design_summary.pdf", size: "340 KB", type: "Plan Design", status: "needs-confirmation", metadata: "⚠ Needs Confirmation" },
];

export const MOCK_PEOS: PEORecommendation[] = [
  {
    name: "TriNet",
    matchScore: 92,
    matchLabel: "Best Match",
    rationale: "Strong California presence with robust benefits administration. Ideal for creative agencies with multi-state employees.",
    pepmRange: "$145–$175",
  },
  {
    name: "Justworks",
    matchScore: 78,
    matchLabel: "Strong Fit",
    rationale: "Modern platform with transparent pricing. Great fit for tech-forward companies under 50 employees.",
    pepmRange: "$99–$129",
  },
  {
    name: "Rippling",
    matchScore: 65,
    matchLabel: "Good Fit",
    rationale: "Unified HR and IT platform. Competitive for companies prioritizing automation and integrations.",
    pepmRange: "$110–$145",
  },
];
