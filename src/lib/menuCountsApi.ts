import { supabase } from "@/integrations/supabase/client";

// The numbers beside the menu's items (story CRM-S1.1c, D-39). One database call answers for every count the menu shows, for the firm the
// address names (D-40): supabase/migrations/20261118140000_menu_counts.sql holds what each one means. Later stories add keys to the same
// answer (leads, others); a caller reads by name, so none of them changes.

/** What the menu shows: open quotes (quote requests sent and not yet answered) and intakes with new PEO mail. */
export interface MenuCounts {
  quotes: number;
  inbox: number;
}

/** The query's key. A thread opened elsewhere invalidates it, so the menu follows the queue's mark at once (CRM-S1.1c). */
export const MENU_COUNTS_KEY = ["menu-counts"] as const;

const whole = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

/** Asks for the counts. Throws on a failed call or an answer that is not whole numbers: the menu keeps what it last had. */
export async function fetchMenuCounts(): Promise<MenuCounts> {
  const { data, error } = await supabase.rpc("menu_counts");
  if (error) throw new Error(error.message || "Couldn't read the menu counts.");
  const answer = (data ?? {}) as Record<string, unknown>;
  const quotes = whole(answer.quotes);
  const inbox = whole(answer.inbox);
  if (quotes === null || inbox === null) throw new Error("The menu counts came back in a form this page can't read.");
  return { quotes, inbox };
}
