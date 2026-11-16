import { cloneElement, isValidElement, useEffect, useMemo, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ActivityError, CALL_OUTCOMES, getActivityOptions, logActivity, OUTCOME_LABELS, updateActivity,
  type ActivityItem, type ActivityType, type CallOutcome, type Logged,
} from "@/lib/activityApi";
import { accountKey } from "./useAccountQueries";

// Log a call, a note or a task on an account (story CRM-E1.5, screen 27), or change a call or a task, or a note's text (D-200). The form checks nothing the
// database checks: it sends what was typed and says in the database's own words what is wrong, so the two can never disagree.

const SELECT_CLASS = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Form = {
  kind: ActivityType; contactId: string; opportunityId: string; when: string; outcome: CallOutcome; body: string; title: string; due: string; forId: string;
  followUp: boolean; followTitle: string; followDue: string; followFor: string;
};

/** A moment as the datetime field holds it: the person's own time, to the minute. */
const localInput = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const KIND_TITLES: Record<ActivityType, { log: string; edit: string }> = {
  call: { log: "Log a call", edit: "Edit call" },
  note: { log: "Add a note", edit: "Edit note" },
  task: { log: "Add a task", edit: "Edit task" },
};

const failureWords = (err: unknown): string =>
  err instanceof ActivityError ? err.message : "Couldn't save that. Check your connection and try again.";

/**
 * The form in a dialog. `item` makes it an edit of that call, task or note (its kind cannot change, and a call has no follow-up); otherwise it logs a new
 * one of `kind`, with `contactId` already chosen when it was opened from a contact and `opportunityId` when it was opened from an opportunity. `userId` is the person, who is who a task is for unless they choose.
 */
