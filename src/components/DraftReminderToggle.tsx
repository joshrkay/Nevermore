import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { DRAFT_REMINDER_HINT, DRAFT_REMINDER_SETTING } from "@/data/draftReminders";
import { readDraftReminders, setDraftReminders } from "@/lib/draftReminders";

/**
 * Asking to be emailed before an unfinished intake closes, or stopping it. Off until the prospect ticks it: a
 * reminder isn't a receipt for something they just did, so it needs their consent (docs/NOTIFICATIONS.md). Only an
 * account with a verified email has somewhere to send it.
 */
const DraftReminderToggle = ({ id = "draft-reminders" }: { id?: string }) => {
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

  if (!userId) return null;

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
