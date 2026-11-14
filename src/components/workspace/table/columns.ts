import type { ReactNode } from "react";
import type { FieldKind, TableFields, TableFilter, TableSort } from "@/lib/tableQuery";

// The table frame's shapes (story CRM-S3.5a). Every workspace table (the queue now; leads, accounts, quotes, the inbox and the
// lists inside a record later) describes itself with a TableDefinition and gets its address, rows, table and pager from the frame.
// Later stories fill in the places this file leaves: sort headers (S3.2a), the filter row (S3.3a), the columns menu (S3.1a), saved
// views (S3.4a), custom fields (X3.1), selection (S3.6, Epic 3), export (S3.8a).

/** One choice a field holds: the value the database matches and the words a person reads. */
export interface FieldChoice {
  value: string;
  label: string;
}

/**
 * One field of a table: the one place its id (the key it is listed under), its words, its kind and, for a field that holds one of a
 * list of values, those values live. It mirrors what the database's own list of the table's fields knows (for the queue,
 * `queue_field_kind` and `queue_field_choices` in supabase/migrations/20261117100000_queue_query.sql): sorting, filtering, the filter
 * row and the columns menu all read it, and a column refers to a field by its id.
 */
export interface FieldDefinition<Kind extends FieldKind = FieldKind> {
  /** What the field is called on screen ("Needs advisor action", "Has new PEO mail"). */
  label: string;
  kind: Kind;
  /** The values of a choice field, when the table lists them. */
  choices?: readonly FieldChoice[];
}

/** A table's fields: its field list (`TableFields`, the kinds) with each one's words and choices. */
export type FieldDefinitions<K extends TableFields> = { readonly [F in keyof K & string]: FieldDefinition<K[F]> };

/** One column of a table. It carries no kind of its own: the field it names has one. */
export interface ColumnDefinition<Row, Field extends string = string, Context = undefined> {
  /** Kept in the database for column choices (CRM-S3.1b), so it never changes once shipped. */
  id: string;
  /** The words in the column's header. */
  header: string;
  /** What the cell shows for a row. The first column's cell is the row's header cell, so it should name the row. `context` is what the page hands the frame for cells that need more than the row (a lookup by row). */
  cell: (row: Row, context: Context) => ReactNode;
  /** The plain value of the cell, for an export (CRM-S3.8a writes it to the CSV). A column without one is left out of an export. */
  text?: (row: Row, context: Context) => string;
  /** The field the database sorts this column by, or none when the column has no sort. */
  sortField?: Field;
  /** The field the column's filter is on (CRM-S3.3a's filter row), when it has one: usually the same field. */
  filterField?: Field;
  /** The first, name column: it names the row and, from the columns menu (CRM-S3.1a) on, can never be hidden. */
  isName?: boolean;
  /** Numbers read better on the right. */
  align?: "left" | "right";
}

/**
 * A view of the table: the filters it stands for. A built-in view is written in code; from CRM-S3.4a a saved view is one too.
 * CRM-S3.4a adds a view's own `sort` here (and makes `queryFor` and `sameAddress` apply it: today a view has no sort of its own, so the
 * address's sort is the only one); CRM-S3.1a adds the view's own `columns`.
 *
 * How the table's limit of 20 filters is applied to the total: the view's filters count first and the address's take what is left
 * (`effectiveFilters`). The rows use the current view's room. A tab's count uses the room of ITS view, so a tab whose view has more
 * filters than the current one counts with fewer of the address's filters than the rows do (the last ones are left out of that tab's
 * number only when the address is already near the limit).
 */
export interface TableView<K extends TableFields> {
  /** What the address's `view` holds. */
  id: string;
  label: string;
  filters: TableFilter<K>[];
}

/**
 * Whether a part of a definition is known yet. A part that is loaded from the database (saved views, CRM-S3.4a; custom fields,
 * CRM-X3.1) is "loading" until it arrives: the address keeps what it can't judge yet exactly as written, and the rows wait. "failed"
 * means it never arrived: the table falls back to what it has, and says so when that drops something. A part that is in code
 * is always "ready".
 */
export type Readiness = "ready" | "loading" | "failed";

/**
 * Everything the frame needs to know about one table.
 *
 * Contract for a hook that builds a definition from what loads (CRM-S3.4a's saved views, CRM-X3.1's custom fields): it must return a
 * MEMOIZED definition (the address is memoized on the definition object, so a new object every render reads the address again every
 * render); it must keep the last list of views and fields while it asks again, reporting "loading" only before the first answer (or the
 * tabs blank on every refresh and the address holds what it should judge); and it reports "failed" only when there is no list to keep.
 */
export interface TableDefinition<K extends TableFields, Row, Context = undefined> {
  /** The table's name: the `workspace_table` of the database and the second part of the query's key. */
  id: string;
  /** What a row is, for the range line: "1 to 50 of 375 submissions". */
  noun: { singular: string; plural: string };
  /** The fields a filter or a sort may name. The table's own, in code; custom fields join once loaded (see `fieldsStatus`). */
  fields: FieldDefinitions<K>;
  /** Whether every field the address may name is in `fields` yet. Absent means ready. */
  fieldsStatus?: Readiness;
  columns: ColumnDefinition<Row, keyof K & string, Context>[];
  rowKey: (row: Row) => string;
  /** The views known now. */
  views: TableView<K>[];
  /** Whether every view the address may name is in `views` yet. Absent means ready. */
  viewsStatus?: Readiness;
  /** The words on the tab that is no view at all ("All statuses"). */
  allViewLabel: string;
  /**
   * The sort the table has when the address holds none, when one column shows it. `null` means the table's own order, which no single
   * column shows (the queue's: certified submissions first, newest certification first, then latest change); the header then shows no
   * sort and the sort box says `defaultSortLabel`.
   */
  defaultSort: TableSort<keyof K & string> | null;
  /** The words for the table's own order, where a sort is chosen ("Newest first"). */
  defaultSortLabel: string;
  /** Searches shorter than this (spaces left out) are not run. */
  searchMinChars: number;
  /** Old parameters mapped onto the new shape, so today's links keep working. A field an old parameter and a new filter both name is the new filter's. */
  legacy?: (params: URLSearchParams) => LegacyAddress<K> | null;
}

/** What an old address means in the new shape; anything left out is left alone. */
export interface LegacyAddress<K extends TableFields> {
  view?: string;
  filters?: TableFilter<K>[];
  sort?: TableSort<keyof K & string>;
}

/** How many rows a page holds, for every table (CRM-S3.5, D-44). The database cuts the pages; the pager only reads the numbers. */
export const TABLE_PAGE_SIZE = 50;

// The database's rules the address is read by, so what the codec lets through is what the database takes. Each is the figure in
// supabase/migrations/20261117100000_queue_query.sql, and src/lib/queueApi.test.ts reads the file and compares.
/** "A page number is 1 to 100000". A larger one is not a place. */
export const MAX_TABLE_PAGE = 100_000;
/** "A table takes at most 20 filters": the view's own filters and the address's together. */
export const TABLE_FILTER_LIMIT = 20;
/** "takes at most 200 characters" (counted in characters, not in UTF-16 units) for a text filter, a list value and the search. */
export const FILTER_TEXT_MAX = 200;
/** "Views are a list of 1 to 20": the most views one call for tab counts takes. The frame asks in batches of this many. */
export const VIEWS_PER_COUNT_CALL = 20;
/** "needs 1 to 100 values" for a list. */
export const FILTER_LIST_MAX = 100;
/** "a whole number of days, 0 to 3660". */
export const FILTER_DAYS_MAX = 3660;
