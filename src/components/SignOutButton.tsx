import { useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

/**
 * "Sign out" for a prospect with a verified email, so the next person at a shared computer doesn't open their
 * intake. Not offered to a guest: a guest's intake can only be reopened from this browser (Save your progress
 * verifies an email first, and then this appears).
 *
 * It leaves for the landing page before ending the session: the Chamber and Profile sit under RequireAuth, which
 * starts a guest session for anyone signed out, and would otherwise start one here the moment the session ends.
 */
const SignOutButton = ({ className = "" }: { className?: string }) => {
  const { user, isAnonymous, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!user || isAnonymous) return null;

  const leave = async () => {
    setBusy(true);
    flushSync(() => navigate("/", { replace: true }));
    // Also clears the unsaved answers this browser kept (useAuth).
    await signOut();
    toast.success("You've signed out. Your answers stay with your account.");
  };

  return (
    <button
      type="button"
      onClick={() => void leave()}
      disabled={busy}
      className={`text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50 ${className}`}
    >
      Sign out
    </button>
  );
};

export default SignOutButton;
