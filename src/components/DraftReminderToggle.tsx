import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { DRAFT_REMINDER_HINT, DRAFT_REMINDER_SETTING } from "@/data/draftReminders";
import { readDraftReminders, setDraftReminders } from "@/lib/draftReminders";
import RecoverIntake from "@/components/chamber/RecoverIntake";

/**
 * Asking to be emailed before an unfinished intake closes, or stopping it. Off until the prospect ticks it: a
 * reminder isn't a receipt for something they just did, so it needs their consent (docs/NOTIFICATIONS.md). Only an
 * account with a verified email has somewhere to send it.
 *
 * With `offerSignIn` (the profile page, where a reminder's stop link lands), a guest is offered the emailed-code
 * sign-in instead: opened in another browser, the link arrives as a fresh guest, who would otherwise see no setting.
 */
const DraftReminderToggle = ({ id = "draft-reminders", offerSignIn = false }: { id?: string; offerSignIn?: boolean }) => {
  const { user, isAnonymous } = useAuth();
  const userId = !isAnonymous ? user?.id ?? null : null;
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void readDraftReminders(userId).then((value) => {
      if (!cancelled) setOn(value);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId) {
    if (!offerSignIn || !user || !isAnonymous) return null;
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">{DRAFT_REMINDER_SETTING}</p>
        <p className="text-xs text-muted-foreground">
          To turn reminders on or off, sign in with the email our reminders go to. We'll email you a code.
        </p>
        <RecoverIntake idPrefix={`${id}-sign-in`} />
      </div>
    );
  }

  const change = async (next: boolean) => {
    setSaving(true);
    const saved = await setDraftReminders(userId, next);
    setSaving(false);
    if (saved) setOn(next);
    else toast.error("We couldn't save that setting. Please try again.");
  };

  return (
    <div className="flex items-start gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={on === true}
        disabled={on === null || saving}
        onChange={(e) => void change(e.target.checked)}
        aria-describedby={`${id}-hint`}
        className="mt-0.5 h-4 w-4 accent-primary"
      />
      <div>
        <label htmlFor={id} className="font-medium">{DRAFT_REMINDER_SETTING}</label>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{DRAFT_REMINDER_HINT}</p>
      </div>
    </div>
  );
};

export default DraftReminderToggle;
