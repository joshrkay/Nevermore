import type { ChamberData } from "./chamberTypes";
import { headcount } from "./headcount";
import type { RequirementProfile } from "./peoProfiles";

/**
 * A PEO the prospect can prepare a packet for, as the database holds it (src/lib/peoCatalog.ts reads them; see
 * src/data/peoProfiles.ts). Every field except `name` is a sourced fact or null: null means "not yet verified",
 * and nothing downstream may substitute a guess for it. The facts come from the PEO's requirement profile in use.
 */
export interface PeoRecord {
  /** The PEO's id in the database. */
  id?: number;
  name: string;
  /** False once an admin stops listing the PEO: nothing offers it, but what was sent to it still reads. */
  listed: boolean;
  /** Smallest group the PEO accepts, once sourced from the PEO. */
  minHeadcount: number | null;
  /** Two-letter state codes the PEO serves, once sourced from the PEO. */
  statesServed: string[] | null;
  /** Workers' comp class codes the PEO won't write, once sourced from the PEO. */
  excludedClassCodes: string[] | null;
  /** ISO date of the oldest check behind the profile in use (each part is checked on its own date). */
  lastVerified: string | null;
  /** The requirement profile in use (its newest published version); null when none is published yet. */
  profile?: RequirementProfile | null;
}

export type FitStatus = "meets" | "does_not_meet" | "unknown";

export interface PeoFitCheck {
  label: string;
  status: FitStatus;
}

/** Compares only what the prospect stated with only what is sourced about the PEO. */
export function peoFit(data: ChamberData, peo: PeoRecord): PeoFitCheck[] {
  const count = headcount(data);
  let status: FitStatus = "unknown";
  if (peo.minHeadcount !== null && count > 0) status = count >= peo.minHeadcount ? "meets" : "does_not_meet";
  const headcountCheck: PeoFitCheck = {
    label: status === "does_not_meet"
      ? `${peo.name} lists a ${peo.minHeadcount}-employee minimum; you have ${count}`
      : `Headcount vs ${peo.name} minimum`,
    status,
  };

  const stated = data.states;
  let statesCheck: PeoFitCheck = { label: `States of operation vs ${peo.name} coverage`, status: "unknown" };
  if (peo.statesServed !== null && stated.length > 0) {
    const unserved = stated.filter((s) => !peo.statesServed!.includes(s));
    statesCheck = unserved.length === 0
      ? { label: `States of operation vs ${peo.name} coverage`, status: "meets" }
      : { label: `${peo.name} doesn't list: ${unserved.join(", ")}`, status: "does_not_meet" };
  }
  // The census's workers' comp class codes, each once: that is how PEOs screen hazard (the intake's industry is free text).
  const codes = [...new Set(data.census.map((e) => e.class_code?.trim()).filter((c): c is string => !!c))];
  let classCheck: PeoFitCheck = { label: `Class codes vs ${peo.name} exclusions`, status: "unknown" };
  if (peo.excludedClassCodes !== null && codes.length > 0) {
    const excluded = codes.filter((c) => peo.excludedClassCodes!.includes(c));
    classCheck = excluded.length === 0
      ? { label: `Class codes vs ${peo.name} exclusions`, status: "meets" }
      : { label: `${peo.name} lists class code${excluded.length === 1 ? "" : "s"} ${excluded.join(", ")} as excluded`, status: "does_not_meet" };
  }
  return [headcountCheck, statesCheck, classCheck];
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
