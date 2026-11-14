import { useCallback, useState, type BaseSyntheticEvent, type KeyboardEvent, type ReactNode } from "react";
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
  /** The form's submit handler. */
  submit: (e?: BaseSyntheticEvent) => Promise<void>;
  /** Cancel: asks first when something changed, then clears the form and calls `onCancel`. Undefined when the form has no `onCancel`. */
  cancel?: () => void;
  /** Route any other way of closing the form (a dialog's close button or overlay) through this: it runs `close` at once when nothing changed, otherwise after the person agrees to discard. */
  requestClose: (close: () => void) => void;
  /** The "discard your changes?" question. WorkspaceForm and WorkspaceFormProvider render it; you render it only if you use neither. */
  prompt: ReactNode;
}

/**
 * Whether an error's text is meant for a person. The client's own failures are not: a dropped network arrives as
 * "TypeError: Failed to fetch" with no code, and the database's timeouts and gateway faults carry codes of the kinds below
 * (PostgREST "PGRST…", connection, resource, operator-intervention and internal classes). The rules the product raises itself
 * (a code already taken, a role refused) carry their own plain sentences and codes outside those kinds.
 */
const TECHNICAL_MESSAGE = /^(TypeError|FetchError|NetworkError|AbortError|SyntaxError|AuthRetryableFetchError|AuthUnknownError)\b|failed to fetch|load failed|networkerror|network request failed/i;
const TECHNICAL_CODE = /^(PGRST|08|53|54|55|57|58|XX|P0)/i;
const hasWordsOfItsOwn = (error: Error) => {
  const code = (error as { code?: unknown }).code;
  const message = error.message.trim();
  if (message === "" || TECHNICAL_MESSAGE.test(message)) return false;
  return !(typeof code === "string" && TECHNICAL_CODE.test(code));
};

const wordsOf = (error: unknown, fallback: string): Explained => {
  if (error instanceof SaveRefused) return { message: error.message, field: error.field };
  return { message: error instanceof Error && hasWordsOfItsOwn(error) ? error.message.trim() : fallback };
};

let formCount = 0;

/**
 * The state of one workspace form (CRM-S4.1, D-51): react-hook-form with a zod schema, errors shown when a field is left
 * and on save, focus to the first field in error, a failed save that keeps everything and says why, and the guard against
 * losing unsaved changes. Pair it with `WorkspaceForm`, `Field` and `FormActions`.
 */
export function useWorkspaceForm<S extends z.ZodTypeAny, R = unknown>(options: WorkspaceFormOptions<S, R>): WorkspaceFormApi {
  const { schema, defaultValues, save, onSaved, savedValues, explain, failureMessage = "Couldn't save. Check your connection and try again.", onCancel, versionOf } = options;
  // Held with the form, not read from the options again: a list reload under an open form must not change what a save starts from.
  const [startedVersion, setStartedVersion] = useState<number | undefined>(options.version);
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
    setSaving(true);
    setSaveError(null);
    try {
      const result = await save(values as z.output<S>, { version: startedVersion });
      const next = versionOf?.(result);
      if (next !== undefined) setStartedVersion(next);
      guard.release();
      form.reset((savedValues ? savedValues(result, values as z.output<S>) : defaultValues) as FieldValues);
      onSaved?.(result, values as z.output<S>);
    } catch (error) {
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
  }, [form]);

  return { form, formId, saving, saveError, dirty, startedVersion, begin, startFrom: setStartedVersion, submit, onKeyDown, cancel, requestClose: useCallback(requestClose, [requestClose]), prompt: guard.prompt };
}
