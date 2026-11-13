import { useCallback, useRef, useState, type BaseSyntheticEvent, type ReactNode } from "react";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
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

export interface Explained { message: string; field?: string }

export interface WorkspaceFormOptions<S extends z.ZodTypeAny, R> {
  schema: S;
  defaultValues: z.input<S>;
  /** Sends the values (already trimmed and checked by the schema). Throw to refuse the save: the form stays open and keeps everything typed. */
  save: (values: z.output<S>) => Promise<R>;
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
  const message = error instanceof Error ? error.message.trim() : "";
  return { message: message || fallback };
};

let formCount = 0;

/**
 * The state of one workspace form (CRM-S4.1, D-51): react-hook-form with a zod schema, errors shown when a field is left
 * and on save, focus to the first field in error, a failed save that keeps everything and says why, and the guard against
 * losing unsaved changes. Pair it with `WorkspaceForm`, `Field` and `FormActions`.
 */
export function useWorkspaceForm<S extends z.ZodTypeAny, R = unknown>(options: WorkspaceFormOptions<S, R>): WorkspaceFormApi {
  const { schema, defaultValues, save, onSaved, savedValues, explain, failureMessage = "Couldn't save. Check your connection and try again.", onCancel } = options;
  const form = useForm<FieldValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as FieldValues,
    mode: "onTouched", // an error appears when the person leaves a field, then follows what they type
    shouldFocusError: true,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [formId] = useState(() => `workspace-form-${++formCount}`);
  const dirty = form.formState.isDirty;
  const guard = useUnsavedChangesGuard(dirty);

  const submit = form.handleSubmit(async (values) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await save(values as z.output<S>);
      guard.release();
      form.reset((savedValues ? savedValues(result, values as z.output<S>) : defaultValues) as FieldValues);
      onSaved?.(result, values as z.output<S>);
    } catch (error) {
      const said = explain?.(error) ?? wordsOf(error, failureMessage);
      if (said.field) form.setError(said.field, { type: "server", message: said.message }, { shouldFocus: true });
      else setSaveError(said.message);
    } finally {
      inFlight.current = false;
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

  return { form, formId, saving, saveError, dirty, submit, cancel, requestClose: useCallback(requestClose, [requestClose]), prompt: guard.prompt };
}
