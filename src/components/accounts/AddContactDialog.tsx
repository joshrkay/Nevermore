import { useEffect, useRef, type MutableRefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FormActions, SaveRefused, SelectInput, useAlternateFlag, useAlternateSave, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { contactFieldsSchema } from "@/data/contactFields";
import { useAuth } from "@/hooks/useAuth";
import { listAccountOwners } from "@/lib/accountCreateApi";
import { addContact, ContactError, getAddContactContext, type AddContactContext, type AddedContact } from "@/lib/contactApi";

// Add a contact (story CRM-A2.2, screen 24): a form over an account's page. The account is filled in and is not a choice (a contact is moved to another account
// by Move, which asks the level rule on both). The database decides who may add one, an archived account, the owner (the level rule, D-209) and every field
// (D-29); this form says what it can itself and shows the database's own words for the rest. Ticking "Main contact" makes this one the account's only main
// contact: the form says who it takes over from before saving and the toast says it after.
//
// Not here, and where it goes: the warning for an email already on another contact (CRM-S4.2), custom fields (CRM-X3.1), a contact's own page (CRM-C1.1).

const schema = contactFieldsSchema.and(z.object({ owner: z.string(), is_main: z.boolean(), do_not_email: z.boolean() }));

const EMPTY = { first_name: "", last_name: "", title: "", email: "", phone: "", mobile: "", is_main: false, do_not_email: false };

const nameOf = (c: { firstName: string | null; lastName: string }) => [c.firstName, c.lastName].filter(Boolean).join(" ");

/** The form in a dialog over an account. `onAdded` runs after every contact saved (the page asks its lists again); `onClose` closes the form. */
export function AddContactDialog({ firmId, accountId, person = "You", onClose, onAdded }: {
  firmId: string;
  accountId: string;
  /** The person's own name, for the owner choice until the firm's people have loaded. */
  person?: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const contextKey = ["add-contact", firmId, accountId, "context"] as const;
  const context = useQuery({ queryKey: contextKey, queryFn: () => getAddContactContext(firmId, accountId), retry: false, gcTime: 0 });
  const data = context.data;
  const closer = useRef<(() => void) | null>(null);
  return (
    // Closing the dialog any way but Cancel (its close button, a click outside, Escape) goes through the form's own question when the form is open.
    <Dialog open onOpenChange={(next) => { if (!next) (closer.current ?? onClose)(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">Add a contact</DialogTitle>
          <DialogDescription>{data ? `On ${data.account.name}` : "Add a person at this account."}</DialogDescription>
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
          <AddContactForm firmId={firmId} accountId={accountId} person={person} context={data} onClose={onClose} onAdded={onAdded} closer={closer} contextKey={contextKey} refreshContext={() => void context.refetch()} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddContactForm({ firmId, accountId, person, context, onClose, onAdded, closer, contextKey, refreshContext }: {
  firmId: string; accountId: string; person: string; context: AddContactContext; onClose: () => void; onAdded: () => void; closer: MutableRefObject<(() => void) | null>;
  /** Where the form's context is kept, so a saved main contact can be put there at once. */
  contextKey: readonly unknown[];
  /** Asks who is the account's main contact again, to confirm what the form was told. */
  refreshContext: () => void;
}) {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const members = useQuery({ queryKey: ["new-account", firmId, me, "owners"], queryFn: () => listAccountOwners(firmId), enabled: me !== "", retry: false, staleTime: 60_000 });
  const yourself = { value: me, label: members.data?.find((m) => m.value === me)?.label ?? person };
  // The people the database lets this person give a contact to (the level rule, D-209: an agent themselves, a lead their teams, an owner anyone), the person first.
  const owners = !members.data ? [yourself] : [yourself, ...members.data.filter((m) => m.value !== me)];
  // Set for the length of "Save and add another" only (see useAlternateSave): the form stays open and starts again. Any other save closes it.
  const another = useAlternateFlag();
  const queryClient = useQueryClient();

  const api = useWorkspaceForm({
    schema,
    defaultValues: { ...EMPTY, owner: me },
    save: async (values) => {
      const v = values as typeof EMPTY & { owner: string };
      const again = another.current;
      try {
        return { added: await addContact(firmId, accountId, {
          firstName: v.first_name, lastName: v.last_name, title: v.title, email: v.email, phone: v.phone, mobile: v.mobile, ownerId: v.owner || null,
          isMain: v.is_main, doNotEmail: v.do_not_email,
        }), again };
      } catch (e) {
        if (e instanceof ContactError && (e.kind === "invalid" || e.kind === "notAllowed" || e.kind === "archived" || e.kind === "readOnly")) {
          // Only a refusal about the owner chosen belongs under Owner; the refusal to replace the main contact is the form's own.
          const field = /the owner\b|for yourself/i.test(e.message) ? "owner" : e.message.startsWith("Enter an email") ? "email" : undefined;
          throw new SaveRefused(e.message, field);
        }
        throw e;
      }
    },
    // After "Save and add another" the form starts empty again for the same account and owner.
    savedValues: (result, values) => ({ ...EMPTY, owner: (values as { owner: string }).owner }),
    onSaved: ({ added, again }: { added: AddedContact; again: boolean }) => {
      // The saved contact may be the main contact now: the form that starts again is told so at once, from the answer, and the refresh below only confirms it.
      if (added.contact.isMain) queryClient.setQueryData<AddContactContext>(contextKey, (old) => (old ? { ...old, mainContact: { id: added.contact.id, name: nameOf(added.contact) } } : old));
      toast.success(added.previousMain ? `Contact added. ${nameOf(added.contact)} is now the main contact, and ${added.previousMain.name} isn't any more.` : "Contact added");
      onAdded();
      refreshContext();
      if (again) setTimeout(() => api.form.setFocus("first_name"), 0); // after the save ends and the button is usable again
      else onClose();
    },
    failureMessage: "Couldn't save the contact. Check your connection and try again.",
    onCancel: onClose,
  });

  const runAnother = useAlternateSave(another, api);
  useEffect(() => {
    closer.current = () => api.requestClose(onClose);
    return () => { closer.current = null; };
  });

  const ticked = api.form.watch("is_main") === true;
  const takesOver = ticked && context.mainContact !== null;
  return (
    <WorkspaceForm
      api={api}
      aria-label="Add a contact"
      actions={(
        <div>
          <FormActions
            submitLabel="Save contact"
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
        </div>
      )}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="first_name" label="First name">{(field) => <Input {...field} autoFocus />}</Field>
        <Field name="last_name" label="Last name" required>{(field) => <Input {...field} />}</Field>
        <Field name="title" label="Title">{(field) => <Input {...field} />}</Field>
        <div className="space-y-1">
          <Label htmlFor="add-contact-account">Account</Label>
          <Input id="add-contact-account" value={context.account.name} disabled readOnly />
        </div>
        <Field name="email" label="Email" help="Email or phone required">{(field) => <Input {...field} type="email" />}</Field>
        <Field name="phone" label="Phone" help="Email or phone required">{(field) => <Input {...field} type="tel" />}</Field>
        <Field name="mobile" label="Mobile">{(field) => <Input {...field} type="tel" />}</Field>
        <Field name="owner" label="Owner">
          {(field) => (
            <SelectInput {...field}>
              {owners.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
          )}
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <CheckField name="is_main" label="Main contact for this account" api={api} />
        <CheckField name="do_not_email" label="Do not email" api={api} />
      </div>
      {takesOver && (
        <p role="status" className="text-sm text-muted-foreground">{context.mainContact?.name} is the main contact now. Saving makes this contact the main contact instead.</p>
      )}
    </WorkspaceForm>
  );
}

function CheckField({ name, label, api }: { name: string; label: string; api: ReturnType<typeof useWorkspaceForm> }) {
  return (
    <FormField
      control={api.form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center gap-2 space-y-0">
          <FormControl>
            <input type="checkbox" className="h-4 w-4 rounded border-input accent-primary" checked={field.value === true} onChange={(e) => field.onChange(e.target.checked)} onBlur={field.onBlur} ref={field.ref} name={field.name} />
          </FormControl>
          <FormLabel className="font-normal">{label}</FormLabel>
        </FormItem>
      )}
    />
  );
}
