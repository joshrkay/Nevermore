import { z } from "zod";
import { choiceRule, dateRule, nameRule } from "@/components/workspace/form/fieldRules";

// What an account's renewals say in words (story CRM-A2.4b, D-446, D-448, D-450). Pure: the database works out which renewal is done and how far away it is.

export type RenewalKind = "peo_placement" | "current_plan";

export const RENEWAL_KINDS: { id: RenewalKind; label: string }[] = [
  { id: "peo_placement", label: "A PEO placement" },
  { id: "current_plan", label: "The employer's current plan" },
];
export const kindLabel = (kind: RenewalKind) => RENEWAL_KINDS.find((k) => k.id === kind)?.label ?? kind;

/**
 * D-448's words for how far away a renewal is: "in 45 days", "in 1 day", "today", "1 day ago", "12 days ago". The database works the number out from today in
 * the person's time zone; this only puts it into words.
 */
export function daysAwayWords(days: number): string {
  if (days === 0) return "today";
  const n = Math.abs(days);
  const unit = n === 1 ? "day" : "days";
  return days > 0 ? `in ${n} ${unit}` : `${n} ${unit} ago`;
}

/**
 * The whole days from `today` (a Date, read in the person's own time) to a renewal's day (YYYY-MM-DD); negative once it has passed. The accounts table's Renewal
 * column says it from the row's date alone; an account's own tab takes the number from the database, which works it out in the firm's time zone (D-448).
 */
export function daysFromToday(day: string, today: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return 0;
  const there = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const here = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((there - here) / 86_400_000);
}

// ---------- the forms' rules ----------

const needsDay = (missing: string) => dateRule().refine((v) => v !== "", missing);

/** Add a renewal (D-447): what renews, with whom (at most 80, as the database has it), the date and, for a PEO placement, when it started if that is known. */
export const addRenewalSchema = z.object({
  kind: choiceRule(RENEWAL_KINDS.map((k) => k.id), "Choose what renews."),
  with_whom: nameRule("Enter who it is with.", 80),
  renews_on: needsDay("Enter the renewal date."),
  placement_start: dateRule(),
});

/** Edit a renewal: with whom and the date (what renews is not changed: delete the renewal and add the right one). */
export const editRenewalSchema = z.object({
  with_whom: nameRule("Enter who it is with.", 80),
  renews_on: needsDay("Enter the renewal date."),
});

/** "Didn't renew" asks the day (offered as the renewal's date, D-451). */
export const notRenewedSchema = z.object({ not_renewed_on: needsDay("Enter the day it didn't renew.") });
