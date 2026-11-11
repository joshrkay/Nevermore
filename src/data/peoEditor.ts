// The PEOs page's editor (L-1.2): a requirement profile as an admin edits it, the rules it is checked against next
// to each field, and what changed between two versions. The rules are the database's (peo_profile_version_error and
// peo_contact_error, 20261111090000); src/data/schemaSync.test.ts keeps their lists and limits equal.

import { CENSUS_TEMPLATE_COLUMNS } from "./census";
import { US_STATE_CODES } from "./chamberValidation";
import { categoryInfo, DOCUMENT_CATEGORIES } from "./documentCategories";
import { CENSUS_FILE_FORMATS, EXTRA_QUESTION_KINDS, formatCheckedOn, isProfileStale, oldestCheck, parsePeoCatalog, PROFILE_CAPS, PROFILE_PARTS, type ProfilePart, type ProfileSource, type RequirementProfile } from "./peoProfiles";
import { FIELD_LABELS } from "./provenance";

/** A contact's limits, in characters. */
export const CONTACT_LIMITS = { name: 200, role: 100, email: 254, phone: 40 } as const;

/** A source may be dated one day ahead of the database's clock, so an admin ahead of UTC can enter their own today. */
export const CHECKED_ON_GRACE_DAYS = 1;

/** A person at the PEO a profile version names. Read by advisors only. */
export interface PeoContact {
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
}

/** A requirement profile as the editor holds it: every part of a version, its contacts included. */
export type EditableProfile = Omit<RequirementProfile, "version" | "publishedAt"> & { contacts: PeoContact[] };

/** A profile with nothing in it: every rule "can't tell yet", nothing sourced. */
export const EMPTY_PROFILE: EditableProfile = {
  neededToQuote: [],
  neededBeforeSigning: [],
  censusLayout: null,
  documents: [],
  rules: { minHeadcount: null, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null },
  extraQuestions: [],
  contacts: [],
  sources: {},
};

/** What is wrong with one field, in plain words; `path` names the field, such as "contacts.0.email". */
export interface ProfileProblem {
  path: string;
  message: string;
}

/** The intake answers a PEO can ask for: every field the intake holds. */
export const ANSWER_FIELDS = Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[];
const DOCUMENT_KINDS = new Set<string>(DOCUMENT_CATEGORIES.map((c) => c.key));
const STATE_SET = new Set(US_STATE_CODES);
/** The database's patterns, written as it writes them (schemaSync.test.ts finds each in the migration). */
export const PROFILE_PATTERNS = {
  questionKey: "^[a-z][a-z0-9_]{0,39}$",
  classCode: "^[0-9]{4}$",
  link: "^https?://[^\\s]+$",
  email: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
} as const;
const QUESTION_KEY = new RegExp(PROFILE_PATTERNS.questionKey);
const CLASS_CODE = new RegExp(PROFILE_PATTERNS.classCode);
const LINK = new RegExp(PROFILE_PATTERNS.link);
const EMAIL = new RegExp(PROFILE_PATTERNS.email);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const length = (s: string) => Array.from(s).length;
const between = (s: string, min: number, max: number) => length(s.trim()) >= min && length(s.trim()) <= max;

/** Whether a YYYY-MM-DD string names a real day. */
const isRealDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

// ---------- The parts of a profile ----------

/** The sections of a profile, in the order the PEOs page shows them. */
export type SectionKey = "rules" | "answers" | "census" | "documents" | "questions" | "contacts";

type RuleKey = keyof EditableProfile["rules"];

/** How a rule is typed in the editor: a number, words such as state codes, or lines in the PEO's own words. */
export type RuleInput = "number" | "words" | "lines";

