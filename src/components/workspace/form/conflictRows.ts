import type { ChangedField } from "@/lib/recordVersion";

/** How one editable field is named and shown in the comparison. `format` turns the stored value into the words the form shows (a kind's code into its label). */
export interface ConflictField {
  label: string;
  format?: (value: unknown) => string;
}

/**
 * One field either side changed, ready to show. `mine` and `theirs` are the words of each side's NEW value, or null when that side left the field
 * alone; `started` is what the field was when the person started, so "you left it as …" is true.
 */
export interface ConflictRow {
  field: string;
  label: string;
  started: string;
  mine: string | null;
  theirs: string | null;
  who: string | null;
  at: string | null;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** A label for a field the page did not name: its id in words, never the id itself ("referral_code" is "Referral code"). */
export const humanise = (field: string): string => {
  const words = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_\-.]+/g, " ").trim().toLowerCase();
  return words === "" ? "Another field" : words[0].toUpperCase() + words.slice(1);
};

const shown = (field: ConflictField | undefined, value: unknown): string => {
  if (value === null || value === undefined || value === "") return "Nothing";
  return field?.format ? field.format(value) : String(value);
};

/** "Nov 14, 2026, 12:00 PM" in the person's own time; the database's text if it is not a date. */
const when = (at: string): string => {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? at : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
};

/**
 * Which fields to show and what each side did to them. A field is shown when EITHER side changed it: the other person's (the database's `changed`),
 * and the person's own (what they typed differs from what they started from). Everything else is left out, because nothing about it is in question.
 * `started` is the form's values when the edit began, `mine` what was typed, `theirs` the record's values now (already in the form's own field names).
 */
export function conflictRows(
  fields: Record<string, ConflictField | undefined>,
  started: Record<string, unknown>,
  mine: Record<string, unknown>,
  theirs: Record<string, unknown>,
  changed: ChangedField[],
): ConflictRow[] {
  const theirChange = new Map(changed.map((c) => [c.field, c]));
  const names = [...theirChange.keys(), ...Object.keys(mine).filter((f) => !theirChange.has(f) && !same(mine[f], started[f]))];
  return names.map((field) => {
    const f = fields[field];
    const them = theirChange.get(field);
    const iChanged = !same(mine[field], started[field]);
    return {
      field,
      label: f?.label ?? humanise(field),
      started: shown(f, started[field]),
      mine: iChanged ? shown(f, mine[field]) : null,
      theirs: them ? shown(f, field in theirs ? theirs[field] : them.value) : null,
      who: them?.who ?? null,
      at: them ? when(them.at) : null,
    };
  });
}

/** One line of what happened to a field, for the dialog's description, so a screen reader hears the comparison the table shows. */
export const sentence = (r: ConflictRow): string => {
  if (r.mine !== null && r.theirs !== null) return `${r.label}: you changed it to ${r.mine}; ${r.who} changed it to ${r.theirs}.`;
  if (r.theirs !== null) return `${r.label}: you left it as ${r.started}; ${r.who} changed it to ${r.theirs}.`;
  return `${r.label}: you changed it to ${r.mine}; nobody else changed it.`;
};
