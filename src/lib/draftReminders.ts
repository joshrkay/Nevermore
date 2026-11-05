import { supabase } from "@/integrations/supabase/client";

/** Whether the account asked for draft reminders, or null when it can't be read. Never throws. */
export async function readDraftReminders(userId: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.from("profiles").select("draft_reminders_at").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return Boolean(data?.draft_reminders_at);
  } catch (err) {
    console.warn("Couldn't read the reminder setting:", err);
    return null;
  }
}

/**
 * Asks for draft reminders, or stops them. The database stamps when they were asked for, whatever time is sent.
 * Returns whether it was saved. Never throws.
 */
export async function setDraftReminders(userId: string, on: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ draft_reminders_at: on ? new Date().toISOString() : null })
      .eq("user_id", userId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("Couldn't save the reminder setting:", err);
    return false;
  }
}
