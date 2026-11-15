import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import type { useWorkspaceForm } from "@/components/workspace/form";

/** A tick box on a workspace form (Add a contact, a contact's Edit): "Main contact", "Do not email". */
export function CheckField({ name, label, api }: { name: string; label: string; api: ReturnType<typeof useWorkspaceForm> }) {
  return (
    <FormField
      control={api.form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center gap-2 space-y-0">
          <FormControl>
            <input type="checkbox" className="h-4 w-4 rounded border-input accent-primary" checked={field.value === true} onChange={(e) => field.onChange(e.target.checked)} onBlur={field.onBlur} ref={field.ref} name={field.name} />
          </FormControl>
          <FormLabel className="font-normal">{label}</FormLabel>
        </FormItem>
      )}
    />
  );
}
