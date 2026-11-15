import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormActions, SaveRefused, SelectInput, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { US_STATE_CODES } from "@/data/chamberValidation";
import { accountFieldsSchema } from "@/data/accountFields";
import { listFirmMembers } from "@/lib/accountsApi";
import {
  applyBulkChange, BULK_FIELDS, BulkChangeError, firmLabels, previewBulkChange,
  type BulkAction, type BulkField, type BulkOutcome, type BulkSelection,
} from "@/lib/bulkChangeApi";
import { accountsWords, changeWords, spelled, FIELD_WORDS, plural, skippedLine, unavailableWords, unchangedWords, valueSent } from "./bulkWords";

// The dialog that says exactly what a bulk change will do, from the database's own preview, before anything changes (story CRM-S3.7a, screen 36). The four
// bar actions open it: Change owner, Set a field, Label (add or remove) and Archive. It asks the preview whenever what is chosen is complete, shows the
// count that will change, the accounts that stay as they are, and every skipped account by name with the reason, and its button makes the change only
// for what the preview showed. Every refusal comes back in words (the database's, CRM-S3.7b). Fields use the shared form kit.

export type BulkKind = "owner" | "field" | "label" | "archive";

/** What the dialog tells the page when a change has been made, so the page can offer Undo and ask the table again. */
export interface BulkMade {
  action: BulkAction;
  outcome: BulkOutcome;
  /** For an owner change: whether the open opportunities were taken along. */
  withOpportunities: boolean;
  /** What the check showed, so the result can say when the change was not that (accounts that started or stopped matching in between). */
  previewed: BulkOutcome;
}

const TITLES: Record<BulkKind, string> = { owner: "Change owner", field: "Set a field", label: "Add or remove a label", archive: "Archive" };
const ASKS: Record<BulkKind, string> = {
  owner: "Choose who will own these accounts.",
  field: "Choose the field to set. A blank value clears it.",
  label: "Add a label to these accounts, or take one off.",
  archive: "Archived accounts leave every view but Archived, and nothing can be added to them.",
};

