import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormActions, SaveConflict, SaveRefused, SelectInput, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { US_STATE_CODES } from "@/data/chamberValidation";
import { formatDay, NOT_GIVEN } from "@/data/accountPage";
import { LEAD_SOURCE_LABELS } from "@/data/leads";
import { leadEditOf, leadEditSchema, leadFormOf, leadFormOfLead, type LeadForm } from "@/data/leadPage";
import { listAccountOwners } from "@/lib/accountCreateApi";
import { listFirmMembers } from "@/lib/accountsApi";
import { ContactError } from "@/lib/contactApi";
import { updateLead, type LeadFields } from "@/lib/leadPageApi";

// The lead's own fields, down one side of its page (story CRM-L2.1, screen 15): the standard fields as they are, edited in place (CRM-S4.1) from the version the
// person started from. The firm's own fields follow them with Epic 9 (D-805). Edit is offered only when the database says the person may change the lead
// (`canChange`: the level rule on its owner, and a lead that is not Converted, Not a fit or in the bin); what the database refuses is said in its own words beside
// Save. If someone saved first, the conflict dialog sets what was typed beside what is there now (D-46). A saved change makes a New lead Working (D-808).

const conflictFields = (ownerName: (id: string) => string) => ({
  name: { label: "Name" },
  title: { label: "Title" },
  business: { label: "Business" },
  email: { label: "Email" },
  phone: { label: "Phone" },
  city: { label: "City" },
  state: { label: "State" },
  employees: { label: "Employees" },
  current_provider: { label: "Current provider" },
  note: { label: "Note" },
  owner_id: { label: "Owner", format: (v: unknown) => ownerName(String(v)) },
  // A status change moves the version too (Not a fit, Reopen, a call that made it Working).
  status: { label: "Status" },
  not_fit_reason: { label: "Not a fit because" },
});

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-1.5 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </div>
);
const Given = ({ value }: { value: string | null }) => (value ? <>{value}</> : <span className="text-muted-foreground">{NOT_GIVEN}</span>);

