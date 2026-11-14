import { z } from "zod";
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

const changedFieldSchema = z.object({
  field: z.string().min(1),
  value: z.any().refine((v) => v !== undefined, "a value, or null"),
  who: z.string().min(1),
  at: z.string().min(1),
});

/**
 * Reads the database's answer to a save, checking every part of it. `row` describes the saved record (it must carry its new `version`) and
 * `current` the editable fields of a conflict. An answer that is not exactly one of the two shapes (a missing or malformed part included) is
 * null: the caller treats it as a failed save, never as a success and never as an empty conflict.
 */
export function readSaveAnswer<Row extends { version: number }, Current>(
  data: unknown,
  row: z.ZodType<Row>,
  current: z.ZodType<Current>,
): Saved<Row> | RecordConflict<Current> | null {
  const saved = z.object({ conflict: z.literal(false), record: row.and(z.object({ version: z.number().int().min(1) })) }).safeParse(data);
  if (saved.success) return { conflict: false, record: saved.data.record };
  const conflict = z
    .object({ conflict: z.literal(true), currentVersion: z.number().int().min(1), current, changed: z.array(changedFieldSchema) })
    .safeParse(data);
  if (conflict.success) {
    const { currentVersion, current: values, changed } = conflict.data;
    return { conflict: true, currentVersion, current: values, changed: changed as ChangedField[] };
  }
  return null;
}
