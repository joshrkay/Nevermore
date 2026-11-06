import { useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SignOutButtonProps {
  className?: string;
  /**
   * Saves what's pending first (the Chamber's answers); resolves true once everything is saved. Signing out also
   * clears this browser's copy of unsaved answers, so when this fails the prospect is asked before they're lost.
   */
  saveFirst?: () => Promise<boolean>;
}

/**
 * "Sign out" for a prospect with a verified email, so the next person at a shared computer doesn't open their
 * intake. Not offered to a guest: a guest's intake can only be reopened from this browser (Save your progress
 * verifies an email first, and then this appears).
 *
 * It leaves for the landing page before ending the session: the Chamber and Profile sit under RequireAuth, which
 * starts a guest session for anyone signed out, and would otherwise start one here the moment the session ends.
 */
const SignOutButton = ({ className = "", saveFirst }: SignOutButtonProps) => {
  const { user, isAnonymous, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [unsaved, setUnsaved] = useState(false);

  if (!user || isAnonymous) return null;

  const leave = async (saved: boolean) => {
    setBusy(true);
    flushSync(() => navigate("/", { replace: true }));
    // Also clears the unsaved answers this browser kept (useAuth).
    await signOut();
    toast.success(saved ? "You've signed out. Your answers stay with your account." : "You've signed out.");
  };

  const start = async () => {
    setBusy(true);
    const saved = saveFirst ? await saveFirst() : true;
    if (saved) return leave(true);
    setBusy(false);
    setUnsaved(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className={`text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50 ${className}`}
      >
        Sign out
      </button>
      <AlertDialog open={unsaved} onOpenChange={setUnsaved}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Some answers aren't saved</AlertDialogTitle>
            <AlertDialogDescription>
              Your latest answers couldn't be saved to your account. If you sign out now, they're lost: this browser's
              copy is cleared when you sign out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={() => void leave(false)}>Sign out anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SignOutButton;
