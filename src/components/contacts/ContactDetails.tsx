import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckField } from "@/components/accounts/CheckField";
import { Input } from "@/components/ui/input";
import { Field, FormActions, SaveConflict, SaveRefused, SelectInput, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { contactEditSchemaFor, editOf, formOfContact, formOfEditable, yesNo, type ContactForm } from "@/data/contactPage";
import { formatDay, NOT_GIVEN } from "@/data/accountPage";
import { listAccountOwners } from "@/lib/accountCreateApi";
import { listFirmMembers } from "@/lib/accountsApi";
import { ContactError } from "@/lib/contactApi";
import { updateContact, type ContactFields, type ContactDetails as Details } from "@/lib/contactPageApi";

// The contact's own fields, down one side of its page (story CRM-C1.1, screen 18): shown as they are, and edited in place (CRM-S4.1) from the version the person
// started from. Edit is offered only when the database says the person may change the contact (`canChange`, the level rule on the contact's own owner, D-209), and
// what the database refuses is said in its own words beside Save (a closing firm, Nevermore support, a field it will not take, the main contact's level). If
// someone saved first, the conflict dialog sets what was typed beside what is there now (D-46). "Do not email" is kept and shown (D-186).

type Result = { contact: ContactFields; previousMain: { id: string; name: string } | null };

const yesNoWords = (v: unknown) => (v === true ? "Yes" : "No");

/** How the conflict dialog names each editable field (by the database's column name) and words its value. */
const conflictFields = (ownerName: (id: string) => string) => ({
  first_name: { label: "First name" },
  last_name: { label: "Last name" },
  title: { label: "Title" },
  email: { label: "Email" },
  phone: { label: "Phone" },
  mobile: { label: "Mobile" },
  owner_id: { label: "Owner", format: (v: unknown) => ownerName(String(v)) },
  is_main: { label: "Main contact", format: yesNoWords },
  do_not_email: { label: "Do not email", format: yesNoWords },
  // Moving a contact changes its version too (the account and the main-contact mark).
  account_id: { label: "Account", format: () => "Another account" },
});

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </div>
);
const Given = ({ value }: { value: string | null }) => (value ? <>{value}</> : <span className="text-muted-foreground">{NOT_GIVEN}</span>);

