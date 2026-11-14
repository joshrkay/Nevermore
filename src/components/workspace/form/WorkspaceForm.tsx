import { createContext, forwardRef, useContext, useEffect, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { ControllerRenderProps, FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, useFormField } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { SaveFailed } from "./SaveFailed";
import { OFFLINE_SAVE_REASON, type WorkspaceFormApi } from "./useWorkspaceForm";

const ApiContext = createContext<WorkspaceFormApi | null>(null);

function useApi(): WorkspaceFormApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("Field and FormActions belong inside a WorkspaceForm or WorkspaceFormProvider.");
  return api;
}

/**
 * Gives the form's state to the fields and buttons below it and draws the "discard your changes?" question. Use it on its own
 * only when the buttons sit outside the `<form>` element (a table row: fields in one cell, buttons in another); otherwise `WorkspaceForm`.
 */
export const WorkspaceFormProvider = ({ api, children }: { api: WorkspaceFormApi; children: ReactNode }) => (
  <ApiContext.Provider value={api}>
    <Form {...api.form}>{children}</Form>
    {api.prompt}
  </ApiContext.Provider>
);

/**
 * The form element. Native browser checks are off (`noValidate`) so the form's own rules and words are the only ones.
 * Escape on a form that has a Cancel asks first when something changed, then closes it.
 */
export const WorkspaceForm = ({ api, children, actions, className, ...aria }: {
  api: WorkspaceFormApi;
  children: ReactNode;
  /** The buttons. Default: `<FormActions />`. Pass `null` when they sit elsewhere. */
  actions?: ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) => {
  const inherited = useContext(ApiContext) === api;
  const body = (
    <form id={api.formId} noValidate onSubmit={(e) => void api.submit(e)} onKeyDown={api.onKeyDown} className={cn("space-y-4", className)} {...aria}>
      {children}
      {actions === undefined ? <FormActions /> : actions}
    </form>
  );
  return inherited ? body : <WorkspaceFormProvider api={api}>{body}</WorkspaceFormProvider>;
};

/**
 * Save, Cancel (when the form has one) and, beside them, what failed in plain words. Save is never disabled to point at an
 * error: it is disabled only while a save is in flight, and then it says so ("Saving…").
 */
export const FormActions = ({ submitLabel = "Save", savingLabel = "Saving…", cancelLabel = "Cancel", className }: {
  submitLabel?: string;
  savingLabel?: string;
  cancelLabel?: string;
  className?: string;
}) => {
  const api = useApi();
  const save = api.saveButton;
  // The Save button was disabled while the request ran, so the browser dropped the focus from it. When the save fails with a
  // message beside the buttons, the focus goes back there (and the message, an alert, is announced once as it appears).
  useEffect(() => {
    if (api.saveError && !api.saving) save.current?.focus();
  }, [api.saveError, api.saving, save]);
  const reasonId = `${api.formId}-offline`;
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2", className)}>
      <SaveFailed message={api.saveError} className="basis-full" />
      {api.offline && <p id={reasonId} className="basis-full text-xs text-muted-foreground">{OFFLINE_SAVE_REASON}</p>}
      {api.cancel && (
        <Button type="button" variant="outline" className="h-11 rounded-md" disabled={api.saving} onClick={api.cancel}>{cancelLabel}</Button>
      )}
      {/* With no connection Save is aria-disabled, not disabled (D-143): it stays in the tab order, says why, and ignores the click. */}
      <Button
        ref={save}
        type="submit"
        form={api.formId}
        className="h-11 rounded-md"
        disabled={api.saving}
        aria-busy={api.saving}
        aria-disabled={api.offline || undefined}
        aria-describedby={api.offline ? reasonId : undefined}
        onClick={api.offline ? (e) => e.preventDefault() : undefined}
      >
        {api.saving && <Loader2 className="animate-spin" aria-hidden="true" />}
        {api.saving ? savingLabel : submitLabel}
      </Button>
    </div>
  );
};

const FieldContent = ({ field, label, required, help, children }: {
  field: ControllerRenderProps<FieldValues, string>;
  label: string;
  required: boolean;
  help?: ReactNode;
  children: (field: ControllerRenderProps<FieldValues, string>) => ReactElement;
}) => {
  // Read inside FormItem, which is what gives this field its ids.
  const { formItemId, formDescriptionId, formMessageId, error } = useFormField();
  const requiredId = `${formItemId}-required`;
  const describedBy = [required && requiredId, help && formDescriptionId, error && formMessageId].filter(Boolean).join(" ");
  return (
    <>
      <FormLabel>{label}</FormLabel>
      {required && <p id={requiredId} className="text-xs text-muted-foreground">Required</p>}
      <FormControl aria-describedby={describedBy || undefined} aria-required={required || undefined}>
        {children(field)}
      </FormControl>
      {help && <FormDescription className="text-xs">{help}</FormDescription>}
      <FormMessage role="alert" className="text-sm" />
    </>
  );
};

/**
 * One labelled field: the label, the word "Required" under it for a required field (in words, and tied to the control for a
 * screen reader), the control, help text, and the error. The error is tied to the control (`aria-describedby`, `aria-invalid`)
 * and announced when it appears. `children` draws the control from the field's props: `{(field) => <Input {...field} />}`.
 */
export const Field = ({ name, label, required = false, help, children }: {
  name: string;
  label: string;
  required?: boolean;
  help?: ReactNode;
  children: (field: ControllerRenderProps<FieldValues, string>) => ReactElement;
}) => {
  const api = useApi();
  return (
    <FormField
      control={api.form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-1">
          <FieldContent field={field} label={label} required={required} help={help}>{children}</FieldContent>
        </FormItem>
      )}
    />
  );
};

/** A native select drawn like the text input. Native on purpose: it works with a phone's picker and a keyboard. */
export const SelectInput = forwardRef<HTMLSelectElement, ComponentPropsWithoutRef<"select">>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50", className)}
    {...props}
  >
    {children}
  </select>
));
SelectInput.displayName = "SelectInput";