export function LogActivityDialog({ firmId, accountId, accountName, kind, contactId, opportunityId, item, userId, onClose, onSaved }: {
  firmId: string;
  accountId: string;
  accountName: string;
  kind: ActivityType;
  contactId?: string | null;
  /** Already chosen as what it is about, when the form was opened from an opportunity (CRM-O1.1b). */
  opportunityId?: string | null;
  item?: ActivityItem;
  userId: string | null;
  onClose: () => void;
  onSaved: (logged: Logged | { activity: ActivityItem; followUp: null }) => void;
}) {
  const options = useQuery({ queryKey: [...accountKey(firmId, accountId), "options"], queryFn: () => getActivityOptions(firmId, accountId), retry: false });
  const current = useMemo(() => options.data?.people ?? [], [options.data]);
  // The person a task is for, when they have left the firm: kept as the choice, named as having left, unless the editor picks someone else. Never quietly the editor.
  const departed = options.data && item?.type === "task" && item.assignee && !current.some((p) => p.id === item.assignee?.id) ? item.assignee : null;
  const people = useMemo(
    () => (departed ? [{ id: departed.id, name: `${departed.name ?? "Someone"} (left the firm)` }, ...current] : current),
    [current, departed],
  );
  const [form, setForm] = useState<Form>(() => ({
    kind: item?.type ?? kind,
    contactId: item?.contact?.id ?? contactId ?? "",
    opportunityId: item?.opportunity?.id ?? opportunityId ?? "",
    when: localInput(item?.type === "call" ? new Date(item.at) : new Date()),
    outcome: item?.outcome ?? "spoke",
    body: item?.body ?? "",
    title: item?.title ?? "",
    due: item?.dueOn ?? "",
    forId: item?.assignee?.id ?? userId ?? "",
    followUp: false, followTitle: "", followDue: "", followFor: userId ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const editing = item !== undefined;
  const k = form.kind;

  // Who a task is for, when the person is not one of the choices (they left, or the list is still on its way): the database takes the person logging it.
  useEffect(() => {
    if (!editing && people.length > 0) setForm((f) => (f.forId && people.some((p) => p.id === f.forId) ? f : { ...f, forId: people.find((p) => p.id === userId)?.id ?? people[0].id }));
  }, [people, userId, editing]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setProblem(null);
    const at = k === "call" && form.when ? new Date(form.when).toISOString() : null;
    try {
      if (editing) {
        const saved = await updateActivity(firmId, item.id, {
          contactId: form.contactId || null, opportunityId: form.opportunityId || null, at, outcome: k === "call" ? form.outcome : null,
          body: form.body, title: form.title, dueOn: form.due || null, forId: form.forId || null,
        });
        onSaved({ activity: saved, followUp: null });
      } else {
        onSaved(await logActivity(firmId, {
          kind: k, accountId, contactId: form.contactId || null, opportunityId: form.opportunityId || null, at, outcome: k === "call" ? form.outcome : null,
          body: form.body, title: form.title, dueOn: form.due || null, forId: k === "task" ? form.forId || null : null,
          followUp: k === "call" && form.followUp ? { title: form.followTitle, dueOn: form.followDue || null, forId: form.followFor || null } : null,
        }));
      }
    } catch (err) {
      setProblem(failureWords(err));
      setSaving(false);
    }
  };

  const noteEdit = editing && k === "note";
  const heading = editing ? KIND_TITLES[k].edit : KIND_TITLES[k].log;
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>On {accountName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          {!editing && (
            <div role="group" aria-label="What to log" className="flex gap-2">
              {(["call", "note", "task"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={k === t}
                  onClick={() => set("kind", t)}
                  className={`min-h-10 rounded-md border px-4 text-sm ${k === t ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-muted"}`}
                >
                  {t === "call" ? "Call" : t === "note" ? "Note" : "Task"}
                </button>
              ))}
            </div>
          )}
          {!noteEdit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Choice label="With" value={form.contactId} onChange={(v) => set("contactId", v)} none="No one in particular" loading={options.isPending}
                choices={(options.data?.contacts ?? []).map((c) => ({ id: c.id, name: c.title ? `${c.name}, ${c.title}` : c.name }))} />
              <Choice label="About" value={form.opportunityId} onChange={(v) => set("opportunityId", v)} none="Nothing in particular" loading={options.isPending}
                choices={options.data?.opportunities ?? []} />
            </div>
          )}
          {k === "call" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Labelled label="When"><Input type="datetime-local" value={form.when} onChange={(e) => set("when", e.target.value)} /></Labelled>
                <Labelled label="Outcome">
                  {(id) => (
                    <select id={id} className={SELECT_CLASS} value={form.outcome} onChange={(e) => set("outcome", e.target.value as CallOutcome)}>
                      {CALL_OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>)}
                    </select>
                  )}
                </Labelled>
              </div>
              <Labelled label="What was said"><Textarea rows={4} value={form.body} onChange={(e) => set("body", e.target.value)} /></Labelled>
            </>
          )}
          {k === "note" && <Labelled label="Note"><Textarea rows={5} value={form.body} onChange={(e) => set("body", e.target.value)} autoFocus /></Labelled>}
          {k === "task" && (
            <>
              <Labelled label="What"><Input value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus /></Labelled>
              <div className="grid gap-4 sm:grid-cols-2">
                <Labelled label="Due"><Input type="date" value={form.due} onChange={(e) => set("due", e.target.value)} /></Labelled>
                <Choice label="For" value={form.forId} onChange={(v) => set("forId", v)} loading={options.isPending} choices={people} />
              </div>
            </>
          )}
          {k === "call" && !editing && (
            <fieldset className="space-y-3 border-t border-border pt-4">
              <legend className="text-sm text-muted-foreground">Follow up</legend>
              <div className="flex items-center gap-2">
                <Checkbox id="follow-up" checked={form.followUp} onCheckedChange={(v) => set("followUp", v === true)} />
                <Label htmlFor="follow-up">Add a task</Label>
              </div>
              {form.followUp && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Labelled label="Task"><Input value={form.followTitle} onChange={(e) => set("followTitle", e.target.value)} /></Labelled>
                    <Labelled label="Due"><Input type="date" value={form.followDue} onChange={(e) => set("followDue", e.target.value)} /></Labelled>
                  </div>
                  <Choice label="For" value={form.followFor} onChange={(v) => set("followFor", v)} loading={options.isPending} choices={people} />
                </>
              )}
            </fieldset>
          )}
          {options.isError && <p role="status" className="text-sm text-muted-foreground">Couldn't load the contacts and people. You can still save.</p>}
          {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A label tied to its one control, whether the control is given as an element (it takes the label by wrapping) or as a function of the id the label names. */
function Labelled({ label, children }: { label: string; children: ReactNode | ((id: string) => ReactNode) }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  const control = typeof children === "function" ? children(id) : isValidElement(children) ? cloneElement(children as ReactElement<{ id: string }>, { id }) : children;
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{control}</div>;
}

/** A choice from the account's own contacts, opportunities or the firm's people. */
function Choice({ label, value, onChange, choices, none, loading }: {
  label: string; value: string; onChange: (v: string) => void; choices: { id: string; name: string }[]; none?: string; loading: boolean;
}) {
  return (
    <Labelled label={label}>
      {(id) => (
        <select id={id} className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)} disabled={loading}>
          {none !== undefined && <option value="">{none}</option>}
          {choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
    </Labelled>
  );
}
