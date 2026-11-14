import { useRef, useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { failureWords, SaveFailed } from "../form";

/** A small action beside the view's words: a plain link-like button, as the filter row's "Clear filters" is. */
export const VIEW_ACTION = "text-primary underline hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

interface Props {
  /** The words on the button that opens the question. */
  trigger: string;
  /** The question, as the dialog's name: "Delete the view “Hot leads”?" */
  title: string;
  /** What the answer does, in plain words. */
  description: ReactNode;
  /** The words on the button that does it. */
  confirm: string;
  /** What to say when it could not be done and the error has no words for people. */
  fallback: string;
  /** Does it. Throws an Error with words for the person to refuse it: the question stays open and says why. */
  onConfirm: () => Promise<void>;
  /** Called when the question opens (the status is put on the page then, empty, so what the action says is announced). */
  onOpen?: () => void;
  /** Where focus goes once the question has closed, when it is not the button that opened it (the button goes with the view that is deleted). */
  focusAfter?: () => HTMLElement | null | undefined;
}

/**
 * A question a person answers before something that can't be undone (story CRM-S3.4a): delete a view, share it with the firm, stop sharing it. A modal alert
 * dialog (Radix `AlertDialog`) whose focus starts on Cancel, the choice that changes nothing; Escape is Cancel. The answer's button is not a "close": it keeps
 * the question open while it asks the database, and if the database refuses, the reason is said inside the question, in the database's words when they are for
 * people, and nothing on screen has changed.
 */
export function ViewConfirm({ trigger, title, description, confirm, fallback, onConfirm, onOpen, focusAfter }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Only a question that was answered Yes sends focus somewhere else: Cancel and Escape put it back on the button that asked.
  const answered = useRef(false);

  const run = async () => {
    setFailure(null);
    setBusy(true);
    try {
      await onConfirm();
      answered.current = true;
      setOpen(false);
    } catch (error) {
      setFailure(failureWords(error, fallback));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setFailure(null); onOpen?.(); } }}>
      <AlertDialogTrigger asChild>
        <button type="button" className={VIEW_ACTION}>{trigger}</button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onCloseAutoFocus={(e) => {
          const target = answered.current ? focusAfter?.() : null;
          answered.current = false;
          if (target) {
            e.preventDefault();
            target.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <SaveFailed message={failure} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void run(); }}>{confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
