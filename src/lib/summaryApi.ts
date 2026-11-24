// A person's own settings for the daily summary (docs/BROKER_READINESS_PRD.md BR-3.3; 20261129090000_daily_summary.sql): whether they get it, and the time
// zone their morning is in. About the caller only.
import { supabase } from "@/integrations/supabase/client";
import { AdvisorApiError } from "@/lib/advisorApi";

export interface SummarySettings { dailySummary: boolean; timeZone: string }

const read = (data: unknown): SummarySettings | null => {
  const d = data as { daily_summary?: unknown; time_zone?: unknown } | null;
  return d && typeof d.daily_summary === "boolean" && typeof d.time_zone === "string" ? { dailySummary: d.daily_summary, timeZone: d.time_zone } : null;
};

export async function loadMySummarySettings(): Promise<SummarySettings> {
  const { data, error } = await supabase.rpc("my_summary_settings");
  const settings = error ? null : read(data);
  if (!settings) throw new AdvisorApiError("Couldn't load your daily summary settings. Try again.", error?.code);
  return settings;
}

/** Saves both. A zone the database doesn't know is refused in its own words ("Choose a time zone from the list"). */
export async function saveMySummarySettings(settings: SummarySettings): Promise<SummarySettings> {
  const { data, error } = await supabase.rpc("set_my_summary_settings", { p_daily_summary: settings.dailySummary, p_time_zone: settings.timeZone });
  if (error) throw new AdvisorApiError(error.code === "22023" && error.message ? error.message : "Your settings weren't saved. Try again.", error.code);
  return read(data) ?? settings;
}

/** Tells the database the zone this browser is in; it keeps it only for a person who has none yet. Never throws: nothing on the page depends on it. */
export async function noteMyTimeZone(timeZone: string): Promise<void> {
  try {
    await supabase.rpc("note_my_time_zone", { p_time_zone: timeZone });
  } catch {
    // The summary goes by a default zone until a later page load says.
  }
}