/** One part of a profile: what people call it, where the editor has it, what it holds, and, for a rule, how it is typed. */
export interface ProfilePartEntry {
  /** Its name in a sentence, such as "minimum headcount". */
  label: string;
  /** "was" or "were", for "Where the <label> <verb> checked". */
  verb: "was" | "were";
  section: SectionKey;
  /** The paths of its fields, as profileProblems names them. */
  fields: string[];
  /** What it holds; null when it isn't set ("can't tell yet"). */
  read: (p: EditableProfile) => unknown;
  /** For an eligibility rule: its key in the rules, how it is typed and shown, and the hint beside it. */
  rule?: { key: RuleKey; input: RuleInput; upperCase?: boolean; hint: string; show: (v: never) => string };
}

const joined = (v: string[]) => v.join(", ");

/** Every part of a profile, in the database's order (PROFILE_PARTS). Each list below derives from this one table. */
export const PROFILE_PART_TABLE: Record<ProfilePart, ProfilePartEntry> = {
  answers: { label: "answers", verb: "were", section: "answers", fields: ["neededToQuote", "neededBeforeSigning"], read: (p) => [...p.neededToQuote, ...p.neededBeforeSigning] },
  census_layout: { label: "census layout", verb: "was", section: "census", fields: ["censusLayout"], read: (p) => p.censusLayout },
  documents: { label: "documents", verb: "were", section: "documents", fields: ["documents"], read: (p) => p.documents },
  extra_questions: { label: "questions", verb: "were", section: "questions", fields: ["extraQuestions"], read: (p) => p.extraQuestions },
  contacts: { label: "contacts", verb: "were", section: "contacts", fields: ["contacts"], read: (p) => p.contacts },
  min_headcount: {
    label: "minimum headcount", verb: "was", section: "rules", fields: ["rules.minHeadcount"], read: (p) => p.rules.minHeadcount,
    rule: { key: "minHeadcount", input: "number", hint: "Employees. Leave it empty if not checked yet.", show: (v: number) => String(v) },
  },
  states_served: {
    label: "states served", verb: "were", section: "rules", fields: ["rules.statesServed"], read: (p) => p.rules.statesServed,
    rule: { key: "statesServed", input: "words", upperCase: true, hint: "State codes, such as CA, NY. Leave it empty if not checked yet.", show: joined },
  },
  excluded_industries: {
    label: "excluded industries", verb: "were", section: "rules", fields: ["rules.excludedIndustries"], read: (p) => p.rules.excludedIndustries,
    rule: { key: "excludedIndustries", input: "lines", hint: "In the PEO's own words, one per line. Leave it empty and give a source if it excludes none.", show: (v: string[]) => joined(v) || "None" },
  },
  excluded_class_codes: {
    label: "excluded class codes", verb: "were", section: "rules", fields: ["rules.excludedClassCodes"], read: (p) => p.rules.excludedClassCodes,
    rule: { key: "excludedClassCodes", input: "words", hint: "Workers' comp class codes, four digits each. Leave it empty and give a source if it excludes none.", show: (v: string[]) => joined(v) || "None" },
  },
  min_enrolment_percent: {
    label: "minimum enrolment", verb: "was", section: "rules", fields: ["rules.minEnrolmentPercent"], read: (p) => p.rules.minEnrolmentPercent,
    rule: { key: "minEnrolmentPercent", input: "number", hint: "Percent of eligible employees. Leave it empty if not checked yet.", show: (v: number) => `${v}%` },
  },
};

/** A part's name to start a line with: "Minimum headcount". */
export const capitalised = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The parts of a profile by the names the PEOs page gives them. */
export const PART_LABELS = Object.fromEntries(PROFILE_PARTS.map((part) => [part, PROFILE_PART_TABLE[part].label])) as Record<ProfilePart, string>;

/** The eligibility rules, in order: each one's part, its key in the rules, its label to start a line with, and how it is typed. */
export const RULE_PARTS = PROFILE_PARTS.flatMap((part) => {
  const { rule, label, verb } = PROFILE_PART_TABLE[part];
  return rule ? [{ ...rule, part, label: capitalised(label), verb }] : [];
});

