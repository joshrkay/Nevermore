import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActivityError, addToNote, type ActivityItem } from "@/lib/activityApi";

/** "Add to note" (D-200): a note a day old is fixed, and this appends a dated addition to it, under the person's name. Anyone who may see the note can. */
export function AddToNoteDialog({ firmId, note, onClose, onSaved }: { firmId: string; note: ActivityItem; onClose: () => void; onSaved: (note: ActivityItem) => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setProblem(null);
    try {
      onSaved(await addToNote(firmId, note.id, text));
    } catch (err) {
      setProblem(err instanceof ActivityError ? err.message : "Couldn't save that. Check your connection and try again.");
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add to note</DialogTitle>
          <DialogDescription>It is added below the note, with today's date and your name. The note itself stays as it was.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          <blockquote className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{note.body}</blockquote>
          <div className="space-y-1.5">
            <Label htmlFor="note-addition">What to add</Label>
            <Textarea id="note-addition" rows={4} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </div>
          {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