const useDebounced = <T,>(value: T, ms: number): T => {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setHeld(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return held;
};

type Values = { owner: string; withOpen: boolean; field: string; value: string; mode: "label_add" | "label_remove"; name: string };
const EMPTY: Values = { owner: "", withOpen: true, field: "", value: "", mode: "label_add", name: "" };

const schemaFor = (kind: BulkKind) => z.object({
  owner: kind === "owner" ? z.string().min(1, "Choose who will own these accounts.") : z.string(),
  withOpen: z.boolean(),
  field: kind === "field" ? z.string().refine((f) => (BULK_FIELDS as readonly string[]).includes(f), "Choose the field to set.") : z.string(),
  value: z.string(),
  mode: z.enum(["label_add", "label_remove"]),
  name: kind === "label" ? z.string().trim().min(1, "Type a label.").max(40, "Keep a label to 40 characters.") : z.string(),
}).superRefine((v, ctx) => {
  if (kind !== "field" || !(BULK_FIELDS as readonly string[]).includes(v.field)) return;
  // The account's own rules for each field, so the dialog never asks the database for what it would refuse for its shape.
  const rule = accountFieldsSchema.shape[v.field as keyof typeof accountFieldsSchema.shape];
  const checked = rule.safeParse(v.value);
  if (!checked.success) ctx.addIssue({ code: "custom", path: ["value"], message: checked.error.issues[0]?.message ?? "Check the value." });
});

/** The change the choices make, or null while they are not complete (nothing is asked of the database until they are). */
const actionOf = (kind: BulkKind, v: Values): BulkAction | null => {
  switch (kind) {
    case "archive": return { action: "archive" };
    // The preview always asks with the open opportunities, so the checkbox can say how many there are; the change sends the box as it is.
    case "owner": return v.owner ? { action: "owner", ownerId: v.owner, changeOpenOpportunities: true } : null;
    case "label": return v.name.trim() ? { action: v.mode, name: v.name.trim() } : null;
    case "field": {
      if (!(BULK_FIELDS as readonly string[]).includes(v.field)) return null;
      const field = v.field as BulkField;
      if (!accountFieldsSchema.shape[field].safeParse(v.value).success) return null;
      return { action: "field", field, value: valueSent(field, v.value) };
    }
  }
};

export function BulkChangeDialog({ firmId, kind, selection, count, onClose, onMade }: {
  firmId: string;
  kind: BulkKind;
  /** What was selected when the dialog opened: the ids, or the table's filters for "all that match". */
  selection: BulkSelection;
  /** How many the person selected, as the table counts them. */
  count: number;
  onClose: () => void;
  onMade: (made: BulkMade) => void;
}) {
  const people = useQuery({ queryKey: ["bulk-owner-choices", firmId], queryFn: () => listFirmMembers(firmId), enabled: kind === "owner", retry: false, staleTime: 60_000 });
  const labels = useQuery({ queryKey: ["bulk-labels", firmId], queryFn: () => firmLabels(firmId), enabled: kind === "label", retry: false, gcTime: 0 });

  const schema = useMemo(() => schemaFor(kind), [kind]);
  // Held where a save can read the newest: the preview a person is looking at, and the box for the open opportunities.
  const previewed = useRef<{ key: string; outcome: BulkOutcome } | null>(null);
  const failure = useRef<string | null>(null);

  const api = useWorkspaceForm({
    schema,
    defaultValues: EMPTY,
    save: async (values) => {
      const v = values as Values;
      const wanted = actionOf(kind, v);
      if (!wanted) throw new SaveRefused("Choose what to change first.");
      const sent: BulkAction = wanted.action === "owner" ? { ...wanted, changeOpenOpportunities: v.withOpen } : wanted;
      // Only what the dialog showed is made: a preview of other choices, or none yet, is waited for.
      if (failure.current) throw new SaveRefused(failure.current);
      if (!previewed.current || previewed.current.key !== JSON.stringify(wanted)) throw new SaveRefused("Wait for the check above to finish, then try again.");
      const shown = previewed.current.outcome;
      if (shown.tooMany) throw new SaveRefused(tooManyWords(shown.selected));
      // An owner change whose accounts already have that owner still changes their open opportunities when the box is ticked.
      const reaches = shown.changed + (sent.action === "owner" && sent.changeOpenOpportunities ? (shown.opportunities?.changed ?? 0) : 0);
      if (reaches === 0) throw new SaveRefused("Nothing would change, so there is nothing to do.");
      try {
        const outcome = await applyBulkChange(firmId, sent, selection);
        return { action: sent, outcome, withOpportunities: sent.action === "owner" && v.withOpen, previewed: shown } satisfies BulkMade;
      } catch (e) {
        if (e instanceof BulkChangeError) throw new SaveRefused(e.message);
        throw e;
      }
    },
    onSaved: (made) => onMade(made),
    failureMessage: "Couldn't make that change. Check your connection and try again.",
    onCancel: onClose,
  });

  const values = api.form.watch() as Values;
  const wanted = actionOf(kind, values);
  // Debounced as text: an object made new on every render would restart the wait each time, and an open dialog would draw again and again.
  const key = JSON.stringify(wanted);
  const asked = useDebounced(key, 350);
  const settled = JSON.parse(asked) as BulkAction | null;
  const current = key === asked;

  const preview = useQuery({
    queryKey: ["bulk-preview", firmId, asked, "ids" in selection ? selection.ids : selection.filters],
    queryFn: () => previewBulkChange(firmId, settled as BulkAction, selection),
    enabled: settled !== null,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const showing = wanted !== null && current && preview.isSuccess && !preview.isFetching ? preview.data : null;
  const refused = wanted !== null && current && preview.isError ? preview.error : null;
  previewed.current = showing && wanted ? { key, outcome: showing } : null;
  failure.current = refused ? (refused instanceof Error ? refused.message : "Couldn't check that change. Try again.") : null;
  const checking = wanted !== null && !showing && !refused;

  const opportunities = showing?.opportunities ?? null;
  const offerOpportunities = kind === "owner" && opportunities !== null && opportunities.changed + opportunities.skipped > 0;
  // The button says how many it will change, from the preview; with none to count (not checked yet, over the limit, nothing to do) it says what it is.
  const many = showing && !showing.tooMany && showing.changed > 0 ? accountsWords(showing.changed) : null;
  const onlyOpportunities = kind === "owner" && values.withOpen && showing && !showing.tooMany && showing.changed === 0 && (showing.opportunities?.changed ?? 0) > 0;
  const confirm = onlyOpportunities ? "Change open opportunities" : kind === "archive" ? (many ? `Archive ${many}` : "Archive accounts") : many ? `Change ${many}` : "Change accounts";

  return (
    <Dialog open onOpenChange={(next) => { if (!next) api.requestClose(onClose); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle className="font-display text-xl font-bold">{TITLES[kind]}: {accountsWords(count)}</DialogTitle>
        <DialogDescription>{ASKS[kind]}</DialogDescription>
        <WorkspaceForm api={api} aria-label={TITLES[kind]} actions={<FormActions submitLabel={confirm} savingLabel="Changing…" />}>
          {kind === "owner" && (
            <Field name="owner" label="New owner" required>
              {(field) => (
                <SelectInput {...field} autoFocus disabled={people.isPending}>
                  <option value="">{people.isPending ? "Loading people" : "Choose a person"}</option>
                  {(people.data ?? []).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </SelectInput>
              )}
            </Field>
          )}
          {kind === "owner" && people.isError && <p role="alert" className="text-sm text-destructive">Couldn't load the firm's people. Close this and try again.</p>}
          {kind === "field" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="field" label="Field" required>
                {(field) => (
                  <SelectInput {...field} autoFocus>
                    <option value="">Choose a field</option>
                    {BULK_FIELDS.map((f) => <option key={f} value={f}>{FIELD_WORDS[f]}</option>)}
                  </SelectInput>
                )}
              </Field>
              <Field name="value" label="New value" help={values.field === "states_of_operation" ? "Two-letter state codes, separated by commas, like OR, WA. Blank clears it." : "Leave it blank to clear the field."}>
                {(field) => values.field === "state" ? (
                  <SelectInput {...field}>
                    <option value="">No state</option>
                    {US_STATE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
                  </SelectInput>
                ) : <Input {...field} inputMode={values.field === "employees" ? "numeric" : undefined} type={values.field === "phone" ? "tel" : "text"} />}
              </Field>
            </div>
          )}
          {kind === "label" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="mode" label="Change">
                {(field) => (
                  <SelectInput
                    {...field}
                    autoFocus
                    onChange={(e) => {
                      field.onChange(e);
                      // A word typed to add is not a label chosen to remove: the other half starts empty.
                      api.form.setValue("name", "");
                    }}
                  >
                    <option value="label_add">Add a label</option>
                    <option value="label_remove">Remove a label</option>
                  </SelectInput>
                )}
              </Field>
              {values.mode === "label_add" ? (
                <Field name="name" label="Label" required help="Type a new word, or one the firm already uses.">
                  {(field) => (
                    <Input {...field} list="bulk-label-words" autoComplete="off" />
                  )}
                </Field>
              ) : (
                <Field name="name" label="Label" required>
                  {(field) => (
                    <SelectInput {...field} disabled={labels.isPending}>
                      <option value="">{labels.isPending ? "Loading labels" : labels.data?.length === 0 ? "The firm has no labels yet" : "Choose a label"}</option>
                      {(labels.data ?? []).map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </SelectInput>
                  )}
                </Field>
              )}
            </div>
          )}
          {kind === "label" && <datalist id="bulk-label-words">{(labels.data ?? []).map((l) => <option key={l.id} value={l.name} />)}</datalist>}
          {kind === "label" && labels.isError && <p role="alert" className="text-sm text-destructive">Couldn't load the firm's labels. You can still type a label to add.</p>}

          <div aria-live="polite" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            {kind !== "archive" && wanted === null && <p className="text-muted-foreground">Once you have chosen, this says exactly what will happen.</p>}
            {checking && <p role="status" className="text-muted-foreground">Checking what this will do…</p>}
            {refused && <p role="alert" className="text-destructive">{refused instanceof Error ? refused.message : "Couldn't check that change. Try again."}</p>}
            {showing && wanted && <WhatWillHappen outcome={showing} action={wanted} withOpen={values.withOpen} />}
          </div>

          {offerOpportunities && opportunities && (
            <div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={values.withOpen} onChange={(e) => api.form.setValue("withOpen", e.target.checked, { shouldDirty: true })} className="mt-1" />
                <span>Also change the owner of their {plural(opportunities.changed, "open opportunity", "open opportunities")}</span>
              </label>
              {opportunities.skipped > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {plural(opportunities.skipped, "open opportunity", "open opportunities")} you can't change will stay as {opportunities.skipped === 1 ? "it is" : "they are"}.
                </p>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">You can undo this for ten minutes. It is recorded in each account's history.</p>
        </WorkspaceForm>
      </DialogContent>
    </Dialog>
  );
}

const tooManyWords = (n: number) => `That is ${n.toLocaleString("en-US")} accounts. A bulk change takes at most 1,000: narrow the selection and try again.`;

/** The preview's answer in words: how many change, how many stay as they are, and every skipped account by name and why. */
function WhatWillHappen({ outcome, action, withOpen }: { outcome: BulkOutcome; action: BulkAction; withOpen: boolean }) {
  if (outcome.tooMany) return <p role="alert" className="font-medium text-destructive">{tooManyWords(outcome.selected)}</p>;
  return (
    <div className="space-y-2">
      <p className="font-semibold">
        {outcome.changed === 0 && action.action === "owner" && withOpen && (outcome.opportunities?.changed ?? 0) > 0
          ? `This will change the owner of their ${plural(outcome.opportunities?.changed ?? 0, "open opportunity", "open opportunities")}.`
          : outcome.changed === 0 ? "Nothing will change." : `This will ${changeWords(spelled(action, outcome), outcome.changed, outcome.ownerName, false)}.`}
      </p>
      {outcome.unchanged > 0 && <p>{unchangedWords(outcome.unchanged, action)}</p>}
      {outcome.skipped.length > 0 && (
        <div className="text-warning">
          <p className="font-semibold">{outcome.skipped.length === 1 ? "1 will be skipped" : `${outcome.skipped.length.toLocaleString("en-US")} will be skipped`}</p>
          <ul className="mt-1 max-h-40 list-disc space-y-1 overflow-y-auto pl-5">
            {outcome.skipped.map((s) => <li key={s.id}>{skippedLine(s)}</li>)}
          </ul>
        </div>
      )}
      {outcome.unavailable > 0 && <p className="text-muted-foreground">{unavailableWords(outcome.unavailable)}</p>}
    </div>
  );
}
