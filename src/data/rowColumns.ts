// The columns of each answer that is a list of rows (intake schema v3): what a row holds, in the order shown,
// with each column's label and how it is typed and read. One description, used by the workspace's table editor,
// Review, the advisor's field review and The Manuscript, so a table reads the same everywhere.
import { formatFein } from "./answerFormat";
import type { ChamberData } from "./chamberTypes";

/** How a cell is typed and shown. */
export type RowCellKind = "text" | "fein";

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
}

export const ROW_LISTS: Record<RowListField, RowList> = {
  entities: {
    title: "Legal entities",
    columns: [
      { key: "legal_name", label: "Legal name", kind: "text" },
      { key: "fein", label: "FEIN", kind: "fein", placeholder: "12-3456789" },
    ],
    max: 50,
  },
};

export const isRowListField = (field: string): field is RowListField => field in ROW_LISTS;

/** A cell as text; "—" when the row doesn't hold it. */
export function formatCell(column: RowColumn, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (column.kind === "fein" && typeof value === "string") return formatFein(value);
  return String(value);
}

/** A cell as the text its input starts from. */
export function cellInput(column: RowColumn, value: unknown): string {
  return value === null || value === undefined ? "" : formatCell(column, value);
}
