import type { ChamberData } from "./chamberTypes";
import { isDraftConsent } from "./certification";
import { classificationLabel, COVERAGE_TIER_LABELS, isAssumed, isW2, type CensusEmployee } from "./census";
import { categoryInfo } from "./documentCategories";
import { documentStatusInfo } from "./documentStatus";
import { headcount } from "./headcount";
import { findPeo, peoFit, type PeoRecord } from "./peoCatalog";
import { FIELD_LABELS, verificationSettles, type FieldKey, type FieldProvenance, type ProvenanceMap } from "./provenance";
import { isRequiredField } from "./readiness";
import { NO_VERIFIED_FIELDS } from "./requiredItems";
import { describeOpenItem, openItems } from "./openItems";

/** Signed attestation stored on chamber_sessions.submission. */
export interface ChamberSubmission {
  signer_name: string;
  signer_title: string;
  signed_at: string; // ISO timestamp, as captured in the signer's browser
  /** The File ID. The database assigns it at the first certification and overwrites whatever the browser sent. */
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
  /** Which certification of the intake this is (1, 2, ...). Stamped by the database; absent on older submissions. */
  version?: number;
  /** The intake's data_version the certification landed at. Stamped by the database; absent on older submissions. */
  data_version?: number;
  schema_version?: number;
  // Copy of the data as signed, so later edits to the session can't change
  // what the certified manuscript shows. Absent on older submissions.
  chamber_data?: unknown;
  // Field status and source as signed. Absent on older submissions.
  field_provenance?: unknown;
  // Stamped by the database at certification (snapshot_certified_evidence): the conversation and the document
  // list as certified, which advisors review. Absent on submissions certified before they were kept.
  transcript?: unknown;
  documents?: SubmittedDocument[];
}

/**
 * What The Reckoning sends to certify: the signature, the consent and the PEO. No File ID: the database assigns it
 * from its per-year sequence at the first certification and stamps it, with the version and hash, onto what it
 * stores (C-3.1, D15).
 */
export type CertificationRequest = Omit<ChamberSubmission, "file_id">;

/** A document as it stood at certification (snapshot_certified_evidence stamps these into the submission). */
export interface SubmittedDocument {
  id: string;
  file_name: string;
  category: string;
  status: string;
  file_size?: string;
  storage_path?: string;
  file_sha256?: string | null;
  created_at?: string;
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

/** Shown for submissions certified before the consent wording was stored. */
export const LEGACY_CONSENT_TEXT =
  "I confirm the information in this submission is accurate and complete to the best of my knowledge.";

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

/**
 * The File ID (reference) the database assigns at certification: EAA-<year>-<number> (decision D15). Older
 * intakes carry EAA-<year>-<8 hex>, which this accepts too.
 */
export const isFileId = (value: unknown): value is string => typeof value === "string" && /^EAA-\d{4}-[0-9A-Z]{4,12}$/.test(value);

/** Where a Manuscript is opened: by its File ID once the intake has one, otherwise by the intake. */
export const manuscriptPath = (fileId: string | null, sessionId: string | null): string =>
  fileId ? `/manuscript/${encodeURIComponent(fileId)}` : sessionId ? `/manuscript?session=${sessionId}` : "/manuscript";

/** A date as YYYYMMDD in UTC, for a file name. */
const compactDate = (date: Date | string): string | null => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10).replace(/-/g, "");
};

/**
 * The Manuscript's file name, the same for the same submission wherever it is generated:
 * `The_Manuscript_<File ID>_v<version>_<company>_<certified YYYYMMDD>.pdf`, safe on every OS and browser.
 * A packet that isn't certified has no version or date. `suffix` tells an advisor's version apart.
 */
