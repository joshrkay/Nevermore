// Requirement profiles (GLOSSARY.md, docs/adr/0003): what each PEO asks for, as dated, versioned data in the
// database (supabase/migrations/20261111090000_peo_requirement_profiles.sql). Admins write a draft and publish
// it; a published version never changes, and the newest published one is the profile in use. The browser reads
// the PEOs and their profiles in use through public.peo_catalog(), which never includes a PEO contact, and gives
// anyone but an advisor a person at the PEO by their role only.
import type { PeoCensusLayout } from "./censusExport";
import type { DocumentCategory } from "./documentCategories";
import type { PeoRecord } from "./peoCatalog";
import type { FieldKey } from "./provenance";

// The lists and caps below are the database's too (peo_profile_version_error); src/data/schemaSync.test.ts keeps
// them equal.
export const PROFILE_STATUSES = ["draft", "published"] as const;
export const CENSUS_FILE_FORMATS = ["csv", "xlsx"] as const;
export type CensusFileFormat = (typeof CENSUS_FILE_FORMATS)[number];
export const EXTRA_QUESTION_KINDS = ["text", "yes_no", "number", "choice"] as const;
export type ExtraQuestionKind = (typeof EXTRA_QUESTION_KINDS)[number];
export const PROFILE_SOURCE_KINDS = ["document", "person"] as const;
export type ProfileSourceKind = (typeof PROFILE_SOURCE_KINDS)[number];
/** The parts of a profile that each carry their own source and date: the sections, then each eligibility rule. */
export const PROFILE_PARTS = [
  "answers", "census_layout", "documents", "extra_questions", "contacts",
  "min_headcount", "states_served", "excluded_industries", "excluded_class_codes", "min_enrolment_percent",
] as const;
export type ProfilePart = (typeof PROFILE_PARTS)[number];

/**
 * Where one part of a profile was checked, and when: a document, by its title with a link when there is one, or a
 * named person at the PEO, with their role. Only advisors and admins read the person's name: for anyone else
 * public.peo_catalog() leaves it out, and it reads as null.
 */
export type ProfileSource =
  | { kind: "document"; name: string; link?: string; checkedOn: string }
  | { kind: "person"; name: string | null; role: string; checkedOn: string };

export const PROFILE_CAPS = {
  censusColumns: 200,
  documents: 30,
  extraQuestions: 30,
  choices: 20,
  listItems: 100,
  header: 100,
  text: 500,
} as const;

/** A PEO's census layout: its columns in order, the file it takes, and its own template file when it has one. */
export interface ProfileCensusLayout extends PeoCensusLayout {
  format: CensusFileFormat;
  /** Where the PEO's own template file is kept, when the census must fill it. */
  templateFile: string | null;
}

export interface ProfileDocument {
  category: DocumentCategory;
  /** What exactly the PEO wants, such as "Three years of loss runs". */
  description: string;
}

/** A question only this PEO asks. `key` names the answer; a choice question lists its choices. */
export interface ExtraQuestion {
  key: string;
  text: string;
  kind: ExtraQuestionKind;
  choices?: string[];
}

/** A PEO's eligibility rules. Each is null until sourced: "can't tell yet", never "no rule". */
export interface EligibilityRules {
  minHeadcount: number | null;
  statesServed: string[] | null;
  excludedIndustries: string[] | null;
  excludedClassCodes: string[] | null;
  /** The share of eligible employees who must enrol, as a percentage. */
  minEnrolmentPercent: number | null;
}

