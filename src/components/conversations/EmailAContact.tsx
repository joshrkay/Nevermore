import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PlaceToWrite from "./PlaceToWrite";

/** A contact that Email may write to, as the account's or the opportunity's contacts list them. */
export interface ContactChoice {
  id: string;
  name: string;
  email: string | null;
  doNotEmail: boolean;
  isMain: boolean;
}

export interface EmailAContactProps {
  firmId: string;
  /** The account whose contacts these are, and whose files a message may carry. */
  accountId: string;
  /** The contacts to choose from: the account's (an opportunity's are its account's). */
  loadContacts: () => Promise<ContactChoice[]>;
  /** The contact listed first: an opportunity's main contact. Otherwise the account's main contact is. */
  firstId?: string | null;
  /** Where to come back to after connecting a mailbox, for the contact being written to (brokerNext keeps the page with its query, D-650). */
  returnTo: (contactId: string) => string;
  /** A contact to open the place to write for at once: the one being written to before leaving to connect a mailbox. */
  startWith?: string | null;
}

/** The contacts in the order Email offers them: the one named first, then the main contact, then as listed. */
function ordered(list: ContactChoice[], firstId: string | null | undefined): ContactChoice[] {
  const rank = (c: ContactChoice) => (firstId ? (c.id === firstId ? 0 : 1) : c.isMain ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b));
}

/**
 * "Email" on an account's page and an opportunity's (story CRM-E1.2, slice 6.3): it asks which contact, then opens the same place to write as the
 * contact's page, for the one chosen.
 */
const EmailAContact = ({ firmId, accountId, loadContacts, firstId, returnTo, startWith }: EmailAContactProps) => {
  const [open, setOpen] = useState(!!startWith);
  const [chosen, setChosen] = useState<ContactChoice | null>(null);
  const contacts = useQuery({ queryKey: ["email-a-contact", firmId, accountId], queryFn: loadContacts, enabled: open });
  // Back from connecting a mailbox: the place to write opens again for the contact it was writing to, with what was written (D-653).
  const [resumed, setResumed] = useState(false);
  useEffect(() => {
    if (!startWith || resumed || !contacts.data) return;
    setResumed(true);
    const match = contacts.data.find((c) => c.id === startWith);
    if (match) setChosen(match);
  }, [startWith, resumed, contacts.data]);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>Email</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setChosen(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{chosen ? `Write to ${chosen.name}` : "Which contact?"}</DialogTitle>
            <DialogDescription>{chosen ? "It goes from your own mailbox and is in your Sent folder." : "Choose who to write to."}</DialogDescription>
          </DialogHeader>
          {!chosen && (
            <ul className="space-y-2">
              {ordered(contacts.data ?? [], firstId).map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setChosen(c)} className="w-full text-left rounded-md border border-border px-3 py-2 hover:bg-muted">
                    <span className="sr-only">Write to </span>{c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {chosen && (
            <PlaceToWrite
              firmId={firmId}
              recipient={{ contactId: chosen.id, name: chosen.name, email: chosen.email, doNotEmail: chosen.doNotEmail, accountId }}
              returnTo={returnTo(chosen.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailAContact;
