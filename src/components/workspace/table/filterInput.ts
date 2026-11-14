import type { TableFields, TableFilter } from "@/lib/tableQuery";
import { escapeText, readValue } from "./address";
import { FILTER_DAYS_MAX, FILTER_LIST_MAX, FILTER_TEXT_MAX, type FieldDefinition } from "./columns";
import { OPERATORS, type OperatorDefinition } from "./operators";

// What the filter row's editor holds while a person types, and how it becomes a filter (story CRM-S3.3a). The editor is driven by the field's kind and
// `OPERATORS`, so it offers exactly the operators the codec and the database take; what is typed is judged by the codec's own `readValue` and the limits
// in columns.ts (200 characters, 100 list values, 0 to 3660 days), so the editor cannot take a value the address would drop or the database refuse for its shape.

/** Everything the editor's fields hold, as text, whatever the operator: only the parts its shape uses are read. */
export interface FilterForm {
  op: string;
  /** The text, the number, the day, the count of days, or the first end of a pair. */
  first: string;
  /** The second end of a pair. */
  second: string;
  /** The chosen values of a list. */
  list: string[];
  /** A yes-or-no filter's answer. */
  yes: "true" | "false";
}

export type FilterFormField = "first" | "second" | "list";

/** The operators the editor offers for a field, in the codec's order. A person's "is any of" needs people to choose from, which a table gives with `choices` (CRM-A1.1); until then only "me" and "my team" are offered. */
export function operatorsFor(field: FieldDefinition): [string, OperatorDefinition][] {
  return Object.entries(OPERATORS[field.kind]).filter(([op]) => !(field.kind === "person" && op === "any_of" && !field.choices?.length));
}

/** Whether a list is chosen from the field's listed values, or typed (a field whose values the table does not list). */
export const choosesFromList = (field: FieldDefinition): boolean => !!field.choices?.length;

/** The editor's starting values: those of the filter being changed, or the field's first operator for a new one. */
export function formFor(field: FieldDefinition, filter?: { op: string; value?: unknown }): FilterForm {
  const ops = operatorsFor(field);
  const blank: FilterForm = { op: ops[0]?.[0] ?? "", first: "", second: "", list: [], yes: "true" };
  if (!filter || !OPERATORS[field.kind][filter.op]) return blank;
  const form = { ...blank, op: filter.op };
  const value = filter.value;
  switch (OPERATORS[field.kind][filter.op].shape) {
    case "text": case "number": case "day": case "count": form.first = String(value ?? ""); break;
    case "numbers": case "days": { const [a, b] = (value as [unknown, unknown]) ?? []; form.first = String(a ?? ""); form.second = String(b ?? ""); break; }
    case "list": form.list = [...((value as string[]) ?? [])]; if (!choosesFromList(field)) form.first = form.list.map((v) => v.replace(/[\\,]/g, (c) => `\\${c}`)).join(", "); break;
    case "bool": form.yes = value === false ? "false" : "true"; break;
  }
  return form;
}

type Result<K extends TableFields> = { filter: TableFilter<K> } | { errors: Partial<Record<FilterFormField, string>> };

const length = (s: string) => Array.from(s).length;
/** A typed list: values separated by commas, where a backslash keeps a comma (or a backslash) inside its value ("a\\,b, c" is "a,b" and "c"). */
const typedList = (text: string): string[] => {
  const values: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\" && i + 1 < text.length && /[\\,]/.test(text[i + 1])) { current += text[i + 1]; i++; }
    else if (text[i] === ",") { values.push(current); current = ""; }
    else current += text[i];
  }
  values.push(current);
  return values.map((v) => v.trim()).filter((v) => v !== "");
};

/**
 * The filter these values make, or what is wrong under which field, in plain words. Nothing is applied until this returns a filter. A pair may be
 * written either way round (the database takes both); a list needs at least one value and at most 100.
 */
export function filterFromForm<K extends TableFields>(fieldId: string, field: FieldDefinition, form: FilterForm): Result<K> {
  const definition = OPERATORS[field.kind][form.op];
  if (!definition) return { errors: { first: "Choose a condition." } };
  const errors: Partial<Record<FilterFormField, string>> = {};
  const done = (value: unknown): Result<K> =>
    ({ filter: (value === null ? { field: fieldId, op: form.op } : { field: fieldId, op: form.op, value }) as unknown as TableFilter<K> });
  const shape = definition.shape;
  if (shape === "none") return done(null);
  if (shape === "bool") return done(form.yes === "true");

  let raw: string;
  switch (shape) {
    case "text": {
      const text = form.first.trim();
      if (text === "") errors.first = "Enter some text.";
      else if (length(text) > FILTER_TEXT_MAX) errors.first = `Use ${FILTER_TEXT_MAX} characters or fewer.`;
      raw = escapeText(form.first);
      break;
    }
    case "number": case "numbers": {
      const bad = (s: string) => s.trim() === "" || !Number.isFinite(Number(s));
      if (bad(form.first)) errors.first = shape === "numbers" ? "Enter a number for one end." : "Enter a number.";
      if (shape === "numbers" && bad(form.second)) errors.second = "Enter a number for the other end.";
      raw = shape === "numbers" ? `${form.first},${form.second}` : form.first;
      break;
    }
    case "day": case "days": {
      const bad = (s: string) => readValue("day", s) === undefined;
      if (bad(form.first)) errors.first = form.first.trim() === "" ? (shape === "days" ? "Choose a day for one end." : "Choose a day.") : "Enter a real day, like 2026-11-30.";
      if (shape === "days" && bad(form.second)) errors.second = form.second.trim() === "" ? "Choose a day for the other end." : "Enter a real day, like 2026-11-30.";
      raw = shape === "days" ? `${form.first},${form.second}` : form.first;
      break;
    }
    case "count": {
      if (form.first.trim() === "") errors.first = "Enter a number of days.";
      else if (readValue("count", form.first) === undefined) errors.first = `Enter a whole number of days from 0 to ${FILTER_DAYS_MAX}.`;
      raw = form.first;
      break;
    }
    case "list": {
      const values = choosesFromList(field) ? form.list : typedList(form.first);
      const where: FilterFormField = choosesFromList(field) ? "list" : "first";
      if (values.length === 0) errors[where] = choosesFromList(field) ? "Choose at least one." : "Enter at least one value.";
      else if (values.length > FILTER_LIST_MAX) errors[where] = `Use ${FILTER_LIST_MAX} values or fewer.`;
      else if (values.some((v) => length(v) > FILTER_TEXT_MAX)) errors[where] = `Use ${FILTER_TEXT_MAX} characters or fewer in each value.`;
      raw = values.map(escapeText).join(",");
      break;
    }
  }
  if (Object.keys(errors).length > 0) return { errors };
  // The codec's own reading has the last word, so what is applied is what the address would keep.
  const value = readValue(shape, raw);
  if (value === undefined) return { errors: { first: "That value can't be used." } };
  return done(value);
}
