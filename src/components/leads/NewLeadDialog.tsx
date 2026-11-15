import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormActions, SaveRefused, SelectInput, useAlternateFlag, useAlternateSave, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { nameRule, optionalEmailRule, phoneRule, stateRule, wholeNumberRule } from "@/components/workspace/form/fieldRules";
import { US_STATE_CODES } from "@/data/chamberValidation";
import { useAuth } from "@/hooks/useAuth";
import { listAccountOwners } from "@/lib/accountCreateApi";
import { AccountError } from "@/lib/accountPageApi";
import { createLead, type MadeLead } from "@/lib/leadCreateApi";

// New lead (story CRM-L1.2a, slice 8.2, screen 21): a form over the Leads table (CRM-L1.1a, slice 8.3, mounts it). Saving makes the lead and hands it to the
// page. The database decides who may make a lead and for whom (the level rule, D-809), the closing firm, Nevermore support and every field; this form says what
// it can itself and shows the database's own words for the rest. The owner is the person making it unless they choose another; the source is Added by hand and
// is not asked (D-804). "Save and add another" saves the same way and starts the form again, keeping the owner.
//
// The owner choices are the account's (account_owner_choices): the level rule is one rule for every record a person makes.
//
// Not here, and where it goes: the firm's own fields (Epic 9, D-805).

const text = z.string().trim();

const schema = z.object({
  name: nameRule("Enter a name: the person's, or the business's when you don't know who to speak to.", 200),
  title: text,
  business: text,
  email: optionalEmailRule(),
  phone: phoneRule(),
  city: text,
  state: stateRule(),
  employees: wholeNumberRule(),
  current_provider: text,
  note: text,
  owner: z.string(),
});

const EMPTY = { name: "", title: "", business: "", email: "", phone: "", city: "", state: "", employees: "", current_provider: "", note: "" };

export function NewLeadDialog({ firmId, person, onClose, onCreated }: {
  firmId: string;
  /** The person's own name, for the owner choice until the firm's people have loaded. */
  person: string;
  onClose: () => void;
  /** `again` is true after "Save and add another": the form stays open and the page only refreshes. */
  onCreated: (lead: MadeLead, again: boolean) => void;
}) {
  const another = useAlternateFlag();
  const { user } = useAuth();
  const me = user?.id ?? "";
  const members = useQuery({ queryKey: ["new-lead", firmId, me, "owners"], queryFn: () => listAccountOwners(firmId), enabled: me !== "", retry: false, staleTime: 60_000 });
  const yourself = { value: me, label: members.data?.find((m) => m.value === me)?.label ?? person };
  // The person first; until the firm's people load, or if they can't, the person alone: that is always allowed.
  const owners = !members.data ? [yourself] : [yourself, ...members.data.filter((m) => m.value !== me)];

  const api = useWorkspaceForm({
    schema,
    defaultValues: { ...EMPTY, owner: me },
    save: async (values) => {
      const v = values as typeof EMPTY & { owner: string };
      const again = another.current;
      try {
        return { again, lead: await createLead(firmId, {
          name: v.name,
          title: v.title,
          business: v.business,
          email: v.email,
          phone: v.phone,
          city: v.city,
          state: v.state,
          employees: v.employees.trim() === "" ? null : Number(v.employees),
          currentProvider: v.current_provider,
          note: v.note,
          ownerId: v.owner || null,
        }) };
      } catch (e) {
        if (e instanceof AccountError && e.kind !== "failed") {
          const field = e.kind === "notAllowed" ? "owner" : e.message.startsWith("Enter an email") ? "email" : e.message.startsWith("Enter a phone") ? "phone" : undefined;
          throw new SaveRefused(e.message, field);
        }
        throw e;
      }
    },
    // After "Save and add another" the form starts empty again, keeping the owner.
    savedValues: (_result, values) => ({ ...EMPTY, owner: (values as { owner: string }).owner }),
    onSaved: ({ lead, again }: { lead: MadeLead; again: boolean }) => {
      toast.success("Lead created");
      onCreated(lead, again);
      if (again) setTimeout(() => api.form.setFocus("name"), 0);
    },
    failureMessage: "Couldn't save the lead. Check your connection and try again.",
    onCancel: onClose,
  });

  const runAnother = useAlternateSave(another, api);

  return (
    <Dialog open onOpenChange={(next) => { if (!next) api.requestClose(onClose); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogTitle className="font-display text-xl font-bold">New lead</DialogTitle>
        <DialogDescription className="sr-only">Add a person or business you aren't quoting yet.</DialogDescription>
        <WorkspaceForm
          api={api}
          aria-label="New lead form"
          actions={(
            <FormActions
              submitLabel="Save lead"
              savingLabel="Saving…"
              between={(
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-md"
                  disabled={api.saving}
                  aria-disabled={api.offline || undefined}
                  onClick={() => void runAnother()}
                >
                  Save and add another
                </Button>
              )}
            />
          )}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="name" label="Name" required help="The person's name, or the business's when you don't know who to speak to.">{(field) => <Input {...field} autoFocus />}</Field>
            <Field name="title" label="Title">{(field) => <Input {...field} />}</Field>
            <Field name="business" label="Business">{(field) => <Input {...field} />}</Field>
            <Field name="email" label="Email">{(field) => <Input {...field} type="email" />}</Field>
            <Field name="phone" label="Phone">{(field) => <Input {...field} type="tel" />}</Field>
            <Field name="city" label="City">{(field) => <Input {...field} />}</Field>
            <Field name="state" label="State">
              {(field) => (
                <SelectInput {...field}>
                  <option value="">No state</option>
                  {US_STATE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
                </SelectInput>
              )}
            </Field>
            <Field name="employees" label="Employees">{(field) => <Input {...field} inputMode="numeric" />}</Field>
            <Field name="current_provider" label="Current PEO or payroll provider">{(field) => <Input {...field} />}</Field>
            <Field name="owner" label="Owner">
              {(field) => (
                <SelectInput {...field}>
                  {owners.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
              )}
            </Field>
            <div className="sm:col-span-2">
              <Field name="note" label="Note">{(field) => <Textarea {...field} rows={3} />}</Field>
            </div>
          </div>
        </WorkspaceForm>
      </DialogContent>
    </Dialog>
  );
}
