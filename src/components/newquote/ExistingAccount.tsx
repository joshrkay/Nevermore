import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { STAGE_LABELS } from "@/data/accountPage";
import { suggestedOpportunityName } from "@/data/opportunityFields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listAccountTab } from "@/lib/accountPageApi";
import { getNewOpportunityContext } from "@/lib/opportunityCreateApi";

// An account picked in step 1: its contacts to choose one from (the main contact first and chosen), and its open opportunity to continue, or a new opportunity (CRM-Q2.1).

/** The most opportunities asked for: an account holds few that are open, and the tab is newest first. */
const OPPORTUNITIES_ASKED = 50;
const CLOSED = ["won", "lost"];
const NEW_OPPORTUNITY = "new";

/** What the agent has chosen on a picked account: the contact, and the open opportunity to continue (or `new`). */
export interface ExistingChoice {
  contactId: string;
  opportunityId: string;
  /** For a new opportunity: its name as typed, and the account's employees to start it with. */
  newName: string;
  employees: number | null;
}

export function ExistingAccount({ firmId, accountId, onChoose }: { firmId: string; accountId: string; onChoose: (choice: ExistingChoice | null) => void }) {
  const context = useQuery({ queryKey: ["new-quote", firmId, accountId, "context"], queryFn: () => getNewOpportunityContext(firmId, accountId), retry: false, gcTime: 0 });
  const opportunities = useQuery({ queryKey: ["new-quote", firmId, accountId, "opportunities"], queryFn: () => listAccountTab(firmId, accountId, "opportunities", { limit: OPPORTUNITIES_ASKED }), retry: false, gcTime: 0 });
  const [contact, setContact] = useState<string | null>(null);
  const [opportunity, setOpportunity] = useState<string | null>(null);
  const [newName, setNewName] = useState(suggestedOpportunityName(""));
  const open = (opportunities.data?.rows ?? []).filter((o) => !CLOSED.includes(o.stage));
  const contactId = contact ?? context.data?.mainContact?.id ?? context.data?.contacts[0]?.id ?? "";
  useEffect(() => { if (opportunity === null && open.length > 0) setOpportunity(open[0].id); }, [opportunity, open]);
  const opportunityChosen = opportunity ?? (open.length === 0 ? NEW_OPPORTUNITY : null);
  useEffect(() => { onChoose(context.data && opportunities.data && opportunityChosen ? { contactId, opportunityId: opportunityChosen, newName, employees: context.data.account.employees } : null); }, [onChoose, context.data, opportunities.data, contactId, opportunityChosen, newName]);
  if (!context.data || !opportunities.data) return <p role="status" className="text-sm text-muted-foreground">Loading the account…</p>;
  return (
    <div className="space-y-4">
      <fieldset role="radiogroup" aria-label="Contact" className="space-y-2">
        <legend className="text-sm font-medium">Contact</legend>
        {context.data.contacts.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <input type="radio" id={`nq-contact-${c.id}`} name="nq-contact" checked={contactId === c.id} onChange={() => setContact(c.id)} />
            <label htmlFor={`nq-contact-${c.id}`}>{c.title ? `${c.name}, ${c.title}` : c.name}</label>
          </div>
        ))}
      </fieldset>
      <fieldset role="radiogroup" aria-label="Opportunity" className="space-y-2">
        <legend className="text-sm font-medium">Opportunity</legend>
        {open.map((o) => (
          <div key={o.id} className="flex items-center gap-2">
            <input type="radio" id={`nq-opp-${o.id}`} name="nq-opportunity" checked={opportunity === o.id} onChange={() => setOpportunity(o.id)} />
            <label htmlFor={`nq-opp-${o.id}`}>{`${o.name}, ${STAGE_LABELS[o.stage as keyof typeof STAGE_LABELS] ?? o.stage}`}</label>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input type="radio" id="nq-opp-new" name="nq-opportunity" checked={opportunity === NEW_OPPORTUNITY || (opportunity === null && open.length === 0)} onChange={() => setOpportunity(NEW_OPPORTUNITY)} />
          <label htmlFor="nq-opp-new">New opportunity</label>
        </div>
        {opportunityChosen === NEW_OPPORTUNITY && (
          <div className="space-y-1">
            <Label htmlFor="nq-opp-name">Opportunity name</Label>
            <Input id="nq-opp-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
        )}
      </fieldset>
    </div>
  );
}
