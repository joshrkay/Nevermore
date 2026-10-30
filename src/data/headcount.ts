import type { ChamberData } from "./chamberTypes";
import { isW2 } from "./census";

/** Stated headcount, falling back to the W-2 employees on the census. 0 when neither is known. */
export function headcount(data: ChamberData): number {
  return data.employee_count ?? data.census.filter(isW2).length;
}
