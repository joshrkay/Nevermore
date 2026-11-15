import { useCallback, useRef, useState, type BaseSyntheticEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { RecordConflict } from "@/lib/recordVersion";
import { useOnline } from "../useOnline";
import { ConflictDialog } from "./ConflictDialog";
import { conflictRows, type ConflictField } from "./conflictRows";
import { failureWords } from "./failureWords";
import { OFFLINE_SAVE_FAILED } from "./offline";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

/**
 * A save the server (or a later check, such as CRM-S2.4a's "someone else changed this") refuses, with the reason in words.
 * Throw it from `save`; give `field` when the reason belongs to one field, and it shows under that field.
 */
export class SaveRefused extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
    this.name = "SaveRefused";
  }
}

/**
 * Throw it from `save` when the database answers that someone else changed the record while the person was editing it (CRM-S2.4a, D-181). Nothing
 * was saved. The form does not show a failure: it opens the conflict dialog (see `conflictDialog`) with what was typed beside what is there now.
 */
export class SaveConflict<Current = unknown> extends Error {
  constructor(readonly conflict: RecordConflict<Current>) {
    super("Someone else changed this record while it was being edited.");
    this.name = "SaveConflict";
  }
}

export { OFFLINE_SAVE_FAILED, OFFLINE_SAVE_REASON } from "./offline";

export interface Explained { message: string; field?: string }

export interface WorkspaceFormOptions<S extends z.ZodTypeAny, R, Current = unknown> {
  schema: S;
  defaultValues: z.input<S>;
  /**
   * Sends the values (already trimmed and checked by the schema). Throw to refuse the save: the form stays open and keeps everything typed.
   * `started.version` is the version of the record the person STARTED editing from (see `version` and `begin`), never the live one a list reload brought.
   */
  save: (values: z.output<S>, started: { version: number | undefined }) => Promise<R>;
  /**
   * The version of the record when this form first opened. Read once: a later change to this option (a list reloaded under an open form) is
   * ignored on purpose, so a save can't name a version the person never saw. Start each edit with `begin`.
   */
  version?: number;
  /** The version a successful save left the record at, taken from what `save` returned; the form starts from it afterwards. */
  versionOf?: (result: R) => number | undefined;
  /**
   * Turns on the conflict dialog for a save that throws `SaveConflict`: what is being edited (`noun`, "partner"), and how each of the form's fields is
   * named and shown (`fields`, by the form's own field names, so a field added to the schema is a type error until it is named here). `toValues` turns
   * the record's current editable fields, as the database answered them, into the form's values; leave it out when the record's keys ARE the form's field
   * names (the partner's name and kind), give it when they are not. Each `changed` entry's `field` is read as a form field name, so a record whose
   * keys differ must also answer its `changed` in the form's names. Without `conflictDialog` a `SaveConflict` is a plain failed save.
   */
  conflictDialog?: {
    noun: string;
    fields: Record<keyof z.input<S> & string, ConflictField>;
    toValues?: (current: Current) => Partial<z.input<S>>;
  };
  /** Runs after a successful save, with what `save` returned. The form has been cleared (or set to `savedValues`) and asks nothing more about leaving. */
  onSaved?: (result: R, values: z.output<S>) => void;
  /** What the form is set to after a save. Default: back to `defaultValues`, which is what an "add" form wants. */
  savedValues?: (result: R, values: z.output<S>) => z.input<S>;
  /** Puts a failure into words, and names its field when it belongs to one. Default: a `SaveRefused` says its own words and field; any other error uses its message. */
  explain?: (error: unknown) => Explained | undefined;
  /** Shown when a failure has no words of its own. */
  failureMessage?: string;
  /** Closing the form without saving (a Cancel button, Escape). With unsaved changes the person is asked first. Leave out for a form that is never closed. */
  onCancel?: () => void;
}

