import type { ReactNode } from "react";
import type { FieldKind, TableFields, TableFilter } from "@/lib/tableQuery";

// The table frame's shapes (story CRM-S3.5a). Every workspace table (the queue now; leads, accounts, quotes, the inbox and the
// lists inside a record later) describes itself with a TableDefinition and gets its address, rows, table and pager from the frame.
// Later stories fill in the places this file leaves: sort headers (S3.2a), the filter row (S3.3a), the columns menu (S3.1a), saved
// views (S3.4a), selection (S3.6, Epic 3).

/** One column of a table. */
export interface ColumnDefinition<Row, Field extends string = string> {
  /** Kept in the database for column choices (CRM-S3.1b), so it never changes once shipped. */
  id: string;
  /** The words in the column's header. */
  header: string;
  /** What the cell shows for a row. The first column's cell is the row's header cell, so it should name the row. */
  cell: (row: Row) => ReactNode;
  /** The field the database sorts this column by, or null when the column has no sort. */
  sortField: Field | null;
  /** The first, name column: it names the row and, from the columns menu (CRM-S3.1a) on, can never be hidden. */
  isName?: boolean;
  /** The kind of value the column holds, which decides the filters it offers (CRM-S3.3a); null for a column nothing filters. */
  kind: FieldKind | null;
  /** Numbers read better on the right. */
  align?: "left" | "right";
}

/** A view the table ships with, written in code (a status tab on the queue). Its id is what the address's `view` holds. */
export interface BuiltInView<K extends TableFields> {
  id: string;
  label: string;
  filters: TableFilter<K>[];
}

/** What an old address (the queue's `status`, `action`, `waiting`, `mail`, `sort`) means in the new shape; anything left out is left alone. */
export interface LegacyAddress<K extends TableFields> {
  view?: string;
  filters?: TableFilter<K>[];
  sort?: { field: keyof K & string; direction: "asc" | "desc" };
}

/** Everything the frame needs to know about one table. */
export interface TableDefinition<K extends TableFields, Row> {
  /** The table's name: the `workspace_table` of the database and the second part of the query's key. */
  id: string;
  /** The fields a filter or a sort may name, with their kinds: the table's own list, the same as the database's. */
  fields: K;
  columns: ColumnDefinition<Row, keyof K & string>[];
  rowKey: (row: Row) => string;
  builtInViews: BuiltInView<K>[];
  /** True for a view id the table knows: a built-in view's, and from CRM-S3.4a a saved view's. Anything else is dropped from the address. */
  isView: (id: string) => boolean;
  /** Words shorter than this (spaces left out) are not searched for. */
  searchMinChars: number;
  /** Old parameters mapped onto the new shape, so today's links keep working. */
  legacy?: (params: URLSearchParams) => LegacyAddress<K> | null;
}

/** How many rows a page holds, for every table (CRM-S3.5, D-44). The database cuts the pages; the pager only reads the numbers. */
export const TABLE_PAGE_SIZE = 50;

/** Pages stop being believed here: a page number past this is garbage, not a place. */
export const MAX_PAGE = 1_000_000;
