import type { TableFields, TableFilter } from "@/lib/tableQuery";
import type { TableAddress } from "./address";
import type { FieldDefinition, FieldDefinitions, TableDefinition } from "./columns";
import { OPERATORS } from "./operators";

// What a filter, a view and a search say in plain words (story CRM-S2.2). The "nothing matches" state names what is in force with these,
// and CRM-S3.3a's filter chips need exactly the same words, so they are written once here, beside the codec and the operators:
//   a field's label, the operator's label from `OPERATORS`, then the value in words (a choice by its label, a pair with "and", a list with "or").
//   "Employees is more than 50", "Status is any of Won or Lost", "Submitted is between Oct 1, 2026 and Oct 31, 2026".
// A yes or no field reads as "Needs advisor action: yes". An operator with no value ends at its label: "Company is empty".

const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);

/** A day as the console shows it ("Nov 1, 2026"), never moved by the reader's time zone. */
const dayInWords = (day: string): string => {
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
};

/** "A", "A or B", "A, B or C". */
const joinedWithOr = (items: string[]): string => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`);

const choiceWords = (field: FieldDefinition | undefined, value: string): string => field?.choices?.find((c) => c.value === value)?.label ?? value;

/** One filter in words: "<field> <operator> <value>". A field or operator the definition does not list is named as it was written. */
export function filterInWords<K extends TableFields>(fields: FieldDefinitions<K>, filter: TableFilter<K>): string {
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
    case "numbers": return `${name} ${label} ${(value as unknown[]).join(" and ")}`;
    case "day": return `${name} ${label} ${dayInWords(String(value))}`;
    case "days": return `${name} ${label} ${(value as string[]).map(dayInWords).join(" and ")}`;
    // "in the next N days" reads with the number where the N is.
    case "count": return `${name} ${label.replace("N", String(value))}`;
    case "list": return `${name} ${label} ${joinedWithOr((value as string[]).map((v) => choiceWords(field, v)))}`;
    case "bool": return `${name} ${label} ${value === true ? "yes" : "no"}`;
  }
}

/**
 * Everything that narrows an address, one phrase each, in the order a person sees it: the view (by the tab's own label), the search in quotes, then
 * each filter. Nothing here is the sort or the page, which only change the order or the part of the same rows.
 */
export function inForceInWords<K extends TableFields, Row, Context>(table: TableDefinition<K, Row, Context>, address: TableAddress<K>): string[] {
  const view = address.view === null ? undefined : table.views.find((v) => v.id === address.view);
  return [
    ...(view ? [`View: ${view.label}`] : []),
    ...(address.search ? [`Search: “${address.search}”`] : []),
    ...address.filters.map((f) => filterInWords(table.fields, f)),
  ];
}

/** Whether the address asks a narrower question than the whole table: a view, a search or a filter. This is what separates "nothing matches" from "nothing yet". */
export const isNarrowed = <K extends TableFields>(address: TableAddress<K>): boolean => address.view !== null || address.search !== "" || address.filters.length > 0;
