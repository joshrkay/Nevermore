import type { ChamberData } from "./chamberTypes";
import { classificationLabel, COVERAGE_TIER_LABELS, isAssumed, isW2, type CensusEmployee } from "./census";
import { headcount } from "./headcount";
import { findPeo, peoFit, type PeoRecord } from "./peoCatalog";
import { verificationSettles, type FieldKey, type FieldProvenance, type ProvenanceMap } from "./provenance";
import { isRequiredField } from "./readiness";
import { NO_VERIFIED_FIELDS } from "./requiredItems";
import { describeOpenItem, openItems } from "./openItems";

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
  // Stamped by the database at certification: the conversation and the document list as certified,
  // which advisors review. Absent on submissions certified before they were kept.
  transcript?: unknown;
  documents?: unknown;
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

/**
 * The intake's File ID, from its id and when it started. The year is the start's, in UTC, exactly as
 * the database builds it when a certification carries none, so one intake has one File ID for good:
 * never today's year, and never the browser's time zone.
 */
export function fileIdForSession(sessionId: string, startedAt: Date): string {
  return `EAA-${startedAt.getUTCFullYear()}-${sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
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

/**
 * The tier the census states, or else the one the dependents named in conversation imply, or null when
 * neither says. No dependents named is not the same as none: nobody may have asked.
 */
export function coverageTier(emp: CensusEmployee): string | null {
  if (emp.coverage_tier) return COVERAGE_TIER_LABELS[emp.coverage_tier];
  const dependents = emp.dependents ?? [];
  const hasSpouse = dependents.some((d) => d.relationship === "spouse" || d.relationship === "domestic_partner");
  const hasChild = dependents.some((d) => d.relationship === "child");
  if (hasSpouse && hasChild) return "Employee + Family";
  if (hasSpouse) return "Employee + Spouse";
  if (hasChild) return "Employee + Child(ren)";
  return null;
}

/**
 * How many dependents a person has, when that is known: the ones named in conversation, or none for a
 * stated Employee Only or Waived tier. Null otherwise (a family tier from a census names nobody).
 */
function knownDependents(emp: CensusEmployee): number | null {
  const named = emp.dependents?.length ?? 0;
  if (named > 0) return named;
  return emp.coverage_tier === "EE" || emp.coverage_tier === "WAIVE" ? 0 : null;
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
  /** "W-2" or "1099", with "PT" for part time; "Not provided" when the census didn't say. */
  classification: string;
  tier: string;
  flag: string | null;
}

// Part time is never a default, so "PT" is always an answer; full time can be, and so isn't printed.
const typeLabel = (e: CensusEmployee) => `${classificationLabel(e)}${e.employment_type === "part_time" ? " PT" : ""}`;

const salaryLabel = (e: CensusEmployee) =>
  e.annual_salary
    ? `$${e.annual_salary.toLocaleString()}${e.compensation_type === "hourly" ? (isAssumed(e, "annual_salary") ? " (hourly, est.)" : " (hourly)") : ""}`
    : NOT_PROVIDED;

/** Which timekeeping methods were named: the ones in use, "None" when all three were ruled out. */
function timekeeping(data: ChamberData): string {
  const methods: [string, boolean | null][] = [
    ["Computer", data.uses_computer_timekeeping],
    ["Mobile app", data.uses_mobile_app],
    ["Physical time clock", data.uses_physical_clocks],
  ];
  const used = methods.filter(([, v]) => v === true).map(([name]) => name);
  if (used.length > 0) return used.join(", ");
  return methods.every(([, v]) => v === false) ? "None of computer, mobile app or time clock" : NOT_PROVIDED;
}

const counted = (n: number, of: number, what: string) => `${n} of ${of} ${what}`;

/**
 * Label, display value, the field whose status and source the row shows, and any other fields the value
 * is built from (a conflict in one of those shows too).
 */
export type ManuscriptRow = [label: string, value: string, field?: FieldKey, alsoFrom?: readonly FieldKey[]];

/**
 * The provenance the Manuscript shows: an answer an advisor verified that still needed the prospect reads as
 * confirmed with no rival answers, rather than keeping a "Conflicting" chip or an "unresolved" marker that
 * points to an open item the list no longer has (`verificationSettles` says which). A required answer in
 * conflict stays one, as in Review, and unknown or not applicable fields keep their status; the advisor's own
 * packet (`applyAdvisorReview`) settles every status.
 */
function settleVerified(provenance: ProvenanceMap, verified: ReadonlySet<string>): ProvenanceMap {
  if (verified.size === 0) return provenance;
  const shown: ProvenanceMap = { ...provenance };
  for (const field of Object.keys(shown) as (keyof ProvenanceMap)[]) {
    const entry = shown[field];
    if (entry && verified.has(field) && verificationSettles(entry.status, isRequiredField(field))) shown[field] = { ...entry, status: "confirmed", candidates: undefined };
  }
  return shown;
}

/**
 * The status and source a row shows: those of the first of its fields whose answers conflict, so no
 * conflict in any part of the value is hidden, or else its own field's. The web Manuscript's chip and
 * the PDF's "unresolved" marker both read it.
 */
export function rowProvenance([, , field, alsoFrom = []]: ManuscriptRow, provenance: ProvenanceMap): FieldProvenance | undefined {
  const fields = field ? [field, ...alsoFrom] : alsoFrom;
  return fields.map((f) => provenance[f]).find((p) => p?.status === "conflicting") ?? (field ? provenance[field] : undefined);
}

export interface Manuscript {
  fileId: string;
  date: string;
  companyName: string;
  submittedTo: string | null;
  companyRows: ManuscriptRow[];
  payrollRows: ManuscriptRow[];
  workforceRows: ManuscriptRow[];
  states: { state: string; count: string; system: string }[];
  census: ManuscriptCensusRow[];
  dependentTiers: { tier: string; count: number; pct: string }[];
  /** The dependents known of, with how many people that leaves out; "Not provided" when nothing is known. */
  totalDependents: string;
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
    /** Fields an advisor verified: settled whatever their status, so never an open item. */
    verified?: ReadonlySet<string>;
    /** For an advisor-generated packet; `followUps` are added to the open items. */
    advisor?: ManuscriptAdvisorReview & { followUps: string[] };
  },
): Manuscript {
  const date = opts.date ?? (opts.submission ? new Date(opts.submission.signed_at) : new Date());
  const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const fmtDateTime = (d: Date) =>
    d.toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  // Everyone but a stated 1099 contractor is counted for coverage; whose classification is only the
  // default is reported as not provided rather than as W-2.
  const w2 = data.census.filter(isW2);
  const statedW2 = w2.filter((e) => !isAssumed(e, "classification"));
  const contractors = data.census.filter((e) => !isW2(e));
  const unstated = (fact: string) => data.census.filter((e) => isAssumed(e, fact)).length;
  const unknownTier = w2.filter((e) => coverageTier(e) === null).length;
  const knownCounts = w2.map(knownDependents);
  const listedDependents = knownCounts.reduce<number>((sum, n) => sum + (n ?? 0), 0);
  const dependentsUnknown = knownCounts.filter((n) => n === null).length;

  const stateCounts = new Map<string, number>();
  for (const emp of data.census) {
    if (emp.work_state) stateCounts.set(emp.work_state, (stateCounts.get(emp.work_state) ?? 0) + 1);
  }
  const allStates = [...new Set([...data.states, ...stateCounts.keys()])];

  const tierCounts = new Map<string, number>([...TIERS, WAIVED, NOT_PROVIDED].map((t) => [t, 0]));
  for (const emp of w2) {
    const tier = coverageTier(emp) ?? NOT_PROVIDED;
    tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1);
  }
  // Waived appears only when the census records someone waiving coverage, and Not provided only when
  // someone's tier is unknown.
  const tiers = [...TIERS, ...(tierCounts.get(WAIVED) ? [WAIVED] : []), ...(tierCounts.get(NOT_PROVIDED) ? [NOT_PROVIDED] : [])];

  // Answers the census only defaulted, said plainly (US-1.4: nothing silently made up).
  const census = data.census.length;
  const unstatedItems = [
    [unstated("classification"), "Worker classification (W-2 or 1099)"],
    [unstated("employment_type"), "Full- or part-time status"],
  ].flatMap(([n, label]) => ((n as number) > 0 ? [`${label} — not provided for ${counted(n as number, census, "people on the census")}`] : []));
  const estimatedPay = unstated("annual_salary");
  if (estimatedPay > 0) unstatedItems.push(`Annual pay — estimated at full-time hours for ${counted(estimatedPay, census, "people on the census")}; confirm their hours`);
  if (unknownTier > 0) unstatedItems.push(`Coverage tier — not provided for ${counted(unknownTier, w2.length, "employees")}`);

  const checks = eligibilityChecks(data);
  // The intake's open items, the one list Review and the advisor queue use too (src/data/openItems.ts): the answers
  // certification requires (always present on a certified packet), the census, then fields by status, less any an
  // advisor verified.
  const provenance = opts.provenance ?? {};
  const verified = opts.verified ?? NO_VERIFIED_FIELDS;
  const intakeItems = openItems(data, provenance, verified).map(describeOpenItem);
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
      ["Entity Structure", data.multiple_entities === null ? NOT_PROVIDED : data.multiple_entities ? `Multiple (${orNotProvided(data.fein_count)} FEINs)` : "Single entity", "multiple_entities", data.multiple_entities ? ["fein_count"] : []],
      ["Target Start", orNotProvided(data.start_month), "start_month"],
      ["Coverage Status", data.virgin_medical === null ? NOT_PROVIDED : data.virgin_medical ? "First-time — no prior employer health benefits" : "Switching existing coverage", "virgin_medical"],
    ],
    payrollRows: [
      ["Current Payroll", orNotProvided(data.payroll_vendor), "payroll_vendor"],
      ["Pay Frequency", orNotProvided(data.pay_frequency), "pay_frequency"],
      ["Funding Lead Time", data.funding_days === null ? NOT_PROVIDED : `${data.funding_days} day${data.funding_days === 1 ? "" : "s"}`, "funding_days"],
      ["Accrual Method", orNotProvided(data.accrual_method), "accrual_method"],
      ["PTO Types", data.pto_types.length ? data.pto_types.join(", ") : NOT_PROVIDED, "pto_types"],
      ["Timekeeping", timekeeping(data)],
      ["Shift Differentials", yesNo(data.shift_differentials), "shift_differentials"],
      ["HRIS", orNotProvided(data.hris_system), "hris_system"],
    ],
    workforceRows: [
      ["Reported Headcount", orNotProvided(data.employee_count), "employee_count"],
      ["W-2 Employees on Census", String(statedW2.length), undefined, ["census"]],
      ["1099 Contractors on Census", data.census.length ? String(contractors.length) : yesNo(data.has_1099), undefined, [data.census.length ? "census" : "has_1099"]],
      ...(unstated("classification") > 0 ? ([["Classification Not Provided", String(unstated("classification")), undefined, ["census"]]] as ManuscriptRow[]) : []),
      ["Exempt / Nonexempt", data.exempt_count === null && data.nonexempt_count === null ? NOT_PROVIDED : `${orNotProvided(data.exempt_count)} / ${orNotProvided(data.nonexempt_count)}`, undefined, ["exempt_count", "nonexempt_count"]],
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
      classification: typeLabel(e),
      tier: isW2(e) ? coverageTier(e) ?? NOT_PROVIDED : "Not applicable",
      flag: employeeFlag(e),
    })),
    dependentTiers: tiers.map((tier) => {
      const count = tierCounts.get(tier) ?? 0;
      return { tier, count, pct: w2.length ? `${Math.round((count / w2.length) * 100)}%` : NOT_PROVIDED };
    }),
    totalDependents:
      w2.length === 0 || dependentsUnknown === w2.length
        ? NOT_PROVIDED
        : dependentsUnknown > 0
          ? `${listedDependents} (not known for ${dependentsUnknown} of ${w2.length})`
          : String(listedDependents),
    benefitsRows: [
      ["Current Carrier", orNotProvided(data.current_carrier), "current_carrier"],
      ["Renewal Date", orNotProvided(data.renewal_date), "renewal_date"],
      ["Rate History", orNotProvided(data.rate_history), "rate_history"],
      ["Waiting Period", orNotProvided(data.benefits_waiting_period), "benefits_waiting_period"],
      ["Ancillary Benefits", data.ancillary_benefits.length ? data.ancillary_benefits.join(", ") : NOT_PROVIDED, "ancillary_benefits"],
      ["Retirement", data.has_401k === null ? NOT_PROVIDED : data.has_401k ? `${data.retirement_type || "401(k)"}${data.employer_contributes ? " · employer contributes" : ""}` : "None", "has_401k", data.has_401k ? ["retirement_type", "employer_contributes"] : []],
    ],
    resolved: checks.filter((c) => c.status === "pass").map((c) => c.label),
    open: [
      ...intakeItems,
      ...unstatedItems,
      ...checks.filter((c) => c.status === "fail").map((c) => `${c.label} — not met`),
      ...checks.filter((c) => c.status === "unknown").map((c) => `${c.label} — not yet verified`),
      ...flags,
      ...(opts.advisor?.followUps ?? []),
    ],
    provenance: settleVerified(provenance, verified),
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
