import { CheckCircle2, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DraftReminderToggle from "@/components/DraftReminderToggle";
import VerifyEmailGate from "./VerifyEmailGate";

// A guest's way back before certifying: the same 6-digit email verification The Reckoning asks for, offered from the
// top bar whenever there is an intake, and once, with a nudge, when its required answers are in (the moment Lenore
// moves on to the census, which most prospects have to go and find). Verifying upgrades the guest in place, so the
// email is their way back from another device (RecoverIntake); once verified they can ask for the draft reminder.

export const SAVE_PROGRESS = "Save your progress";

const linkButton = "font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors";

/** Opens the dialog. Only a guest has progress to save this way. */
export const SaveProgressButton = ({ onOpen }: { onOpen: () => void }) => (
  <button
    type="button"
    onClick={onOpen}
    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors whitespace-nowrap"
  >
    <Save className="w-3 h-3" aria-hidden="true" /> {SAVE_PROGRESS}
  </button>
);

/** The verification, and, once it is done, where it leaves them. Rendered once, by the Chamber page. */
export const SaveProgressDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { isAnonymous, user } = useAuth();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isAnonymous ? SAVE_PROGRESS : "Your progress is saved"}</DialogTitle>
          <DialogDescription>
            {isAnonymous
              ? "Your answers are saved in this browser. Verify your email to come back to this intake from any device by signing in with it."
              : `Sign in with ${user?.email ?? "your email"} to come back to this intake from any device.`}
          </DialogDescription>
        </DialogHeader>
        {isAnonymous ? (
          <VerifyEmailGate purpose="save" framed={false} />
        ) : (
          <div className="space-y-4">
            <p role="status" className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Email verified.
            </p>
            <DraftReminderToggle id="save-progress-reminders" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** The one-time nudge under the top bar, until the prospect saves or says not now. */
export const SaveProgressNudge = ({ onSave, onDismiss }: { onSave: () => void; onDismiss: () => void }) => (
  <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-primary/5 px-4 py-2 text-xs">
    <span>
      Your required answers are in. Most people go and find their employee list next: verify your email first so you
      can come back to this intake from any device.
    </span>
    <span className="flex items-center gap-3 ml-auto">
      <button type="button" onClick={onSave} className={linkButton}>{SAVE_PROGRESS}</button>
      <button type="button" onClick={onDismiss} className={linkButton}>Not now</button>
    </span>
  </div>
);