export interface WorkspaceFormApi {
  form: UseFormReturn<FieldValues>;
  formId: string;
  /** True only while a save is in flight; the only time Save is disabled. */
  saving: boolean;
  /** What failed, in words, for the place beside the form's buttons. Null when the last save did not fail or the failure belongs to a field. */
  saveError: string | null;
  dirty: boolean;
  /** Escape closes a form that has a Cancel, asking first when something changed. Put it on the form, and on any wider element (a table row) whose buttons sit outside it. */
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  /** The version of the record this edit started from: set by `begin`, moved only by this form's own successful save or `startFrom`. */
  startedVersion: number | undefined;
  /** Begins an edit: puts the form back to `values` and takes `version` as the one this edit starts from. Call it when the person opens Edit. */
  begin: (values: FieldValues, version: number | undefined) => void;
  /** Moves the starting version (for "keep mine": save again over their change, starting from the version that holds it). */
  startFrom: (version: number | undefined) => void;
  /** True while the browser has no connection: Save is not usable then (`FormActions` says why) and a save is not sent. */
  offline: boolean;
  /** The Save button, so focus can go back to it (a failure beside the buttons, the conflict dialog's Keep editing). `FormActions` puts it there. */
  saveButton: RefObject<HTMLButtonElement>;
  /** The form's submit handler. */
  submit: (e?: BaseSyntheticEvent) => Promise<void>;
  /** Cancel: asks first when something changed, then clears the form and calls `onCancel`. Undefined when the form has no `onCancel`. */
  cancel?: () => void;
  /** Route any other way of closing the form (a dialog's close button or overlay) through this: it runs `close` at once when nothing changed, otherwise after the person agrees to discard. */
  requestClose: (close: () => void) => void;
  /** The "discard your changes?" question. WorkspaceForm and WorkspaceFormProvider render it; you render it only if you use neither. */
  prompt: ReactNode;
}

const wordsOf = (error: unknown, fallback: string): Explained => {
  if (error instanceof SaveRefused) return { message: error.message, field: error.field };
  return { message: failureWords(error, fallback) };
};

let formCount = 0;

/**
 * The state of one workspace form (CRM-S4.1, D-51): react-hook-form with a zod schema, errors shown when a field is left
 * and on save, focus to the first field in error, a failed save that keeps everything and says why, and the guard against
 * losing unsaved changes. Pair it with `WorkspaceForm`, `Field` and `FormActions`.
 */