export function manuscriptFilename(
  fileId: string,
  companyName: string | null,
  opts: { version?: number | null; date?: Date | string | null; suffix?: string } = {},
): string {
  const slug = foldLatin(companyName ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/, "");
  const parts = [
    "The_Manuscript",
    fileId,
    ...(opts.version ? [`v${opts.version}`] : []),
    slug || "Company",
    ...(opts.date ? [compactDate(opts.date)].filter(Boolean) : []),
    ...(opts.suffix ? [opts.suffix.replace(/[^A-Za-z0-9-]+/g, "_")] : []),
  ];
  return `${parts.join("_")}.pdf`;
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
/** Shown for an answer the prospect marked as not applying to them. */
export const NOT_APPLICABLE = "Not applicable";
/** The date line of a packet that was never certified. */
export const NOT_CERTIFIED = "Not certified";

const orNotProvided = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? NOT_PROVIDED : String(v);

const yesNo = (v: boolean | null) => (v === null ? NOT_PROVIDED : v ? "Yes" : "No");

const dollars = (v: number | null) => (v === null ? NOT_PROVIDED : `$${v.toLocaleString("en-US")}`);

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
  classCode: string;
  flag: string | null;
}

// Part time is never a default, so "PT" is always an answer; full time can be, and so isn't printed.
const typeLabel = (e: CensusEmployee) => `${classificationLabel(e)}${e.employment_type === "part_time" ? " PT" : ""}`;

const salaryLabel = (e: CensusEmployee) =>
  e.annual_salary
    ? `$${e.annual_salary.toLocaleString("en-US")}${e.compensation_type === "hourly" ? (isAssumed(e, "annual_salary") ? " (hourly, est.)" : " (hourly)") : ""}`
    : NOT_PROVIDED;

/** The workers' comp class codes the census carries, with how many people hold each. */
function classCodes(census: CensusEmployee[]): string {
  const counts = new Map<string, number>();
  for (const e of census) if (e.class_code) counts.set(e.class_code, (counts.get(e.class_code) ?? 0) + 1);
  if (counts.size === 0) return NOT_PROVIDED;
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([code, n]) => `${code} (${n})`).join(", ");
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

export interface ManuscriptDocument {
  name: string;
  category: string;
  status: string;
}

export interface Manuscript {
  fileId: string;
  /** Which certification of the intake this packet is (1, 2, ...); null for a packet that isn't certified. */
  version: number | null;
  /** The intake's data version the certification covered; null when the submission predates it. */
  dataVersion: number | null;
  /** When it was certified (ISO), null when it isn't. */
  certifiedAt: string | null;
  /** The certification date for the page, or "Not certified". */
  date: string;
  companyName: string;
  submittedTo: string | null;
  companyRows: ManuscriptRow[];
  workforceRows: ManuscriptRow[];
  locationRows: ManuscriptRow[];
  states: { state: string; count: string; system: string }[];
  census: ManuscriptCensusRow[];
  dependentTiers: { tier: string; count: number; pct: string }[];
  /** The dependents known of, with how many people that leaves out; "Not provided" when nothing is known. */
  totalDependents: string;
  payrollRows: ManuscriptRow[];
  benefitsRows: ManuscriptRow[];
  workersCompRows: ManuscriptRow[];
  operationsRows: ManuscriptRow[];
  /** The documents uploaded, as they stood at certification; null when the submission predates the record. */
  documents: ManuscriptDocument[] | null;
  /** Facts the prospect confirmed (the only "resolved" items), in business language. */
  resolved: string[];
  /** The eligibility checks, each passing, failing or not yet verifiable. */
  checks: EligibilityCheck[];
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
  /** The version of the consent wording signed; null when the certification predates storing it. */
  consentVersion: string | null;
  /** Whether that wording is a draft counsel hasn't approved (C-2.4, D3): the page and the PDF mark it. */
  consentDraft: boolean;
}

/**
 * Builds The Manuscript from an intake's answers. Pure: the same answers, submission and options give the
 * same packet, whenever it is built. The date is the certification's (`certified_at`, else `signed_at`),
 * or `opts.date` for a packet that isn't certified (the sample); nothing is read from the clock.
 */
