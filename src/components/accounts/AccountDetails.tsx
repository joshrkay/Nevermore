import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Field, FormActions, SaveConflict, SaveRefused, SelectInput, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { US_STATE_CODES } from "@/data/chamberValidation";
import { accountFieldsSchemaFor } from "@/data/accountFields";
import { addressLines, editOf, formOf, NOT_GIVEN, sourceWords, valueWords, type AccountForm } from "@/data/accountPage";
import { listFirmMembers } from "@/lib/accountsApi";
import { accountKey, useIntakeSaysQuery } from "./useAccountQueries";
import { AccountError, updateAccount, type AccountDetails as Details, type AccountFields } from "@/lib/accountPageApi";

// The account's own fields, down one side of the Overview (story CRM-A2.1b): shown as they are, and edited in place (CRM-S4.1) from the version the person
// started from. Edit is offered only when the database says the person may change the account (`canChange`, the level rule, D-209), and what the database
// refuses is said in its own words beside Save (a closing firm, Nevermore support, a field it will not take). If someone saved first, the conflict dialog
// sets what was typed beside what is there now (D-46).

/** An archive date as a person reads it ("Nov 14, 2026"), the database's text if it is not a date. */
const archivedWords = (v: unknown): string => {
  const date = new Date(String(v));
  return Number.isNaN(date.getTime()) ? String(v) : date.toLocaleDateString("en-US", { dateStyle: "medium" });
};

/**
 * How the conflict dialog names each editable field (by the database's column name) and words its value. Archiving and changing the owner change the version
 * too (CRM-A1.1c), so someone saving at that moment is shown "Archived" and "Owner", not the column names; `ownerName` words an owner by the person's name.
 */
const conflictFields = (ownerName: (id: string) => string) => ({
  archived_at: { label: "Archived", format: archivedWords },
  owner_id: { label: "Owner", format: (v: unknown) => ownerName(String(v)) },
  name: { label: "Account name" },
  trade_name: { label: "Trade name" },
  website: { label: "Website" },
  phone: { label: "Phone" },
  street: { label: "Street" },
  city: { label: "City" },
  state: { label: "State" },
  postal_code: { label: "ZIP" },
  industry: { label: "Industry" },
  employees: { label: "Employees" },
  states_of_operation: { label: "States of operation", format: (v: unknown) => (Array.isArray(v) ? valueWords(v as string[]) : String(v)) },
  current_provider: { label: "Current provider" },
});

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </div>
);
/** "The intake says 23" under a field, with "Use it" for someone who may change the account (D-1715, D-1812). */
const IntakeSays = ({ words, label, canUse, busy, onUse }: { words: string; label: string; canUse: boolean; busy: boolean; onUse: () => void }) => (
  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-muted-foreground">
    <span>The intake says {words}</span>
    {canUse && (
      <button type="button" disabled={busy} onClick={onUse} className="text-primary underline underline-offset-2 hover:text-primary/90 disabled:opacity-50">
        Use it<span className="sr-only"> for {label}</span>
      </button>
    )}
  </span>
);
const Given = ({ value }: { value: string | null }) => (value ? <>{value}</> : <span className="text-muted-foreground">{NOT_GIVEN}</span>);

