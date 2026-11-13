import { useBlocker } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const DiscardDialog = ({ open, onKeep, onDiscard }: { open: boolean; onKeep: () => void; onDiscard: () => void }) => (
  <AlertDialog open={open} onOpenChange={(next) => { if (!next) onKeep(); }}>
    <AlertDialogContent>
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

/** Asks before the app moves to another page. Only mounted under a data router (see App.tsx); `useBlocker` needs one. */
export const NavigationBlocker = ({ active }: { active: () => boolean }) => {
  const blocker = useBlocker(() => active());
  return (
    <DiscardDialog
      open={blocker.state === "blocked"}
      onKeep={() => blocker.state === "blocked" && blocker.reset()}
      onDiscard={() => blocker.state === "blocked" && blocker.proceed()}
    />
  );
};

