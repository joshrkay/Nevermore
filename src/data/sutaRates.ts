// The employer's unemployment tax rate in each state of operation (K-4.2): which states those are, and which of
// them have no rate yet. A state with no rate is one open item, never a blocker.
import type { ChamberData } from "./chamberTypes";

/**
 * The states the employer operates in: the ones it listed, then any others its employees work in, each once. A
 * state where only 1099 contractors work is not one: unemployment tax is owed where there are employees.
 */
export function statesOfOperation(data: Pick<ChamberData, "states" | "census">): string[] {
  const employees = data.census.filter((e) => e.classification !== "1099");
  return [...new Set([...data.states, ...employees.map((e) => e.work_state)].filter(Boolean))];
}

/** The states of operation with no unemployment tax rate held. A state listed with no rate has none. */
export function statesWithoutRate(data: Pick<ChamberData, "states" | "census" | "suta_rates">): string[] {
  const rated = new Set(data.suta_rates.filter((r) => r.rate !== undefined).map((r) => r.state));
  return statesOfOperation(data).filter((state) => !rated.has(state));
}

/** What to tell the prospect to do about a state with no rate. */
export const SUTA_RATE_HINT = "Add it on the Payroll tab, or upload the state's rate notice. You can certify without it.";
