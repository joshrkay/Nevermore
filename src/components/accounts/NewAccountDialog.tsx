import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormActions, SaveRefused, SelectInput, useAlternateFlag, useAlternateSave, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { US_STATE_CODES } from "@/data/chamberValidation";
import { accountFieldsSchema } from "@/data/accountFields";
import { statesOf } from "@/data/accountPage";
import { useAuth } from "@/hooks/useAuth";
import { createAccount, listAccountOwners } from "@/lib/accountCreateApi";
import { AccountError, type AccountFields } from "@/lib/accountPageApi";

// New account (story CRM-A1.2, screen 23): a form over the Accounts page. Saving makes the account and hands it to the page, which opens it. The database
// decides who may make an account and for whom (the level rule, D-209), the closing firm, Nevermore support and every field (D-29); this form says what it can
// itself and shows the database's own words for the rest. The owner is the person making it unless they choose another (D-214).
//
// "Save and add a contact" (CRM-A1.2, built with CRM-A2.2) saves the same way and then opens the new account with the Add a contact form already open on it.
//
// Not here, and where it goes: the warning that an account with the same website or name exists (CRM-S4.2), the renewal date and the firm's own fields (D-186, CRM-X3.1).

const schema = accountFieldsSchema.extend({ owner: z.string() });

const EMPTY = {
  name: "", trade_name: "", website: "", phone: "", street: "", city: "", state: "", postal_code: "", industry: "", employees: "", states_of_operation: "", current_provider: "",
};

export function NewAccountDialog({ firmId, person, onClose, onCreated }: {
  firmId: string;
  /** The person's own name, for the owner choice until the firm's people have loaded. */
  person: string;
  onClose: () => void;
  /** `thenContact` is true after "Save and add a contact": the page of the new account opens with the contact form open on it. */
  onCreated: (account: AccountFields, thenContact: boolean) => void;
}) {
  // Set for the length of "Save and add a contact" only (see useAlternateSave); any other save leaves it false.
  const thenContact = useAlternateFlag();
  const { user } = useAuth();
  const me = user?.id ?? "";
  const members = useQuery({ queryKey: ["new-account", firmId, me, "owners"], queryFn: () => listAccountOwners(firmId), enabled: me !== "", retry: false, staleTime: 60_000 });
  const yourself = { value: me, label: members.data?.find((m) => m.value === me)?.label ?? person };
  // The people the database lets this person give an account to (the level rule, D-209: an agent themselves, a lead their teams, an owner anyone), the person
  // first. Until they load, or if they can't, the person themselves: that is always allowed.
  const owners = !members.data ? [yourself] : [yourself, ...members.data.filter((m) => m.value !== me)];

  const api = useWorkspaceForm({
    schema,
    defaultValues: { ...EMPTY, owner: me },
    save: async (values) => {
      const v = values as typeof EMPTY & { owner: string };
      const andContact = thenContact.current;
      try {
        return { andContact, account: await createAccount(firmId, {
          name: v.name,
          tradeName: v.trade_name,
          website: v.website,
          phone: v.phone,
          street: v.street,
          city: v.city,
          state: v.state,
          postalCode: v.postal_code,
          industry: v.industry,
          employees: v.employees.trim() === "" ? null : Number(v.employees),
          statesOfOperation: statesOf(v.states_of_operation),
          currentProvider: v.current_provider,
          ownerId: v.owner || null,
        }) };
      } catch (e) {
        if (e instanceof AccountError && e.kind !== "failed") throw new SaveRefused(e.message, e.kind === "notAllowed" ? "owner" : e.code === "22003" ? "employees" : undefined);
        throw e;
      }
    },
    onSaved: ({ account, andContact }) => {
      toast.success("Account created");
      onCreated(account, andContact);
    },
    failureMessage: "Couldn't save the account. Check your connection and try again.",
    onCancel: onClose,
  });

  const runThenContact = useAlternateSave(thenContact, api);

  return (
    <Dialog open onOpenChange={(next) => { if (!next) api.requestClose(onClose); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogTitle className="font-display text-xl font-bold">New account</DialogTitle>
        <DialogDescription className="sr-only">Add a business you quote for.</DialogDescription>
        <WorkspaceForm
          api={api}
          aria-label="New account"
          actions={(
            <div>
              <FormActions
                submitLabel="Save account"
                savingLabel="Saving…"
                between={(
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-md"
                    disabled={api.saving}
                    aria-disabled={api.offline || undefined}
                    onClick={() => void runThenContact()}
                  >
                    Save and add a contact
                  </Button>
                )}
              />
            </div>
          )}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="name" label="Account name" required>{(field) => <Input {...field} autoFocus />}</Field>
            <Field name="trade_name" label="Trade name">{(field) => <Input {...field} />}</Field>
            <Field name="website" label="Website">{(field) => <Input {...field} />}</Field>
            <Field name="phone" label="Phone">{(field) => <Input {...field} type="tel" />}</Field>
            <Field name="street" label="Street">{(field) => <Input {...field} />}</Field>
            <Field name="city" label="City">{(field) => <Input {...field} />}</Field>
            <Field name="state" label="State">
              {(field) => (
                <SelectInput {...field}>
                  <option value="">No state</option>
                  {US_STATE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
                </SelectInput>
              )}
            </Field>
            <Field name="postal_code" label="ZIP">{(field) => <Input {...field} />}</Field>
            <Field name="industry" label="Industry">{(field) => <Input {...field} />}</Field>
            <Field name="employees" label="Employees">{(field) => <Input {...field} inputMode="numeric" />}</Field>
            <Field name="states_of_operation" label="States of operation" help="Two-letter state codes, separated by commas, like OR, WA.">{(field) => <Input {...field} />}</Field>
            <Field name="current_provider" label="Current PEO or payroll provider">{(field) => <Input {...field} />}</Field>
            <Field name="owner" label="Owner">
              {(field) => (
                <SelectInput {...field}>
                  {owners.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
              )}
            </Field>
          </div>
        </WorkspaceForm>
      </DialogContent>
    </Dialog>
  );
}
