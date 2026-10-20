import type { ChamberData } from "./chamberTypes";
import { headcount } from "./headcount";

/**
 * A PEO the prospect can prepare a packet for. Every field except `name` is a sourced fact or null:
 * null means "not yet verified", and nothing downstream may substitute a guess for it.
 */
export interface PeoRecord {
  name: string;
  /** Smallest group the PEO accepts, once sourced from the PEO. */
  minHeadcount: number | null;
  /** Two-letter state codes the PEO serves, once sourced from the PEO. */
  statesServed: string[] | null;
  /** ISO date the facts above were last checked against the PEO's own materials. */
  lastVerified: string | null;
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
  const headcountCheck: PeoFitCheck = { label: `Headcount vs ${peo.name} minimum`, status };

  const stated = data.states;
  let statesCheck: PeoFitCheck = { label: `States of operation vs ${peo.name} coverage`, status: "unknown" };
  if (peo.statesServed !== null && stated.length > 0) {
    const unserved = stated.filter((s) => !peo.statesServed!.includes(s));
    statesCheck = unserved.length === 0
      ? { label: `States of operation vs ${peo.name} coverage`, status: "meets" }
      : { label: `${peo.name} doesn't list: ${unserved.join(", ")}`, status: "does_not_meet" };
  }
  return [headcountCheck, statesCheck];
}

// Alphabetical on purpose: this is a list of choices, not a ranking. Facts stay null until
// someone checks them against the PEO's own materials and records the date in `lastVerified`.
export const PEO_CATALOG: PeoRecord[] = [
  { name: "ADP TotalSource", minHeadcount: null, statesServed: null, lastVerified: null },
  { name: "Insperity", minHeadcount: null, statesServed: null, lastVerified: null },
  { name: "Justworks", minHeadcount: null, statesServed: null, lastVerified: null },
  { name: "Rippling", minHeadcount: null, statesServed: null, lastVerified: null },
  { name: "TriNet", minHeadcount: null, statesServed: null, lastVerified: null },
];

export function findPeo(name: string): PeoRecord | undefined {
  const wanted = name.trim().toLowerCase();
  return PEO_CATALOG.find((p) => p.name.toLowerCase() === wanted);
}