/** "Where the minimum headcount was checked". */
export const whereChecked = (part: ProfilePart) => `Where the ${PROFILE_PART_TABLE[part].label} ${PROFILE_PART_TABLE[part].verb} checked`;

/** Whether a part of the profile holds something a source can be for. A rule or a census layout that is null doesn't. */
function partIsSet(p: EditableProfile, part: ProfilePart): boolean {
  return PROFILE_PART_TABLE[part].read(p) !== null;
}

/** Whether a part holds something, so that publishing needs its source. */
export function partHoldsSomething(p: EditableProfile, part: ProfilePart): boolean {
  const held = PROFILE_PART_TABLE[part].read(p);
  return Array.isArray(held) && !RULE_PARTS.some((r) => r.part === part) ? held.length > 0 : held !== null;
}

/**
 * Every rule a profile breaks, each at the field it is about, in the words an admin acts on: the database's rules
 * (peo_profile_version_error, peo_contact_error and admin_save_peo_profile), so a profile the editor accepts is one
 * the database stores. `today` is the database's date (UTC, utcToday()), YYYY-MM-DD, since a source may be dated at
 * most one day past it.
 */
export function profileProblems(p: EditableProfile, today: string): ProfileProblem[] {
  const out: ProfileProblem[] = [];
  const add = (path: string, message: string) => out.push({ path, message });
  const caps = PROFILE_CAPS;

  // The answers: intake fields, each once, to quote or before signing.
  const seen = new Set<string>();
  for (const [list, name] of [[p.neededToQuote, "neededToQuote"], [p.neededBeforeSigning, "neededBeforeSigning"]] as const) {
    list.forEach((field, i) => {
      if (!(ANSWER_FIELDS as string[]).includes(field)) add(`${name}.${i}`, `${field || "An empty name"} isn't an answer the intake asks for`);
      else if (seen.has(field)) add(`${name}.${i}`, "Each answer is listed once: needed to quote, or needed only before signing");
      seen.add(field);
    });
  }

  // The census layout.
  const layout = p.censusLayout;
  if (layout) {
    if (!(CENSUS_FILE_FORMATS as readonly string[]).includes(layout.format)) add("censusLayout.format", "A census file is CSV or xlsx");
    if (layout.templateFile !== null && !between(layout.templateFile, 1, caps.sourceName)) {
      add("censusLayout.templateFile", `A template file is named by its path, up to ${caps.sourceName} characters, or not at all`);
    }
    if (layout.columns.length < 1 || layout.columns.length > caps.censusColumns) {
      add("censusLayout.columns", `A census layout has 1 to ${caps.censusColumns} columns`);
    } else {
      const headers = new Set<string>();
      layout.columns.forEach((c, i) => {
        if (!between(c.header, 1, caps.header)) add(`censusLayout.columns.${i}.header`, `Each census column has a header of 1 to ${caps.header} characters`);
        else if (headers.has(c.header.trim().toLowerCase())) add(`censusLayout.columns.${i}.header`, "Each census column has a header of its own");
        headers.add(c.header.trim().toLowerCase());
        if (c.from !== null && !(CENSUS_TEMPLATE_COLUMNS as readonly string[]).includes(c.from)) add(`censusLayout.columns.${i}.from`, `${c.from} isn't one of our census columns`);
      });
    }
  }

  // The documents.
  if (p.documents.length > caps.documents) add("documents", `A profile lists up to ${caps.documents} documents`);
  p.documents.forEach((d, i) => {
    if (!DOCUMENT_KINDS.has(d.category)) add(`documents.${i}.category`, "Each document is one of the kinds of document the intake takes");
    if (!between(d.description, 1, caps.text)) add(`documents.${i}.description`, `Each document says what the PEO wants, in 1 to ${caps.text} characters`);
  });

  // The eligibility rules, each null until sourced.
  const r = p.rules;
  if (r.minHeadcount !== null && (!Number.isInteger(r.minHeadcount) || r.minHeadcount < 1 || r.minHeadcount > caps.headcount)) {
    add("rules.minHeadcount", `A minimum headcount is a whole number of employees from 1 to ${caps.headcount.toLocaleString("en-US")}`);
  }
  if (r.statesServed !== null && (r.statesServed.length === 0 || r.statesServed.some((s) => !STATE_SET.has(s)) || new Set(r.statesServed).size !== r.statesServed.length)) {
    add("rules.statesServed", "The states served are US state or territory codes such as CA, each once, and at least one");
  }
  if (r.excludedIndustries !== null && (r.excludedIndustries.length > caps.listItems || r.excludedIndustries.some((i) => !between(i, 1, caps.header) || i !== i.trim()))) {
    add("rules.excludedIndustries", `Up to ${caps.listItems} excluded industries, each named in 1 to ${caps.header} characters`);
  }
  if (r.excludedClassCodes !== null && (r.excludedClassCodes.length > caps.listItems || r.excludedClassCodes.some((c) => !CLASS_CODE.test(c)))) {
    add("rules.excludedClassCodes", `Up to ${caps.listItems} excluded class codes, each four digits`);
  }
  if (r.minEnrolmentPercent !== null && !(r.minEnrolmentPercent > 0 && r.minEnrolmentPercent <= 100)) {
    add("rules.minEnrolmentPercent", "A minimum enrolment is a percentage above 0 and up to 100");
  }

  // The extra questions.
  if (p.extraQuestions.length > caps.extraQuestions) add("extraQuestions", `A profile has up to ${caps.extraQuestions} extra questions`);
  const keys = new Set<string>();
  p.extraQuestions.forEach((q, i) => {
    if (!QUESTION_KEY.test(q.key)) {
      add(`extraQuestions.${i}.key`, "Each extra question has a key of lower-case letters, digits and underscores, starting with a letter, up to 40 characters");
    } else if (keys.has(q.key)) add(`extraQuestions.${i}.key`, "Each extra question has a key of its own");
    keys.add(q.key);
    if (!between(q.text, 1, caps.text)) add(`extraQuestions.${i}.text`, `Each extra question is 1 to ${caps.text} characters`);
    if (!(EXTRA_QUESTION_KINDS as readonly string[]).includes(q.kind)) add(`extraQuestions.${i}.kind`, "An extra question is answered as text, yes or no, a number, or a choice");
    if (q.kind === "choice") {
      const choices = q.choices ?? [];
      if (choices.length < 2 || choices.length > caps.choices || choices.some((c) => !between(c, 1, caps.header))
          || new Set(choices.map((c) => c.trim().toLowerCase())).size !== choices.length) {
        add(`extraQuestions.${i}.choices`, `A choice question has 2 to ${caps.choices} different choices, each 1 to ${caps.header} characters`);
      }
    }
  });

  // The contacts.
  if (p.contacts.length > caps.contacts) add("contacts", `A profile names up to ${caps.contacts} contacts`);
  p.contacts.forEach((c, i) => {
    if (!between(c.name, 1, CONTACT_LIMITS.name)) add(`contacts.${i}.name`, `Each contact has a name of 1 to ${CONTACT_LIMITS.name} characters`);
    if (c.role && length(c.role.trim()) > CONTACT_LIMITS.role) add(`contacts.${i}.role`, `A contact's role is up to ${CONTACT_LIMITS.role} characters`);
    if (c.email && c.email.trim() && (length(c.email.trim()) > CONTACT_LIMITS.email || !EMAIL.test(c.email.trim()))) add(`contacts.${i}.email`, "A contact's email must be an email address");
    if (c.phone && length(c.phone.trim()) > CONTACT_LIMITS.phone) add(`contacts.${i}.phone`, `A contact's phone number is up to ${CONTACT_LIMITS.phone} characters`);
  });

  // Where each part was checked, and when.
  for (const [part, s] of Object.entries(p.sources) as [ProfilePart, RequirementProfile["sources"][ProfilePart]][]) {
    if (!s) continue;
    const at = `sources.${part}`;
    if (!partIsSet(p, part)) {
      add(at, `${part.replace(/_/g, " ")} isn't set, so it has no source`);
      continue;
    }
    if (s.name === null || !between(s.name, 1, caps.sourceName) || s.name !== s.name.trim()) {
      add(`${at}.name`, `A source is named, by its title or the person's name, in 1 to ${caps.sourceName} characters`);
    }
    if (s.kind === "person" && !between(s.role, 1, caps.header)) add(`${at}.role`, `A person at the PEO is named with their role, of 1 to ${caps.header} characters`);
    if (s.kind === "document" && s.link !== undefined && (!LINK.test(s.link) || length(s.link) > caps.link)) {
      add(`${at}.link`, "A link is a web address starting http:// or https://");
    }
    if (!ISO_DATE.test(s.checkedOn)) add(`${at}.checkedOn`, "Each source has the date it was checked");
    else if (!isRealDate(s.checkedOn)) add(`${at}.checkedOn`, `${s.checkedOn} isn't a date`);
    else if (s.checkedOn > addDays(today, CHECKED_ON_GRACE_DAYS)) add(`${at}.checkedOn`, "A source can't be checked on a date that hasn't come");
  }
  return out;
}

