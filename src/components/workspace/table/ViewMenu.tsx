import { useId, useRef, useState, type FormEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VIEW_NAME_MAX, type SavedViewRights } from "./columns";
import { wordsOf } from "./wordsOf";
import type { SavedViewsControl } from "./useSavedViews";

const ITEM = "inline-flex min-h-9 w-full items-center rounded-md px-3 text-left text-sm hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const BUTTON = "inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 text-sm hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

interface Props {
  view: { id: string; label: string; saved: SavedViewRights };
  control: SavedViewsControl;
}

type Step = "menu" | "rename" | "delete";

/**
 * What a person can do with one saved view (CRM-S3.4a): rename and delete it (its saver), share it with the firm (an owner, on their own private
 * view) or stop sharing it (an owner, on any shared view). It offers only what the database says this person may do (`list_saved_views`), and only
 * the database decides: a refusal comes back in its words and shows in the same place, the dialog open, nothing changed on screen. A built-in view has
 * no menu: it is code, and nothing can delete it.
 */
export function ViewMenu({ view, control }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const [name, setName] = useState(view.label);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = useId();
  // The attempt on its way: closing the dialog ends it, so a refusal that arrives later is not shown in the next, clean dialog.
  const attempt = useRef(0);
  // A change that has been started is not over until its call settles, whatever the dialog does meanwhile: closing the dialog hides it but does not free
  // the lock, so a reopened one cannot start another change of the view. A ref, because two clicks can come before the next render.
  const locked = useRef(false);
  const { canChange, canShare, canUnshare } = view.saved;
  if (!canChange && !canShare && !canUnshare) return null;

  const close = () => {
    attempt.current++;
    setOpen(false);
    setStep("menu");
    setProblem(null);
  };
  /** The name offered is the view's name as it is NOW, every time the rename step starts (it may have been renamed, or half typed over, since). */
  const startRename = () => {
    setName(view.label);
    setProblem(null);
    setStep("rename");
  };
  /** Runs one change: the dialog closes when it was made, and says why when it wasn't. */
  const run = async (change: () => Promise<void>, fallback: string) => {
    if (locked.current) return;
    const mine = ++attempt.current;
    locked.current = true;
    setBusy(true);
    setProblem(null);
    try {
      await change();
      if (attempt.current === mine) close();
    } catch (error) {
      if (attempt.current === mine) setProblem(wordsOf(error, fallback));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const submitRename = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() === "") {
      setProblem("Give the view a name.");
      return;
    }
    void run(() => control.rename(view.id, name.trim()), "Couldn't rename the view. Try again.");
  };

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Options for ${view.label}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72" aria-label={`Options for ${view.label}`}>
        {step === "menu" && (
          <div className="space-y-1">
            {/* While an earlier change of this view is still on its way, nothing here starts another: the items stay in the tab order, say so, and ignore the click. */}
            {canChange && <button type="button" aria-disabled={busy || undefined} onClick={() => { if (!busy) startRename(); }} className={`${ITEM} ${busy ? "opacity-50" : ""}`}>Rename</button>}
            {canShare && <button type="button" aria-disabled={busy || undefined} onClick={() => void run(() => control.share(view.id), "Couldn't share the view. Try again.")} className={`${ITEM} ${busy ? "opacity-50" : ""}`}>Share with the firm</button>}
            {canUnshare && <button type="button" aria-disabled={busy || undefined} onClick={() => void run(() => control.unshare(view.id), "Couldn't stop sharing the view. Try again.")} className={`${ITEM} ${busy ? "opacity-50" : ""}`}>Stop sharing</button>}
            {canChange && <button type="button" aria-disabled={busy || undefined} onClick={() => { if (!busy) setStep("delete"); }} className={`${ITEM} ${busy ? "opacity-50" : ""}`}>Delete</button>}
            {busy && <p className="px-3 pt-1 text-xs text-muted-foreground">Finishing the last change to this view.</p>}
            {canShare && <p className="px-3 pt-1 text-xs text-muted-foreground">Everyone in the firm can open a shared view, and sees only the submissions they may see.</p>}
          </div>
        )}
        {step === "rename" && (
          <form onSubmit={submitRename} noValidate>
            <label htmlFor={`${ids}-name`} className="text-sm font-medium">Name</label>
            <p className="text-xs text-muted-foreground">Required</p>
            <input
              id={`${ids}-name`}
              type="text"
              autoFocus
              value={name}
              maxLength={VIEW_NAME_MAX}
              autoComplete="off"
              aria-describedby={problem ? `${ids}-problem` : undefined}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {problem && <p id={`${ids}-problem`} role="alert" className="mt-2 text-sm text-destructive">{problem}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button type="submit" aria-disabled={busy || undefined} className={BUTTON}>{busy ? "Renaming…" : "Rename view"}</button>
              <button type="button" onClick={close} className={BUTTON}>Cancel</button>
            </div>
          </form>
        )}
        {step === "delete" && (
          <div>
            <p className="text-sm">{`Delete the view "${view.label}"?`}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {view.saved.shared ? "It is shared, so it goes for everyone in the firm. " : ""}
              {"Everyone's own choices of columns on it go with it. The submissions themselves are not touched."}
            </p>
            {problem && <p role="alert" className="mt-2 text-sm text-destructive">{problem}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button type="button" aria-disabled={busy || undefined} onClick={() => void run(() => control.remove(view.id), "Couldn't delete the view. Try again.")} className={BUTTON}>
                {busy ? "Deleting…" : "Delete view"}
              </button>
              <button type="button" onClick={close} autoFocus className={BUTTON}>Cancel</button>
            </div>
          </div>
        )}
        {step === "menu" && problem && <p role="alert" className="mt-2 text-sm text-destructive">{problem}</p>}
      </PopoverContent>
    </Popover>
  );
}
