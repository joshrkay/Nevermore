import type { FieldKind } from "@/lib/tableQuery";

// The operators of each kind of field, in one place beside the codec (CRM-S3.5a): which a kind takes, the shape of the value each takes,
// and its words. The codec reads an address by it, and CRM-S3.3a's filter row offers the same list ("Add filter" lists a field's kind's
// operators with these labels). They are the operators `src/lib/tableQuery.ts` types and the database's `workspace_filter_check` takes.

/** What an operator's value looks like, which is how the codec reads it and how a filter row asks for it. */
export type OperatorShape =
  /** No value (`is_empty`, `me`, `my_team`). */
  | "none"
  | "text"
  | "number"
  /** Two numbers, either way round. */
  | "numbers"
  /** A day, YYYY-MM-DD. */
  | "day"
  /** Two days, either way round. */
  | "days"
  /** A whole number of days, 0 to 3660. */
  | "count"
  /** One to 100 values. */
  | "list"
  | "bool";

export interface OperatorDefinition {
  shape: OperatorShape;
  /** What a person reads in the filter row, after the field's name: "Employees is more than 50". */
  label: string;
}

/** The operators each kind of field takes, by operator name. */
export const OPERATORS: Readonly<Record<FieldKind, Readonly<Record<string, OperatorDefinition>>>> = {
  text: {
    contains: { shape: "text", label: "contains" },
    is: { shape: "text", label: "is" },
    is_empty: { shape: "none", label: "is empty" },
  },
  number: {
    is: { shape: "number", label: "is" },
    more_than: { shape: "number", label: "is more than" },
    less_than: { shape: "number", label: "is less than" },
    between: { shape: "numbers", label: "is between" },
  },
  date: {
    on: { shape: "day", label: "is on" },
    before: { shape: "day", label: "is before" },
    after: { shape: "day", label: "is after" },
    between: { shape: "days", label: "is between" },
    in_next_days: { shape: "count", label: "is in the next N days" },
    in_last_days: { shape: "count", label: "is in the last N days" },
  },
  choice: {
    any_of: { shape: "list", label: "is any of" },
    none_of: { shape: "list", label: "is none of" },
    is_empty: { shape: "none", label: "is empty" },
  },
  choices: {
    any_of: { shape: "list", label: "includes any of" },
    none_of: { shape: "list", label: "includes none of" },
    is_empty: { shape: "none", label: "is empty" },
  },
  yes_no: {
    is: { shape: "bool", label: "is" },
  },
  person: {
    any_of: { shape: "list", label: "is any of" },
    me: { shape: "none", label: "is me" },
    my_team: { shape: "none", label: "is my team" },
  },
};
