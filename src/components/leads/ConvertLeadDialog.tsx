import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { convertingMakes, personNameParts } from "@/data/leadPage";
import { ContactError } from "@/lib/contactApi";
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
  const parts = makes.contact !== null ? personNameParts(lead.name) : { firstName: "", lastName: "" };
  // A lead whose name is its business's names no person, so no contact is made unless asked for.
  const [makeContact, setMakeContact] = useState(makes.contact !== null);
  const [firstName, setFirstName] = useState(parts.firstName);
  const [lastName, setLastName] = useState(parts.lastName);
  const [email, setEmail] = useState(lead.email ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const matches = useQuery({ queryKey: ["convert-lead", firmId, lead.id, "matches"], queryFn: () => getConvertMatches(firmId, lead.id), retry: false, staleTime: 0, gcTime: 0 });
  // Which account: null makes one from the lead's business; otherwise the existing account chosen.
  const [account, setAccount] = useState<ConvertMatch | null>(null);
  // The opportunity's name follows the account until the agent types their own.
  const [typedName, setTypedName] = useState<string | null>(null);
  const [targetStart, setTargetStart] = useState("");
  const [makeOpportunity, setMakeOpportunity] = useState(true);
  const opportunityName = typedName ?? `${account?.name ?? makes.account} – PEO search`;
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    // The contact's two rules, in the database's own words, before anything is sent.
    if (makeContact && lastName.trim() === "") return setProblem("Enter the contact's last name.");
    if (makeContact && email.trim() === "" && phone.trim() === "") return setProblem("Enter an email or a phone number.");
    setProblem(null);
    try {
      onConverted(await convertLead(firmId, lead.id, {
        accountId: account?.id ?? null, makeContact, firstName, lastName, email, phone,
        makeOpportunity, opportunityName: makeOpportunity ? opportunityName : "", targetStart,
      }));
    } catch (err) {
      setProblem(err instanceof ContactError && err.kind !== "failed" ? err.message : "Couldn't convert the lead. Check your connection and try again.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert {lead.name}</DialogTitle>
          <DialogDescription>Make the account, contact and opportunity for this lead in one step.</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Account</legend>
          {matches.isError && <p className="text-sm text-muted-foreground">Couldn't look for accounts this might be. You can still make a new one.</p>}
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
            <input type="checkbox" checked={makeContact} onChange={(e) => setMakeContact(e.target.checked)} />
            Make a contact
          </label>
          {!makeContact && makes.contact === null && <p className="text-sm text-muted-foreground">No person is named, so no contact is made.</p>}
          {makeContact && <div className="grid gap-3 sm:grid-cols-2">
            <Labelled id="convert-first" label="First name"><Input id="convert-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Labelled>
            <Labelled id="convert-last" label="Last name"><Input id="convert-last" value={lastName} onChange={(e) => setLastName(e.target.value)} /></Labelled>
            <Labelled id="convert-email" label="Email"><Input id="convert-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Labelled>
            <Labelled id="convert-phone" label="Phone"><Input id="convert-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Labelled>
          </div>}
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium">Opportunity</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={makeOpportunity} onChange={(e) => setMakeOpportunity(e.target.checked)} />
            Make an opportunity
          </label>
          {makeOpportunity && <div className="grid gap-3 sm:grid-cols-2">
            <Labelled id="convert-opp-name" label="Opportunity name"><Input id="convert-opp-name" value={opportunityName} onChange={(e) => setTypedName(e.target.value)} /></Labelled>
            <Labelled id="convert-start" label="Target start"><Input id="convert-start" type="date" value={targetStart} onChange={(e) => setTargetStart(e.target.value)} /></Labelled>
          </div>}
        </fieldset>
        {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={() => void submit()}>Convert</Button>
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
