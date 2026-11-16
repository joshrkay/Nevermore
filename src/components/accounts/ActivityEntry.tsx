import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { activityWords, contactName, formatDay, formatWhen, KIND_LABELS, today } from "@/data/accountPage";
import { OUTCOME_LABELS, type ActivityItem } from "@/lib/activityApi";
import type { ActivityRow, ContactRow } from "@/lib/accountPageApi";
import { contactPath } from "./accountColumns";
import { Pill } from "./accountLists";
import { useAccountActions } from "./useAccountActions";

// One entry of the Activity tab (D-212): a change in the record's history, or a call, a note or a task (CRM-E1.5). Drawn once for the Overview's recent
// activity and for the tab's whole list.

const GONE = "Someone who has left";
const linkClass = "text-primary underline underline-offset-2 hover:text-primary/90";

/** What happened, in words: a change as a sentence; a call, a note or a task with what it holds. */
export function ActivityWhat({ row }: { row: ActivityRow }) {
  if (row.type === "change") return <>{activityWords(row)}</>;
  const withContact = row.contact ? <>{" "}with <Link to={contactPath(row.contact.id)} className={linkClass}>{row.contact.name ?? contactName({ firstName: null, lastName: "A contact" })}</Link></> : null;
  const about = row.opportunity ? <>{" "}about {row.opportunity.name}</> : null;
  if (row.type === "call") {
    return (
      <div className="space-y-1">
        <p><span className="font-medium">{row.outcome ? OUTCOME_LABELS[row.outcome] : "Call"}</span>{withContact}{about}</p>
        {row.body && <p className="whitespace-pre-wrap">{row.body}</p>}
      </div>
    );
  }
  if (row.type === "note") {
    return (
      <div className="space-y-1">
        <p className="whitespace-pre-wrap">{row.body}</p>
        {(row.contact || row.opportunity) && <p className="text-muted-foreground">On{withContact ?? null}{about}</p>}
        {row.additions.map((a, i) => (
          <p key={i} className="whitespace-pre-wrap border-l-2 border-border pl-3 text-muted-foreground">
            <span className="font-medium">Added {formatWhen(a.at)} by {a.who ?? GONE}:</span> {a.text}
          </p>
        ))}
      </div>
    );
  }
  const overdue = row.doneAt === null && row.dueOn !== null && row.dueOn < today();
  return (
    <div className="space-y-1">
      <p className={row.doneAt ? "text-muted-foreground line-through" : "font-medium"}>{row.title}</p>
      <p className="text-muted-foreground">
        {row.dueOn && <>Due {formatDay(row.dueOn)}{overdue && <> <Pill>Overdue</Pill></>}</>}
        {row.assignee && <>{row.dueOn ? " · " : ""}For {row.assignee.name ?? GONE}</>}
        {withContact}{about}
      </p>
      {row.doneAt && <p className="text-muted-foreground">Done {formatWhen(row.doneAt)} by {row.doneBy ?? GONE}</p>}
    </div>
  );
}

/** What can be done to an entry: change it, add to a note, mark a task done or open it again. Nothing for a change, and nothing without actions (a Nevermore support session, an archived account). */
export function ActivityActions({ row }: { row: ActivityRow }) {
  const actions = useAccountActions();
  if (!actions || row.type === "change") return null;
  const item: ActivityItem = row;
  const button = "min-h-9 text-sm text-primary underline underline-offset-2 hover:text-primary/90";
  const noun = KIND_LABELS[item.type].toLowerCase();
  return (
    <span className="flex flex-wrap gap-x-3">
      {item.type === "task" && (
        <button type="button" className={button} onClick={() => void actions.setDone(item, item.doneAt === null)}>
          {item.doneAt === null ? "Mark done" : "Open again"}<span className="sr-only"> {item.title}</span>
        </button>
      )}
      {item.canEdit && <button type="button" className={button} onClick={() => actions.edit(item)}>Edit<span className="sr-only"> {noun}</span></button>}
      {item.type === "note" && actions.canAdd && <button type="button" className={button} onClick={() => actions.addTo(item)}>Add to note</button>}
    </span>
  );
}

/**
 * Log a call or a note on one contact, from the Contacts tab (the contact's page does the same, CRM-C1.1), Move it, and Merge it with another contact of the account.
 * Nothing without actions (a Nevermore support session). On an archived account nothing can be added (D-222), so logging and Move are hidden; Merge adds nothing and stays (D-642).
 */
export function ContactActions({ contact }: { contact: ContactRow }) {
  const actions = useAccountActions();
  if (!actions?.canAdd && !actions?.canMerge) return null;
  const button = "min-h-9 text-sm text-primary underline underline-offset-2 hover:text-primary/90";
  const name = contactName(contact);
  return (
    <span className="flex flex-wrap gap-x-3">
      {actions.canAdd && <button type="button" className={button} onClick={() => actions.log("call", contact.id)}>Log a call<span className="sr-only"> with {name}</span></button>}
      {actions.canAdd && <button type="button" className={button} onClick={() => actions.log("note", contact.id)}>Add a note<span className="sr-only"> on {name}</span></button>}
      {actions.canMerge && <button type="button" className={button} onClick={() => actions.merge(contact)}>Merge<span className="sr-only"> {name} with another contact</span></button>}
      {actions.canAdd && actions.canMove && <button type="button" className={button} onClick={() => actions.move(contact)}>Move<span className="sr-only"> {name} to another account</span></button>}
    </span>
  );
}

/** "Add contact" over an account's contacts (CRM-A2.2, screen 24). Nothing without actions (a Nevermore support session, an archived account). */
export function AddContactButton() {
  const actions = useAccountActions();
  if (!actions?.canAdd) return null;
  return <Button type="button" size="sm" onClick={actions.addContact}>Add contact</Button>;
}

/** "New opportunity" over an account's opportunities (CRM-A2.3, screen 25). Nothing without actions (a Nevermore support session, an archived account). */
export function NewOpportunityButton() {
  const actions = useAccountActions();
  if (!actions?.canAdd) return null;
  return <Button type="button" size="sm" onClick={actions.newOpportunity}>New opportunity</Button>;
}

/** The empty Contacts list: "No contacts yet." and, where a contact can be added (not in a Nevermore support session, not on an archived account), "Add a contact". */
export function ContactsEmpty({ words }: { words: string }) {
  const actions = useAccountActions();
  return (
    <p className="text-sm text-muted-foreground py-2">
      {words}
      {actions?.canAdd && (
        <>
          {" "}
          <button type="button" className="min-h-9 text-primary underline underline-offset-2 hover:text-primary/90" onClick={actions.addContact}>Add a contact</button>
        </>
      )}
    </p>
  );
}
