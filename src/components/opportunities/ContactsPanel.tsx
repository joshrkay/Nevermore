import { Link } from "react-router-dom";
import { ListPanel, Pill } from "@/components/accounts/accountLists";
import { contactPath } from "@/components/accounts/accountColumns";
import type { OpportunityContact } from "@/lib/opportunityPageApi";

// "Contacts on this search" (screen 19, D-429): the main contact (marked Main) and the contact made from the intake's prospect (marked "fills in the intake"), one row
// per contact, so the usual case, where the prospect is the main contact (D-214), is one row with both marks. Each opens its contact's page. There is no per-
// opportunity list of contacts or roles: the main contact is changed in the details.

const linkClass = "text-primary underline underline-offset-2 hover:text-primary/90";

export function OpportunityContacts({ contacts }: { contacts: OpportunityContact[] }) {
  return (
    <ListPanel id="opportunity-contacts" heading="Contacts on this search">
      {contacts.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No contacts on this search yet.</p>
      ) : (
        <ul className="space-y-3">
          {contacts.map((c) => {
            const line = [c.title, c.fillsInIntake ? "fills in the intake" : null].filter((p): p is string => !!p).join(" · ");
            return (
              <li key={c.id} className="text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <Link to={contactPath(c.id)} className={linkClass}>{c.name}</Link>
                  {c.main && <Pill>Main</Pill>}
                </span>
                {line && <span className="block text-muted-foreground">{line}</span>}
                {c.email && <span className="block break-all text-muted-foreground">{c.email}</span>}
                {c.phone && <span className="block text-muted-foreground">{c.phone}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </ListPanel>
  );
}
