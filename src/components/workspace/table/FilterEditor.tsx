import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm, type Control, type ControllerRenderProps, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { TableFields, TableFilter } from "@/lib/tableQuery";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SelectInput } from "../form/WorkspaceForm";
import type { FieldDefinition } from "./columns";
import { choosesFromList, filterFromForm, formFor, operatorsFor, type FilterForm } from "./filterInput";
import { OPERATORS } from "./operators";

// The editor for one filter (story CRM-S3.3a): a small form in the workspace form's manner (react-hook-form with a zod schema, D-51; errors under
// the field, tied to it, announced as they appear, focus to the first field in error). It applies on "Apply" or Enter and never on a keystroke.
// Cancelling is the popover's own (Escape or a click away), so it asks nothing: there is nothing to lose. Native selects and date inputs, as the
// workspace form's own select is: they work with a phone's picker and a keyboard.

// The schema reads the values once and hands on the finished filter, so what is checked is what is applied (nothing is worked out twice).
const schemaFor = <K extends TableFields>(fieldId: string, field: FieldDefinition) =>
  z
    .object({ op: z.string(), first: z.string(), second: z.string(), list: z.array(z.string()), yes: z.enum(["true", "false"]) })
    .transform((form, ctx): TableFilter<K> => {
      const result = filterFromForm<K>(fieldId, field, form as FilterForm);
      if ("filter" in result) return result.filter;
      for (const [path, message] of Object.entries(result.errors)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
      return z.NEVER;
    });

interface Props<K extends TableFields> {
  fieldId: string;
  field: FieldDefinition;
  /** The filter being changed; none for a new one. */
  initial?: TableFilter<K>;
  onApply: (filter: TableFilter<K>) => void;
  onCancel: () => void;
}

/** A searchable list of the field's values with a checkbox each, by label. A value the table does not list but the filter holds stays in the list, shown in quotes as written, so changing the filter never drops it unseen. */
function ChoiceList({ field, control, describedBy }: { field: FieldDefinition; control: ControllerRenderProps<FilterForm, "list">; describedBy?: string }) {
  const group = useRef<HTMLDivElement | null>(null);
  // When nothing is chosen, the form puts focus on the list's first choice (not the search box above it); the message is tied to the group.
  const takeGroup = (el: HTMLDivElement | null) => {
    group.current = el;
    control.ref(el && { focus: () => el.querySelector<HTMLElement>("input[type=checkbox]")?.focus() });
  };
  const [search, setSearch] = useState("");
  const listed = field.choices ?? [];
  const extra = control.value.filter((v) => !listed.some((c) => c.value.toLowerCase() === v.toLowerCase())).map((value) => ({ value, label: `“${value}”` }));
  const needle = search.trim().toLowerCase();
  const options = [...listed, ...extra].filter((c) => needle === "" || c.label.toLowerCase().includes(needle));
  const chosen = (value: string) => control.value.some((v) => v.toLowerCase() === value.toLowerCase());
  return (
    <div className="space-y-2">
      <Input
        type="search"
        aria-label="Search choices"
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        // Enter in the search box searches; it must not apply a half-made choice.
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
      />
      <div ref={takeGroup} role="group" aria-label="Choices" aria-describedby={describedBy} className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {options.length === 0 ? <p className="text-sm text-muted-foreground">Nothing matches that search.</p> : options.map((c) => (
          <label key={c.value} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary"
              checked={chosen(c.value)}
              onChange={(e) => control.onChange(e.target.checked ? [...control.value, c.value] : control.value.filter((v) => v.toLowerCase() !== c.value.toLowerCase()))}
            />
            {c.label}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{control.value.length === 0 ? "None chosen" : `${control.value.length} chosen`}</p>
    </div>
  );
}

export function FilterEditor<K extends TableFields>({ fieldId, field, initial, onApply, onCancel }: Props<K>) {
  const schema = useMemo(() => schemaFor<K>(fieldId, field), [fieldId, field]);
  const form = useForm<FilterForm, unknown, TableFilter<K>>({
    resolver: zodResolver(schema),
    defaultValues: formFor(field, initial as { op: string; value?: unknown } | undefined),
    // Errors show when a person tries to apply, then follow what they type.
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });
  const id = useId();
  // The ui kit's form fields are typed for a form whose output is its input; this one's output is the finished filter.
  const control = form.control as unknown as Control<FilterForm>;
  const ops = operatorsFor(field);
  const op = form.watch("op");
  const shape = OPERATORS[field.kind][op]?.shape ?? "none";
  const root = useRef<HTMLFormElement>(null);
  // Focus goes into the editor when it opens: its first control.
  useEffect(() => { root.current?.querySelector<HTMLElement>("select, input, button")?.focus(); }, []);
  const pair = shape === "numbers" || shape === "days";
  const inputType = shape === "day" || shape === "days" ? "date" : shape === "text" ? "text" : "number";
  const firstLabel = shape === "day" ? "Day" : shape === "count" ? "Number of days" : shape === "number" ? "Number" : "Text";

  const apply = form.handleSubmit((filter) => onApply(filter));

  const input = (name: "first" | "second", label: string) => (
    <FormField
      control={control}
      name={name}
      render={({ field: f }) => (
        <FormItem className="space-y-1">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...f} type={inputType} {...(inputType === "number" ? { step: shape === "count" ? 1 : "any", min: shape === "count" ? 0 : undefined } : {})} />
          </FormControl>
          <FormMessage role="alert" className="text-sm" />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...(form as unknown as UseFormReturn<FilterForm>)}>
      <form ref={root} noValidate onSubmit={(e) => void apply(e)} className="space-y-3" aria-label={`Filter on ${field.label}`}>
        <p className="text-sm font-medium">{field.label}</p>
        {ops.length > 1 && (
          <FormField
            control={control}
            name="op"
            render={({ field: f }) => (
              <FormItem className="space-y-1">
                <FormLabel>Condition</FormLabel>
                <FormControl>
                  <SelectInput {...f} onChange={(e) => {
                    // A new condition that asks for something else starts with empty boxes: a value typed for the old one must not stay hidden and be applied.
                    form.clearErrors();
                    if (OPERATORS[field.kind][e.target.value]?.shape !== shape) {
                      form.setValue("first", ""); form.setValue("second", ""); form.setValue("list", []);
                    }
                    f.onChange(e);
                  }}>
                    {ops.map(([name, def]) => <option key={name} value={name}>{def.label}</option>)}
                  </SelectInput>
                </FormControl>
              </FormItem>
            )}
          />
        )}
        {shape === "bool" && (
          <FormField
            control={control}
            name="yes"
            render={({ field: f }) => (
              <FormItem className="space-y-1">
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  <SelectInput {...f}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </SelectInput>
                </FormControl>
              </FormItem>
            )}
          />
        )}
        {(shape === "text" || shape === "number" || shape === "day" || shape === "count") && input("first", firstLabel)}
        {pair && <>{input("first", "From")}{input("second", "To")}</>}
        {shape === "list" && (choosesFromList(field) ? (
          <FormField
            control={control}
            name="list"
            render={({ field: f }) => (
              <FormItem className="space-y-1">
                <p className="text-sm font-medium leading-none">Values</p>
                <ChoiceList field={field} control={f} describedBy={`${id}-list-message`} />
                <FormMessage id={`${id}-list-message`} role="alert" className="text-sm" />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={control}
            name="first"
            render={({ field: f }) => (
              <FormItem className="space-y-1">
                <FormLabel>Values, separated by commas</FormLabel>
                <FormControl><Input {...f} type="text" /></FormControl>
                <FormMessage role="alert" className="text-sm" />
              </FormItem>
            )}
          />
        ))}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-10 rounded-md" onClick={onCancel}>Cancel</Button>
          <Button type="submit" className="h-10 rounded-md">Apply</Button>
        </div>
      </form>
    </Form>
  );
}