export function useWorkspaceForm<S extends z.ZodTypeAny, R = unknown, Current = unknown>(options: WorkspaceFormOptions<S, R, Current>): WorkspaceFormApi {
  const { schema, defaultValues, save, onSaved, savedValues, explain, failureMessage = "Couldn't save. Check your connection and try again.", onCancel, versionOf, conflictDialog } = options;
  // Held with the form, not read from the options again: a list reload under an open form must not change what a save starts from. A ref beside
  // the state, so a save made in the same breath as `startFrom` ("Keep mine") already starts from the new version.
  const [startedVersion, setStartedVersionState] = useState<number | undefined>(options.version);
  const started = useRef(options.version);
  const setStartedVersion = useCallback((version: number | undefined) => {
    started.current = version;
    setStartedVersionState(version);
  }, []);
  const online = useOnline();
  const saveButton = useRef<HTMLButtonElement>(null);
  // The form's values when this edit began (the defaults, then `begin`'s, then what a save left): what "the person changed this field" is measured from.
  const baseline = useRef<Record<string, unknown>>(options.defaultValues as Record<string, unknown>);
  // A refused save the person has to decide about: what they typed (as it was when they pressed Save), what the database answered (already in the form's
  // values) and the fields the person had changed.
  const [conflict, setConflict] = useState<{ answer: RecordConflict<Current>; mine: Record<string, unknown>; theirs: Record<string, unknown>; touched: string[] } | null>(null);
  // Where focus goes when the dialog has closed: the first field (Keep theirs, Keep mine: a save is on its way and Save is busy), or Save (Keep editing).
  const focusAfter = useRef<"first-field" | "save" | null>(null);
  // "Keep mine" sends its one save from the version that holds their change, but that version is the form's own only if the save works.
  const sendFrom = useRef<number | undefined>(undefined);
  const firstField = () => Object.keys(baseline.current)[0];
  const form = useForm<FieldValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as FieldValues,
    mode: "onTouched", // an error appears when the person leaves a field, then follows what they type
    shouldFocusError: true,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formId] = useState(() => `workspace-form-${++formCount}`);
  const dirty = form.formState.isDirty;
  const guard = useUnsavedChangesGuard(dirty);

  // True from the moment a save starts until it has ended: a second submit (Enter again, a second event) and a close are ignored meanwhile. A ref, so it holds
  // in the same breath, before the `saving` state has rendered.
  const inFlight = useRef(false);

  const submit = form.handleSubmit(async (values) => {
    if (inFlight.current) return;
    // Nothing is sent without a connection (the Save button says so; a save made with Enter says it too).
    if (!navigator.onLine) {
      setSaveError(OFFLINE_SAVE_FAILED);
      return;
    }
    const from = sendFrom.current ?? started.current;
    const overridden = sendFrom.current !== undefined;
    sendFrom.current = undefined;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await save(values as z.output<S>, { version: from });
      const next = versionOf?.(result) ?? (overridden ? from : undefined);
      if (next !== undefined) setStartedVersion(next);
      guard.release();
      const after = (savedValues ? savedValues(result, values as z.output<S>) : defaultValues) as FieldValues;
      baseline.current = after;
      form.reset(after);
      onSaved?.(result, values as z.output<S>);
    } catch (error) {
      if (error instanceof SaveConflict && conflictDialog) {
        const answer = error.conflict as RecordConflict<Current>;
        const mine = { ...values } as Record<string, unknown>;
        const theirs = (conflictDialog.toValues ? conflictDialog.toValues(answer.current) : answer.current) as Record<string, unknown>;
        const touched = Object.keys(mine).filter((f) => JSON.stringify(mine[f] ?? null) !== JSON.stringify(baseline.current[f] ?? null));
        setConflict({ answer, mine, theirs, touched });
        return;
      }
      const said = explain?.(error) ?? wordsOf(error, failureMessage);
      if (said.field) form.setError(said.field, { type: "server", message: said.message }, { shouldFocus: true });
      else setSaveError(said.message);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  });

  // A form is not closed or discarded while it is saving: the save would still land and move the page for a form the person had closed.
  const ask = guard.ask;
  const requestClose = useCallback<typeof guard.ask>((...args) => {
    if (inFlight.current) return;
    return ask(...args);
  }, [ask]);
  const cancel = onCancel
    ? () => guard.ask(() => {
        baseline.current = defaultValues as Record<string, unknown>;
        form.reset(defaultValues as FieldValues);
        setSaveError(null);
        onCancel();
      })
    : undefined;

  // Whichever element sees Escape first handles it; one that comes after sees it already handled.
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && !e.defaultPrevented && cancel) {
      e.preventDefault();
      cancel();
    }
  };

  const begin = useCallback((values: FieldValues, version: number | undefined) => {
    baseline.current = values;
    form.reset(values);
    setSaveError(null);
    setStartedVersion(version);
  }, [form, setStartedVersion]);

  // The three ways out of the conflict dialog. Each is one deliberate choice, none runs twice, and none is all or nothing: a field only one side changed
  // keeps that side's change.
  const keepMine = () => {
    if (!conflict || !navigator.onLine) return;
    // What the person left alone takes THEIR value (putting the old one back would undo their change unseen); what the person changed is sent as typed.
    const alone = Object.keys(conflict.theirs).filter((f) => !conflict.touched.includes(f));
    for (const f of alone) form.setValue(f, conflict.theirs[f]);
    baseline.current = { ...baseline.current, ...Object.fromEntries(alone.map((f) => [f, conflict.theirs[f]])) };
    focusAfter.current = "first-field";
    sendFrom.current = conflict.answer.currentVersion;
    setConflict(null);
    // The one save starts from the version that holds their change; the form's own version moves only if it works (a failed one leaves the next Save to
    // find the conflict again). `sendFrom` is dropped if the save was never made (the form's own checks refused it).
    void submit().finally(() => { sendFrom.current = undefined; });
  };
  const keepTheirs = () => {
    if (!conflict) return;
    const theirChange = conflict.answer.changed.map((c) => c.field).filter((f) => f in conflict.theirs);
    // Their values for the fields they changed, and the start moves to their version; whatever else the person typed is typed again over it.
    begin({ ...baseline.current, ...Object.fromEntries(theirChange.map((f) => [f, conflict.theirs[f]])) }, conflict.answer.currentVersion);
    for (const f of conflict.touched) if (!theirChange.includes(f)) form.setValue(f, conflict.mine[f], { shouldDirty: true });
    focusAfter.current = "first-field";
    setConflict(null);
  };
  const keepEditing = () => {
    if (!conflict) return;
    focusAfter.current = "save";
    setConflict(null);
  };
  const afterConflict = (): boolean => {
    const where = focusAfter.current;
    focusAfter.current = null;
    if (where === "save") saveButton.current?.focus();
    else if (where === "first-field" && firstField()) form.setFocus(firstField());
    // The dialog took focus when it opened, and what it was on is gone: left to the browser focus would fall to the page, so say we handled it.
    return true;
  };
  const dialog = conflict && conflictDialog ? (
    <ConflictDialog
      noun={conflictDialog.noun}
      rows={conflictRows(conflictDialog.fields, baseline.current, conflict.mine, conflict.theirs, conflict.answer.changed)}
      offline={!online}
      onKeepMine={keepMine}
      onKeepTheirs={keepTheirs}
      onKeepEditing={keepEditing}
      onClosed={afterConflict}
    />
  ) : null;

  return {
    form, formId, saving, saveError, dirty, startedVersion, begin, startFrom: setStartedVersion, submit, onKeyDown, cancel, offline: !online, saveButton,
    requestClose,
    prompt: <>{guard.prompt}{dialog}</>,
  };
}
