import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormActions, SaveConflict, SaveRefused, SelectInput, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { addRenewalSchema, editRenewalSchema, kindLabel, notRenewedSchema, RENEWAL_KINDS } from "@/data/renewals";
import { formatDay } from "@/data/accountPage";
import { NOT_THEIRS } from "./renewalActions";
import {
  addRenewal, deleteRenewal, markNotRenewed, RenewalError, updateRenewal, type Renewal, type RenewalConflict, type RenewalSaved,
} from "@/lib/renewalsApi";

// The forms of an account's Renewals tab (story CRM-A2.4b, screen 17): Add a renewal, Edit, "Didn't renew" and its undo, and Delete. Each is a workspace form (CRM-S4.1)
// over the account; the database decides who may add (anyone who may see the account), who may change (whoever may change it), an archived account, a closing firm,
// Nevermore support and every field, and this shows its own words. A change names the version the person started from; if someone saved first, the conflict
// dialog sets what was typed beside what is there now (D-46).


/** A refusal the form shows in the database's words (a field's, under it when the words name it). */
const refused = (e: unknown): never => {
  if (e instanceof RenewalError && e.kind !== "failed") throw new SaveRefused(e.message, e.kind === "invalid" ? fieldOf(e.message) : undefined);
  throw e;
};
const fieldOf = (message: string): string | undefined => {
  // The database's words for each field (renewal_input_error): "Say who it is with.", "Keep who it is with to 80 characters.", "Give the renewal date." A start date's refusal
  // ("Only a PEO placement has a start date.") is about no field of this form's own, so it shows beside the buttons.
  if (/who it is with/i.test(message)) return "with_whom";
  if (/the renewal date/i.test(message)) return "renews_on";
  return undefined;
};

