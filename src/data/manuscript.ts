import type { ChamberData, ChamberEmployee } from "./chamberTypes";

/** Signed attestation stored on chamber_sessions.submission. */
export interface ChamberSubmission {
  signer_name: string;
  signer_title: string;
  signed_at: string; // ISO timestamp
  file_id: string;
  peo?: string; // PEO the client chose on PEO Match; absent on older submissions
  // Copy of the data as signed, so later edits to the session can't change
  // what the certified manuscript shows. Absent on older submissions.
  chamber_data?: unknown;
}

/** Stable, human-readable file id derived from the session id. */
export function fileIdForSession(sessionId: string, date = new Date()): string {
  return `EAA-${date.getFullYear()}-${sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

// ---------- Eligibility ----------

export type CheckStatus = "pass" | "fail" | "unknown";

export interface EligibilityCheck {
  label: string;
  status: CheckStatus;
}

export const MIN_HEADCOUNT = 5;

export function headcount(data: ChamberData): number {
  return data.employee_count ?? data.employees.filter((e) => e.classification === "W2").length;
}

/** Only reports pass/fail for what was actually collected; everything else is "unknown". */
export function eligibilityChecks(data: ChamberData): EligibilityCheck[] {
  const count = headcount(data);
  return [
    {
      label: `Headcount meets PEO minimum (${count || "?"} of ${MIN_HEADCOUNT} employees)`,
      status: count === 0 ? "unknown" : count >= MIN_HEADCOUNT ? "pass" : "fail",
    },
    { label: "US headquarters", status: data.hq_state ? "pass" : "unknown" },
    {
      label: `Employee census captured${data.employees.length ? ` (${data.employees.length} employees)` : ""}`,
      status: data.employees.length > 0 ? "pass" : "unknown",
    },
    { label: "Industry — no exclusions", status: "unknown" },
    { label: "Workers' comp history and open claims", status: "unknown" },
    { label: "Renewal increase within range", status: "unknown" },
  ];
}

// ---------- Employee flags ----------

export function employeeFlag(emp: ChamberEmployee): string | null {
  if (emp.classification === "1099" && emp.state === "CA") return "CA 1099 contractor — AB5 review recommended";
  const title = emp.title.toLowerCase();
  if (/freelance|contractor/.test(title)) return "Worker classification needs confirmation";
  if (/account|sales/.test(title)) return "Confirm W/C class code (possible outside sales)";
  return null;
}

// ---------- Manuscript view model ----------

const MONOPOLISTIC_STATES = new Set(["ND", "OH", "WA", "WY"]);
const STATE_RATING_BUREAUS: Record<string, string> = {
  CA: "WCIRB",
  NY: "NYCIRB",
  NJ: "NJCRIB",
  PA: "PCRB",
  DE: "DCRB",
};

export function wcSystem(state: string): string {
  if (MONOPOLISTIC_STATES.has(state)) return "State fund";
  return STATE_RATING_BUREAUS[state] ?? "NCCI";
}

export function coverageTier(emp: ChamberEmployee): string {
  const hasSpouse = emp.dependents.some((d) => d.relationship === "spouse" || d.relationship === "domestic_partner");
  const hasChild = emp.dependents.some((d) => d.relationship === "child");
  if (hasSpouse && hasChild) return "Employee + Family";
  if (hasSpouse) return "Employee + Spouse";
  if (hasChild) return "Employee + Child(ren)";
  return "Employee Only";
}

const TIERS = ["Employee Only", "Employee + Spouse", "Employee + Child(ren)", "Employee + Family"];

export const NOT_PROVIDED = "Not provided";

const orNotProvided = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? NOT_PROVIDED : String(v);

const yesNo = (v: boolean | null) => (v === null ? NOT_PROVIDED : v ? "Yes" : "No");

export interface ManuscriptCensusRow {
  name: string;
  dob: string;
  state: string;
  title: string;
  salary: string;
  classification: ChamberEmployee["classification"];
  tier: string;
  flag: string | null;
}

export interface Manuscript {
  fileId: string;
  date: string;
  companyName: string;
  submittedTo: string | null;
  companyRows: [string, string][];
  workforceRows: [string, string][];
  states: { state: string; count: string; system: string }[];
  census: ManuscriptCensusRow[];
  dependentTiers: { tier: string; count: number; pct: string }[];
  totalDependents: number;
  benefitsRows: [string, string][];
  resolved: string[];
  open: string[];
  signer: { name: string; title: string; signedAt: string } | null;
}

export function buildManuscript(
  data: ChamberData,
  opts: { fileId: string; submission?: ChamberSubmission | null; date?: Date },
): Manuscript {
  const date = opts.date ?? (opts.submission ? new Date(opts.submission.signed_at) : new Date());
  const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const w2 = data.employees.filter((e) => e.classification === "W2");
  const contractors = data.employees.filter((e) => e.classification === "1099");

  const stateCounts = new Map<string, number>();
  for (const emp of data.employees) {
    if (emp.state) stateCounts.set(emp.state, (stateCounts.get(emp.state) ?? 0) + 1);
  }
  const allStates = [...new Set([...data.states, ...stateCounts.keys()])];

  const tierCounts = new Map<string, number>(TIERS.map((t) => [t, 0]));
  for (const emp of w2) tierCounts.set(coverageTier(emp), (tierCounts.get(coverageTier(emp)) ?? 0) + 1);

  const checks = eligibilityChecks(data);
  const missingCore = [
    ["Company legal name", !data.company_name],
    ["States of operation", allStates.length === 0],
    ["Pay frequency", !data.pay_frequency],
    ["Employee census", data.employees.length === 0],
  ].flatMap(([label, missing]) => (missing ? [`${label} — not provided`] : []));
  const flags = data.employees.flatMap((e) => {
    const flag = employeeFlag(e);
    return flag ? [`${e.first_name} ${e.last_name}: ${flag}`] : [];
  });

  return {
    fileId: opts.fileId,
    date: fmtDate(date),
    companyName: data.company_name ?? "[Company name not provided]",
    submittedTo: opts.submission?.peo ?? null,
    companyRows: [
      ["Legal Name", orNotProvided(data.company_name)],
      ["HQ State", orNotProvided(data.hq_state)],
      ["Industry", orNotProvided(data.industry)],
      ["Entity Structure", data.multiple_entities === null ? NOT_PROVIDED : data.multiple_entities ? `Multiple (${orNotProvided(data.fein_count)} FEINs)` : "Single entity"],
      ["Target Start", orNotProvided(data.start_month)],
      ["Current Payroll", orNotProvided(data.payroll_vendor)],
      ["Pay Frequency", orNotProvided(data.pay_frequency)],
      ["Coverage Status", data.virgin_medical === null ? NOT_PROVIDED : data.virgin_medical ? "First-time — no prior employer health benefits" : "Switching existing coverage"],
    ],
    workforceRows: [
      ["Reported Headcount", orNotProvided(data.employee_count)],
      ["W-2 Employees on Census", String(w2.length)],
      ["1099 Contractors on Census", data.employees.length ? String(contractors.length) : yesNo(data.has_1099)],
      ["Exempt / Nonexempt", data.exempt_count === null && data.nonexempt_count === null ? NOT_PROVIDED : `${orNotProvided(data.exempt_count)} / ${orNotProvided(data.nonexempt_count)}`],
      ["In-house HR Staff", orNotProvided(data.hr_staff_count)],
      ["Employee Handbook", yesNo(data.has_handbook)],
    ],
    states: allStates.map((s) => ({ state: s, count: stateCounts.has(s) ? String(stateCounts.get(s)) : NOT_PROVIDED, system: wcSystem(s) })),
    census: data.employees.map((e) => ({
      name: `${e.first_name} ${e.last_name}`.trim(),
      dob: e.dob || NOT_PROVIDED,
      state: e.state || NOT_PROVIDED,
      title: e.title || NOT_PROVIDED,
      salary: e.salary ? `$${e.salary.toLocaleString()}` : NOT_PROVIDED,
      classification: e.classification,
      tier: e.classification === "W2" ? coverageTier(e) : "Not applicable",
      flag: employeeFlag(e),
    })),
    dependentTiers: TIERS.map((tier) => {
      const count = tierCounts.get(tier) ?? 0;
      return { tier, count, pct: w2.length ? `${Math.round((count / w2.length) * 100)}%` : NOT_PROVIDED };
    }),
    totalDependents: w2.reduce((sum, e) => sum + e.dependents.length, 0),
    benefitsRows: [
      ["Current Carrier", orNotProvided(data.current_carrier)],
      ["Renewal Date", orNotProvided(data.renewal_date)],
      ["Rate History", orNotProvided(data.rate_history)],
      ["Waiting Period", orNotProvided(data.benefits_waiting_period)],
      ["Ancillary Benefits", data.ancillary_benefits.length ? data.ancillary_benefits.join(", ") : NOT_PROVIDED],
      ["Retirement", data.has_401k === null ? NOT_PROVIDED : data.has_401k ? `${data.retirement_type || "401(k)"}${data.employer_contributes ? " · employer contributes" : ""}` : "None"],
    ],
    resolved: checks.filter((c) => c.status === "pass").map((c) => c.label),
    open: [
      ...missingCore,
      ...checks.filter((c) => c.status === "fail").map((c) => `${c.label} — not met`),
      ...checks.filter((c) => c.status === "unknown").map((c) => `${c.label} — not yet verified`),
      ...flags,
    ],
    signer: opts.submission
      ? { name: opts.submission.signer_name, title: opts.submission.signer_title, signedAt: fmtDate(new Date(opts.submission.signed_at)) }
      : null,
  };
}
