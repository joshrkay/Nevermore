// The workers' comp application data (L-3.2): our own summary of the last certified version, laid out in the order of
// the standard workers' compensation application (applicant, locations, owners and officers, the rating table by
// state, prior carriers and loss history, nature of business, general questions). It is not the ACORD form and never
// says or looks as if it were: no form number, logo or wording copied beyond ordinary field names. Whether the real
// form may be reproduced is the owner's to confirm with counsel.
//
// Every entry is an answer the certified version holds, as certified, or a blank that says so: nothing is inferred,
// defaulted or estimated. Most of what the application asks the intake doesn't collect yet, so most of it is blank
// today; the blanks are counted and listed at the start, and beside the download, so the advisor knows before
// sending. The rating table comes from the certified census alone, its pay summed only where the census states it.
// The same for every PEO: no PEO's profile asks anything else of it yet. Rendered by src/lib/workersCompPdf.ts.
import { isAssumed, type CensusEmployee } from "./census";
import type { ChamberData } from "./chamberTypes";
import type { CertifiedIntake } from "./peoCompleteness";
import { formatFieldValue, type FieldKey } from "./provenance";

export const WORKERS_COMP_TITLE = "Workers' compensation application data";

/** What a blank reads as, wherever it is printed. */
export const NOT_IN_CERTIFIED = "Not in the certified answers";

export interface WorkersCompSource {
  /** The last certified version's answers, their field status, and the fields an advisor verified. */
  intake: Pick<CertifiedIntake, "data" | "provenance" | "verified">;
  fileId: string;
  version: number | null;
  /** The prospect has changed answers since certifying: this is still built from the version certified. */
  changedSince: boolean;
}

/** One line of a section: the certified answer in words, or null for a blank, with why when there is more to say. */
export interface WorkersCompEntry {
  label: string;
  value: string | null;
  note?: string;
}

export interface WorkersCompSection {
  title: string;
  entries: WorkersCompEntry[];
}

/** One row of the rating table: the census's people in one state with one class code. */
export interface RatingRow {
  /** Null for people the census gives no class code. */
  classCode: string | null;
  employees: number;
  fullTime: number;
  partTime: number;
  /** People whose full or part time the census doesn't state (a default, not an answer). */
  hoursNotStated: number;
  /** People the census marks 1099. Counted in the row, as the census lists them. */
  contractors: number;
  /** The sum of the annual pay the census states for them; null when it states none. */
  pay: number | null;
  /** How `pay` is made up, in a sentence. */
  basis: string;
}

export interface RatingState {
  /** Null for people the census gives no work state. */
  state: string | null;
  rows: RatingRow[];
}

export interface WorkersCompApplication {
  title: string;
  companyName: string;
  fileId: string;
  version: number | null;
  /** "From certified version 3". */
  fromVersion: string;
  /** "The prospect has changed answers since certifying. These files are from version 3.", or null. */
  changedNotice: string | null;
  /** That this is our own summary, not the form. */
  ourOwn: string;
  /** That the intake doesn't ask most of this yet. */
  intakeGaps: string;
  sections: WorkersCompSection[];
  ratingTable: RatingState[];
  /** Every blank, "Section: Label (why)", in the order printed. */
  blanks: string[];
}

const blank = (label: string, note?: string): WorkersCompEntry => (note ? { label, value: null, note } : { label, value: null });

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

/** A certified answer as an entry: its value in words, marked when it wasn't confirmed or is incomplete; a blank otherwise. */
function answer(intake: WorkersCompSource["intake"], field: FieldKey, label: string, words: (v: NonNullable<unknown>) => string = formatFieldValue): WorkersCompEntry {
  const status = intake.provenance[field]?.status;
  if (status === "not_applicable") return { label, value: "Doesn't apply" };
  if (status === "unknown") return blank(label, "the prospect didn't know");
  if (status === "conflicting") return blank(label, "the answers given conflict");
  const v = intake.data[field] as unknown;
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return blank(label);
  const value = words(v);
  if (status === "inferred" && !intake.verified.has(field)) return { label, value: `${value} (not confirmed by the prospect)` };
  if (status === "incomplete" && !intake.verified.has(field)) return { label, value: `${value} (incomplete)` };
  return { label, value };
}

const byCode = (a: string | null, b: string | null) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b));

/** People, in words: "1 person", "3 people". */
const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

