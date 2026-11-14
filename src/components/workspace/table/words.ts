import type { TableFields, TableFilter } from "@/lib/tableQuery";
import { formatDay } from "@/data/quoteRequests";
import type { TableAddress } from "./address";
import type { FieldDefinition, FieldDefinitions, TableDefinition } from "./columns";
import { has } from "./has";
import { OPERATORS } from "./operators";

// What a filter, a view and a search say in plain words (story CRM-S2.2). The "nothing matches" state names what is in force with these,
// and CRM-S3.3a's filter chips need exactly the same words, so they are written once here, beside the codec and the operators:
//   a field's label, the operator's label from `OPERATORS`, then the value in words (a choice by its label, a pair with "and", a list with "or").
// The words by kind and operator (a value `V`, a choice's label `C`, a field `F`):
//   text      F contains “V” | F is “V” | F is empty
//   number    F is V | F is more than V | F is less than V | F is between A and B (the smaller first, whichever way they were written)
//   date      F is on D | F is before D | F is after D | F is between D1 and D2 (earlier first) | F is in the next N days ("the next day" for 1,
//             "today" for 0) | F is in the last N days ("the last day" for 1, "today" for 0). D reads "Nov 1, 2026".
//   choice    F is C | F is not C (one value) | F is any of C1 or C2 | F is none of C1 or C2 (two or more, "C1, C2 or C3") | F is empty
//   choices   F includes C | F does not include C (one value) | F includes any of C1 or C2 | F includes none of C1 or C2 | F is empty
//   yes_no    F: yes | F: no
//   person    F is any of N1 or N2 | F is me | F is my team. A person field MUST be given a way to name people (`names`): an id is never shown.
// A value the table does not list is shown as it was written, in quotes ("Status is “zzz”"), so it is plainly a raw value and not a word of ours.

/** The words for the people of a person field: a user id to a name or an email. CRM-A1.1 gives one when records have an owner. */
export type NamePeople = (id: string) => string | undefined;

/** "A", "A or B", "A, B or C". */
const joinedWithOr = (items: string[]): string => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`);

const choiceWords = (field: FieldDefinition | undefined, value: string, names?: NamePeople): string => {
  if (field?.kind === "person") return names?.(value) ?? `“${value}”`;
  // The database ignores case in a choice, so the words do too.
  return field?.choices?.find((c) => c.value.toLowerCase() === value.toLowerCase())?.label ?? `“${value}”`;
};

/** The two ends of a pair, smaller (or earlier) first. Days are YYYY-MM-DD, so their text sorts as dates. */
const ordered = <T extends number | string>(pair: [T, T]): [T, T] => (pair[0] <= pair[1] ? pair : [pair[1], pair[0]]);

/** A count of days: "in the next 3 days", "in the next day", "today". The database reads 0 days as today alone and N as today and the N days after (or before). */
function daysInWords(op: string, n: number): string {
  if (n === 0) return "is today";
  const when = op === "in_next_days" ? "next" : "last";
  return n === 1 ? `is in the ${when} day` : `is in the ${when} ${n} days`;
}

/** One filter in words: "<field> <operator> <value>". A field or operator the definition does not list is named as it was written. */
export function filterInWords<K extends TableFields>(fields: FieldDefinitions<K>, filter: TableFilter<K>, names?: NamePeople): string {
  const f = filter as { field: string; op: string; value?: unknown };
  const field: FieldDefinition | undefined = has(fields, f.field) ? (fields as Record<string, FieldDefinition>)[f.field] : undefined;
  const name = field?.label ?? f.field;
  const operator = field && has(OPERATORS[field.kind], f.op) ? OPERATORS[field.kind][f.op] : undefined;
  const value = f.value;
  if (field?.kind === "yes_no") return `${name}: ${value === true ? "yes" : value === false ? "no" : String(value)}`;
  const label = operator?.label ?? f.op;
  if (!operator || operator.shape === "none" || value === undefined || value === null) return `${name} ${label}`;
  switch (operator.shape) {
    case "text": return `${name} ${label} “${String(value)}”`;
    case "number": return `${name} ${label} ${String(value)}`;
    case "numbers": return `${name} ${label} ${ordered(value as [number, number]).join(" and ")}`;
    case "day": return `${name} ${label} ${formatDay(String(value))}`;
    case "days": return `${name} ${label} ${ordered(value as [string, string]).map(formatDay).join(" and ")}`;
    case "count": return `${name} ${daysInWords(f.op, Number(value))}`;
    case "list": {
      const items = (value as string[]).map((v) => choiceWords(field, v, names));
      if (items.length === 1 && field) {
        // One value reads as a plain statement, not a list of one.
        if (field.kind === "choice") return `${name} ${f.op === "none_of" ? "is not" : "is"} ${items[0]}`;
        if (field.kind === "choices") return `${name} ${f.op === "none_of" ? "does not include" : "includes"} ${items[0]}`;
      }
      return `${name} ${label} ${joinedWithOr(items)}`;
    }
    case "bool": return `${name} ${label} ${value === true ? "yes" : "no"}`;
  }
}

/**
 * Everything that narrows an address, one phrase each, in the order a person sees it: the view (by the tab's own label), the search in quotes, then
 * each filter. Nothing here is the sort or the page, which only change the order or the part of the same rows.
 */
export function inForceInWords<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, address: TableAddress<K>, names?: NamePeople): string[] {
  const view = address.view === null ? undefined : table.views.find((v) => v.id === address.view);
  return [
    ...(view ? [`View: ${view.label}`] : []),
    ...(address.search ? [`Search: “${address.search}”`] : []),
    ...address.filters.map((f) => filterInWords(table.fields, f, names)),
  ];
}

/** Whether the address asks a narrower question than the whole table: a view, a search or a filter. This is what separates "nothing matches" from "nothing yet". */
export const isNarrowed = <K extends TableFields>(address: TableAddress<K>): boolean => address.view !== null || address.search !== "" || address.filters.length > 0;
