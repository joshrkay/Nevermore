import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { sentence, type ConflictRow } from "./conflictRows";
import { OFFLINE_SAVE_REASON } from "./offline";

export interface ConflictDialogProps {
  /** What was being edited, in lower case, for "Someone else changed this partner". */
  noun: string;
  rows: ConflictRow[];
  /** The browser has no connection: Keep mine can't send anything, so it is aria-disabled and says why. */
  offline: boolean;
  onKeepMine: () => void;
  onKeepTheirs: () => void;
  /** Close the question and go back to the form with everything still typed (also Escape). Nothing is saved or dropped. */
  onKeepEditing: () => void;
  /** Where focus goes once the dialog has closed; returns true when it moved focus itself. */
  onClosed: () => boolean;
}

/**
 * "Someone else changed this {noun}" (CRM-S2.4a, D-183). Shown when a save is refused because the record moved on while the person was editing
 * (`SaveConflict`). It shows every field EITHER side changed, what each side made it and who changed it and when (the history's own words:
 * a member's email, "Nevermore", "System", never an id, D-33); a field one side left alone says "You didn't change this" or "They didn't change this".
 * The three choices are per field, not all or nothing: **Keep mine** saves the fields the person changed and keeps the other person's change on every
 * field the person left alone (starting from the version that holds it), **Keep theirs** takes their values for the fields they changed and keeps whatever
 * else the person typed, and **Keep editing** goes back with nothing changed. Nothing is overwritten or dropped without one being chosen; Escape is Keep
 * editing. A modal alert dialog: focus is trapped inside, starts on Keep editing (the one choice that changes nothing), and the title and the one line per
 * field in the description are read when it opens.
 */
export function ConflictDialog({ noun, rows, offline, onKeepMine, onKeepTheirs, onKeepEditing, onClosed }: ConflictDialogProps) {
  const theirsRows = rows.filter((r) => r.theirs !== null);
  const reasonId = "conflict-offline";
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
            Nothing has been saved yet. Keep mine saves what you changed and keeps their change to any field you left alone. Keep theirs takes their change to the fields they changed and keeps anything else you typed. Keep editing goes back to the form as it is.
            {rows.map((r) => <span key={r.field} className="block">{sentence(r)}</span>)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {theirsRows.length === 0 ? (
          <p className="text-sm">The fields are as they were when you started: the other change was undone. Keep mine saves what you typed.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">What changed, with what you made each field beside what they made it</caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-normal">Field</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Yours</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Theirs</th>
                  <th scope="col" className="py-2 font-normal">Changed by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.field} className="border-b border-border/60 align-top">
                    <th scope="row" className="py-2 pr-3 font-medium">{r.label}</th>
                    <td className="py-2 pr-3 break-words">{r.mine ?? <span className="text-muted-foreground">You didn't change this</span>}</td>
                    <td className="py-2 pr-3 break-words">{r.theirs ?? <span className="text-muted-foreground">They didn't change this</span>}</td>
                    <td className="py-2">
                      {r.who === null ? "—" : <>{r.who}<span className="block text-xs text-muted-foreground">{r.at}</span></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {offline && <p id={reasonId} className="text-xs text-muted-foreground">{OFFLINE_SAVE_REASON}</p>}
        <AlertDialogFooter>
          {/* The cancel element is where an alert dialog puts focus first, and closing it (this button or Escape) is Keep editing. The other two are plain
              buttons, so choosing one is not also a "close" that would say Keep editing. Keep mine can't send with no connection: aria-disabled, as Save is (D-143). */}
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <Button type="button" variant="secondary" onClick={onKeepTheirs}>Keep theirs</Button>
          <Button type="button" aria-disabled={offline || undefined} aria-describedby={offline ? reasonId : undefined} onClick={offline ? undefined : onKeepMine}>Keep mine</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
