// The columns of each answer that is a list of rows (intake schema v3): what a row holds, in the order shown,
// with each column's label and how it is typed and read. One description, used by the workspace's table editor,
// Review, the advisor's field review and The Manuscript, so a table reads the same everywhere.
import { formatFein } from "./answerFormat";
import type { ChamberData } from "./chamberTypes";

/** How a cell is typed and shown. */
export type RowCellKind = "text" | "fein" | "percent" | "boolean" | "year" | "dollars" | "decimal" | "count" | "money" | "state";

export interface RowColumn {
  key: string;
  label: string;
  kind: RowCellKind;
  /** A hint shown in the empty input. */
  placeholder?: string;
}

/** The answers that are lists of rows. */
export type RowListField = { [K in keyof ChamberData]: ChamberData[K] extends object[] ? (K extends "census" ? never : K) : never }[keyof ChamberData];

export interface RowList {
  /** What the table is called. */
  title: string;
  /** What one row is, for "Add a …". */
  columns: readonly RowColumn[];
  max: number;
  /** The column that says which row is which (a person's name, a policy year): rows heard later are matched by it. */
  key: string;
}

export const ROW_LISTS: Record<RowListField, RowList> = {
  entities: {
    title: "Legal entities",
    columns: [
      { key: "legal_name", label: "Legal name", kind: "text" },
      { key: "fein", label: "FEIN", kind: "fein", placeholder: "12-3456789" },
    ],
    max: 50,
    key: "legal_name",
  },
  owners_officers: {
    title: "Owners and officers",
    columns: [
      { key: "name", label: "Name", kind: "text" },
      { key: "title", label: "Title", kind: "text" },
      { key: "ownership_percent", label: "Ownership %", kind: "percent" },
      { key: "duties", label: "Duties", kind: "text" },
      { key: "covered", label: "Covered by workers' comp", kind: "boolean" },
    ],
    max: 20,
    key: "name",
  },
  loss_history: {
    title: "Loss history",
    columns: [
      { key: "policy_year", label: "Policy year", kind: "year", placeholder: "2025" },
      { key: "carrier", label: "Carrier", kind: "text" },
      { key: "premium", label: "Premium", kind: "dollars" },
      { key: "experience_mod", label: "Experience mod", kind: "decimal", placeholder: "0.92" },
      { key: "claims", label: "Claims", kind: "count", placeholder: "0 for none" },
      { key: "paid", label: "Paid", kind: "dollars" },
      { key: "reserved", label: "Reserved", kind: "dollars" },
      { key: "valuation_date", label: "Valued as of", kind: "text" },
      { key: "no_coverage", label: "No coverage", kind: "boolean" },
    ],
    max: 5,
    key: "policy_year",
  },
  medical_plans: {
    title: "Current medical plans",
    columns: [
      { key: "name", label: "Plan", kind: "text" },
      { key: "carrier", label: "Carrier", kind: "text" },
      { key: "rate_ee", label: "EE", kind: "money", placeholder: "per month" },
      { key: "rate_ee_sp", label: "EE + spouse", kind: "money" },
      { key: "rate_ee_ch", label: "EE + child(ren)", kind: "money" },
      { key: "rate_fam", label: "Family", kind: "money" },
      { key: "renewal_rate_ee", label: "Renewal EE", kind: "money" },
      { key: "renewal_rate_ee_sp", label: "Renewal EE + spouse", kind: "money" },
      { key: "renewal_rate_ee_ch", label: "Renewal EE + child(ren)", kind: "money" },
      { key: "renewal_rate_fam", label: "Renewal family", kind: "money" },
      { key: "employer_contribution", label: "Employer contribution", kind: "text" },
      { key: "enrolled", label: "Enrolled", kind: "count" },
    ],
    max: 20,
    key: "name",
  },
  suta_rates: {
    title: "State unemployment tax rates",
    columns: [
      { key: "state", label: "State", kind: "state", placeholder: "CA" },
      { key: "rate", label: "Rate %", kind: "percent", placeholder: "3.4" },
      { key: "year", label: "Effective year", kind: "year", placeholder: "2026" },
    ],
    max: 60,
    key: "state",
  },
};

export const isRowListField = (field: string): field is RowListField => field in ROW_LISTS;

/** A cell as text; "—" when the row doesn't hold it. */
export function formatCell(column: RowColumn, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (column.kind === "fein" && typeof value === "string") return formatFein(value);
  if (column.kind === "percent") return `${value}%`;
  if (column.kind === "dollars" && typeof value === "number") return `$${value.toLocaleString("en-US")}`;
  if (column.kind === "money" && typeof value === "number") return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (column.kind === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** A cell as the text its input starts from. */
export function cellInput(column: RowColumn, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (column.kind === "boolean") return value ? "yes" : "no";
  if (column.kind === "percent" || column.kind === "dollars" || column.kind === "money") return String(value);
  return formatCell(column, value);
}

type Row = Record<string, unknown>;
const sameKey = (a: unknown, b: unknown) =>
  a !== undefined && b !== undefined && (typeof a === "string" && typeof b === "string" ? a.trim().toLowerCase() === b.trim().toLowerCase() : a === b);

/**
 * A table with more rows merged in: a row for something already listed (matched by the list's key column)
 * fills in what that row was missing, and changes what it held only when `overwrite` says the new rows come
 * from a better source; a row for something new is added at the end, up to the list's cap.
 */
export function mergeRows<R extends object>(field: RowListField, held: readonly R[], incoming: readonly R[], overwrite = false): R[] {
  const { key, max } = ROW_LISTS[field];
  const out: Row[] = held.map((row) => ({ ...(row as Row) }));
  for (const row of incoming as readonly Row[]) {
    const at = out.findIndex((existing) => sameKey(existing[key], row[key]));
    if (at === -1) {
      // A row with no key can't be matched, so the same row heard twice is recognised by being identical.
      const listed = row[key] === undefined && out.some((existing) => JSON.stringify(existing) === JSON.stringify(row));
      if (!listed && out.length < max) out.push({ ...row });
      continue;
    }
    for (const [column, value] of Object.entries(row)) {
      if (column === key) continue;
      if (out[at][column] === undefined || overwrite) out[at][column] = value;
    }
  }
  return out as R[];
}