export function LeadDetailsPanel({ firmId, lead, canChange, onSaved }: {
  firmId: string;
  lead: LeadFields;
  canChange: boolean;
  /** The saved fields, to put on the page at once (the reload that follows confirms them). */
  onSaved: (fields: LeadFields) => void;
}) {
  const [editing, setEditing] = useState(false);
  const people = useQuery({ queryKey: ["account-owner-choices", firmId], queryFn: () => listFirmMembers(firmId), retry: false, staleTime: 60_000 });
  // The people the caller may give a lead to (the level rule, as New lead offers them): asked only while the form is open.
  const choosable = useQuery({ queryKey: ["new-lead", firmId, "owners-for-lead"], queryFn: () => listAccountOwners(firmId), enabled: editing, retry: false, staleTime: 60_000 });
  const conflictDialog = useMemo(() => {
    const byId = new Map((people.data ?? []).map((p) => [p.value, p.label]));
    return { noun: "lead", fields: conflictFields((id) => byId.get(id) ?? "Someone in the firm") };
  }, [people.data]);
  const editButton = useRef<HTMLButtonElement>(null);
  const [focusEdit, setFocusEdit] = useState(false);
  useEffect(() => {
    if (focusEdit && !editing) {
      editButton.current?.focus();
      setFocusEdit(false);
    }
  }, [focusEdit, editing]);

  const api = useWorkspaceForm({
    schema: leadEditSchema,
    defaultValues: leadFormOfLead(lead),
    version: lead.version,
    versionOf: (saved: LeadFields) => saved.version,
    save: async (values, started): Promise<LeadFields> => {
      if (started.version === undefined) throw new SaveRefused("Couldn't save the lead. Reload the page and try again.");
      try {
        const answer = await updateLead(firmId, lead.id, leadEditOf(values as LeadForm), started.version);
        if (!("lead" in answer)) throw new SaveConflict({ conflict: true, currentVersion: answer.currentVersion, current: leadFormOf(answer.current), changed: answer.changed });
        return answer.lead;
      } catch (e) {
        if (e instanceof ContactError && e.kind !== "failed") {
          const field = /the owner\b|give a lead only/i.test(e.message) ? "owner_id" : e.message.startsWith("Enter an email") ? "email" : undefined;
          throw new SaveRefused(e.message, field);
        }
        throw e;
      }
    },
    conflictDialog,
    savedValues: (saved) => leadFormOfLead(saved),
    onSaved: (saved) => {
      setEditing(false);
      setFocusEdit(true);
      toast.success("Lead saved");
      onSaved(saved);
    },
    failureMessage: "Couldn't save the lead. Check your connection and try again.",
    onCancel: () => {
      setEditing(false);
      setFocusEdit(true);
    },
  });

  const startEditing = () => {
    api.begin(leadFormOfLead(lead), lead.version);
    setEditing(true);
  };

  // The owner choice: the present owner first (even one the person could not choose, so nothing changes by leaving it), then the people they may give it to.
  const owners = useMemo(() => {
    const present = lead.owner ? [{ value: lead.owner.id, label: lead.owner.name }] : [];
    return [...present, ...(choosable.data ?? []).filter((m) => m.value !== lead.owner?.id)];
  }, [lead.owner, choosable.data]);

  return (
    <section aria-labelledby="lead-details-heading" className="border border-border rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="lead-details-heading" className="font-display text-lg font-bold">Details</h2>
        {canChange && !editing && (
          <button ref={editButton} type="button" onClick={startEditing} className="text-sm text-primary underline underline-offset-2 hover:text-primary/90">
            Edit<span className="sr-only"> the lead's details</span>
          </button>
        )}
      </div>
      {editing ? (
        <WorkspaceForm api={api} aria-labelledby="lead-details-heading" actions={<FormActions />}>
          <Field name="name" label="Name" required>{(field) => <Input {...field} autoFocus />}</Field>
          <Field name="title" label="Title">{(field) => <Input {...field} />}</Field>
          <Field name="business" label="Business">{(field) => <Input {...field} />}</Field>
          <Field name="email" label="Email">{(field) => <Input {...field} type="email" />}</Field>
          <Field name="phone" label="Phone">{(field) => <Input {...field} type="tel" />}</Field>
          <Field name="city" label="City">{(field) => <Input {...field} />}</Field>
          <Field name="state" label="State">
            {(field) => (
              <SelectInput {...field}>
                <option value="">None</option>
                {US_STATE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field name="employees" label="Employees">{(field) => <Input {...field} inputMode="numeric" />}</Field>
          <Field name="current_provider" label="Current provider">{(field) => <Input {...field} />}</Field>
          <Field name="note" label="Note">{(field) => <Textarea {...field} rows={3} />}</Field>
          <Field name="owner_id" label="Owner">
            {(field) => (
              <SelectInput {...field}>
                {lead.owner === null && <option value="">No owner</option>}
                {owners.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            )}
          </Field>
        </WorkspaceForm>
      ) : (
        <dl>
          <Row label="Name">{lead.name}</Row>
          <Row label="Title"><Given value={lead.title} /></Row>
          <Row label="Business"><Given value={lead.business} /></Row>
          <Row label="Email">{lead.email ? <span className="break-all">{lead.email}</span> : <Given value={null} />}</Row>
          <Row label="Phone"><Given value={lead.phone} /></Row>
          <Row label="City"><Given value={lead.city} /></Row>
          <Row label="State"><Given value={lead.state} /></Row>
          <Row label="Employees"><Given value={lead.employees === null ? null : lead.employees.toLocaleString("en-US")} /></Row>
          <Row label="Current provider"><Given value={lead.currentProvider} /></Row>
          <Row label="Note">{lead.note ? <span className="whitespace-pre-wrap">{lead.note}</span> : <Given value={null} />}</Row>
          <Row label="Owner"><Given value={lead.owner?.name ?? null} /></Row>
          <Row label="Source">{LEAD_SOURCE_LABELS[lead.source]}</Row>
          <Row label="Added">{formatDay(lead.createdAt)}</Row>
        </dl>
      )}
    </section>
  );
}
