import type { ReactNode } from "react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ChangedField } from "@/lib/recordVersion";

/** How one editable field is named and shown in the comparison. `format` turns the stored value into the words the form shows (a kind's code into its label). */
export interface ConflictField {
  label: string;
  format?: (value: unknown) => string;
}

export interface ConflictDialogProps {
  /** What was being edited, in lower case, for "Someone else changed this partner". */
  noun: string;
  fields: Record<string, ConflictField>;
  /** What the person typed, by field (the values the refused save carried). */
  mine: Record<string, unknown>;
  /** Each field that differs now, from the database's answer (`RecordConflict.changed`). */
  changed: ChangedField[];
  onKeepMine: () => void;
  onKeepTheirs: () => void;
  /** Close the question and go back to the form with everything still typed (also Escape). Nothing is saved or dropped. */
  onKeepEditing: () => void;
  /** Where focus goes once the dialog has closed; it returns true when it moved focus itself. */
  onClosed: () => boolean;
}

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
 * "Someone else changed this {noun}" (CRM-S2.4a, D-181). Shown when a save is refused because the record moved on while the person was editing
 * (`SaveConflict`). It sets what the person typed beside what is there now, field by field, with who changed it and when (the history's own words:
 * a member's email, "Nevermore", "System", never an id, D-33), and offers the three things that can be done: Keep mine (save again over their change,
 * starting from the version that holds it), Keep theirs (put their values in the form and drop what was typed, which the table has just shown), and
 * Keep editing (go back, nothing changed). Nothing is overwritten and nothing is dropped without one of those being chosen: the buttons name it,
 * a line says what each does, and Escape, the way out with no button, is Keep editing. Focus starts on Keep editing, the one choice that changes
 * nothing, and is trapped inside (a modal alert dialog). It is announced once, as it opens (an alert dialog is named and described on opening).
 */
export function ConflictDialog({ noun, fields, mine, changed, onKeepMine, onKeepTheirs, onKeepEditing, onClosed }: ConflictDialogProps): ReactNode {
  return (
    <AlertDialog open onOpenChange={(next) => { if (!next) onKeepEditing(); }}>
      <AlertDialogContent
        className="max-w-2xl"
        onCloseAutoFocus={(e) => {
          if (onClosed()) e.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Someone else changed this {noun}</AlertDialogTitle>
          <AlertDialogDescription>
            Nothing has been saved yet. Keep mine saves what you typed over their change. Keep theirs puts their version in the form and drops what you typed. Keep editing goes back to the form as it is.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {changed.length === 0 ? (
          <p className="text-sm">The fields are as they were when you started: the other change was undone. Keep mine saves what you typed.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">What changed, with what you typed beside what is there now</caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-normal">Field</th>
                  <th scope="col" className="py-2 pr-3 font-normal">What you typed</th>
                  <th scope="col" className="py-2 pr-3 font-normal">What is there now</th>
                  <th scope="col" className="py-2 font-normal">Changed by</th>
                </tr>
              </thead>
              <tbody>
                {changed.map((c) => (
                  <tr key={c.field} className="border-b border-border/60 align-top">
                    <th scope="row" className="py-2 pr-3 font-medium">{fields[c.field]?.label ?? c.field}</th>
                    <td className="py-2 pr-3 break-words">{shown(fields[c.field], mine[c.field])}</td>
                    <td className="py-2 pr-3 break-words">{shown(fields[c.field], c.value)}</td>
                    <td className="py-2">{c.who}<span className="block text-xs text-muted-foreground">{when(c.at)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AlertDialogFooter>
          {/* The cancel element is where an alert dialog puts focus first, and closing it (this button or Escape) is Keep editing. The other two are plain
              buttons, so choosing one is not also a "close" that would say Keep editing. */}
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <Button type="button" variant="secondary" onClick={onKeepTheirs}>Keep theirs</Button>
          <Button type="button" onClick={onKeepMine}>Keep mine</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
