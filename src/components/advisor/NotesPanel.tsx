import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addNote, type AdvisorNote } from "@/lib/advisorApi";
import { formatDateTime } from "./format";

// Internal only: notes are readable by advisors and never shown to the prospect.
const NotesPanel = ({ sessionId, notes, onAdded }: { sessionId: string; notes: AdvisorNote[]; onAdded: () => void }) => {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await addNote(sessionId, body);
      setBody("");
      onAdded();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="notes-heading" className="border border-border rounded-xl p-5 space-y-3">
      <h2 id="notes-heading" className="font-display text-lg font-bold">Internal notes</h2>
      <p className="text-xs text-muted-foreground">Visible to advisors only.</p>
      <label htmlFor="new-note" className="sr-only">New note</label>
      <textarea
        id="new-note"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        rows={3}
        placeholder="Add a note…"
        className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
      />
      <button
        onClick={save}
        disabled={saving || !body.trim()}
        className="flex items-center gap-2 border border-border text-sm px-3 py-1.5 rounded-md hover:bg-muted disabled:opacity-50"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Add note
      </button>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="text-xs text-muted-foreground">{n.author_email ?? "Advisor"} · {formatDateTime(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default NotesPanel;
