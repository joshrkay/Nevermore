import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface StartOverButtonProps {
  /** Archives this intake (when it can be) and begins a blank one. False when nothing changed. */
  onStartOver: () => Promise<boolean>;
  /** The intake was certified at some point: it is kept for the advisor, not archived. */
  certifiedBefore: boolean;
}

/** "Start over", confirmed first: what happens to the intake on screen depends on whether it was certified. */
const StartOverButton = ({ onStartOver, certifiedBefore }: StartOverButtonProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await onStartOver();
    setBusy(false);
    if (ok) setOpen(false);
    else setFailed(true);
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!busy) { setOpen(next); setFailed(false); } }}>
      <AlertDialogTrigger asChild>
        <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
          Start over
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start a new intake?</AlertDialogTitle>
          <AlertDialogDescription>
            {certifiedBefore
              ? "This intake was certified, so it stays with your advisor as it is. You'll begin a blank intake."
              : "This intake will be archived, and you won't be able to open it again. You'll begin a blank intake."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            We couldn't set this intake aside just now. Nothing has changed; try again in a moment.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep this intake</AlertDialogCancel>
          {/* Not AlertDialogAction: that closes the dialog before the archive has answered. */}
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Start over
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default StartOverButton;
