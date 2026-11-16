import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ownerChoices } from "@/components/accounts/ownerChoices";
import { accountPath } from "@/components/accounts/accountColumns";
import { accountKey } from "@/components/accounts/useAccountQueries";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormActions, SaveConflict, SaveRefused, SelectInput, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { formatDay, NOT_GIVEN, STAGE_LABELS } from "@/data/accountPage";
import { dollarsWords, editOf, formOfEditable, formOfOpportunity, opportunityFieldsSchema, type OpportunityForm } from "@/data/opportunityPage";
import { listAccountOwners } from "@/lib/accountCreateApi";
import { listFirmMembers } from "@/lib/accountsApi";
import { getActivityOptions } from "@/lib/activityApi";
import { OpportunityError, updateOpportunity, type OpportunityFields, type OpportunityPage } from "@/lib/opportunityPageApi";

// The opportunity's own details, down one side of its page (story CRM-O1.1b, screen 19, D-428): shown as they are, and edited in place (CRM-S4.1) from the version
// the person started from. The account and the stage are shown, never edited: the stage moves only by the intake, a send, a quote, and Mark won or lost (D-408,
// D-411). Edit is offered only when the database says the person may change the opportunity (`canChange`: the level rule on its own owner, D-209, and never on an
// archived account, D-432), and what the database refuses is said in its own words beside Save. If someone saved first, the conflict dialog sets what was typed
// beside what is there now (D-46, D-183). Custom fields wait for Epic 9.

// The conflict dialog hands a value over as the form holds it, text: "9000" is $9,000.
const money = (v: unknown) => (typeof v === "number" || (typeof v === "string" && /^\d+(\.\d+)?$/.test(v)) ? dollarsWords(Number(v)) : String(v));
const day = (v: unknown) => (typeof v === "string" ? formatDay(v) : String(v));

/** How the conflict dialog names each editable field (by the database's column name) and words its value. `ownerName` and `contactName` word a person by their name. */
const conflictFields = (ownerName: (id: string) => string, contactName: (id: string) => string) => ({
  name: { label: "Name" },
  target_start: { label: "Target start", format: day },
  employees: { label: "Employees" },
  main_contact_id: { label: "Main contact", format: (v: unknown) => contactName(String(v)) },
  expected_close: { label: "Expected close", format: day },
  value: { label: "Value", format: money },
  source: { label: "Source" },
  next_step: { label: "Next step" },
  owner_id: { label: "Owner", format: (v: unknown) => ownerName(String(v)) },
  // Marking lost with no intake (CRM-O1.3b) changes the version too.
  lost_at: { label: "Marked lost", format: day },
  lost_by: { label: "Marked lost by", format: (v: unknown) => ownerName(String(v)) },
  // Moving an opportunity to another account (CRM-A2.2) changes its version too.
  account_id: { label: "Account", format: () => "Another account" },
});

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </div>
);
const Given = ({ value }: { value: string | null }) => (value ? <>{value}</> : <span className="text-muted-foreground">{NOT_GIVEN}</span>);

