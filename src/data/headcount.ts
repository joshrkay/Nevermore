import type { ChamberData } from "./chamberTypes";

/** Stated headcount, falling back to the W-2 employees on the census. 0 when neither is known. */
export function headcount(data: ChamberData): number {
  return data.employee_count ?? data.employees.filter((e) => e.classification === "W2").length;
}
