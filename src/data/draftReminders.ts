/**
 * The setting a prospect ticks to be emailed a week before an unfinished intake closes (profiles.draft_reminders_at,
 * migration 20261105091000), and unticks to stop. The reminder email names it in these words
 * (dispatch-outbox's DRAFT_REMINDER_SETTING; draftReminders.test.ts keeps them equal).
 */
export const DRAFT_REMINDER_SETTING = "Email me before an unfinished intake closes";

export const DRAFT_REMINDER_HINT =
  "We'll email you a week before an intake you haven't certified closes, with a link back to it. Untick to stop.";
