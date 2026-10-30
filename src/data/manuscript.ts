import type { ChamberData } from "./chamberTypes";
import { COVERAGE_TIER_LABELS, isW2, type CensusEmployee } from "./census";
import { headcount } from "./headcount";
import { findPeo, peoFit, type PeoRecord } from "./peoCatalog";
import { fieldOpenItems, type FieldKey, type ProvenanceMap } from "./provenance";

/** Signed attestation stored on chamber_sessions.submission. */
export interface ChamberSubmission {
  signer_name: string;
  signer_title: string;
  signed_at: string; // ISO timestamp, as captured in the signer's browser
  file_id: string;
  peo?: string; // PEO the client chose on PEO Match; absent on older submissions
  // The consent wording the signer agreed to, one statement per entry; absent on older submissions.
  // `consent_version` carries the same version for the database's certification check, and
  // submissions from before the statements were stored separately hold `consent_text` as one string.
  consent_text_version?: string;
  consent_version?: string;
  consent_text?: string[] | string;
  // Stamped by the database when the certification is accepted (the server's clock, not the browser's).
  certified_at?: string;
  data_hash?: string;
  data_sha256?: string;
  // Copy of the data as signed, so later edits to the session can't change
  // what the certified manuscript shows. Absent on older submissions.
  chamber_data?: unknown;
  // Field status and source as signed. Absent on older submissions.
  field_provenance?: unknown;
}

// ---------- Certification ----------

/**
 * Where a session stands. "stale" means it was certified, then its answers changed:
 * the database withdraws the certification, and the prospect has to certify again.
 */
export type CertificationState =
  | { status: "none" }
  | { status: "certified"; submission: ChamberSubmission }
  | { status: "stale"; submission: ChamberSubmission };

export const NO_CERTIFICATION: CertificationState = { status: "none" };

/** Reads a stored row's status and submission into a CertificationState. */
export function certificationFromRow(status: string | null, submission: unknown): CertificationState {
  const sub = submission as ChamberSubmission | null;
  if (!sub || typeof sub !== "object" || !sub.signer_name) return NO_CERTIFICATION;
  return status === "submitted" ? { status: "certified", submission: sub } : { status: "stale", submission: sub };
}

export const CERTIFICATION_CONSENT_VERSION = "2026-10-v1";

/** Shown for submissions certified before the consent wording was stored. */
export const LEGACY_CONSENT_TEXT =
  "I confirm the information in this submission is accurate and complete to the best of my knowledge.";

export interface CertificationConsent {
  version: string;
  /** One checkbox each; every one must be ticked before signing. */
  statements: string[];
  /** The sentence the signature itself affirms. */
  signing: string;
  /** Everything above as one string, stored verbatim with the submission. */
  text: string;
}

export function certificationConsent(opts: { companyName: string | null; peo: string | null }): CertificationConsent {
  const statements = [
    "The information I've provided is accurate and complete to the best of my knowledge.",
    "All employees listed are W-2. Any K-1 owners or 1099 contractors have been identified separately.",
    `I understand this packet is prepared for me to send to ${opts.peo ?? "the PEO I choose"} myself. Edgar Allan Advisory does not submit it or request a quote for me.`,
  ];
  const signing =
    `By signing, I certify as an authorized representative of ${opts.companyName?.trim() || "my company"} ` +
    "that the information in this submission is accurate and complete, and I consent to Edgar Allan Advisory " +
    "preparing it as The Manuscript. I understand that changing my answers after signing requires me to certify again.";
  return {
    version: CERTIFICATION_CONSENT_VERSION,
    statements,
    signing,
    text: [...statements, signing].join("\n"),
  };
}

// ---------- Masking & filenames ----------

/** Masks month/day of a date of birth, keeping the year. An age ("Age 41") already hides both. */
export function maskDob(dob: string): string {
  if (/^Age \d+$/.test(dob)) return dob;
  const year = dob.match(/\d{4}/)?.[0];
  return year ? `••/••/${year}` : "••/••/••••";
}