/** A dialog that closes through its form's own question when the form has unsaved changes. */
function FormDialog({ title, description, closer, onClose, children }: {
  title: string; description: string; closer: MutableRefObject<(() => void) | null>; onClose: () => void; children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(next) => { if (!next) (closer.current ?? onClose)(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function AddRenewalDialog({ firmId, accountId, onClose, onAdded }: { firmId: string; accountId: string; onClose: () => void; onAdded: (renewal: Renewal) => void }) {
  const closer = useRef<(() => void) | null>(null);
  const api = useWorkspaceForm({
    schema: addRenewalSchema,
    defaultValues: { kind: "peo_placement", with_whom: "", renews_on: "", placement_start: "" },
    save: async (values) => {
      const v = values as Record<string, string>;
      try {
        return await addRenewal(firmId, accountId, { kind: v.kind as "peo_placement" | "current_plan", withWhom: v.with_whom, renewsOn: v.renews_on, placementStartOn: v.placement_start });
      } catch (e) {
        return refused(e);
      }
    },
    onSaved: (renewal) => {
      toast.success("Renewal added");
      onAdded(renewal);
    },
    failureMessage: "Couldn't add the renewal. Check your connection and try again.",
    onCancel: onClose,
  });
  useEffect(() => {
    closer.current = () => api.requestClose(onClose);
    return () => { closer.current = null; };
  });
  const kind = api.form.watch("kind");
  return (
    <FormDialog title="Add a renewal" description="A date this account's cover comes up." closer={closer} onClose={onClose}>
      <WorkspaceForm api={api} aria-label="Add a renewal" actions={<FormActions submitLabel="Add renewal" savingLabel="Adding…" />}>
        <Field name="kind" label="What renews" required>
          {(field) => <SelectInput {...field}>{RENEWAL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</SelectInput>}
        </Field>
        <Field name="with_whom" label="With" required>{(field) => <Input {...field} autoFocus maxLength={80} />}</Field>
        <Field name="renews_on" label="Renewal date" required>{(field) => <Input {...field} type="date" />}</Field>
        {kind === "peo_placement" && (
          <Field name="placement_start" label="Placement start date" help="When the placement started, if you know.">{(field) => <Input {...field} type="date" />}</Field>
        )}
      </WorkspaceForm>
    </FormDialog>
  );
}

/** Someone else's answer to a save, as the form's conflict. */
const conflictOf = (answer: RenewalConflict) =>
  new SaveConflict({ conflict: true, currentVersion: answer.currentVersion, current: answer.current, changed: answer.changed });

export function EditRenewalDialog({ firmId, renewal, onClose, onSaved }: { firmId: string; renewal: Renewal; onClose: () => void; onSaved: (renewal: Renewal) => void }) {
  const closer = useRef<(() => void) | null>(null);
  const api = useWorkspaceForm({
    schema: editRenewalSchema,
    defaultValues: { with_whom: renewal.withWhom, renews_on: renewal.renewsOn },
    version: renewal.version,
    versionOf: (saved: Renewal) => saved.version,
    save: async (values, started): Promise<Renewal> => {
      const v = values as Record<string, string>;
      if (started.version === undefined) throw new SaveRefused("Couldn't save the renewal. Reload the page and try again.");
      let answer: RenewalSaved | RenewalConflict;
      try {
        answer = await updateRenewal(firmId, renewal.id, { withWhom: v.with_whom, renewsOn: v.renews_on }, started.version);
      } catch (e) {
        return refused(e);
      }
      if (answer.conflict) throw conflictOf(answer);
      return (answer as RenewalSaved).renewal;
    },
    conflictDialog: {
      noun: "renewal",
      fields: { with_whom: { label: "With" }, renews_on: { label: "Renewal date", format: (v: unknown) => formatDay(String(v)) } },
      toValues: (current: RenewalConflict["current"]) => ({ with_whom: current.withWhom ?? "", renews_on: current.renewsOn ?? "" }),
    },
    savedValues: (saved) => ({ with_whom: saved.withWhom, renews_on: saved.renewsOn }),
    onSaved: (saved) => {
      toast.success("Renewal saved");
      onSaved(saved);
    },
    failureMessage: "Couldn't save the renewal. Check your connection and try again.",
    onCancel: onClose,
  });
  useEffect(() => {
    closer.current = () => api.requestClose(onClose);
    return () => { closer.current = null; };
  });
  return (
    <FormDialog title="Edit the renewal" description={`${kindLabel(renewal.kind)}.`} closer={closer} onClose={onClose}>
      <WorkspaceForm api={api} aria-label="Edit the renewal" actions={<FormActions />}>
        <Field name="with_whom" label="With" required>{(field) => <Input {...field} autoFocus maxLength={80} />}</Field>
        <Field name="renews_on" label="Renewal date" required>{(field) => <Input {...field} type="date" />}</Field>
      </WorkspaceForm>
    </FormDialog>
  );
}

/** "Didn't renew": the day (offered as the renewal's date, D-451). The placement it came from ends that day. */
export function NotRenewedDialog({ firmId, renewal, onClose, onSaved }: { firmId: string; renewal: Renewal; onClose: () => void; onSaved: (renewal: Renewal) => void }) {
  const closer = useRef<(() => void) | null>(null);
  const api = useWorkspaceForm({
    schema: notRenewedSchema,
    defaultValues: { not_renewed_on: renewal.renewsOn },
    version: renewal.version,
    versionOf: (saved: Renewal) => saved.version,
    save: async (values, started): Promise<Renewal> => {
      if (started.version === undefined) throw new SaveRefused("Couldn't save the renewal. Reload the page and try again.");
      let answer: RenewalSaved | RenewalConflict;
      try {
        answer = await markNotRenewed(firmId, renewal.id, (values as Record<string, string>).not_renewed_on, started.version);
      } catch (e) {
        return refused(e);
      }
      if (answer.conflict) throw conflictOf(answer);
      return (answer as RenewalSaved).renewal;
    },
    conflictDialog: {
      noun: "renewal",
      fields: { not_renewed_on: { label: "Didn't renew on", format: (v: unknown) => formatDay(String(v)) } },
      toValues: (current: RenewalConflict["current"]) => ({ not_renewed_on: current.notRenewedOn ?? "" }),
    },
    savedValues: (saved) => ({ not_renewed_on: saved.notRenewedOn ?? "" }),
    onSaved: (saved) => {
      toast.success("Marked as not renewed");
      onSaved(saved);
    },
    failureMessage: "Couldn't save the renewal. Check your connection and try again.",
    onCancel: onClose,
  });
  useEffect(() => {
    closer.current = () => api.requestClose(onClose);
    return () => { closer.current = null; };
  });
  return (
    <FormDialog
      title="Didn't renew"
      description={renewal.kind === "peo_placement" ? "The placement it came from ends on this day." : "This renewal is then done."}
      closer={closer}
      onClose={onClose}
    >
      <WorkspaceForm api={api} aria-label="Didn't renew" actions={<FormActions submitLabel="Mark as not renewed" />}>
        <Field name="not_renewed_on" label="Day it didn't renew" required>{(field) => <Input {...field} type="date" autoFocus />}</Field>
      </WorkspaceForm>
    </FormDialog>
  );
}

/** The question before a renewal is deleted. A renewal a win made is deleted only by reopening that win, so it is not offered here. */
export function DeleteRenewalDialog({ firmId, renewal, onClose, onDeleted }: { firmId: string; renewal: Renewal; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const answer = await deleteRenewal(firmId, renewal.id, renewal.version);
      if (answer.conflict) toast.error(NOT_THEIRS);
      else toast.success("Renewal deleted");
      onDeleted();
    } catch (e) {
      toast.error(e instanceof RenewalError ? e.message : "Couldn't delete the renewal. Check your connection and try again.");
      onDeleted();
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this renewal?</AlertDialogTitle>
          <AlertDialogDescription>
            {kindLabel(renewal.kind)}, with {renewal.withWhom}, on {formatDay(renewal.renewsOn)}.
            {renewal.kind === "peo_placement" ? " A placement added with it by hand goes too." : ""} This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void go()}>{busy ? "Deleting…" : "Delete renewal"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
