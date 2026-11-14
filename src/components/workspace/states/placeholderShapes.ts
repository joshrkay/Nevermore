import type { TableFields } from "@/lib/tableQuery";
import type { ColumnDefinition, TableDefinition } from "../table/columns";
import type { PlaceholderWidth } from "./Placeholder";

/** How many grey rows a table shows while its first rows are on the way. */
export const PLACEHOLDER_ROWS = 8;

/** What a grey cell needs to know about its column. A plain table (not on the table frame) gives a list of these. */
export interface PlaceholderColumn {
  id: string;
  align?: "left" | "right";
  width?: PlaceholderWidth;
  /** How many lines the real cell usually has (the second is shorter); default one. */
  lines?: 1 | 2;
}

/** A column's grey bar by the kind of field it shows; the name column (the first) is the widest. */
function widthOf<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, column: ColumnDefinition<Row, keyof K & string, Context>, first: boolean): PlaceholderWidth {
  if (column.isName || first) return "name";
  const field = column.sortField ?? column.filterField;
  switch (field ? table.fields[field]?.kind : undefined) {
    case "number": return "number";
    case "date": return "date";
    case "choice":
    case "choices":
    case "yes_no": return "badge";
    case "person": return "person";
    default: return "text";
  }
}

/** The grey cells of a definition's columns (or of the list of columns the page draws, once a person can choose them, CRM-S3.1a). */
export function placeholderColumns<K extends TableFields, Row, Context>(
  table: TableDefinition<K, Row, Context>,
  columns: ColumnDefinition<Row, keyof K & string, Context>[] = table.columns,
): PlaceholderColumn[] {
  return columns.map((column, i) => ({ id: column.id, align: column.align, width: widthOf(table, column, i === 0) }));
}
