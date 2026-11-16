import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { US_STATE_CODES } from "@/data/chamberValidation";

// The fields of a new account in step 1 of New quote (CRM-Q2.1): the account's name, state and employees, and its first contact (a name, and an email or a phone).

export interface NewAccountValues {
  name: string;
  state: string;
  employees: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

const Required = () => <span className="text-xs text-muted-foreground">Required</span>;

export function NewAccountFields({ value, onChange, problems = {} }: { value: NewAccountValues; onChange: (next: NewAccountValues) => void; problems?: Partial<Record<string, string>> }) {
  const set = (key: keyof NewAccountValues) => (e: { target: { value: string } }) => onChange({ ...value, [key]: e.target.value });
  return (
    <fieldset aria-label="New account" className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between"><Label htmlFor="nq-account-name">Account name</Label><Required /></div>
        <Input id="nq-account-name" value={value.name} onChange={set("name")} aria-invalid={problems.name ? true : undefined} />
        {problems.name && <p className="text-sm text-destructive">{problems.name}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="nq-account-state">State</Label>
        <select id="nq-account-state" value={value.state} onChange={set("state")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">No state</option>
          {US_STATE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="nq-account-employees">Employees</Label>
        <Input id="nq-account-employees" inputMode="numeric" value={value.employees} onChange={set("employees")} />
      </div>
      <div className="space-y-1">
        <div className="flex items-baseline justify-between"><Label htmlFor="nq-contact-name">Contact name</Label><Required /></div>
        <Input id="nq-contact-name" value={value.contactName} onChange={set("contactName")} aria-invalid={problems.contactName ? true : undefined} />
        {problems.contactName && <p className="text-sm text-destructive">{problems.contactName}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="nq-contact-email">Contact email</Label>
        <Input id="nq-contact-email" type="email" value={value.contactEmail} onChange={set("contactEmail")} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="nq-contact-phone">Contact phone</Label>
        <Input id="nq-contact-phone" type="tel" value={value.contactPhone} onChange={set("contactPhone")} aria-invalid={problems.contact ? true : undefined} />
        {problems.contact && <p className="text-sm text-destructive">{problems.contact}</p>}
      </div>
    </fieldset>
  );
}