export function buildManuscript(
  data: ChamberData,
  opts: {
    fileId: string;
    submission?: ChamberSubmission | null;
    date?: Date;
    provenance?: ProvenanceMap;
    /** Fields an advisor verified: settled (`verificationSettles`), so not an open item. */
    verified?: ReadonlySet<string>;
    /** For an advisor-generated packet; `followUps` are added to the open items. */
    advisor?: ManuscriptAdvisorReview & { followUps: string[] };
    /** The PEO the checks are run against (the chosen one, when it is in the catalog). */
    peo?: PeoRecord;
  },
): Manuscript {
  const certifiedAt = opts.submission ? (opts.submission.certified_at ?? opts.submission.signed_at) : null;
  const date = opts.date ?? (certifiedAt ? new Date(certifiedAt) : null);
  const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const fmtDateTime = (d: Date) =>
    d.toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const provenance = opts.provenance ?? {};
  const verified = opts.verified ?? NO_VERIFIED_FIELDS;
  // An answer the prospect marked as not applying shows that, whatever the row would have said.
  // The fields a value is also built from stay with it, so a conflict in one of them still marks the row.
  const finish = (rows: ManuscriptRow[]): ManuscriptRow[] =>
    rows.map(([label, value, field, alsoFrom]) => {
      const shown = field && provenance[field]?.status === "not_applicable" ? NOT_APPLICABLE : value;
      return alsoFrom ? [label, shown, field, alsoFrom] : [label, shown, field];
    });

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

  const checks = eligibilityChecks(data, opts.peo ?? (opts.submission?.peo ? findPeo(opts.submission.peo) ?? undefined : undefined));
  // The intake's open items, the one list Review and the advisor queue use too (src/data/openItems.ts): the answers
  // certification requires (always present on a certified packet), the census, then fields by status, less any an
  // advisor verified.
  const intakeItems = openItems(data, provenance, verified).map(describeOpenItem);
  const flags = data.census.flatMap((e) => {
    const flag = employeeFlag(e);
    return flag ? [`${e.first_name} ${e.last_name}: ${flag}`] : [];
  });

  // Only what the prospect confirmed, or applied from a document, counts as resolved: never a check that
  // merely passed on an unconfirmed answer.
  const resolved = (Object.keys(FIELD_LABELS) as FieldKey[])
    .filter((field) => provenance[field]?.status === "confirmed")
    .map((field) => {
      const source = provenance[field]!.source;
      const from = source.kind === "document" ? ` from ${source.document_name ?? "an uploaded document"}` : " by the prospect";
      return `${FIELD_LABELS[field]} — confirmed${from}`;
    });

  const submittedDocuments = opts.submission?.documents;
  const consentVersion = opts.submission ? opts.submission.consent_version || opts.submission.consent_text_version || null : null;

  return {
    fileId: opts.fileId,
    version: opts.submission?.version ?? null,
    dataVersion: opts.submission?.data_version ?? null,
    certifiedAt,
    date: date ? fmtDate(date) : NOT_CERTIFIED,
    companyName: data.company_name ?? "[Company name not provided]",
    submittedTo: opts.submission?.peo ?? null,
    companyRows: finish([
      ["Legal Name", orNotProvided(data.company_name), "company_name"],
      ["Industry", orNotProvided(data.industry), "industry"],
      ["Entity Structure", data.multiple_entities === null ? NOT_PROVIDED : data.multiple_entities ? "Multiple entities" : "Single entity", "multiple_entities"],
      ["FEINs", orNotProvided(data.fein_count), "fein_count"],
      ["Target Start", orNotProvided(data.start_month), "start_month"],
    ]),
    workforceRows: finish([
      ["Reported Headcount", orNotProvided(data.employee_count), "employee_count"],
      ["W-2 Employees on Census", String(statedW2.length), undefined, ["census"]],
      ["1099 Contractors on Census", data.census.length ? String(contractors.length) : NOT_PROVIDED, undefined, ["census"]],
      ...(unstated("classification") > 0 ? ([["Classification Not Provided", String(unstated("classification")), undefined, ["census"]]] as ManuscriptRow[]) : []),
      ["1099 Contractors Reported", yesNo(data.has_1099), "has_1099"],
      ["California Contractors", yesNo(data.ca_contractors), "ca_contractors"],
      ["Nonexempt Employees", yesNo(data.has_nonexempt), "has_nonexempt"],
      ["Nonexempt Count", orNotProvided(data.nonexempt_count), "nonexempt_count"],
      ["Exempt Count", orNotProvided(data.exempt_count), "exempt_count"],
    ]),
    locationRows: finish([
      ["HQ State", orNotProvided(data.hq_state), "hq_state"],
      ["States of Operation", data.states.length ? data.states.join(", ") : NOT_PROVIDED, "states"],
    ]),
    states: allStates.map((s) => ({ state: s, count: stateCounts.has(s) ? String(stateCounts.get(s)) : NOT_PROVIDED, system: wcSystem(s) })),
    census: data.census.map((e) => ({
      name: `${e.first_name} ${e.last_name}`.trim(),
      dob: e.dob || (e.age !== undefined ? `Age ${e.age}` : NOT_PROVIDED),
      state: e.work_state || NOT_PROVIDED,
      title: e.job_title || NOT_PROVIDED,
      salary: salaryLabel(e),
      classification: typeLabel(e),
      tier: isW2(e) ? coverageTier(e) ?? NOT_PROVIDED : NOT_APPLICABLE,
      classCode: e.class_code || NOT_PROVIDED,
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
    payrollRows: finish([
      ["Current Payroll", orNotProvided(data.payroll_vendor), "payroll_vendor"],
      ["Pay Frequency", orNotProvided(data.pay_frequency), "pay_frequency"],
      ["Funding Lead Time", data.funding_days === null ? NOT_PROVIDED : `${data.funding_days} day${data.funding_days === 1 ? "" : "s"}`, "funding_days"],
      ["Accrual Method", orNotProvided(data.accrual_method), "accrual_method"],
      ["PTO Types", data.pto_types.length ? data.pto_types.join(", ") : NOT_PROVIDED, "pto_types"],
    ]),
    benefitsRows: finish([
      ["Coverage Status", data.virgin_medical === null ? NOT_PROVIDED : data.virgin_medical ? "First-time — no prior employer health benefits" : "Switching existing coverage", "virgin_medical"],
      ["Current Carrier", orNotProvided(data.current_carrier), "current_carrier"],
      ["Renewal Date", orNotProvided(data.renewal_date), "renewal_date"],
      ["Rate History", orNotProvided(data.rate_history), "rate_history"],
      ["Waiting Period", orNotProvided(data.benefits_waiting_period), "benefits_waiting_period"],
      ["Ancillary Benefits", data.ancillary_benefits.length ? data.ancillary_benefits.join(", ") : NOT_PROVIDED, "ancillary_benefits"],
      ["Retirement Plan", yesNo(data.has_401k), "has_401k"],
      ["Retirement Plan Type", orNotProvided(data.retirement_type), "retirement_type"],
      ["Employer Retirement Contribution", yesNo(data.employer_contributes), "employer_contributes"],
    ]),
    workersCompRows: finish([
      ["Current Carrier", orNotProvided(data.wc_carrier), "wc_carrier"],
      ["Renewal Date", orNotProvided(data.wc_renewal_date), "wc_renewal_date"],
      ["Experience Mod", data.wc_experience_mod === null ? NOT_PROVIDED : data.wc_experience_mod.toFixed(2), "wc_experience_mod"],
      ["Annual Premium", dollars(data.wc_annual_premium), "wc_annual_premium"],
      ["Class Codes on Census", classCodes(data.census)],
    ]),
    operationsRows: finish([
      ["Employee Handbook", yesNo(data.has_handbook), "has_handbook"],
      ["Handbook Last Updated", orNotProvided(data.handbook_last_updated), "handbook_last_updated"],
      ["In-house HR Staff", orNotProvided(data.hr_staff_count), "hr_staff_count"],
      ["Physical Time Clocks", yesNo(data.uses_physical_clocks), "uses_physical_clocks"],
      ["Mobile Timekeeping", yesNo(data.uses_mobile_app), "uses_mobile_app"],
      ["Computer Timekeeping", yesNo(data.uses_computer_timekeeping), "uses_computer_timekeeping"],
      ["Shift Differentials", yesNo(data.shift_differentials), "shift_differentials"],
      ["HRIS", orNotProvided(data.hris_system), "hris_system"],
      ["Key Challenges", orNotProvided(data.key_challenges), "key_challenges"],
      ["Business Goals", orNotProvided(data.business_goals), "business_goals"],
    ]),
    documents: submittedDocuments
      ? submittedDocuments.map((d) => ({ name: d.file_name, category: categoryInfo(d.category).label, status: documentStatusInfo(d.status).label }))
      : null,
    resolved,
    checks,
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
          consentVersion,
          consentDraft: isDraftConsent(consentVersion),
        }
      : null,
    advisorReview: opts.advisor ? { version: opts.advisor.version, corrections: opts.advisor.corrections } : null,
  };
}