/** What a draft must say before it can be published: where every part that holds something came from. */
export function publishProblems(p: EditableProfile): ProfileProblem[] {
  const missing = PROFILE_PARTS.filter((part) => partHoldsSomething(p, part) && !p.sources[part]);
  if (missing.length > 0) {
    return missing.map((part) => ({ path: `sources.${part}`, message: `Name where the ${PART_LABELS[part]} came from, and when it was checked, before publishing` }));
  }
  return Object.keys(p.sources).length === 0 ? [{ path: "sources", message: "A profile with nothing sourced has nothing to publish" }] : [];
}

// ---------- Sources, as people read them ----------

/** Where a part was checked, as the PEOs page shows it beside the part; "Not checked yet" for none. */
export function describeSource(source: ProfileSource | undefined): string {
  if (!source) return "Not checked yet";
  const checked = `checked ${formatCheckedOn(source.checkedOn)}`;
  if (source.kind === "document") return `Document: ${source.name} · ${checked}`;
  return `Broker desk: ${source.name ? `${source.name}, ` : ""}${source.role} · ${checked}`;
}

// ---------- To and from the database ----------

const sourcePayload = (s: ProfileSource) =>
  s.kind === "document"
    ? { kind: "document", name: s.name, ...(s.link ? { link: s.link } : {}), checked_on: s.checkedOn }
    : { kind: "person", name: s.name, role: s.role, checked_on: s.checkedOn };