export function OpportunityDetailsPanel({ firmId, page, onSaved }: {
  firmId: string;
  page: OpportunityPage;
  /** The saved fields, to put on the page at once (the reload that follows confirms them). */
  onSaved: (fields: OpportunityFields) => void;
}) {
  const { opportunity, account, owner, canChange } = page;
  const [editing, setEditing] = useState(false);
  // The firm's people, so a conflict over the owner names a person (asked once, kept a minute; a failure leaves "Someone in the firm").
  const people = useQuery({ queryKey: ["account-owner-choices", firmId], queryFn: () => listFirmMembers(firmId), retry: false, staleTime: 60_000 });
  // The people the caller may give an opportunity to (the level rule), and the account's own contacts (the main contact must be one): asked only while the form is open.
  const choosable = useQuery({ queryKey: ["new-account", firmId, "owners-for-contact"], queryFn: () => listAccountOwners(firmId), enabled: editing, retry: false, staleTime: 60_000 });
  const options = useQuery({ queryKey: [...accountKey(firmId, account.id), "options"], queryFn: () => getActivityOptions(firmId, account.id), enabled: editing, retry: false });
  const conflictDialog = useMemo(() => {
    const byId = new Map((people.data ?? []).map((p) => [p.value, p.label]));
    const contacts = new Map((options.data?.contacts ?? []).map((c) => [c.id, c.name]));
    return { noun: "opportunity", fields: conflictFields((id) => byId.get(id) ?? "Someone in the firm", (id) => contacts.get(id) ?? "Another contact") };
  }, [people.data, options.data]);
  // A save closes the form, and the Save button that had focus goes with it: focus goes to Edit, which takes its place.
  const editButton = useRef<HTMLButtonElement>(null);
  const [focusEdit, setFocusEdit] = useState(false);
  useEffect(() => {
    if (focusEdit && !editing) {
      editButton.current?.focus();
      setFocusEdit(false);
    }
  }, [focusEdit, editing]);

  const api = useWorkspaceForm({
    schema: opportunityFieldsSchema,
    defaultValues: formOfOpportunity(opportunity),
    version: opportunity.version,
    versionOf: (saved: OpportunityFields) => saved.version,
    save: async (values, started): Promise<OpportunityFields> => {
      // The version the person started editing from, never the page's live one (a refresh may have brought a newer one).
      if (started.version === undefined) throw new SaveRefused("Couldn't save the opportunity. Reload the page and try again.");
      try {
        const answer = await updateOpportunity(firmId, opportunity.id, editOf(values as OpportunityForm), started.version);
        // Nothing was saved: the form opens the conflict dialog, and the person chooses.
        if (!("opportunity" in answer)) throw new SaveConflict({ conflict: true, currentVersion: answer.currentVersion, current: formOfEditable(answer.current), changed: answer.changed });
        return answer.opportunity;
      } catch (e) {
        if (e instanceof OpportunityError && (e.kind === "invalid" || e.kind === "notAllowed" || e.kind === "readOnly" || e.kind === "notFound")) {
          const field = /choose .*owner|as the owner|give an opportunity only|who can see this account/i.test(e.message) ? "owner_id" : /contact of this account/i.test(e.message) ? "main_contact_id" : undefined;
          throw new SaveRefused(e.message, field);
        }
        throw e;
      }
    },
    conflictDialog,
    savedValues: (saved) => formOfOpportunity(saved),
    onSaved: (saved) => {
      setEditing(false);
      setFocusEdit(true);
      toast.success("Opportunity saved");
      onSaved(saved);
    },
    failureMessage: "Couldn't save the opportunity. Check your connection and try again.",
    onCancel: () => {
      setEditing(false);
      setFocusEdit(true);
    },
  });

  const startEditing = () => {
    api.begin(formOfOpportunity(opportunity), opportunity.version);
    setEditing(true);
  };

  // The owner choice: the present owner first (even one the person could not choose, so nothing changes by leaving it), then the people the database lets them give it to.
  const ownerNow = api.form.watch("owner_id") as string;
  const owners = useMemo(() => ownerChoices(owner, choosable.data ?? [], people.data ?? [], ownerNow), [owner, choosable.data, people.data, ownerNow]);
  // The main contact box likewise always holds the contact the form holds, named from the account's contacts, else "Another contact" (the list may not have loaded).
  const contactNow = api.form.watch("main_contact_id") as string;
  const contactOptions = useMemo(() => {
    const listed = (options.data?.contacts ?? []).map((c) => ({ value: c.id, label: c.name }));
    if (contactNow !== "" && !listed.some((c) => c.value === contactNow)) {
      const label = contactNow === page.mainContact?.id ? page.mainContact.name : "Another contact";
      return [...listed, { value: contactNow, label }];
    }
    return listed;
  }, [options.data, contactNow, page.mainContact]);

  return (
    <section aria-labelledby="opportunity-details-heading" className="border border-border rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="opportunity-details-heading" className="font-display text-lg font-bold">Details</h2>
        {canChange && !editing && (
          <button ref={editButton} type="button" onClick={startEditing} className="text-sm text-primary underline underline-offset-2 hover:text-primary/90">
            Edit<span className="sr-only"> the opportunity's details</span>
          </button>
        )}
      </div>
      {editing ? (
        <WorkspaceForm api={api} aria-labelledby="opportunity-details-heading" actions={<FormActions />}>
          <Field name="name" label="Name" required>{(field) => <Input {...field} autoFocus />}</Field>
          <Field name="target_start" label="Target start">{(field) => <Input {...field} type="date" />}</Field>
          <Field name="employees" label="Employees">{(field) => <Input {...field} inputMode="numeric" />}</Field>
          <Field name="main_contact_id" label="Main contact">
            {(field) => (
              <SelectInput {...field} disabled={options.isPending}>
                <option value="">No main contact</option>
                {contactOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field name="expected_close" label="Expected close">{(field) => <Input {...field} type="date" />}</Field>
          <Field name="value" label="Value" help="Dollars a year, like 7100.">{(field) => <Input {...field} inputMode="decimal" />}</Field>
          <Field name="source" label="Source">{(field) => <Input {...field} />}</Field>
          <Field name="next_step" label="Next step">{(field) => <Textarea {...field} rows={3} />}</Field>
          <Field name="owner_id" label="Owner">
            {(field) => (
              <SelectInput {...field}>
                {owner === null && <option value="">No owner</option>}
                {owners.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            )}
          </Field>
        </WorkspaceForm>
      ) : (
        <dl>
          <Row label="Account"><Link to={accountPath(account.id)} className="text-primary underline underline-offset-2 hover:text-primary/90">{account.name}</Link></Row>
          <Row label="Stage">{STAGE_LABELS[opportunity.stage]}</Row>
          <Row label="Target start"><Given value={opportunity.targetStart ? formatDay(opportunity.targetStart) : null} /></Row>
          <Row label="Employees"><Given value={opportunity.employees === null ? null : opportunity.employees.toLocaleString("en-US")} /></Row>
          <Row label="Expected close"><Given value={opportunity.expectedClose ? formatDay(opportunity.expectedClose) : null} /></Row>
          <Row label="Value"><Given value={opportunity.value === null ? null : `${dollarsWords(opportunity.value)} a year`} /></Row>
          <Row label="Source"><Given value={opportunity.source} /></Row>
          <Row label="Next step"><Given value={opportunity.nextStep} /></Row>
          <Row label="Owner"><Given value={owner?.name ?? null} /></Row>
        </dl>
      )}
    </section>
  );
}
