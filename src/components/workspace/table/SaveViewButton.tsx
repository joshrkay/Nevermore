import { useId, useState, type FormEvent } from "react";
import { BookmarkPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VIEW_NAME_MAX } from "./columns";
import { wordsOf } from "./wordsOf";

const BUTTON = "inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

interface Props {
  /** Keeps the screen as a new view of this name. Rejects with the words to show. */
  onSave: (name: string) => Promise<void>;
}

/**
 * "Save this as a view" (CRM-S3.4a): one name, and the screen's filters, sort and columns are kept under it as the person's own view. The dialog stays
 * open, with what was typed, when the database refuses (a name taken, the ceiling of 30, a closing firm, a support session), and says why in the
 * database's words; it opens clean each time.
 */
export function SaveViewButton({ onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ids = useId();

  const close = () => {
    setOpen(false);
    setName("");
    setProblem(null);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (name.trim() === "") {
      setProblem("Give the view a name.");
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      await onSave(name.trim());
      close();
    } catch (error) {
      setProblem(wordsOf(error, "Couldn't save the view. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button type="button" className={BUTTON}>
          <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
          Save this as a view
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80" aria-label="Save this as a view">
        <form onSubmit={submit} noValidate>
          <p className="mb-2 text-sm text-muted-foreground">
            Keeps the filters, the sort and the columns on screen as a view of your own, with a tab that shows its count.
          </p>
          <label htmlFor={`${ids}-name`} className="text-sm font-medium">Name</label>
          <p className="text-xs text-muted-foreground">Required</p>
          <input
            id={`${ids}-name`}
            type="text"
            value={name}
            maxLength={VIEW_NAME_MAX}
            autoComplete="off"
            aria-describedby={problem ? `${ids}-problem` : undefined}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          {problem && <p id={`${ids}-problem`} role="alert" className="mt-2 text-sm text-destructive">{problem}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button type="submit" aria-disabled={saving || undefined} className={`${BUTTON} text-foreground`}>{saving ? "Saving…" : "Save view"}</button>
            <button type="button" onClick={close} className={BUTTON}>Cancel</button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
