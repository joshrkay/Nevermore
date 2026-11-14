import type { MutableRefObject } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * "Discard your changes?" The dialog has no trigger button of its own, so it is given the element that had the focus when the
 * question was asked and puts the focus back there when it closes (otherwise it would drop to the top of the page).
 */
export const DiscardDialog = ({ open, onKeep, onDiscard, returnFocusTo }: {
  open: boolean;
  onKeep: () => void;
  onDiscard: () => void;
  returnFocusTo: MutableRefObject<HTMLElement | null>;
}) => (
  <AlertDialog open={open} onOpenChange={(next) => { if (!next) onKeep(); }}>
    <AlertDialogContent
      onCloseAutoFocus={(e) => {
        const back = returnFocusTo.current;
        if (back?.isConnected) {
          e.preventDefault();
          back.focus();
        }
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
        <AlertDialogDescription>You changed this form and haven't saved. If you leave now, those changes are lost.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep editing</AlertDialogCancel>
        <AlertDialogAction onClick={onDiscard}>Discard changes</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
