import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/accounts/accountLists";
import { useAccountActions } from "@/components/accounts/useAccountActions";
import { initialsOf } from "@/data/accountPage";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/data/leads";
import { PlaceholderLine } from "@/components/workspace/states";
import type { LeadFields } from "@/lib/leadPageApi";

/** Where the lead is, as one line: "Portland, OR", or whichever part is known. */
const leadPlace = (l: Pick<LeadFields, "city" | "state">): string | null => [l.city, l.state].filter((p): p is string => !!p).join(", ") || null;

/**
 * The top of a lead's page (story CRM-L2.1, screen 15): a trail back to Leads, "Lead", the name with its status, one line of title at the business, where it is,
 * its employees, where it came from and its owner; and Email (to the place to write on this page), Log a call and Not a fit where each will serve: Log a call
 * where something can be logged, Not a fit where the person may change the lead and it is New or Working. Convert is slice 8.6's (CRM-L2.2) and is not shown
 * until it does something (D-402: no dead buttons).
 */
export function LeadHeader({ lead, canEmail, onNotFit }: {
  lead: LeadFields;
  /** Whether the place to write is on the page (not for a converted lead or one in the bin). */
  canEmail: boolean;
  /** Not a fit, or null where the person may not mark it. */
  onNotFit: (() => void) | null;
}) {
  // Log a call is the lead's actions' (leadActions.tsx), offered where something can be logged; with no actions (a support session) it is not drawn.
  const actions = useAccountActions();
  const onLogCall = actions?.canAdd ? () => actions.log("call") : null;
  const at = lead.title && lead.business ? `${lead.title} at ${lead.business}` : lead.business ?? lead.title;
  const place = leadPlace(lead);
  const facts = [
    at,
    place,
    lead.employees !== null ? `${lead.employees.toLocaleString("en-US")} ${lead.employees === 1 ? "employee" : "employees"}` : null,
    LEAD_SOURCE_LABELS[lead.source],
    `Owner: ${lead.owner?.name ?? "No owner"}`,
  ].filter((f): f is string => !!f);
  return (
    <header className="mb-6">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted-foreground">
        <Link to="/leads" className="text-primary hover:underline">Leads</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{lead.name}</span>
      </nav>
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">{initialsOf(lead.name)}</span>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Lead</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold break-words">{lead.name}</h1>
            <Pill>{LEAD_STATUS_LABELS[lead.status]}</Pill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground break-words">{facts.join(" · ")}</p>
        </div>
      </div>
      {(canEmail || onLogCall || onNotFit) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canEmail && (
            <Button asChild variant="outline"><a href="#emails">Email<span className="sr-only"> {lead.name}</span></a></Button>
          )}
          {onLogCall && <Button type="button" onClick={onLogCall}>Log a call<span className="sr-only"> with {lead.name}</span></Button>}
          {onNotFit && <Button type="button" variant="outline" onClick={onNotFit}>Not a fit</Button>}
        </div>
      )}
    </header>
  );
}

/** The header as it is drawn while the lead is on its way. */
export function LeadHeaderLoading() {
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
