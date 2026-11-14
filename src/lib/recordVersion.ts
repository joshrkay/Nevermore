import type { Json } from "@/integrations/supabase/types";

// What a save answers when the record has a version (story CRM-S2.4b; D-46). A save names the version it started from. If someone else
// changed the record meanwhile, nothing is saved and the answer says what is there now and who changed what, so a screen can show their
// change beside the person's. Every table that gets a version (accounts, contacts, leads, opportunities) answers in this one shape.

/** One field that now differs from what the person started from: its value now, and who changed it last, and when. */
export type ChangedField = {
  field: string;
  /** The value now: a JSON string, number or boolean; null when there is none. */
  value: Json | null;
  /** A member's email, "Nevermore" (who at Nevermore is never shown, D-33) or "System". Never an id. */
  who: string;
  /** When they changed it (ISO text). */
  at: string;
};

/** Someone else changed the record while the person was editing it. Nothing was saved. */
export type RecordConflict<Current> = {
  conflict: true;
  /** The version to start the next save from. */
  currentVersion: number;
  /** The current values of the fields a person can edit. */
  current: Current;
  /** Each field that differs from what the person started from, oldest field name first. Empty when the fields are back where they were. */
  changed: ChangedField[];
};

/** A save that went through: the saved record, with its new version. */
export type Saved<Row> = { conflict: false; record: Row };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads the database's answer to a save, or null when it isn't one of the two shapes. */
export function readSaveAnswer<Row, Current>(data: unknown, readCurrent: (current: Record<string, unknown>) => Current | null): Saved<Row> | RecordConflict<Current> | null {
  if (!isObject(data)) return null;
  if (data.conflict === false && isObject(data.record)) return { conflict: false, record: data.record as Row };
  if (data.conflict === true && typeof data.currentVersion === "number" && isObject(data.current) && Array.isArray(data.changed)) {
    const current = readCurrent(data.current);
    if (!current) return null;
    const changed = data.changed.filter(isObject).map((c) => ({ field: String(c.field), value: (c.value ?? null) as Json | null, who: String(c.who), at: String(c.at) }));
    return { conflict: true, currentVersion: data.currentVersion, current, changed };
  }
  return null;
}
