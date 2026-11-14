/**
 * The shapes every workspace table's query takes (D-44): a filter, a sort and a page of results. The database checks and
 * runs them (workspace_filter_check and the matchers in supabase/migrations/20261117100000_queue_query.sql); these types
 * only describe what it takes. Each table lists its fields with their kinds, and gets filters typed by them:
 *
 *   const FIELDS = { name: "text", employees: "number" } as const satisfies TableFields;
 *   type Filter = TableFilter<typeof FIELDS>;   // { field: "employees"; op: "more_than"; value: 50 } ...
 */

/** What kind of value a field holds, which decides the operators a filter on it may use (CRM-S3.3). */
export type FieldKind = "text" | "number" | "date" | "choice" | "choices" | "yes_no" | "person";

/** A table's filterable and sortable fields, by name, with the kind of each. */
export type TableFields = Readonly<Record<string, FieldKind>>;

/** A day, written YYYY-MM-DD. A moment is compared as the day it falls on in the caller's time zone. */
export type Day = string;

/** The filters a field of each kind takes. Text and choices ignore case; ends of a between may come in either order. */
export interface FiltersByKind<F extends string> {
  text: { field: F; op: "contains" | "is"; value: string } | { field: F; op: "is_empty" };
  number: { field: F; op: "is" | "more_than" | "less_than"; value: number } | { field: F; op: "between"; value: [number, number] };
  date:
    | { field: F; op: "on" | "before" | "after"; value: Day }
    | { field: F; op: "between"; value: [Day, Day] }
    /** 0 is today; at most 3660. */
    | { field: F; op: "in_next_days" | "in_last_days"; value: number };
  /** One value: any_of keeps the rows whose value is in the list (1 to 100 values); none_of keeps empty ones too. */
  choice: { field: F; op: "any_of" | "none_of"; value: string[] } | { field: F; op: "is_empty" };
  /** Several values: any_of keeps the rows holding any of them; none_of the rows holding none, empty ones included. */
  choices: { field: F; op: "any_of" | "none_of"; value: string[] } | { field: F; op: "is_empty" };
  yes_no: { field: F; op: "is"; value: boolean };
  /** The database refuses these until records have an owner (CRM-A1.1). */
  person: { field: F; op: "any_of"; value: string[] } | { field: F; op: "me" | "my_team" };
}

/** One filter on one of a table's fields; a table's filters combine with "and" (at most 20). */
export type TableFilter<K extends TableFields> = {
  [F in keyof K & string]: FiltersByKind<F>[K[F]];
}[keyof K & string];

export type SortDirection = "asc" | "desc";

/** One column at a time (CRM-S3.2). Empty values sort last whichever way. */
export interface TableSort<F extends string> {
  field: F;
  direction: SortDirection;
}

/** One page of a table: its rows, how many match in all, which page (from 1) and how many a page holds (50). */
export interface TablePage<Row> {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
}

/** The count for one named view's tab (CRM-S3.4). */
export interface ViewCount {
  name: string;
  total: number;
}