/** The profile as admin_save_peo_profile() takes it: every part, its sources and its contacts. */
export function profilePayload(p: EditableProfile): Record<string, unknown> {
  return {
    needed_to_quote: p.neededToQuote,
    needed_before_signing: p.neededBeforeSigning,
    census_layout: p.censusLayout
      ? { format: p.censusLayout.format, template_file: p.censusLayout.templateFile, columns: p.censusLayout.columns.map((c) => ({ header: c.header, from: c.from })) }
      : null,
    documents: p.documents,
    // Each rule's column is named after its part.
    ...Object.fromEntries(RULE_PARTS.map((r) => [r.part, p.rules[r.key]])),
    extra_questions: p.extraQuestions,
    sources: Object.fromEntries(Object.entries(p.sources).map(([part, s]) => [part, sourcePayload(s!)])),
    contacts: p.contacts,
  };
}

/** One version of a PEO's profile as advisors read it on the PEOs page: its number, state, dates and every part. */
export interface ProfileVersion {
  id: number;
  version: number;
  /** A draft's state, new on every save: a save or a publish names the one it was based on. */
  revision: string | null;
  status: "draft" | "published";
  createdAt: string;
  publishedAt: string | null;
  profile: EditableProfile;
}

type Row = Record<string, unknown>;

