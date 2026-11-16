import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convertingMakes, personNameParts } from "@/data/leadPage";
import { ContactError } from "@/lib/contactApi";
import { convertLead, getConvertMatches, type ConvertMatch, type Converted } from "@/lib/leadConvertApi";
import type { LeadFields } from "@/lib/leadPageApi";

/**
 * Convert a lead (story CRM-L2.2, screen 22): the account (made from the lead's business, or an existing one, the possible matches first), the contact (the lead's
 * person, unticked or filled in), and the opportunity (named for the account, with a target start if the agent has one). One step: the database does all of it or
 * none, so a refusal is said in its own words and the dialog stays open with what was typed. "Convert and start a quote" waits for New quote (Epic 5, D-402).
 */
export function ConvertLeadDialog({ firmId, lead, onClose, onConverted }: {
  firmId: string;
  lead: Pick<LeadFields, "id" | "name" | "business" | "title" | "email" | "phone">;
  onClose: () => void;
  onConverted: (made: Converted) => void;
}) {
  const makes = convertingMakes(lead);
  const parts = personNameParts(lead.name);
  const matches = useQuery({ queryKey: ["convert-lead", firmId, lead.id, "matches"], queryFn: () => getConvertMatches(firmId, lead.id), retry: false, staleTime: 0, gcTime: 0 });
  // Which account: null makes one from the lead's business; otherwise the existing account chosen.
  const [account, setAccount] = useState<ConvertMatch | null>(null);
  const [makeContact, setMakeContact] = useState(makes.contact !== null);
  const [firstName, setFirstName] = useState(makes.contact !== null ? parts.firstName : "");
  const [lastName, setLastName] = useState(makes.contact !== null ? parts.lastName : "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [makeOpportunity, setMakeOpportunity] = useState(true);
  // The opportunity's name follows the account until the agent types their own.
  const [typedName, setTypedName] = useState<string | null>(null);
  const [targetStart, setTargetStart] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const opportunityName = typedName ?? `${account?.name ?? makes.account} – PEO search`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    // The contact's two rules, in the database's own words, before anything is sent.
    if (makeContact && lastName.trim() === "") return setProblem("Enter the contact's last name.");
    if (makeContact && email.trim() === "" && phone.trim() === "") return setProblem("Enter an email or a phone number.");
    setSaving(true);
    setProblem(null);
    try {
      onConverted(await convertLead(firmId, lead.id, {
        accountId: account?.id ?? null, makeContact, firstName, lastName, email, phone, makeOpportunity, opportunityName: makeOpportunity ? opportunityName : "", targetStart,
      }));
    } catch (err) {
      setProblem(err instanceof ContactError && err.kind !== "failed" ? err.message : "Couldn't convert the lead. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert {lead.name}</DialogTitle>
          <DialogDescription>Make the account, contact and opportunity for this lead in one step. Its calls, notes, tasks, labels and emails move with it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Account</legend>
            {matches.isError && <p className="text-sm text-muted-foreground">Couldn't look for accounts this might be. You can still make a new one.</p>}
            {(matches.data ?? []).length > 0 && <p className="text-sm text-muted-foreground">These accounts may be the same business.</p>}
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
            {makeContact && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Labelled id="convert-first" label="First name"><Input id="convert-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Labelled>
                <Labelled id="convert-last" label="Last name"><Input id="convert-last" value={lastName} onChange={(e) => setLastName(e.target.value)} /></Labelled>
                <Labelled id="convert-email" label="Email"><Input id="convert-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Labelled>
                <Labelled id="convert-phone" label="Phone"><Input id="convert-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Labelled>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-medium">Opportunity</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={makeOpportunity} onChange={(e) => setMakeOpportunity(e.target.checked)} />
              Make an opportunity
            </label>
            {makeOpportunity && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Labelled id="convert-opp-name" label="Opportunity name"><Input id="convert-opp-name" value={opportunityName} onChange={(e) => setTypedName(e.target.value)} /></Labelled>
                <Labelled id="convert-start" label="Target start"><Input id="convert-start" type="date" value={targetStart} onChange={(e) => setTargetStart(e.target.value)} /></Labelled>
              </div>
            )}
          </fieldset>

          {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Converting…" : "Convert"}</Button>
          </DialogFooter>
        </form>
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
