import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DuplicateWarning } from "@/components/accounts/DuplicateWarning";
import { useAccountDuplicates } from "@/components/accounts/useDuplicates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NewAccountFields, type NewAccountValues } from "./NewAccountFields";
import { ExistingAccount, type ExistingChoice } from "./ExistingAccount";
import { newAccountProblems, splitName } from "@/data/newQuote";
import { createAccount } from "@/lib/accountCreateApi";
import { AccountError } from "@/lib/accountPageApi";
import { addContact, ContactError } from "@/lib/contactApi";
import { createOpportunity, OpportunityError } from "@/lib/opportunityCreateApi";
import { searchRecords } from "@/lib/searchApi";

// Step 1 of New quote, the account (CRM-Q2.1, screen 4): the agent types the business's name and sees the accounts that could be it, or keeps "New account".

/** Searching waits for a pause in typing (the menu's search waits the same), and the database answers nothing under two characters (D-240). */
const WAIT_MS = 300;
const MIN_CHARS = 2;

function useDebounced<T>(value: T, ms: number): T {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setHeld(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return held;
}

export function AccountStep({ firmId, onSaved }: { firmId: string; onSaved: (done: { opportunityId: string }) => void }) {
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [making, setMaking] = useState<NewAccountValues | null>(null);
  const [problems, setProblems] = useState<Partial<Record<string, string>>>({});
  const [choice, setChoice] = useState<ExistingChoice | null>(null);
  const words = useDebounced(typed.trim(), WAIT_MS);
  const found = useQuery({ queryKey: ["new-quote", firmId, "accounts", words], queryFn: () => searchRecords(firmId, words), enabled: words.length >= MIN_CHARS, retry: false, gcTime: 0 });
  const accounts = found.data?.accounts.rows ?? [];
  // While a new account is typed, the database says which of the firm's accounts may be the same business (CRM-S4.2, D-193). It is advice and never stops the save.
  const duplicates = useAccountDuplicates(firmId, { name: making?.name ?? "", website: "", state: making?.state ?? "" });
  // What step 1 has already made, kept across a refused save: Save and close again goes on from here and never makes a second account or contact.
  const made = useRef<{ accountId?: string; contactId?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const makeAll = async (v: NewAccountValues): Promise<string> => {
    if (!made.current.accountId) {
      const account = await createAccount(firmId, {
        name: v.name, tradeName: "", website: "", phone: "", street: "", city: "", state: v.state, postalCode: "", industry: "",
        employees: v.employees.trim() === "" ? null : Number(v.employees), statesOfOperation: [], currentProvider: "", ownerId: null, source: "new_quote",
      });
      made.current.accountId = account.id;
    }
    if (!made.current.contactId) {
      const { firstName, lastName } = splitName(v.contactName);
      const added = await addContact(firmId, made.current.accountId, { firstName, lastName, title: "", email: v.contactEmail.trim(), phone: v.contactPhone.trim(), mobile: "", ownerId: null, isMain: true, doNotEmail: false });
      made.current.contactId = added.contact.id;
    }
    const opportunity = await createOpportunity(firmId, made.current.accountId, {
      name: "PEO search", targetStart: "", employees: v.employees.trim() === "" ? null : Number(v.employees), mainContactId: made.current.contactId, expectedClose: "", value: null, source: "",
      referralPartnerCode: null, nextStep: "", ownerId: null, renewalId: null,
    });
    return opportunity.id;
  };

  const save = async () => {
    setFailure(null);
    if (making) {
      const found = newAccountProblems(making);
      setProblems(found);
      if (Object.keys(found).length > 0) return;
    } else if (!choice) return;
    setSaving(true);
    try {
      if (making) return onSaved({ opportunityId: await makeAll(making) });
      if (choice && choice.opportunityId !== "new") return onSaved({ opportunityId: choice.opportunityId });
      const opportunity = await createOpportunity(firmId, picked as string, {
        name: (choice as ExistingChoice).newName, targetStart: "", employees: (choice as ExistingChoice).employees, mainContactId: (choice as ExistingChoice).contactId || null, expectedClose: "", value: null, source: "",
        referralPartnerCode: null, nextStep: "", ownerId: null, renewalId: null,
      });
      onSaved({ opportunityId: opportunity.id });
    } catch (e) {
      setFailure(e instanceof AccountError || e instanceof ContactError || e instanceof OpportunityError ? e.message : "Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section aria-label="The account" className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="new-quote-business">Business name</Label>
        <Input id="new-quote-business" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </div>
      {accounts.length > 0 && (
        <ul role="listbox" aria-label="Accounts that could be this business" className="divide-y rounded-md border">
          {accounts.map((a) => (
            <li key={a.id} role="option" aria-selected={picked === a.id} tabIndex={0} onClick={() => { setMaking(null); setPicked(a.id); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMaking(null); setPicked(a.id); } }} className="cursor-pointer px-3 py-2">
              <span className="block font-medium">{a.name}</span>
              <span className="block text-xs text-muted-foreground">{a.city && a.state ? `${a.city}, ${a.state}` : a.city ?? a.state}</span>
            </li>
          ))}
        </ul>
      )}
      {picked && <ExistingAccount firmId={firmId} accountId={picked} onChoose={setChoice} />}
      {making && <><NewAccountFields value={making} onChange={setMaking} problems={problems} /><DuplicateWarning found={duplicates} kind="account" /></>}
      <Button type="button" variant="outline" onClick={() => { setPicked(null); setChoice(null); setMaking({ name: typed.trim(), state: "", employees: "", contactName: "", contactEmail: "", contactPhone: "" }); }}>New account</Button>
      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
      <div>
        <Button type="button" disabled={saving} onClick={() => void save()}>Save and close</Button>
      </div>
    </section>
  );
}