const LATIN_FOLDS: Record<string, string> = {
  ø: "o", Ø: "O", æ: "ae", Æ: "AE", ß: "ss", ł: "l", Ł: "L", đ: "d", Đ: "D", ð: "d", Ð: "D", þ: "th", Þ: "Th",
};

/** Letters with no Unicode decomposition (ø, ł, ß...) mapped to their usual ASCII spelling. */
export function foldLatin(text: string): string {
  return text.replace(/[øØæÆßłŁđĐðÐþÞ]/g, (ch) => LATIN_FOLDS[ch]);
}

/** `The_Manuscript_<file id>_<company>.pdf`, safe on every OS and browser. */
export function manuscriptFilename(fileId: string, companyName: string | null): string {
  const slug = foldLatin(companyName ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/, "");
  return `The_Manuscript_${fileId}_${slug || "Company"}.pdf`;
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

export { headcount } from "./headcount";

function headcountCheck(data: ChamberData, peo?: PeoRecord): EligibilityCheck {
  const count = headcount(data);
  if (!peo || peo.minHeadcount === null) {
    return { label: `Headcount meets PEO minimum (${count || "?"} employees) — minimum not yet confirmed`, status: "unknown" };
  }
  const [fit] = peoFit(data, peo);
  return {
    label: `Headcount meets ${peo.name} minimum (${count || "?"} of ${peo.minHeadcount} employees)`,
    status: fit.status === "meets" ? "pass" : fit.status === "does_not_meet" ? "fail" : "unknown",
  };
}

/** Only reports pass/fail for what was actually collected; everything else is "unknown". */
export function eligibilityChecks(data: ChamberData, peo?: PeoRecord): EligibilityCheck[] {
  return [
    headcountCheck(data, peo),
    { label: "US headquarters", status: data.hq_state ? "pass" : "unknown" },
    {
      label: `Employee census captured${data.census.length ? ` (${data.census.length} employees)` : ""}`,
      status: data.census.length > 0 ? "pass" : "unknown",
    },
    { label: "Industry — no exclusions", status: "unknown" },
    { label: "Workers' comp history and open claims", status: "unknown" },
    { label: "Renewal increase within range", status: "unknown" },
  ];
}

// ---------- Employee flags ----------

export function employeeFlag(emp: CensusEmployee): string | null {
  if (emp.classification === "1099" && emp.work_state === "CA") return "CA 1099 contractor — AB5 review recommended";
  const title = (emp.job_title ?? "").toLowerCase();
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

/** The tier the census states, or else the one the dependents named in conversation imply. */
export function coverageTier(emp: CensusEmployee): string {
  if (emp.coverage_tier) return COVERAGE_TIER_LABELS[emp.coverage_tier];
  const dependents = emp.dependents ?? [];
  const hasSpouse = dependents.some((d) => d.relationship === "spouse" || d.relationship === "domestic_partner");
  const hasChild = dependents.some((d) => d.relationship === "child");
  if (hasSpouse && hasChild) return "Employee + Family";
  if (hasSpouse) return "Employee + Spouse";
  if (hasChild) return "Employee + Child(ren)";
  return "Employee Only";
}

const TIERS = ["Employee Only", "Employee + Spouse", "Employee + Child(ren)", "Employee + Family"];
const WAIVED = COVERAGE_TIER_LABELS.WAIVE;

export const NOT_PROVIDED = "Not provided";

const orNotProvided = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? NOT_PROVIDED : String(v);

const yesNo = (v: boolean | null) => (v === null ? NOT_PROVIDED : v ? "Yes" : "No");

export interface ManuscriptCensusRow {
  name: string;
  /** Date of birth, or "Age N" when the census gave only an age. */
  dob: string;
  state: string;
  title: string;
  salary: string;
  /** "W-2" or "1099", with "PT" for part time. */
  classification: string;
  tier: string;
  flag: string | null;
}

const classificationLabel = (e: CensusEmployee) =>
  `${e.classification === "1099" ? "1099" : "W-2"}${e.employment_type === "part_time" ? " PT" : ""}`;

const salaryLabel = (e: CensusEmployee) =>
  e.annual_salary ? `$${e.annual_salary.toLocaleString()}${e.compensation_type === "hourly" ? " (hourly)" : ""}` : NOT_PROVIDED;

/** Label, display value, and the field whose status and source the row shows. */
export type ManuscriptRow = [label: string, value: string, field?: FieldKey];

export interface Manuscript {
  fileId: string;
  date: string;
  companyName: string;
  submittedTo: string | null;
  companyRows: ManuscriptRow[];
  workforceRows: ManuscriptRow[];
  states: { state: string; count: string; system: string }[];
  census: ManuscriptCensusRow[];
  dependentTiers: { tier: string; count: number; pct: string }[];
  totalDependents: number;
  benefitsRows: ManuscriptRow[];
  resolved: string[];
  open: string[];
  /** Status and source of each field, as shown beside its row. */
  provenance: ProvenanceMap;
  signer: ManuscriptSigner | null;
  /** Present on a packet an advisor generated: its version and the corrections it applies. */
  advisorReview: ManuscriptAdvisorReview | null;
}

export interface ManuscriptAdvisorReview {
  version: number;
  corrections: { label: string; prospectValue: string; advisorValue: string; reason: string }[];
}

export interface ManuscriptSigner {
  name: string;
  title: string;
  /** Date only. */
  signedAt: string;
  /** Date and time with zone, as recorded for the certification. */
  signedAtFull: string;
  consent: string;
}

export function buildManuscript(
  data: ChamberData,
  opts: {
    fileId: string;
    submission?: ChamberSubmission | null;
    date?: Date;
    provenance?: ProvenanceMap;
    /** For an advisor-generated packet; `followUps` are added to the open items. */
    advisor?: ManuscriptAdvisorReview & { followUps: string[] };
  },
): Manuscript {
  const date = opts.date ?? (opts.submission ? new Date(opts.submission.signed_at) : new Date());
  const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const fmtDateTime = (d: Date) =>
    d.toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  const w2 = data.census.filter(isW2);
  const contractors = data.census.filter((e) => !isW2(e));

  const stateCounts = new Map<string, number>();
  for (const emp of data.census) {
    if (emp.work_state) stateCounts.set(emp.work_state, (stateCounts.get(emp.work_state) ?? 0) + 1);
  }
  const allStates = [...new Set([...data.states, ...stateCounts.keys()])];

  const tierCounts = new Map<string, number>([...TIERS, WAIVED].map((t) => [t, 0]));
  for (const emp of w2) tierCounts.set(coverageTier(emp), (tierCounts.get(coverageTier(emp)) ?? 0) + 1);
  // Waived appears only when the census records someone waiving coverage.
  const tiers = tierCounts.get(WAIVED) ? [...TIERS, WAIVED] : TIERS;

  const checks = eligibilityChecks(data);
  const missingCore = [
    ["Company legal name", !data.company_name],
    ["States of operation", allStates.length === 0],
    ["Pay frequency", !data.pay_frequency],
    ["Employee census", data.census.length === 0],
  ].flatMap(([label, missing]) => (missing ? [`${label} — not provided`] : []));
  const provenance = opts.provenance ?? {};
  const fieldItems = fieldOpenItems(provenance).map((i) => `${i.label} — ${i.reason.toLowerCase()}`);
  const flags = data.census.flatMap((e) => {
    const flag = employeeFlag(e);
    return flag ? [`${e.first_name} ${e.last_name}: ${flag}`] : [];
  });

  return {
    fileId: opts.fileId,
    date: fmtDate(date),
    companyName: data.company_name ?? "[Company name not provided]",
    submittedTo: opts.submission?.peo ?? null,
    companyRows: [
      ["Legal Name", orNotProvided(data.company_name), "company_name"],
      ["HQ State", orNotProvided(data.hq_state), "hq_state"],
      ["Industry", orNotProvided(data.industry), "industry"],
      ["Entity Structure", data.multiple_entities === null ? NOT_PROVIDED : data.multiple_entities ? `Multiple (${orNotProvided(data.fein_count)} FEINs)` : "Single entity", "multiple_entities"],
      ["Target Start", orNotProvided(data.start_month), "start_month"],
      ["Current Payroll", orNotProvided(data.payroll_vendor), "payroll_vendor"],
      ["Pay Frequency", orNotProvided(data.pay_frequency), "pay_frequency"],
      ["Coverage Status", data.virgin_medical === null ? NOT_PROVIDED : data.virgin_medical ? "First-time — no prior employer health benefits" : "Switching existing coverage", "virgin_medical"],
    ],
    workforceRows: [
      ["Reported Headcount", orNotProvided(data.employee_count), "employee_count"],
      ["W-2 Employees on Census", String(w2.length)],
      ["1099 Contractors on Census", data.census.length ? String(contractors.length) : yesNo(data.has_1099)],
      ["Exempt / Nonexempt", data.exempt_count === null && data.nonexempt_count === null ? NOT_PROVIDED : `${orNotProvided(data.exempt_count)} / ${orNotProvided(data.nonexempt_count)}`],
      ["In-house HR Staff", orNotProvided(data.hr_staff_count), "hr_staff_count"],
      ["Employee Handbook", yesNo(data.has_handbook), "has_handbook"],
    ],
    states: allStates.map((s) => ({ state: s, count: stateCounts.has(s) ? String(stateCounts.get(s)) : NOT_PROVIDED, system: wcSystem(s) })),
    census: data.census.map((e) => ({
      name: `${e.first_name} ${e.last_name}`.trim(),
      dob: e.dob || (e.age !== undefined ? `Age ${e.age}` : NOT_PROVIDED),
      state: e.work_state || NOT_PROVIDED,
      title: e.job_title || NOT_PROVIDED,
      salary: salaryLabel(e),
      classification: classificationLabel(e),
      tier: isW2(e) ? coverageTier(e) : "Not applicable",
      flag: employeeFlag(e),
    })),
    dependentTiers: tiers.map((tier) => {
      const count = tierCounts.get(tier) ?? 0;
      return { tier, count, pct: w2.length ? `${Math.round((count / w2.length) * 100)}%` : NOT_PROVIDED };
    }),
    totalDependents: w2.reduce((sum, e) => sum + (e.dependents?.length ?? 0), 0),
    benefitsRows: [
      ["Current Carrier", orNotProvided(data.current_carrier), "current_carrier"],
      ["Renewal Date", orNotProvided(data.renewal_date), "renewal_date"],
      ["Rate History", orNotProvided(data.rate_history), "rate_history"],
      ["Waiting Period", orNotProvided(data.benefits_waiting_period), "benefits_waiting_period"],
      ["Ancillary Benefits", data.ancillary_benefits.length ? data.ancillary_benefits.join(", ") : NOT_PROVIDED, "ancillary_benefits"],
      ["Retirement", data.has_401k === null ? NOT_PROVIDED : data.has_401k ? `${data.retirement_type || "401(k)"}${data.employer_contributes ? " · employer contributes" : ""}` : "None", "has_401k"],
    ],
    resolved: checks.filter((c) => c.status === "pass").map((c) => c.label),
    open: [
      ...missingCore,
      ...fieldItems,
      ...checks.filter((c) => c.status === "fail").map((c) => `${c.label} — not met`),
      ...checks.filter((c) => c.status === "unknown").map((c) => `${c.label} — not yet verified`),
      ...flags,
      ...(opts.advisor?.followUps ?? []),
    ],
    provenance,
    signer: opts.submission
      ? {
          name: opts.submission.signer_name,
          title: opts.submission.signer_title,
          signedAt: fmtDate(new Date(opts.submission.signed_at)),
          signedAtFull: fmtDateTime(new Date(opts.submission.signed_at)),
          consent:
            (Array.isArray(opts.submission.consent_text)
              ? opts.submission.consent_text.join("\n")
              : opts.submission.consent_text) || LEGACY_CONSENT_TEXT,
        }
      : null,
    advisorReview: opts.advisor ? { version: opts.advisor.version, corrections: opts.advisor.corrections } : null,
  };
}