function ratingRow(classCode: string | null, group: readonly CensusEmployee[]): RatingRow {
  const statedPay = group.filter((e) => typeof e.annual_salary === "number" && !isAssumed(e, "annual_salary")).map((e) => e.annual_salary as number);
  const workedOut = group.filter((e) => typeof e.annual_salary === "number" && isAssumed(e, "annual_salary")).length;
  const hoursNotStated = group.filter((e) => isAssumed(e, "employment_type")).length;
  // Only W-2 is ever a default (CENSUS_ASSUMABLE), so a row marked 1099 says so.
  const contractors = group.filter((e) => e.classification === "1099").length;
  const pay = statedPay.length ? Math.round(statedPay.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  const notes: string[] = [];
  if (pay === null) notes.push(`No pay in the census for the ${people(group.length)} here.`);
  else {
    const sum = statedPay.length === 1 ? money(pay) : statedPay.length <= 10 ? `${statedPay.map(money).join(" + ")} = ${money(pay)}` : `The sum of ${statedPay.length} amounts, ${money(pay)}`;
    notes.push(`${sum}, the pay the census states for ${statedPay.length} of ${group.length}.`);
  }
  if (workedOut > 0) notes.push(`${workedOut} ${workedOut === 1 ? "has" : "have"} a year's pay worked out from an hourly rate at full-time hours, which isn't counted.`);
  if (contractors > 0) notes.push(`Includes ${contractors} the census marks 1099.`);
  return {
    classCode,
    employees: group.length,
    fullTime: group.filter((e) => e.employment_type === "full_time" && !isAssumed(e, "employment_type")).length,
    partTime: group.filter((e) => e.employment_type === "part_time" && !isAssumed(e, "employment_type")).length,
    hoursNotStated,
    contractors,
    pay,
    basis: notes.join(" "),
  };
}

/** The certified census by work state, then class code, states alphabetical and the ones it doesn't give last. */
export function ratingTable(census: readonly CensusEmployee[]): RatingState[] {
  const states = new Map<string | null, Map<string | null, CensusEmployee[]>>();
  for (const e of census) {
    const state = e.work_state?.trim() || null;
    const code = e.class_code?.trim() || null;
    const codes = states.get(state) ?? new Map<string | null, CensusEmployee[]>();
    codes.set(code, [...(codes.get(code) ?? []), e]);
    states.set(state, codes);
  }
  return [...states.entries()]
    .sort(([a], [b]) => byCode(a, b))
    .map(([state, codes]) => ({ state, rows: [...codes.entries()].sort(([a], [b]) => byCode(a, b)).map(([code, group]) => ratingRow(code, group)) }));
}

/** "CA: 94107, 94110 · NY: no ZIP given": where the census says people work. */
function censusPlaces(census: readonly CensusEmployee[]): string {
  const places = new Map<string, Set<string>>();
  for (const e of census) {
    const state = e.work_state?.trim() || "No work state given";
    const zips = places.get(state) ?? new Set<string>();
    if (e.zip_code?.trim()) zips.add(e.zip_code.trim());
    places.set(state, zips);
  }
  return [...places.entries()]
    .sort(([a], [b]) => (a === "No work state given" ? 1 : b === "No work state given" ? -1 : a.localeCompare(b)))
    .map(([state, zips]) => `${state}: ${zips.size ? [...zips].sort().join(", ") : "no ZIP given"}`)
    .join(" · ");
}

/** What the census lacks for the rating table, as blanks: never estimated. */
function censusGaps(census: readonly CensusEmployee[]): WorkersCompEntry[] {
  const n = census.length;
  const of = (k: number) => `the census has none for ${k} of ${n}`;
  const noCode = census.filter((e) => !e.class_code?.trim()).length;
  const noPay = census.filter((e) => typeof e.annual_salary !== "number").length;
  const workedOut = census.filter((e) => typeof e.annual_salary === "number" && isAssumed(e, "annual_salary")).length;
  const noState = census.filter((e) => !e.work_state?.trim()).length;
  const out: WorkersCompEntry[] = [];
  if (noCode) out.push(blank("Class code", of(noCode)));
  if (noPay || workedOut) {
    const parts: string[] = [];
    if (noPay) parts.push(of(noPay));
    if (workedOut) parts.push(`${workedOut}${noPay ? "" : ` of ${n}`} ${workedOut === 1 ? "is" : "are"} worked out from an hourly rate`);
    out.push(blank("Annual pay", parts.join(", and ")));
  }
  if (noState) out.push(blank("Work state", of(noState)));
  return out;
}

const GENERAL_TOPICS = [
  "Subcontractors' certificates of insurance",
  "Aircraft or watercraft",
  "Hazardous materials",
  "Work underground or above 15 feet",
  "Group transportation",
  "Employees under 16 or over 60",
  "Seasonal, volunteer or leased workers",
  "Work at home",
  "Travel out of state",
  "Written safety program",
  "Physicals before hiring",
  "Coverage declined, cancelled or not renewed in the past three years",
  "Unpaid workers' comp premium",
  "Other businesses the employer runs",
];

/**
 * The workers' comp application data from the last certified version: each section in the standard application's
 * order, every entry the certified answer or a blank, the rating table from the certified census, and every blank
 * listed. A pure function, so tests read the document without a PDF.
 */
export function workersCompApplication(from: WorkersCompSource): WorkersCompApplication {
  const { intake } = from;
  const d: ChamberData = intake.data;
  const census = d.census ?? [];
  const n = census.length;
  const sections: WorkersCompSection[] = [
    {
      title: "Applicant",
      entries: [
        answer(intake, "company_name", "Legal name"),
        blank("Doing business as (DBA)"),
        blank("FEIN"),
        answer(intake, "fein_count", "Number of FEINs"),
        answer(intake, "multiple_entities", "More than one legal entity"),
        blank("Type of entity"),
        blank("Mailing address"),
        answer(intake, "hq_state", "Headquarters state"),
        blank("Contact name, phone and email"),
        blank("Years in business"),
        blank("Website"),
      ],
    },
    {
      title: "Locations",
      entries: [
        answer(intake, "states", "States of operation"),
        ...(n ? [{ label: "Work states and ZIP codes in the census", value: censusPlaces(census) }] : []),
        blank("Address of each location"),
      ],
    },
    {
      title: "Owners and officers",
      entries: [blank("Names, titles and share owned"), blank("Included in or excluded from coverage")],
    },
    {
      title: "Rating by state",
      entries: [
        answer(intake, "employee_count", "Employees, as answered"),
        ...(n ? [{ label: "Employees in the census", value: String(n) }, ...censusGaps(census)] : [blank("Census")]),
        blank("Description of each class code"),
        blank("Estimated pay for the policy period"),
      ],
    },
    {
      title: "Prior carriers and loss history",
      entries: [
        answer(intake, "wc_carrier", "Current workers' comp carrier"),
        answer(intake, "wc_renewal_date", "Renewal date"),
        answer(intake, "wc_annual_premium", "Annual premium", (v) => (typeof v === "number" ? money(v) : String(v))),
        answer(intake, "wc_experience_mod", "Experience modification"),
        blank("Policy number"),
        blank("Carriers, premiums and modifications in the past five years"),
        blank("Claims in the past five years"),
      ],
    },
    {
      title: "Nature of business",
      entries: [
        answer(intake, "industry", "Industry, as the prospect described it"),
        blank("Description of operations"),
        blank("Industry code (NAICS or SIC)"),
      ],
    },
    {
      title: "General questions",
      entries: [
        answer(intake, "has_1099", "Uses 1099 contractors"),
        answer(intake, "ca_contractors", "Contractors in California"),
        ...GENERAL_TOPICS.map((t) => blank(t)),
      ],
    },
  ];
  const version = from.version;
  return {
    title: WORKERS_COMP_TITLE,
    companyName: d.company_name ?? "Company not provided",
    fileId: from.fileId,
    version,
    fromVersion: version !== null ? `From certified version ${version}` : "From the certification on record",
    changedNotice: from.changedSince ? `The prospect has changed answers since certifying. These files are from version ${version ?? "on record"}.` : null,
    ourOwn: "This is our own summary of the certified answers, laid out in the order of the standard workers' compensation application. It is not the ACORD form, and it is not filled in on it.",
    intakeGaps: "The intake doesn't ask most of what a workers' comp application needs yet, such as owners and officers, addresses and loss history, so much of this is blank. Fill the blanks in with the employer before sending.",
    sections,
    ratingTable: ratingTable(census),
    blanks: sections.flatMap((s) => s.entries.filter((e) => e.value === null).map((e) => `${s.title}: ${e.label}${e.note ? ` (${e.note})` : ""}`)),
  };
}

/** "EAA-2026-0042-workers-comp-application-v3.pdf". */
export const workersCompFilename = (a: Pick<WorkersCompApplication, "fileId" | "version">) =>
  `${a.fileId}-workers-comp-application${a.version !== null ? `-v${a.version}` : ""}.pdf`;
