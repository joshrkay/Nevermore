import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { contactName } from "@/data/accountPage";
import { listAccountTab } from "@/lib/accountPageApi";

// Which contact to merge a contact with (story CRM-S4.3a, D-210): only the other contacts of the same account are offered, since two contacts on two accounts are moved
// first or their accounts merged. The choice opens the merge dialog with the contact the person started from kept; the dialog lets them keep the other instead.

const SHOWN = 100;

export function PickContactDialog({ firmId, accountId, contact, onClose, onPicked }: {
  firmId: string;
  accountId: string;
  contact: { id: string; name: string };
  onClose: () => void;
  onPicked: (otherId: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const contacts = useQuery({ queryKey: ["merge-contact-choices", firmId, accountId], queryFn: () => listAccountTab(firmId, accountId, "contacts", { limit: SHOWN }), retry: false, gcTime: 0 });
  const others = (contacts.data?.rows ?? []).filter((c) => c.id !== contact.id);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!chosen) {
      setProblem("Choose the contact to merge with.");
      return;
    }
    onPicked(chosen);
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge {contact.name} with another contact</DialogTitle>
          <DialogDescription>Two contacts of this account that are one person. You choose which to keep, and which value to keep, on the next step.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">Merge with</legend>
            {contacts.isError ? (
              <p role="alert" className="text-sm text-destructive">{(contacts.error as Error).message}</p>
            ) : contacts.isPending ? (
              <p role="status" className="text-sm text-muted-foreground">Loading the account's contacts…</p>
            ) : contacts.data === null ? (
              <p role="status" className="text-sm text-muted-foreground">This account isn't available.</p>
            ) : others.length === 0 ? (
              <p role="status" className="text-sm text-muted-foreground">This account has no other contact to merge with. A contact of another account is moved here first.</p>
            ) : (
              <ul className="max-h-60 space-y-1 overflow-y-auto">
                {others.map((c) => (
                  <li key={c.id}>
                    <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted">
                      <input type="radio" name="merge-contact-with" value={c.id} checked={chosen === c.id} onChange={() => { setChosen(c.id); setProblem(null); }} />
                      <span>{contactName(c)}{c.email ? <span className="text-muted-foreground"> · {c.email}</span> : null}{c.isMain ? <span className="text-muted-foreground"> · Main contact</span> : null}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {contacts.data && contacts.data.count > SHOWN && <p className="text-xs text-muted-foreground">Showing the first {SHOWN} of {contacts.data.count} contacts.</p>}
          </fieldset>
          {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={others.length === 0}>Continue</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