/** A peo_profile_versions row and its peo_contacts rows, as the PEOs page holds them. */
export function parseProfileVersion(peo: string, row: Row, contacts: readonly Row[]): ProfileVersion {
  const [parsed] = parsePeoCatalog([{ id: 0, name: peo, profile: row }]);
  const profile = parsed.profile!;
  return {
    id: Number(row.id),
    version: profile.version,
    revision: typeof row.revision === "string" ? row.revision : null,
    status: row.status === "published" ? "published" : "draft",
    createdAt: String(row.created_at ?? ""),
    publishedAt: profile.publishedAt,
    profile: {
      neededToQuote: profile.neededToQuote,
      neededBeforeSigning: profile.neededBeforeSigning,
      censusLayout: profile.censusLayout,
      documents: profile.documents,
      rules: profile.rules,
      extraQuestions: profile.extraQuestions,
      sources: profile.sources,
      contacts: contactsOf(Number(row.id), contacts),
    },
  };
}

/** The contacts one profile version names, in order, from peo_contacts rows. */
export function contactsOf(versionId: number, rows: readonly Row[]): PeoContact[] {
  const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
  return rows
    .filter((c) => Number(c.profile_version_id) === versionId)
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((c) => ({ name: String(c.name ?? ""), role: str(c.role), email: str(c.email), phone: str(c.phone) }));
}

/**
 * What an editor or a review was based on: the draft's revision, or, with no draft, null and the version in use (null
 * with none). The database refuses a save or a publish based on anything else.
 */
export interface DraftBasis {
  draftRevision: string | null;
  inUseVersion: number | null;
}

/** Whether the database refused a save or a publish because the draft changed since it was opened (PT409). */
export const isStaleDraftError = (err: unknown) => (err as { code?: unknown } | null)?.code === "PT409";

// ---------- What changed ----------

/** A rule's value as the PEOs page shows it: "Not checked yet" while it is null. */
export function showRule(p: EditableProfile, key: keyof EditableProfile["rules"]): string {
  const rule = RULE_PARTS.find((r) => r.key === key)!;
  const value = p.rules[key];
  return value === null ? "Not checked yet" : rule.show(value as never);
}

const listChange = (label: string, before: string[], after: string[]): string[] => {
  const added = after.filter((x) => !before.includes(x));
  const removed = before.filter((x) => !after.includes(x));
  const parts = [...(added.length ? [`added ${added.join(", ")}`] : []), ...(removed.length ? [`removed ${removed.join(", ")}`] : [])];
  return parts.length ? [`${label}: ${parts.join("; ")}`] : [];
};

const documentLabel = (d: EditableProfile["documents"][number]) => `${categoryInfo(d.category)?.label ?? d.category} (${d.description})`;
const questionLabel = (q: EditableProfile["extraQuestions"][number]) =>
  `${q.text}${q.kind === "choice" ? ` (${(q.choices ?? []).join(" / ")})` : ` (${EXTRA_QUESTION_LABELS[q.kind]})`}`;

/** How each kind of extra question is answered, in plain words. */
export const EXTRA_QUESTION_LABELS: Record<EditableProfile["extraQuestions"][number]["kind"], string> = {
  text: "text",
  yes_no: "yes or no",
  number: "a number",
  choice: "a choice",
};

/**
 * What changes from one version to the next, in words, part by part, for the review before publishing and the
 * history: each rule's old and new value, what was added to or removed from each list, and every source that
 * changed. `from` is null for a PEO's first version.
 */
