import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/accounts/accountLists";
import { useAccountActions } from "@/components/accounts/useAccountActions";
import { contactName, initialsOf } from "@/data/accountPage";
import { PlaceholderLine } from "@/components/workspace/states";
import type { ContactDetails } from "@/lib/contactPageApi";

/**
 * The top of a contact's page (screen 18): a trail back, "Contact", the name with "Main contact" when they are, one line of title at the account (linked), email and
 * phone, and Log a call and Add a task where there are actions to take: not in a Nevermore support session (ADR 0024) and not on an archived account, so nothing
 * here is a button that does nothing (D-24). Email the contact is Epic 6's (D-186). Move is offered by the same rules as on the account's Contacts tab.
 */
export function ContactHeader({ contact, canMove }: { contact: ContactDetails; canMove: boolean }) {
  const actions = useAccountActions();
  const name = contactName(contact);
  const account = <Link to={`/accounts/${contact.account.id}`} className="text-primary underline underline-offset-2 hover:text-primary/90">{contact.account.name}</Link>;
  const reach = [contact.email, contact.phone ?? contact.mobile].filter((f): f is string => !!f);
  return (
    <header className="mb-6">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted-foreground">
        <Link to="/accounts" className="text-primary hover:underline">Accounts</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/accounts/${contact.account.id}`} className="text-primary hover:underline">{contact.account.name}</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{name}</span>
      </nav>
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">{initialsOf(name)}</span>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Contact</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold break-words">{name}</h1>
            {contact.isMain && <Pill>Main contact</Pill>}
            {contact.doNotEmail && <Pill>Do not email</Pill>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground break-words">
            {contact.title ? <>{contact.title} at </> : <>At </>}{account}
            {reach.map((r) => <span key={r}> · <span className="break-all">{r}</span></span>)}
          </p>
        </div>
      </div>
      {(actions?.canAdd || (actions && canMove)) && (
        <div data-contact-actions className="mt-4 flex flex-wrap gap-2">
          {actions.canAdd && <Button type="button" onClick={() => actions.log("call", contact.id)}>Log a call<span className="sr-only"> with {name}</span></Button>}
          {actions.canAdd && <Button type="button" variant="outline" onClick={() => actions.log("task", contact.id)}>Add a task<span className="sr-only"> for {name}</span></Button>}
          {canMove && (
            <Button
              type="button"
              variant="outline"
              onClick={() => actions.move({ id: contact.id, firstName: contact.firstName, lastName: contact.lastName, title: contact.title, email: contact.email, phone: contact.phone, mobile: contact.mobile, isMain: contact.isMain, doNotEmail: contact.doNotEmail })}
            >
              Move to another account
            </Button>
          )}
        </div>
      )}
    </header>
  );
}

/** The header as it is drawn while the contact is on its way: the page's frame shows at once, with grey where the name and facts will be. */
export function ContactHeaderLoading() {
  return (
    <header aria-hidden="true" aria-busy="true" className="mb-6 flex items-start gap-4">
      <span className="h-14 w-14 shrink-0 rounded-full bg-muted-foreground/30 motion-safe:animate-pulse" />
      <div className="space-y-2">
        <PlaceholderLine width="name" className="h-8 w-72" />
        <PlaceholderLine width="name" className="w-96" />
      </div>
    </header>
  );
}
