import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactError, listMoveChoices, moveContact, type MovedContact } from "@/lib/contactApi";

// Move a contact to another account (story CRM-A2.2, D-209). The database decides who may (the contact's level, and both accounts must be seen and changeable),
// an archived account, and what a move does to an opportunity left behind; this lists the accounts the database says the contact may go to, sends the choice, and
// puts the database's own words on screen. A move that would take a call, note or task off an opportunity, or end a contact's place as an opportunity's main
// contact, is asked about first (the database refuses with a question and changes nothing) and goes ahead only when the person agrees.

const SEARCH_WAIT_MS = 250;

const plural = (n: number) => `${n} call${n === 1 ? "" : "s"}, note${n === 1 ? "" : "s"} and task${n === 1 ? "" : "s"}`;

/** What a move did, in words: where the contact went, what went with it, and an account left with no main contact. */
const movedWords = (name: string, m: MovedContact): string => {
  const along = m.activitiesMoved === 0 ? "" : m.activitiesMoved === 1 ? ", with 1 call, note or task" : `, with ${plural(m.activitiesMoved)}`;
  const main = m.wasMain ? ` ${m.from.name} has no main contact now.` : "";
  return `${name} moved to ${m.to.name}${along}.${main}`;
};

export function MoveContactDialog({ firmId, contact, onClose, onMoved }: {
  firmId: string;
  contact: { id: string; name: string };
  onClose: () => void;
  onMoved: (moved: MovedContact) => void;
}) {
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const inFlight = useRef(false);

  // What is typed narrows the list after a short wait, so each key does not ask the database.
  useEffect(() => {
    const t = setTimeout(() => setSearch(typed), SEARCH_WAIT_MS);
    return () => clearTimeout(t);
  }, [typed]);

  const choices = useQuery({ queryKey: ["move-contact", firmId, contact.id, search], queryFn: () => listMoveChoices(firmId, contact.id, search), retry: false, gcTime: 0, placeholderData: (previous) => previous });
  const rows = choices.data ?? [];

  const go = async (confirm: boolean) => {
    if (inFlight.current) return;
    if (!chosen) {
      setProblem("Choose an account.");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setProblem(null);
    try {
      const moved = await moveContact(firmId, contact.id, chosen, confirm);
      toast.success(movedWords(contact.name, moved));
      onMoved(moved);
      onClose();
    } catch (e) {
      if (e instanceof ContactError && e.kind === "confirm") setQuestion(e.message);
      else setProblem(e instanceof ContactError ? e.message : "Couldn't move the contact. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void go(false);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !inFlight.current) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Move {contact.name}</DialogTitle>
          <DialogDescription>To another account. Their calls, notes and tasks go with them.</DialogDescription>
        </DialogHeader>
        {question ? (
          <div className="space-y-4">
            <p role="alert" className="text-sm">{question}</p>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setQuestion(null)}>Don't move</Button>
              <Button type="button" disabled={saving} onClick={() => void go(true)}>{saving ? "Moving…" : "Move anyway"}</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="move-contact-find">Find an account</Label>
              <Input id="move-contact-find" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
            </div>
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-medium">Move to</legend>
              {choices.isError ? (
                <p role="alert" className="text-sm text-destructive">{(choices.error as Error).message}</p>
              ) : choices.isPending ? (
                <p role="status" className="text-sm text-muted-foreground">Loading the accounts…</p>
              ) : rows.length === 0 ? (
                <p role="status" className="text-sm text-muted-foreground">No account you can change matches.</p>
              ) : (
                <ul className="max-h-60 space-y-1 overflow-y-auto">
                  {rows.map((a) => (
                    <li key={a.id}>
                      <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted">
                        <input type="radio" name="move-contact-to" value={a.id} checked={chosen === a.id} onChange={() => { setChosen(a.id); setProblem(null); }} />
                        {a.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
            {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Moving…" : "Move contact"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