export function ContactDetailsPanel({ firmId, contact, canChange, onSaved }: {
  firmId: string;
  contact: Details;
  canChange: boolean;
  /** The saved fields, to put on the page at once (the reload that follows confirms them), and the main contact it took over from. */
  onSaved: (fields: ContactFields, previousMain: { id: string; name: string } | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  // The firm's people, so a conflict over the owner names a person (asked once, kept a minute; a failure leaves "Someone in the firm").
  const people = useQuery({ queryKey: ["account-owner-choices", firmId], queryFn: () => listFirmMembers(firmId), retry: false, staleTime: 60_000 });
  // The people the caller may give a contact to (the level rule): asked only while the form is open.
  const choosable = useQuery({ queryKey: ["new-account", firmId, "owners-for-contact"], queryFn: () => listAccountOwners(firmId), enabled: editing, retry: false, staleTime: 60_000 });
  const conflictDialog = useMemo(() => {
    const byId = new Map((people.data ?? []).map((p) => [p.value, p.label]));
    return { noun: "contact", fields: conflictFields((id) => byId.get(id) ?? "Someone in the firm") };
  }, [people.data]);
  // A save closes the form, and the Save button that had focus goes with it: focus goes to Edit, which takes its place.
  const editButton = useRef<HTMLButtonElement>(null);
  const [focusEdit, setFocusEdit] = useState(false);
  useEffect(() => {
    if (focusEdit && !editing) {
      editButton.current?.focus();
      setFocusEdit(false);
    }
  }, [focusEdit, editing]);

  // The email, phone and mobile as they were when the edit began: left as they were, they are not judged again, so an older-format one never blocks a save of another field.
  const [kept, setKept] = useState({ email: contact.email, phone: contact.phone, mobile: contact.mobile });
  const schema = useMemo(() => contactEditSchemaFor(kept), [kept]);

  const api = useWorkspaceForm({
    schema,
    defaultValues: formOfContact(contact),
    version: contact.version,
    versionOf: (saved: Result) => saved.contact.version,
    save: async (values, started): Promise<Result> => {
      // The version the person started editing from, never the page's live one (a refresh may have brought a newer one).
      if (started.version === undefined) throw new SaveRefused("Couldn't save the contact. Reload the page and try again.");
      try {
        const answer = await updateContact(firmId, contact.id, editOf(values as ContactForm), started.version);
        // Nothing was saved: the form opens the conflict dialog, and the person chooses.
        if (!("contact" in answer)) throw new SaveConflict({ conflict: true, currentVersion: answer.currentVersion, current: formOfEditable(answer.current), changed: answer.changed });
        return { contact: answer.contact, previousMain: answer.previousMain };
      } catch (e) {
        if (e instanceof ContactError && (e.kind === "invalid" || e.kind === "notAllowed" || e.kind === "readOnly" || e.kind === "notFound")) {
          // Only a refusal about the owner chosen belongs under Owner; the refusal to replace the main contact is the form's own.
          const field = /the owner\b|give a contact only/i.test(e.message) ? "owner_id" : e.message.startsWith("Enter an email") ? "email" : undefined;
          throw new SaveRefused(e.message, field);
        }
        throw e;
      }
    },
    conflictDialog,
    savedValues: (saved) => formOfContact(saved.contact),
    onSaved: (saved) => {
      setEditing(false);
      setFocusEdit(true);
      toast.success(saved.previousMain ? `Contact saved. ${saved.previousMain.name} isn't the main contact any more.` : "Contact saved");
      onSaved(saved.contact, saved.previousMain);
    },
    failureMessage: "Couldn't save the contact. Check your connection and try again.",
    onCancel: () => {
      setEditing(false);
      setFocusEdit(true);
    },
  });

  const startEditing = () => {
    api.begin(formOfContact(contact), contact.version);
    setKept({ email: contact.email, phone: contact.phone, mobile: contact.mobile });
    setEditing(true);
  };

  // The owner choice: the contact's present owner first (even one the person could not choose, so nothing changes by leaving it), then the people the database lets them give it to.
  const owners = useMemo(() => {
    const present = contact.owner ? [{ value: contact.owner.id, label: contact.owner.name }] : [];
    return [...present, ...(choosable.data ?? []).filter((m) => m.value !== contact.owner?.id)];
  }, [contact.owner, choosable.data]);
  const ticked = api.form.watch("is_main") === true;

  return (
    <section aria-labelledby="contact-details-heading" className="border border-border rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="contact-details-heading" className="font-display text-lg font-bold">Details</h2>
        {canChange && !editing && (
          <button ref={editButton} type="button" onClick={startEditing} className="text-sm text-primary underline underline-offset-2 hover:text-primary/90">
            Edit<span className="sr-only"> the contact's details</span>
          </button>
        )}
      </div>
      {editing ? (
        <WorkspaceForm api={api} aria-labelledby="contact-details-heading" actions={<FormActions />}>
          <Field name="first_name" label="First name">{(field) => <Input {...field} autoFocus />}</Field>
          <Field name="last_name" label="Last name" required>{(field) => <Input {...field} />}</Field>
          <Field name="title" label="Title">{(field) => <Input {...field} />}</Field>
          <Field name="email" label="Email" help="Email or phone required">{(field) => <Input {...field} type="email" />}</Field>
          <Field name="phone" label="Phone" help="Email or phone required">{(field) => <Input {...field} type="tel" />}</Field>
          <Field name="mobile" label="Mobile">{(field) => <Input {...field} type="tel" />}</Field>
          <Field name="owner_id" label="Owner">
            {(field) => (
              <SelectInput {...field}>
                {contact.owner === null && <option value="">No owner</option>}
                {owners.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            )}
          </Field>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <CheckField name="is_main" label="Main contact for this account" api={api} />
            <CheckField name="do_not_email" label="Do not email" api={api} />
          </div>
          {ticked && !contact.isMain && <p role="status" className="text-sm text-muted-foreground">Saving makes this contact the account's main contact, in place of any other.</p>}
        </WorkspaceForm>
      ) : (
        <dl>
          <Row label="First name"><Given value={contact.firstName} /></Row>
          <Row label="Last name">{contact.lastName}</Row>
          <Row label="Title"><Given value={contact.title} /></Row>
          <Row label="Account"><Link to={`/accounts/${contact.account.id}`} className="text-primary underline underline-offset-2 hover:text-primary/90">{contact.account.name}</Link></Row>
          <Row label="Email">{contact.email ? <span className="break-all">{contact.email}</span> : <Given value={null} />}</Row>
          <Row label="Phone"><Given value={contact.phone} /></Row>
          <Row label="Mobile"><Given value={contact.mobile} /></Row>
          <Row label="Do not email">{yesNo(contact.doNotEmail)}</Row>
          <Row label="Owner"><Given value={contact.owner?.name ?? null} /></Row>
          <Row label="Added">{formatDay(contact.createdAt)}</Row>
        </dl>
      )}
    </section>
  );
}
