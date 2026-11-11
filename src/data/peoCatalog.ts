import type { ChamberData } from "./chamberTypes";
import { headcount } from "./headcount";
import { capitalised, codesPhrase, isProfileStale, notCheckedYet, PART_LABELS, RULE_KEYS, RULE_PARTS_IN_ORDER, type RequirementProfile } from "./peoProfiles";

/**
 * A PEO the prospect can prepare a packet for, as the database holds it (src/lib/peoCatalog.ts reads them; see
 * src/data/peoProfiles.ts). Its facts are its requirement profile in use: each rule is null until sourced, and
 * nothing downstream may substitute a guess for it.
 */
export interface PeoRecord {
  /** The PEO's id in the database. */
  id?: number;
  name: string;
  /** False once an admin stops listing the PEO: nothing offers it, but what was sent to it still reads. */
  listed: boolean;
  /** ISO date of the oldest check behind the profile in use (each part is checked on its own date). */
  lastVerified: string | null;
  /** The requirement profile in use (its newest published version); null when none is published yet. */
  profile?: RequirementProfile | null;
}

export type FitStatus = "meets" | "does_not_meet" | "unknown";

/** Each outcome in words, as every eligibility check shows it, beside its icon. */
export const FIT_WORDS: Record<FitStatus, string> = {
  meets: "Meets",
  does_not_meet: "Doesn't meet",
  unknown: "Can't tell yet",
};

/** What a check that isn't met means where the advisor sends: a warning, never a stop. */
export const NOT_MET_NOTE = "A check that isn't met is a warning. It never stops you sending.";

/** The eligibility rules a check is run for, in the order the checks always come in. */
export const FIT_RULES = RULE_PARTS_IN_ORDER;
export type FitRule = (typeof FIT_RULES)[number];

/** One eligibility check (GLOSSARY.md): a rule of the PEO's profile in use against the employer's answers. */
export interface PeoFitCheck {
  rule: FitRule;
  /** The rule's name, such as "Minimum headcount". */
  label: string;
  status: FitStatus;
  /** The PEO's fact against the employer's, in a plain sentence. */
  sentence: string;
  /** When the rule was checked with the PEO (YYYY-MM-DD); null for a rule not sourced. */
  checkedOn: string | null;
  /** Whether that was more than 180 days ago (isProfileStale). The check still stands, with a warning. */
  stale: boolean;
}

const list = (items: readonly string[]) => items.join(", ");

/**
 * One check per eligibility rule of the PEO's profile in use, always in FIT_RULES's order. Compares only what the
 * employer stated with only what is sourced about the PEO: a rule that isn't sourced, or an answer not given yet,
 * is "can't tell yet", never a guess. Industry exclusions are checked only through the class codes an admin mapped
 * them to, never against the intake's free-text industry. `today` (YYYY-MM-DD) tells whether a rule's check is stale.
 */
