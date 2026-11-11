// What the PEOs page's components share (L-1.2): the classes, the sections and their rules, and a source as a form
// holds it.
import type { EditableProfile, ProfileProblem } from "@/data/peoEditor";
import type { ProfilePart, ProfileSource } from "@/data/peoProfiles";

export const inputClass = "w-full min-h-11 bg-muted border border-border rounded-md px-3 py-2 text-sm aria-[invalid=true]:border-destructive";
export const buttonClass = "inline-flex items-center justify-center gap-2 min-h-11 border border-border text-sm px-3 py-2 rounded-md hover:bg-muted disabled:opacity-50";
export const primaryClass = "inline-flex items-center justify-center gap-2 min-h-11 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50";

/** The problem at one path, if any. */
export const problemAt = (problems: readonly ProfileProblem[], path: string) => problems.find((p) => p.path === path)?.message;

/** A source as the form holds it: every field a string, so nothing typed is lost when the kind changes. */
export interface SourceDraft {
  kind: "none" | "document" | "person";
  name: string;
  role: string;
  link: string;
  checkedOn: string;
}

export const sourceDraft = (source: ProfileSource | undefined, today: string): SourceDraft =>
  source
    ? { kind: source.kind, name: source.name ?? "", role: source.kind === "person" ? source.role : "", link: source.kind === "document" ? source.link ?? "" : "", checkedOn: source.checkedOn }
    : { kind: "none", name: "", role: "", link: "", checkedOn: today };

/** The source the form describes; undefined for "Not checked yet". */
export const sourceFrom = (d: SourceDraft): ProfileSource | undefined =>
  d.kind === "none" ? undefined
    : d.kind === "document" ? { kind: "document", name: d.name.trim(), ...(d.link.trim() ? { link: d.link.trim() } : {}), checkedOn: d.checkedOn }
      : { kind: "person", name: d.name.trim(), role: d.role.trim(), checkedOn: d.checkedOn };

/** The sections of a profile, in the order the PEOs page shows them, each with the part its source belongs to. */
export type SectionKey = "rules" | "answers" | "census" | "documents" | "questions" | "contacts";

export const SECTION_TITLES: Record<SectionKey, string> = {
  rules: "What it won't take on",
  answers: "Answers it needs",
  census: "Census layout",
  documents: "Documents",
  questions: "Its own questions",
  contacts: "Contacts · advisors only",
};

/** A census column we fill, as people read it: "first_name" is "First name". */
export const columnLabel = (column: string) => column.charAt(0).toUpperCase() + column.slice(1).replace(/_/g, " ");

export const RULE_ROWS: { key: keyof EditableProfile["rules"]; part: ProfilePart; label: string }[] = [
  { key: "minHeadcount", part: "min_headcount", label: "Minimum headcount" },
  { key: "statesServed", part: "states_served", label: "States served" },
  { key: "excludedIndustries", part: "excluded_industries", label: "Excluded industries" },
  { key: "excludedClassCodes", part: "excluded_class_codes", label: "Excluded class codes" },
  { key: "minEnrolmentPercent", part: "min_enrolment_percent", label: "Minimum enrolment" },
];

/** A question's key, suggested from its text until the admin types one: lower-case words joined by underscores. */
export const suggestQuestionKey = (text: string) => {
  const key = text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (/^[a-z]/.test(key) ? key : key ? `q_${key}` : "").slice(0, 40).replace(/_+$/, "");
};
