import { useEffect, useRef, type MutableRefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormActions, SaveRefused, SelectInput, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { dollarsOf, newOpportunitySchema, OPPORTUNITY_SOURCES, suggestedOpportunityName } from "@/data/opportunityFields";
import { useAuth } from "@/hooks/useAuth";
import { createOpportunity, getNewOpportunityContext, OpportunityError, type MadeOpportunity, type NewOpportunityContext } from "@/lib/opportunityCreateApi";

// New opportunity (story CRM-A2.3, screen 25): a form over an account's page, opened from its header and its Opportunities tab (D-436). The account is filled in and
// is not a choice (an opportunity is moved to another account by a move, CRM-A2.2). The database decides who may add one, an archived account, a closing firm,
// Nevermore support, the owner (the level rule, D-209), the source and every field (D-29); this form says what it can itself and shows the database's own words
// for the rest. The stage is Qualifying and cannot be changed (D-409): with no intake it is the only stage there is. Saving hands the new opportunity to the page,
// which opens its own page (D-442).
//
// Not here, and where it goes (D-441, D-402): "Save and start the quote" and "Start from last year's certified answers" come with New quote (Epic 5).

/** The form in a dialog over an account. `onCreated` runs once the opportunity is made (the page opens it); `onClose` closes the form. */
export function NewOpportunityDialog({ firmId, accountId, person = "You", onClose, onCreated }: {
  firmId: string;
  accountId: string;
  /** The person's own name, for the owner choice if the firm's people are not in the answer. */
  person?: string;
  onClose: () => void;
  onCreated: (made: MadeOpportunity) => void;
}) {
  const context = useQuery({ queryKey: ["new-opportunity", firmId, accountId, "context"], queryFn: () => getNewOpportunityContext(firmId, accountId), retry: false, gcTime: 0 });
  const data = context.data;
  const closer = useRef<(() => void) | null>(null);
  return (
    // Closing the dialog any way but Cancel (its close button, a click outside, Escape) goes through the form's own question when the form is open.
    <Dialog open onOpenChange={(next) => { if (!next) (closer.current ?? onClose)(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">New opportunity</DialogTitle>
          <DialogDescription>{data ? `On ${data.account.name}` : "Start a search on this account."}</DialogDescription>
        </DialogHeader>
        {context.isError && !data ? (
          <div role="alert" className="space-y-3 text-sm">
            <p>{(context.error as Error).message || "Couldn't load the account."}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => void context.refetch()}>Try again</Button>
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : !data ? (
          <p role="status" className="text-sm text-muted-foreground">Loading the account…</p>
        ) : data.account.archived ? (
          <div className="space-y-3 text-sm">
            <p role="alert">This account is archived. Nothing can be added to it.</p>
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <NewOpportunityForm firmId={firmId} accountId={accountId} person={person} context={data} onClose={onClose} onCreated={onCreated} closer={closer} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The field a refusal's words are about, so they show under it; none for words about the whole form. */
const fieldOf = (message: string): string | undefined => {
  if (/the owner\b|for yourself|someone who can see/i.test(message)) return "owner";
  if (/source/i.test(message)) return "source";
  if (/referral partner/i.test(message)) return "referral_partner";
  if (/contact of this account/i.test(message)) return "main_contact";
  if (/opportunity's name|a name/i.test(message)) return "name";
  if (/value/i.test(message)) return "value";
  if (/employees/i.test(message)) return "employees";
  if (/next step/i.test(message)) return "next_step";
  return undefined;
};

function NewOpportunityForm({ firmId, accountId, person, context, onClose, onCreated, closer }: {
  firmId: string; accountId: string; person: string; context: NewOpportunityContext; onClose: () => void; onCreated: (made: MadeOpportunity) => void;
  closer: MutableRefObject<(() => void) | null>;
}) {
  const { user } = useAuth();
  const me = user?.id ?? "";
  // The people the database lets this person give the opportunity to, the person first. If they are not among them (the answer should always hold them), they are
  // offered by name, which is always allowed.
  const mine = context.owners.find((o) => o.id === me) ?? { id: me, name: person };
  const owners = [mine, ...context.owners.filter((o) => o.id !== me)];
  // The name follows the target start until the person types in it (D-438).
  const nameTyped = useRef(false);

  const api = useWorkspaceForm({
    schema: newOpportunitySchema,
    defaultValues: {
      name: suggestedOpportunityName(""), target_start: "", employees: context.account.employees === null ? "" : String(context.account.employees),
      main_contact: context.mainContact?.id ?? "", expected_close: "", value: "", source: "", referral_partner: "", owner: me, next_step: "",
    },
    save: async (values) => {
      const v = values as Record<string, string>;
      try {
        return await createOpportunity(firmId, accountId, {
          name: v.name,
          targetStart: v.target_start,
          employees: v.employees === "" ? null : Number(v.employees),
          mainContactId: v.main_contact || null,
          expectedClose: v.expected_close,
          value: dollarsOf(v.value),
          source: v.source,
          // A partner goes only with Referral (the database refuses it with any other source).
          referralPartnerCode: v.source === "Referral" && v.referral_partner !== "" ? v.referral_partner : null,
          nextStep: v.next_step,
          ownerId: v.owner || null,
        });
      } catch (e) {
        if (e instanceof OpportunityError && e.kind !== "failed") throw new SaveRefused(e.message, e.kind === "notAllowed" ? "owner" : e.kind === "invalid" ? fieldOf(e.message) : undefined);
        throw e;
      }
    },
    onSaved: (made) => {
      toast.success("Opportunity created");
      onCreated(made);
    },
    failureMessage: "Couldn't save the opportunity. Check your connection and try again.",
    onCancel: onClose,
  });
  useEffect(() => {
    closer.current = () => api.requestClose(onClose);
    return () => { closer.current = null; };
  });

  const source = api.form.watch("source");
  return (
    <WorkspaceForm api={api} aria-label="New opportunity" actions={<FormActions submitLabel="Save opportunity" savingLabel="Saving…" />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Opportunity name" required>
          {(field) => <Input {...field} autoFocus onChange={(e) => { nameTyped.current = true; field.onChange(e); }} />}
        </Field>
        <div className="space-y-1">
          <Label htmlFor="new-opportunity-account">Account</Label>
          <Input id="new-opportunity-account" value={context.account.name} disabled readOnly />
        </div>
        <Field name="target_start" label="Target start date">
          {(field) => (
            <Input
              {...field}
              type="date"
              onChange={(e) => {
                field.onChange(e);
                if (!nameTyped.current) api.form.setValue("name", suggestedOpportunityName(e.target.value));
              }}
            />
          )}
        </Field>
        <Field name="employees" label="Employees in this search">{(field) => <Input {...field} inputMode="numeric" />}</Field>
        <Field name="main_contact" label="Main contact">
          {(field) => (
            <SelectInput {...field}>
              <option value="">No main contact</option>
              {context.contacts.map((c) => <option key={c.id} value={c.id}>{c.title ? `${c.name}, ${c.title}` : c.name}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field name="expected_close" label="Expected close date">{(field) => <Input {...field} type="date" />}</Field>
        <Field name="value" label="Value, a year">{(field) => <Input {...field} inputMode="decimal" />}</Field>
        <Field name="source" label="Source">
          {(field) => (
            <SelectInput {...field}>
              <option value="">No source</option>
              {OPPORTUNITY_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectInput>
          )}
        </Field>
        {source === "Referral" && context.partners.length > 0 && (
          <Field name="referral_partner" label="Referral partner">
            {(field) => (
              <SelectInput {...field}>
                <option value="">Not named</option>
                {context.partners.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </SelectInput>
            )}
          </Field>
        )}
        <div className="space-y-1">
          <Label htmlFor="new-opportunity-stage">Stage</Label>
          <SelectInput id="new-opportunity-stage" disabled value="qualifying"><option value="qualifying">Qualifying</option></SelectInput>
        </div>
        <Field name="owner" label="Owner">
          {(field) => (
            <SelectInput {...field}>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </SelectInput>
          )}
        </Field>
      </div>
      <Field name="next_step" label="Next step">{(field) => <Textarea {...field} rows={3} />}</Field>
    </WorkspaceForm>
  );
}
