import { useRef, useState } from "react";
import type { TableFields } from "@/lib/tableQuery";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { failureWords, SaveFailed } from "../form";
import { useOnline } from "../useOnline";
import type { TableView } from "./columns";
import type { ViewActions } from "./useViewActions";
import { VIEW_ACTION, ViewConfirm } from "./ViewConfirm";
import { ViewNameForm } from "./ViewNameForm";
import { viewTabLink } from "./viewTabLink";

interface Props<K extends TableFields> {
  /** The saved view that is open. */
  view: TableView<K>;
  /** Whether something is over it that it was not saved with (`isModifiedView`). */
  modified: boolean;
  manage: ViewActions<K>;
}

/**
 * What a person may do with the saved view that is open (story CRM-S3.4a), in a short line under the tabs: who can see it, whether it has been changed
 * since it was saved, and the buttons for what they may do with it. The database says what they may do (`view.saved`); nothing here decides it, and a
 * control the person may not use is not drawn. A built-in view has no bar: nothing can change it.
 */
export function ViewBar<K extends TableFields>({ view, modified, manage }: Props<K>) {
  const saved = view.saved!;
  const online = useOnline();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const saveChangesButton = useRef<HTMLButtonElement>(null);
  const offline = !online;
  const unavailable = offline ? "You're offline. Saving is back when you are." : manage.unavailable;

  const saveChanges = async () => {
    if (unavailable) return;
    setFailure(null);
    setBusy(true);
    manage.arm();
    try {
      await manage.saveChanges(view);
    } catch (error) {
      setFailure(failureWords(error, "Couldn't change the view. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="group" aria-label="This view" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      <span>{saved.shared ? "Shared with the firm." : "Only you can see this view."}</span>
      {modified && (
        <span>
          This view has changes you haven't saved.{!saved.canChange && " “Save this as a view” keeps them as a view of your own."}
        </span>
      )}
      {modified && saved.canChange && (
        <>
          <Button
            ref={saveChangesButton}
            type="button"
            variant="outline"
            disabled={busy}
            aria-disabled={unavailable ? true : undefined}
            aria-describedby={unavailable ? "save-changes-unavailable" : undefined}
            onClick={() => void saveChanges()}
            className={`h-9 rounded-md ${unavailable ? "opacity-50" : ""}`}
          >
            Save changes to this view
          </Button>
          {unavailable && <span id="save-changes-unavailable" className="sr-only">{unavailable}</span>}
          <SaveFailed message={failure} returnFocusTo={saveChangesButton} />
        </>
      )}
      {saved.canChange && (
        <Popover open={renaming} onOpenChange={(open) => { setRenaming(open); if (open) manage.arm(); }}>
          <PopoverTrigger asChild>
            <button type="button" className={VIEW_ACTION}>Rename</button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80" aria-label="Rename this view">
            <ViewNameForm
              submitLabel="Rename view"
              intro={`Rename “${view.label}”.`}
              initial={view.label}
              onSubmit={async (name) => { await manage.rename(view, name); setRenaming(false); }}
              onCancel={() => setRenaming(false)}
            />
          </PopoverContent>
        </Popover>
      )}
      {/* One button for both, so the element a keyboard person pressed is still there, with its new words, when the question is answered. */}
      {(saved.canShare || saved.canUnshare) && (
        <ViewConfirm
          trigger={saved.canShare ? "Share with the firm" : "Stop sharing"}
          title={saved.canShare ? `Share “${view.label}” with the firm?` : `Stop sharing “${view.label}”?`}
          description={
            saved.canShare
              ? "Everyone in the firm will see this tab, with its filters, sort and columns. Only an owner can stop sharing it."
              : saved.mine
                ? "It goes back to being a view only you can see. The rest of the firm will no longer see this tab."
                : "It goes back to being private to whoever saved it, so it will no longer be in your views or the firm's."
          }
          confirm={saved.canShare ? "Share with the firm" : "Stop sharing"}
          fallback={saved.canShare ? "Couldn't share the view. Try again." : "Couldn't stop sharing the view. Try again."}
          onOpen={manage.arm}
          onConfirm={() => (saved.canShare ? manage.share(view) : manage.unshare(view))}
          // A colleague's view leaves the person's tabs once it is not shared, so the button goes: focus goes to the "all" tab.
          focusAfter={!saved.canShare && !saved.mine ? () => viewTabLink(null) : undefined}
        />
      )}
      {saved.canChange && (
        <ViewConfirm
          trigger="Delete"
          title={`Delete the view “${view.label}”?`}
          description={<>{saved.shared && <>It is shared with the firm, so it goes for everyone in it. </>}<span>The submissions stay.</span></>}
          confirm="Delete view"
          fallback="Couldn't delete the view. Try again."
          onOpen={manage.arm}
          onConfirm={() => manage.remove(view)}
          // The Delete button goes with the view: focus goes to the table's "all" tab, which is where the table now is.
          focusAfter={() => viewTabLink(null)}
        />
      )}
    </div>
  );
}