export function AccountDetailsPanel({ firmId, account, canChange, onSaved }: {
  firmId: string;
  account: Details;
  canChange: boolean;
  /** The saved fields, to put on the page at once (the reload that follows confirms them). */
  onSaved: (fields: AccountFields) => void;
}) {
  const [editing, setEditing] = useState(false);
  // The firm's people, so a conflict over the owner names a person (asked once, kept a minute; a failure leaves "Someone in the firm").
  const people = useQuery({ queryKey: ["account-owner-choices", firmId], queryFn: () => listFirmMembers(firmId), retry: false, staleTime: 60_000 });
  const conflictDialog = useMemo(() => {
    const byId = new Map((people.data ?? []).map((p) => [p.value, p.label]));
    return { noun: "account", fields: conflictFields((id) => byId.get(id) ?? "Someone in the firm") };
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

  // The phone as it was when the edit began: left as it was, it is not judged again, so an older-format phone never blocks a save of another field.
  const [phoneAtStart, setPhoneAtStart] = useState<string | null>(account.phone);
  const schema = useMemo(() => accountFieldsSchemaFor(phoneAtStart), [phoneAtStart]);

  const api = useWorkspaceForm({
    schema,
    defaultValues: formOf(account),
    version: account.version,
    versionOf: (saved: AccountFields) => saved.version,
    save: async (values, started): Promise<AccountFields> => {
      // The version the person started editing from, never the page's live one (a refresh may have brought a newer one).
      if (started.version === undefined) throw new SaveRefused("Couldn't save the account. Reload the page and try again.");
      const answer = await updateAccount(firmId, account.id, editOf(values as AccountForm), started.version);
      // Nothing was saved: the form opens the conflict dialog, and the person chooses.
      if (!("account" in answer)) throw new SaveConflict({ conflict: true, currentVersion: answer.currentVersion, current: formOf(answer.current), changed: answer.changed });
      toast.success("Account saved");
      return answer.account;
    },
    // A number the database's integer can't hold is said under Employees; its other refusals keep the form's usual words.
    explain: (e) => (e instanceof AccountError && e.code === "22003" ? { message: e.message, field: "employees" } : undefined),
    conflictDialog,
    savedValues: (saved) => formOf(saved),
    onSaved: (saved) => {
      setEditing(false);
      setFocusEdit(true);
      onSaved(saved);
    },
    failureMessage: "Couldn't save the account. Check your connection and try again.",
    onCancel: () => {
      setEditing(false);
      setFocusEdit(true);
    },
  });

  const startEditing = () => {
    api.begin(formOf(account), account.version);
    setPhoneAtStart(account.phone);
    setEditing(true);
  };

  const says = useIntakeSaysQuery(firmId, account.id).data ?? {};
  const queryClient = useQueryClient();
  const [using, setUsing] = useState(false);
  // "Use it" is an edit of the account like any other: every field sent from the version on the page, one of them the intake's (the database's save, history and rules).
  const takeIntakeValue = async (change: Partial<AccountForm>) => {
    setUsing(true);
    try {
      const answer = await updateAccount(firmId, account.id, editOf({ ...formOf(account), ...change }), account.version);
      if (!("account" in answer)) {
        toast.error("The account changed since this page was loaded. Reload the page and try again.");
        return;
      }
      toast.success("Account saved");
      onSaved(answer.account);
      await queryClient.invalidateQueries({ queryKey: [...accountKey(firmId, account.id), "intake-says"] });
    } catch (e) {
      toast.error(e instanceof AccountError ? e.message : "Couldn't save the account. Check your connection and try again.");
    } finally {
      setUsing(false);
    }
  };
  // The line under a field where the intake says something else; each one's Use it changes that field alone.
  const suggest = (value: string | number | undefined, label: string, change: Partial<AccountForm>) => value !== undefined && (
    <IntakeSays words={String(value)} label={label} canUse={canChange} busy={using} onUse={() => void takeIntakeValue(change)} />
  );
  const address = addressLines(account);
  return (
    <section aria-labelledby="account-details-heading" className="border border-border rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="account-details-heading" className="font-display text-lg font-bold">Details</h2>
        {canChange && !editing && (
          <button ref={editButton} type="button" onClick={startEditing} className="text-sm text-primary underline underline-offset-2 hover:text-primary/90">
            Edit<span className="sr-only"> the account's details</span>
          </button>
        )}
      </div>
      {editing ? (
        <WorkspaceForm api={api} aria-labelledby="account-details-heading" actions={<FormActions />}>
          <Field name="name" label="Account name" required>{(field) => <Input {...field} autoFocus />}</Field>
          <Field name="trade_name" label="Trade name">{(field) => <Input {...field} />}</Field>
          <Field name="website" label="Website">{(field) => <Input {...field} />}</Field>
          <Field name="phone" label="Phone">{(field) => <Input {...field} type="tel" />}</Field>
          <Field name="street" label="Street">{(field) => <Input {...field} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="city" label="City">{(field) => <Input {...field} />}</Field>
            <Field name="state" label="State">
              {(field) => (
                <SelectInput {...field}>
                  <option value="">No state</option>
                  {US_STATE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
                </SelectInput>
              )}
            </Field>
          </div>
          <Field name="postal_code" label="ZIP">{(field) => <Input {...field} />}</Field>
          <Field name="industry" label="Industry">{(field) => <Input {...field} />}</Field>
          <Field name="employees" label="Employees">{(field) => <Input {...field} inputMode="numeric" />}</Field>
          <Field name="states_of_operation" label="States of operation" help="Two-letter state codes, separated by commas, like OR, WA.">{(field) => <Input {...field} />}</Field>
          <Field name="current_provider" label="Current PEO or payroll provider">{(field) => <Input {...field} />}</Field>
        </WorkspaceForm>
      ) : (
        <dl>
          <Row label="Account name">{account.name}{suggest(says.name, "the account name", { name: says.name })}</Row>
          <Row label="Trade name"><Given value={account.tradeName} /></Row>
          <Row label="Website"><Given value={account.website} />{suggest(says.website, "the website", { website: says.website })}</Row>
          <Row label="Phone"><Given value={account.phone} /></Row>
          <Row label="Address">{address.length > 0 ? address.map((line) => <span key={line} className="block">{line}</span>) : <Given value={null} />}{suggest(says.street, "the street", { street: says.street })}{suggest(says.state, "the state", { state: says.state })}</Row>
          <Row label="Industry"><Given value={account.industry} />{suggest(says.industry, "the industry", { industry: says.industry })}</Row>
          <Row label="Employees"><Given value={account.employees === null ? null : account.employees.toLocaleString("en-US")} />{suggest(says.employees, "employees", { employees: String(says.employees) })}</Row>
          <Row label="States"><Given value={account.statesOfOperation.length > 0 ? account.statesOfOperation.join(", ") : null} />{suggest(says.statesOfOperation?.join(", "), "the states of operation", { states_of_operation: says.statesOfOperation?.join(", ") })}</Row>
          <Row label="Current provider"><Given value={account.currentProvider} />{suggest(says.currentProvider, "the current provider", { current_provider: says.currentProvider })}</Row>
          <Row label="Source">{sourceWords(account.source, account.sourcePartner)}</Row>
          <Row label="Owner"><Given value={account.owner?.name ?? null} /></Row>
        </dl>
      )}
    </section>
  );
}
