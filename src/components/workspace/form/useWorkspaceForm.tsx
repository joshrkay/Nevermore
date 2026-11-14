import { useCallback, useRef, useState, type BaseSyntheticEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { RecordConflict } from "@/lib/recordVersion";
import { useOnline } from "../useOnline";
import { ConflictDialog, type ConflictField } from "./ConflictDialog";
import { failureWords } from "./failureWords";
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
export class SaveConflict extends Error {
  constructor(readonly conflict: RecordConflict<unknown>) {
    super("Someone else changed this record while it was being edited.");
    this.name = "SaveConflict";
  }
}

/** What a form says when it is asked to save with no connection: nothing was sent. */
export const OFFLINE_SAVE_FAILED = "You're offline, so this wasn't saved. Try again when you're back online. What you typed is still here.";
/** Why Save is not usable with no connection (D-143: said where the button is, and tied to it). */
export const OFFLINE_SAVE_REASON = "You're offline. Saving is back when you are.";

export interface Explained { message: string; field?: string }

export interface WorkspaceFormOptions<S extends z.ZodTypeAny, R> {
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
   * Turns on the conflict dialog for a save that throws `SaveConflict`: what is being edited (`noun`, "partner") and how each field the record holds is
   * named and shown. Without it a `SaveConflict` is a plain failed save.
   */
  conflictDialog?: { noun: string; fields: Record<string, ConflictField> };
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
export function useWorkspaceForm<S extends z.ZodTypeAny, R = unknown>(options: WorkspaceFormOptions<S, R>): WorkspaceFormApi {
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
  // A refused save the person has to decide about: what they typed (as it was when they pressed Save) and what the database answered.
  const [conflict, setConflict] = useState<{ answer: RecordConflict<unknown>; mine: Record<string, unknown> } | null>(null);
  // Where focus goes when the dialog has closed: the first field (Keep theirs), Save (Keep editing), or nowhere in particular (Keep mine closes the form).
  const focusAfter = useRef<"first-field" | "save" | null>(null);
  const firstField = useRef<string | null>(null);
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

  const submit = form.handleSubmit(async (values) => {
    // Nothing is sent without a connection (the Save button says so; a save made with Enter says it too).
    if (!navigator.onLine) {
      setSaveError(OFFLINE_SAVE_FAILED);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await save(values as z.output<S>, { version: started.current });
      const next = versionOf?.(result);
      if (next !== undefined) setStartedVersion(next);
      guard.release();
      form.reset((savedValues ? savedValues(result, values as z.output<S>) : defaultValues) as FieldValues);
      onSaved?.(result, values as z.output<S>);
    } catch (error) {
      if (error instanceof SaveConflict && conflictDialog) {
        firstField.current = Object.keys(error.conflict.current as object)[0] ?? null;
        setConflict({ answer: error.conflict, mine: { ...values } });
        return;
      }
      const said = explain?.(error) ?? wordsOf(error, failureMessage);
      if (said.field) form.setError(said.field, { type: "server", message: said.message }, { shouldFocus: true });
      else setSaveError(said.message);
    } finally {
      setSaving(false);
    }
  });

  const requestClose = guard.ask;
  const cancel = onCancel
    ? () => guard.ask(() => {
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
    form.reset(values);
    setSaveError(null);
    setStartedVersion(version);
  }, [form, setStartedVersion]);

  // The three ways out of the conflict dialog. Each is one deliberate choice, and none runs twice.
  const keepMine = () => {
    if (!conflict) return;
    focusAfter.current = null;
    setConflict(null);
    setStartedVersion(conflict.answer.currentVersion);
    void submit(); // what is typed is still in the form: it is saved again over their change, from the version that holds it
  };
  const keepTheirs = () => {
    if (!conflict) return;
    focusAfter.current = "first-field";
    setConflict(null);
    begin(conflict.answer.current as FieldValues, conflict.answer.currentVersion);
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
    else if (where === "first-field" && firstField.current) form.setFocus(firstField.current);
    // The dialog took focus when it opened, and what it was on is gone: left to the browser focus would fall to the page, so say we handled it.
    return true;
  };
  const dialog = conflict && conflictDialog ? (
    <ConflictDialog
      noun={conflictDialog.noun}
      fields={conflictDialog.fields}
      mine={conflict.mine}
      changed={conflict.answer.changed}
      onKeepMine={keepMine}
      onKeepTheirs={keepTheirs}
      onKeepEditing={keepEditing}
      onClosed={afterConflict}
    />
  ) : null;

  return {
    form, formId, saving, saveError, dirty, startedVersion, begin, startFrom: setStartedVersion, submit, onKeyDown, cancel, offline: !online, saveButton,
    requestClose: useCallback(requestClose, [requestClose]),
    prompt: <>{guard.prompt}{dialog}</>,
  };
}