export function profileChanges(from: EditableProfile | null, to: EditableProfile): string[] {
  const before = from ?? EMPTY_PROFILE;
  const out: string[] = [];
  const field = (key: string) => FIELD_LABELS[key as keyof typeof FIELD_LABELS] ?? key;

  for (const rule of RULE_PARTS) {
    const a = showRule(before, rule.key);
    const b = showRule(to, rule.key);
    if (a !== b) out.push(`${rule.label}: ${a} → ${b}`);
  }
  out.push(...listChange("Answers needed to quote", before.neededToQuote.map(field), to.neededToQuote.map(field)));
  out.push(...listChange("Answers needed only before signing", before.neededBeforeSigning.map(field), to.neededBeforeSigning.map(field)));
  const [l0, l1] = [before.censusLayout, to.censusLayout];
  if (!l1 && l0) out.push("Census layout: Not checked yet");
  if (l1) {
    const formatName = (l: typeof l1 | null) => (l ? (l.format === "xlsx" ? "xlsx" : "CSV") : "Not checked yet");
    if (formatName(l0) !== formatName(l1)) out.push(`Census file: ${formatName(l0)} → ${formatName(l1)}`);
    if ((l0?.templateFile ?? null) !== l1.templateFile) out.push(`Template file: ${l0?.templateFile ?? "None"} → ${l1.templateFile ?? "None"}`);
    if (!l0 || JSON.stringify(l0.columns) !== JSON.stringify(l1.columns)) out.push(`Census layout: columns now ${l1.columns.map((c) => c.header).join(", ")}`);
  }
  out.push(...listChange("Documents", before.documents.map(documentLabel), to.documents.map(documentLabel)));
  out.push(...listChange("Its own questions", before.extraQuestions.map((q) => q.text), to.extraQuestions.map((q) => q.text)));
  for (const q of to.extraQuestions) {
    const old = before.extraQuestions.find((o) => o.key === q.key);
    if (old && old.text === q.text && questionLabel(old) !== questionLabel(q)) out.push(`Its own questions: ${questionLabel(old)} → ${questionLabel(q)}`);
  }
  const contactLabel = (c: PeoContact) => [c.name, c.role, c.email, c.phone].filter(Boolean).join(", ");
  const contacts = listChange("Contacts", before.contacts.map((c) => c.name), to.contacts.map((c) => c.name));
  out.push(...contacts);
  for (const c of to.contacts) {
    const old = before.contacts.find((o) => o.name === c.name);
    if (old && contactLabel(old) !== contactLabel(c)) out.push(`Contacts: ${contactLabel(old)} → ${contactLabel(c)}`);
  }

  for (const rule of RULE_PARTS) sourceChange(rule.part);
  for (const part of PROFILE_PARTS.filter((p) => !PROFILE_PART_TABLE[p].rule)) sourceChange(part);
  return out;

  function sourceChange(part: ProfilePart) {
    const a = describeSource(before.sources[part]);
    const b = describeSource(to.sources[part]);
    if (a !== b) out.push(`${whereChecked(part)}: ${a} → ${b}`);
  }
}

// ---------- Where a PEO's profile stands ----------

/** The version in use (the newest published one) and the draft, if any, of a PEO's versions (newest first). */
export function versionsOf(versions: readonly ProfileVersion[]): { inUse: ProfileVersion | null; draft: ProfileVersion | null; published: ProfileVersion[] } {
  const published = versions.filter((v) => v.status === "published").sort((a, b) => b.version - a.version);
  return { inUse: published[0] ?? null, draft: versions.find((v) => v.status === "draft") ?? null, published };
}

/**
 * The one line the PEOs page lists a PEO with: whether it is listed, the version in use and when it was checked
 * (out of date by the one staleness rule), or that it has no profile yet, and, for admins, a draft in progress.
 */
export function peoStatusLine(peo: { listed: boolean; versions: readonly ProfileVersion[] }, today: string): string {
  const { inUse, draft } = versionsOf(peo.versions);
  const checked = inUse ? oldestCheck(inUse.profile) : null;
  const parts = [
    ...(peo.listed ? [] : ["Not listed · hidden from prospects"]),
    inUse ? `Version ${inUse.version}${checked ? ` · checked ${formatCheckedOn(checked)}` : ""}${isProfileStale(checked, today) ? " · out of date" : ""}` : "No profile yet",
    ...(draft ? ["draft in progress"] : []),
  ];
  return parts.join(" · ");
}
