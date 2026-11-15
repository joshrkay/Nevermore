import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { failureWords, OFFLINE_SAVE_FAILED, OFFLINE_SAVE_REASON, SaveFailed } from "../form";
import { useOnline } from "../useOnline";

// The small form that names a saved view (story CRM-S3.4a): "Save this as a view" asks for a name, and Rename asks for a new one. It is the filter editor's
// kind of form (D-166): react-hook-form with a zod schema, the reason under the field, applied on the button or Enter, and closed by Escape or a click away
// with nothing to lose. A name the database refuses (taken, over the limit of views, a closing firm) stays in the box and the reason is said beside the button.

/** The most characters a view's name holds (the database counts characters, not UTF-16 units). */
export const VIEW_NAME_MAX = 60;

const schema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Required").refine((s) => Array.from(s).length <= VIEW_NAME_MAX, `A view's name is up to ${VIEW_NAME_MAX} characters.`)),
});
type Values = z.input<typeof schema>;

interface Props {
  /** The label of the button that makes the change: "Save view", "Rename view". */
  submitLabel: string;
  /** What the form says before the name's box, in a line: what will be kept, or what is being renamed. */
  intro: string;
  initial?: string;
  /** Makes the change. Throws an Error with words for the person to refuse it: the form stays open with what was typed. */
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}

export function ViewNameForm({ submitLabel, intro, initial = "", onSubmit, onCancel }: Props) {
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: initial },
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLFormElement>(null);
  const reasonId = useId();
  // Focus goes into the form when it opens: its one box.
  useEffect(() => { root.current?.querySelector<HTMLElement>("input")?.focus(); }, []);

  const submit = form.handleSubmit(async ({ name }) => {
    setFailure(null);
    setBusy(true);
    try {
      await onSubmit(name);
    } catch (error) {
      setFailure(failureWords(error, "That didn't go through. Check your connection and try again. What you typed is still here."));
    } finally {
      setBusy(false);
    }
  });

  return (
    <Form {...form}>
      <form
        ref={root}
        noValidate
        onSubmit={(e) => void submit(e)}
        // Nothing is sent without a connection. The button says so and ignores the click, which would also leave Enter in the box doing nothing, so Enter says it.
        onKeyDown={(e) => {
          if (e.key !== "Enter" || online || !(e.target instanceof HTMLInputElement)) return;
          e.preventDefault();
          setFailure(OFFLINE_SAVE_FAILED);
        }}
        className="space-y-3"
      >
        <p className="text-sm text-muted-foreground">{intro}</p>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel>View name</FormLabel>
              <FormControl>
                <Input {...field} type="text" autoComplete="off" />
              </FormControl>
              <FormMessage role="alert" className="text-sm" />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SaveFailed message={failure} returnFocusTo={button} className="mr-auto" />
          <Button type="button" variant="outline" className="h-10 rounded-md" onClick={onCancel}>Cancel</Button>
          <Button
            ref={button}
            type="submit"
            disabled={busy}
            // Offline the button stays, says why and ignores the click (D-182's way); Enter still reaches the submit, which says the save wasn't made.
            aria-disabled={online ? undefined : true}
            aria-describedby={online ? undefined : reasonId}
            onClick={online ? undefined : (e) => e.preventDefault()}
            className={`h-10 rounded-md ${online ? "" : "opacity-50"}`}
          >
            {submitLabel}
          </Button>
        </div>
        {!online && <p id={reasonId} className="text-xs text-muted-foreground">{OFFLINE_SAVE_REASON}</p>}
      </form>
    </Form>
  );
}
