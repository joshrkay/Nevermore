// The columns of each answer that is a list of rows (intake schema v3): what a row holds, in the order shown,
// with each column's label and how it is typed and read. One description, used by the workspace's table editor,
// Review, the advisor's field review and The Manuscript, so a table reads the same everywhere.
import { formatFein } from "./answerFormat";
import type { ChamberData } from "./chamberTypes";

/** How a cell is typed and shown. */
export type RowCellKind = "text" | "fein" | "percent" | "boolean";

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
};

export const isRowListField = (field: string): field is RowListField => field in ROW_LISTS;

/** A cell as text; "—" when the row doesn't hold it. */
export function formatCell(column: RowColumn, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (column.kind === "fein" && typeof value === "string") return formatFein(value);
  if (column.kind === "percent") return `${value}%`;
  if (column.kind === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** A cell as the text its input starts from. */
export function cellInput(column: RowColumn, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (column.kind === "boolean") return value ? "yes" : "no";
  if (column.kind === "percent") return String(value);
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
      if (out.length < max) out.push({ ...row });
      continue;
    }
    for (const [column, value] of Object.entries(row)) {
      if (column === key) continue;
      if (out[at][column] === undefined || overwrite) out[at][column] = value;
    }
  }
  return out as R[];
}