/** One published version of a PEO's requirement profile. PEO contacts are not in it: only advisors read them. */
export interface RequirementProfile {
  version: number;
  /** Intake answers the PEO needs before it will quote. */
  neededToQuote: FieldKey[];
  /** Intake answers it needs only before the client signs. */
  neededBeforeSigning: FieldKey[];
  /** Null until the PEO's census columns are sourced. */
  censusLayout: ProfileCensusLayout | null;
  documents: ProfileDocument[];
  rules: EligibilityRules;
  extraQuestions: ExtraQuestion[];
  /**
   * Where each part was checked, and when. A part with no source isn't sourced. Only an advisor's catalog holds the
   * contacts' source and the names of people at the PEO.
   */
  sources: Partial<Record<ProfilePart, ProfileSource>>;
  publishedAt: string | null;
}

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
const list = <T = string>(v: unknown): T[] | null => (Array.isArray(v) ? (v as T[]) : null);
const num = (v: unknown): number | null => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const text = (v: unknown): string | null => (typeof v === "string" ? v : null);

function parseProfile(peo: string, p: Row): RequirementProfile {
  const layout = isRow(p.census_layout) ? p.census_layout : null;
  const rules: EligibilityRules = {
    minHeadcount: num(p.min_headcount),
    statesServed: list(p.states_served),
    excludedIndustries: list(p.excluded_industries),
    excludedClassCodes: list(p.excluded_class_codes),
    minEnrolmentPercent: num(p.min_enrolment_percent),
  };
  const sources: Partial<Record<ProfilePart, ProfileSource>> = {};
  if (isRow(p.sources)) {
    for (const [part, raw] of Object.entries(p.sources)) {
      if (!(PROFILE_PARTS as readonly string[]).includes(part) || !isRow(raw)) continue;
      const name = text(raw.name);
      const checkedOn = text(raw.checked_on);
      if (!checkedOn) continue;
      if (raw.kind === "person" && text(raw.role)) sources[part as ProfilePart] = { kind: "person", name: name || null, role: text(raw.role)!, checkedOn };
      else if (raw.kind === "document" && name) {
        const link = text(raw.link);
        sources[part as ProfilePart] = link ? { kind: "document", name, link, checkedOn } : { kind: "document", name, checkedOn };
      }
    }
  }
  return {
    version: num(p.version) ?? 0,
    neededToQuote: list<FieldKey>(p.needed_to_quote) ?? [],
    neededBeforeSigning: list<FieldKey>(p.needed_before_signing) ?? [],
    censusLayout: layout
      ? {
          peo,
          format: layout.format as CensusFileFormat,
          templateFile: text(layout.template_file),
          columns: list<PeoCensusLayout["columns"][number]>(layout.columns) ?? [],
        }
      : null,
    documents: list<ProfileDocument>(p.documents) ?? [],
    rules,
    extraQuestions: list<ExtraQuestion>(p.extra_questions) ?? [],
    sources,
    publishedAt: text(p.published_at),
  };
}

/** The date of a profile's oldest sourced part, which says how long ago it was checked; null when none is sourced. */
export function oldestCheck(profile: RequirementProfile): string | null {
  const dates = Object.values(profile.sources).map((s) => s.checkedOn).sort();
  return dates[0] ?? null;
}

/**
 * What public.peo_catalog() returns, as PEO records: each PEO in the database's (alphabetical) order, listed or not,
 * with its profile in use, or none. The fit checks (peoFit) read the profile's rules; a PEO with no profile has no
 * facts. A PEO that isn't listed is kept so that what was sent to it still reads; nothing offers it.
 */
export function parsePeoCatalog(raw: unknown): PeoRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): PeoRecord[] => {
    if (!isRow(entry) || typeof entry.name !== "string" || entry.name.trim() === "") return [];
    const profile = isRow(entry.profile) ? parseProfile(entry.name, entry.profile) : null;
    return [{
      id: num(entry.id) ?? undefined,
      name: entry.name,
      listed: entry.listed !== false,
      minHeadcount: profile?.rules.minHeadcount ?? null,
      statesServed: profile?.rules.statesServed ?? null,
      excludedClassCodes: profile?.rules.excludedClassCodes ?? null,
      lastVerified: profile ? oldestCheck(profile) : null,
      profile,
    }];
  });
}