export function peoFit(data: ChamberData, peo: PeoRecord, today: string): PeoFitCheck[] {
  const profile = peo.profile ?? null;
  const name = peo.name;
  // The census's workers' comp class codes, each once: how PEOs screen hazard.
  const codes = [...new Set(data.census.map((e) => e.class_code?.trim()).filter((c): c is string => !!c))];

  return FIT_RULES.map((rule): PeoFitCheck => {
    const label = capitalised(PART_LABELS[rule]);
    const value = profile ? profile.rules[RULE_KEYS[rule]] : null;
    const source = profile?.sources[rule];
    const check = (status: FitStatus, sentence: string): PeoFitCheck => ({
      rule, label, status, sentence, checkedOn: source!.checkedOn, stale: isProfileStale(source!.checkedOn, today),
    });
    if (value === null || value === undefined || !source) {
      return { rule, label, status: "unknown", sentence: notCheckedYet(name, rule), checkedOn: null, stale: false };
    }
    switch (rule) {
      case "min_headcount": {
        const min = value as number;
        const count = headcount(data);
        const fact = `${name} takes groups of ${min} or more employees`;
        if (count <= 0) return check("unknown", `${fact}; this employer's headcount isn't given yet.`);
        return check(count >= min ? "meets" : "does_not_meet", `${fact}; this employer has ${count}.`);
      }
      case "states_served": {
        const served = value as string[];
        const stated = data.states;
        if (stated.length === 0) return check("unknown", `${name} serves ${list(served)}; the states this employer operates in aren't given yet.`);
        const unserved = stated.filter((s) => !served.includes(s));
        return unserved.length === 0
          ? check("meets", `${name} serves ${list(served)}; this employer operates in ${list(stated)}.`)
          : check("does_not_meet", `${name} doesn't serve ${list(unserved)}; this employer operates in ${list(stated)}.`);
      }
      case "excluded_industries": {
        const industries = value as string[];
        if (industries.length === 0) return check("meets", `${name} excludes no industries.`);
        const mapping = profile!.rules.excludedIndustryCodes ?? {};
        const hit = industries.find((i) => (mapping[i] ?? []).some((c) => codes.includes(c)));
        if (hit) {
          const found = mapping[hit].filter((c) => codes.includes(c));
          return check("does_not_meet", `${name} won't take ${hit} (${codesPhrase(mapping[hit])}); this employer's census has ${list(found)}.`);
        }
        const unmapped = industries.filter((i) => !(mapping[i]?.length));
        if (unmapped.length > 0) {
          const one = unmapped.length === 1;
          return check("unknown", `${name} won't take ${list(unmapped)}; no class codes are mapped to ${one ? "it" : "them"} yet, so ${one ? "it" : "they"} can't be checked.`);
        }
        if (codes.length === 0) return check("unknown", `${name} won't take ${list(industries)}; this employer's census has no class codes yet.`);
        return check("meets", `None of this employer's class codes (${list(codes)}) is in an industry ${name} won't take.`);
      }
      case "excluded_class_codes": {
        const excluded = value as string[];
        if (excluded.length === 0) return check("meets", `${name} excludes no class codes.`);
        if (codes.length === 0) return check("unknown", `${name} excludes ${codesPhrase(excluded)}; this employer's census has no class codes yet.`);
        const found = codes.filter((c) => excluded.includes(c));
        return found.length > 0
          ? check("does_not_meet", `${name} excludes ${codesPhrase(found)}, which ${found.length === 1 ? "is" : "are"} on this employer's census.`)
          : check("meets", `${name} excludes ${codesPhrase(excluded)}; none is on this employer's census (${list(codes)}).`);
      }
      case "min_enrolment_percent":
        // Minimum participation: the intake doesn't yet hold how many employees are eligible for the health plan or
        // how many will enrol, and nothing else (coverage tiers, waivers, headcount) stands in for them.
        return check("unknown", `${name} needs ${value}% of employees eligible for the health plan to enrol; the intake doesn't hold how many are eligible or how many will enrol yet.`);
    }
  });
}

/** Where a PEO stands across its checks: one not met, else one that can't be told yet, else every one met. */
export function fitOutcome(checks: readonly PeoFitCheck[]): FitStatus {
  return checks.some((c) => c.status === "does_not_meet") ? "does_not_meet" : checks.some((c) => c.status === "unknown") ? "unknown" : "meets";
}

/** The order outcomes are always shown in, whichever holds more PEOs. */
export const FIT_OUTCOME_ORDER: readonly FitStatus[] = ["meets", "unknown", "does_not_meet"];

/**
 * The PEOs grouped by how their checks come out, the groups always in FIT_OUTCOME_ORDER and the PEOs alphabetical
 * within each: nothing is ranked or scored. A group with no PEO is left out.
 */
export function groupPeosByFit(data: ChamberData, peos: readonly PeoRecord[], today: string): { outcome: FitStatus; peos: PeoRecord[] }[] {
  const outcomes = new Map(peos.map((p) => [p, fitOutcome(peoFit(data, p, today))]));
  const alphabetical = [...peos].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return FIT_OUTCOME_ORDER
    .map((outcome) => ({ outcome, peos: alphabetical.filter((p) => outcomes.get(p) === outcome) }))
    .filter((g) => g.peos.length > 0);
}

/**
 * The longest PEO name kept, the limit of the "name another PEO" field. The database refuses longer
 * names (chamber_sessions.chosen_peo); src/data/schemaSync.test.ts keeps the two the same.
 */
export const PEO_NAME_MAX = 80;

/** A PEO name as it is saved: trimmed and at most PEO_NAME_MAX characters, or null for none. */
export function cleanPeoName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  // Cut by character, not UTF-16 unit, so a name is never left ending in half a character.
  const cleaned = Array.from(name.trim()).slice(0, PEO_NAME_MAX).join("").trim();
  return cleaned === "" ? null : cleaned;
}

/**
 * The PEO in the catalog with this name, compared ignoring case, listed or not: one an admin took off the list is
 * still found, so what was sent to it reads against its profile. Undefined for a name the catalog doesn't hold.
 */
export function findPeo(catalog: readonly PeoRecord[], name: string): PeoRecord | undefined {
  const wanted = name.trim().toLowerCase();
  return catalog.find((p) => p.name.toLowerCase() === wanted);
}

/** The PEOs an admin lists, in the catalog's (alphabetical) order: the only ones offered anywhere. */
export function listedPeos(catalog: readonly PeoRecord[]): PeoRecord[] {
  return catalog.filter((p) => p.listed);
}
