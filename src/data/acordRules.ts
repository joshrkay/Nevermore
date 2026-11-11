// What the intake already knows about the ACORD 130 questions (K-3.4), so the prospect is asked only what it
// can't work out: which questions don't apply to this employer, and which are answered by the census or an
// earlier answer. src/data/provenance.ts applies both whenever an answer changes.
import { ageOn } from "./census";
import type { ChamberData } from "./chamberTypes";
import type { FieldKey } from "./provenance";

/**
 * Workers' comp class codes for office work: clerical (8810), outside sales (8742), clerical telecommuters (8871),
 * attorneys (8820) and auditors and accountants (8803). From general knowledge of NCCI's codes, not from a
 * published list: the advisory lead should check it before it is relied on.
 */
export const OFFICE_CLASS_CODES: ReadonlySet<string> = new Set(["8810", "8742", "8871", "8820", "8803"]);

/** NAICS sectors that are office work when the census has no class codes: information, finance, professional services, management. */
const OFFICE_NAICS_SECTORS: ReadonlySet<string> = new Set(["51", "52", "54", "55"]);

/**
 * Whether the employer does office work only: every class code on the census is an office code, or, when the
 * census has no class codes at all, its industry is an office one. One person with another code, or with none
 * while others have one, means it isn't.
 */
export function isOfficeOnly(data: Pick<ChamberData, "census" | "naics_code">): boolean {
  if (data.census.some((e) => e.class_code !== undefined)) return data.census.every((e) => e.class_code !== undefined && OFFICE_CLASS_CODES.has(e.class_code));
  return data.naics_code !== null && OFFICE_NAICS_SECTORS.has(data.naics_code.slice(0, 2));
}

const hasAnyAnswer = (data: ChamberData): boolean =>
  Object.values(data).some((v) => !(v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)));

/**
 * Questions marked "Doesn't apply" when something about the employer becomes true, and opened again when it
 * stops being true. Each is closed once, at that moment, and only while unanswered and untouched: a question the
 * prospect reopens stays open.
 */
export const ACORD_CLOSING_RULES: readonly { when: (data: ChamberData) => boolean; closes: readonly FieldKey[] }[] = [
  // No. 1 to 4 (aircraft or watercraft, hazardous material, work underground or at height, work on or over
  // water) for an employer that does office work only.
  { when: isOfficeOnly, closes: ["wcq_01", "wcq_02", "wcq_03", "wcq_04"] },
  // No. 17, "any other insurance with this insurer": the intake is PEO-neutral, so there is no insurer yet.
  { when: hasAnyAnswer, closes: ["wcq_17"] },
  // No. 18: the form tells Missouri applicants not to answer it.
  { when: (data) => data.hq_state === "MO", closes: ["wcq_18"] },
];

/** Every census row answers `fact` and none says yes: false. Any says yes: true. Otherwise the census can't say. */
function censusSays(data: ChamberData, fact: "remote" | "travels"): boolean | undefined {
  if (data.census.some((e) => e[fact] === true)) return true;
  return data.census.length > 0 && data.census.every((e) => e[fact] === false) ? false : undefined;
}

/**
 * Questions the intake can answer from what it already holds, for the prospect to confirm rather than be asked
 * again: the answer, the explanation the form asks for with a yes, and the field it was worked out from.
 */
export const ACORD_DERIVED: readonly {
  field: FieldKey;
  explain?: FieldKey;
  from: FieldKey;
  answer: (data: ChamberData, now: Date) => { value: boolean; explain?: string } | undefined;
}[] = [
  {
    // No. 10: any employees under 16 or over 60, from the census's dates of birth and ages.
    field: "wcq_10", from: "census",
    answer: (data, now) => {
      const ages = data.census.map((e) => (e.dob ? ageOn(e.dob, now) : e.age));
      if (ages.some((age) => age !== undefined && (age < 16 || age > 60))) return { value: true };
      return ages.length > 0 && ages.every((age) => age !== undefined) ? { value: false } : undefined;
    },
  },
  {
    // No. 14: do employees travel out of state, from the census's travels column.
    field: "wcq_14", from: "census",
    answer: (data) => {
      const travels = censusSays(data, "travels");
      return travels === undefined ? undefined : { value: travels };
    },
  },
  {
    // No. 19: are employee health plans provided, from the medical coverage answers.
    field: "wcq_19", from: "virgin_medical",
    answer: (data) => (data.medical_plans.length > 0 || data.virgin_medical === false ? { value: true } : data.virgin_medical === true ? { value: false } : undefined),
  },
  {
    // No. 21: are employees leased to or from other employers, from whether the employer is in a PEO now.
    field: "wcq_21", from: "in_peo",
    answer: (data) => (data.in_peo === null ? undefined : { value: data.in_peo }),
  },
  {
    // No. 22: do any employees predominantly work at home, and how many, from the census's remote column.
    field: "wcq_22", explain: "wcq_22_explain", from: "census",
    answer: (data) => {
      const remote = censusSays(data, "remote");
      if (remote === undefined) return undefined;
      const count = data.census.filter((e) => e.remote === true).length;
      return remote ? { value: true, explain: `${count} ${count === 1 ? "employee" : "employees"}` } : { value: false };
    },
  },
];
