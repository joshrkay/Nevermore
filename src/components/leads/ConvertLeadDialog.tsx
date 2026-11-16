import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { convertingMakes, personNameParts } from "@/data/leadPage";
import { convertLead, getConvertMatches, type ConvertMatch, type Converted } from "@/lib/leadConvertApi";
import type { LeadFields } from "@/lib/leadPageApi";

/** Convert a lead (story CRM-L2.2, screen 22). */
export function ConvertLeadDialog({ firmId, lead, onClose, onConverted }: {
  firmId: string;
  lead: Pick<LeadFields, "id" | "name" | "business" | "email" | "phone">;
  onClose: () => void;
  onConverted: (made: Converted) => void;
}) {
  const makes = convertingMakes(lead);
  const parts = personNameParts(lead.name);
  // A lead whose name is its business's names no person, so no contact is made unless asked for.
  const makeContact = makes.contact !== null;
  const matches = useQuery({ queryKey: ["convert-lead", firmId, lead.id, "matches"], queryFn: () => getConvertMatches(firmId, lead.id), retry: false, staleTime: 0, gcTime: 0 });
  // Which account: null makes one from the lead's business; otherwise the existing account chosen.
  const [account, setAccount] = useState<ConvertMatch | null>(null);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert {lead.name}</DialogTitle>
          <DialogDescription>Make the account, contact and opportunity for this lead in one step.</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Account</legend>
          {(matches.data ?? []).map((m) => (
            <label key={m.id} className="flex items-start gap-2 text-sm">
              <input type="radio" name="convert-account" className="mt-1" checked={account?.id === m.id} onChange={() => setAccount(m)} />
              <span>Use {m.name}{[m.city, m.state].filter(Boolean).length > 0 ? ` (${[m.city, m.state].filter(Boolean).join(", ")})` : ""}</span>
            </label>
          ))}
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="convert-account" className="mt-1" checked={account === null} onChange={() => setAccount(null)} />
            <span>Create account {makes.account}</span>
          </label>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium">Contact</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={makeContact} readOnly />
            Make a contact
          </label>
          {!makeContact && <p className="text-sm text-muted-foreground">No person is named, so no contact is made.</p>}
          {makeContact && <div className="grid gap-3 sm:grid-cols-2">
            <Labelled id="convert-first" label="First name"><Input id="convert-first" defaultValue={parts.firstName} /></Labelled>
            <Labelled id="convert-last" label="Last name"><Input id="convert-last" defaultValue={parts.lastName} /></Labelled>
            <Labelled id="convert-email" label="Email"><Input id="convert-email" type="email" defaultValue={lead.email ?? ""} /></Labelled>
            <Labelled id="convert-phone" label="Phone"><Input id="convert-phone" type="tel" defaultValue={lead.phone ?? ""} /></Labelled>
          </div>}
        </fieldset>
        <DialogFooter>
          <Button
            type="button"
            onClick={async () => onConverted(await convertLead(firmId, lead.id, {
              accountId: account?.id ?? null, makeContact, firstName: parts.firstName, lastName: parts.lastName, email: lead.email ?? "", phone: lead.phone ?? "",
              makeOpportunity: true, opportunityName: `${account?.name ?? makes.account} – PEO search`, targetStart: "",
            }))}
          >Convert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const Labelled = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label htmlFor={id}>{label}</Label>
    {children}
  </div>
);
