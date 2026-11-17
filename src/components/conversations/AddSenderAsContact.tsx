import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { personNameParts } from "@/data/leadPage";
import { ContactError } from "@/lib/contactApi";
import { addSenderAsContact } from "@/lib/conversationApi";

const FALLBACK = "Couldn't add the contact. Check your connection and try again.";

/** The message a new sender wrote: its id, the address it came from (the one the contact is made with) and the name the mail gave, if any. */
export interface NewSenderMessage {
  id: string;
  from: string;
  fromName: string | null;
}

/**
 * A new sender offered as a contact on the account (story CRM-E1.3, slice 6.4: "a sender not seen before is marked new and offered as a contact on that
 * account"). Drawn on a received message the database says to offer (`offerContact`: a new sender on a contact's conversation who is no contact of that
 * account yet; never on a lead's). Adding goes through add_sender_as_contact, which adds the message's own From address through add_contact and every one of
 * its rules, so the address is shown here and not asked for, and the database's refusals are said in its words.
 */
export function AddSenderAsContact({ firmId, message, onAdded }: { firmId: string; message: NewSenderMessage; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const named = message.fromName?.trim() ? message.fromName.trim() : null;
  const parts = named ? personNameParts(named) : { firstName: "", lastName: "" };
  const [firstName, setFirstName] = useState(parts.firstName);
  const [lastName, setLastName] = useState(parts.lastName);
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setProblem(null);
    try {
      await addSenderAsContact(firmId, message.id, { firstName, lastName, title, phone });
    } catch (err) {
      setProblem(err instanceof ContactError && err.kind !== "failed" ? err.message : FALLBACK);
      setSaving(false);
      return;
    }
    setSaving(false);
    setOpen(false);
    onAdded();
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs font-semibold text-warning">New sender</span>
      <button type="button" onClick={() => setOpen(true)} className="text-primary underline underline-offset-2">Add as a contact</button>
      {open && (
        <Dialog open onOpenChange={(o) => { if (!o && !saving) setOpen(false); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {named ?? message.from} as a contact</DialogTitle>
              <DialogDescription>They are added to this account with the address they wrote from: <span className="font-medium text-foreground">{message.from}</span></DialogDescription>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`sender-first-${message.id}`}>First name</Label>
                  <Input id={`sender-first-${message.id}`} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`sender-last-${message.id}`}>Last name</Label>
                  <Input id={`sender-last-${message.id}`} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`sender-title-${message.id}`}>Title</Label>
                <Input id={`sender-title-${message.id}`} value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`sender-phone-${message.id}`}>Phone</Label>
                <Input id={`sender-phone-${message.id}`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
              </div>
              {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                <Button type="submit" disabled={saving}>Add contact</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </span>
  );
}
