// Payroll and headcount for each workers' comp class code in each state (K-3.2): the rating table a workers' comp
// underwriter starts from. It is worked out from the census and held nowhere, so it changes only when the census
// does and nobody can type over it. The Workers' comp tab and The Manuscript both show it.
import { isW2, type CensusEmployee } from "./census";

/** What the people with no class code on the census are totalled under. */
export const NO_CLASS_CODE = "No class code yet";

export interface ClassCodePayrollRow {
  /** The work state; "" for people whose census row names none. */
  state: string;
  /** A four-digit class code, or NO_CLASS_CODE. */
  classCode: string;
  fullTime: number;
  partTime: number;
  /** The year's pay of everyone in the row whose pay the census gives, in whole dollars. */
  payroll: number;
}

/**
 * One row per class code per state, for the employer's employees (1099 contractors are not on its payroll): states
 * in order with no state last, and within a state the coded rows in order, then the people with no class code.
 */
export function classCodePayroll(census: readonly CensusEmployee[]): ClassCodePayrollRow[] {
  const rows = new Map<string, ClassCodePayrollRow>();
  for (const e of census.filter(isW2)) {
    const classCode = e.class_code ?? NO_CLASS_CODE;
    const key = `${e.work_state}|${classCode}`;
    const row = rows.get(key) ?? { state: e.work_state, classCode, fullTime: 0, partTime: 0, payroll: 0 };
    if (e.employment_type === "part_time") row.partTime += 1;
    else row.fullTime += 1;
    row.payroll += e.annual_salary ?? 0;
    rows.set(key, row);
  }
  // No state sorts after every state, and no class code after every code.
  const compare = (a: string, b: string, last: string) => (a === b ? 0 : a === last ? 1 : b === last ? -1 : a < b ? -1 : 1);
  return [...rows.values()].sort((a, b) => compare(a.state, b.state, "") || compare(a.classCode, b.classCode, NO_CLASS_CODE));
}

/** The table's column headings and each row as text, as the tab and the packet print it. */
export const CLASS_CODE_PAYROLL_COLUMNS = ["State", "Class code", "Full time", "Part time", "Annual payroll"] as const;
export const classCodePayrollCells = (row: ClassCodePayrollRow): string[] => [
  row.state || "—", row.classCode, String(row.fullTime), String(row.partTime), `$${row.payroll.toLocaleString("en-US")}`,
];
