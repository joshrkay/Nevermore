// What a renewal says (story CRM-A2.4a; docs/BROKER_CRM_BUILD.md D-447 to D-451, D-454). Words and the one view's rule only: which renewals exist, who may change
// them and what is done are the database's (20261120110000_placements_renewals.sql). The screens that show these are CRM-A2.4b's.

/** What renews (D-447): a PEO placement, or the employer's current plan. */
export const RENEWAL_KINDS = ["peo_placement", "current_plan"] as const;
export type RenewalKind = (typeof RENEWAL_KINDS)[number];

export const RENEWAL_KIND_LABELS: Record<RenewalKind, string> = {
  peo_placement: "A PEO placement",
  current_plan: "The employer's current plan",
};

/**
 * What a renewal is at (D-449), worked out by the database: open (nobody is working it), working (its opportunity is open), lost (its opportunity was lost: Start
 * the renewal is offered again), renewed (its opportunity was won) and not_renewed (marked "Didn't renew", D-451). Renewed and not_renewed are done.
 */
export const RENEWAL_STATES = ["open", "working", "lost", "renewed", "not_renewed"] as const;
export type RenewalState = (typeof RENEWAL_STATES)[number];

/** The renewals still to be worked within this many days, overdue included, are the "Renewing in 120 days" view (D-450). */
export const RENEWING_WITHIN_DAYS = 120;

/** Days away in words (D-448): "in 45 days", "in 1 day", "today", "1 day ago", "12 days ago". */
export function daysAwayWords(days: number): string {
  if (!Number.isInteger(days)) throw new Error("Days away is a whole number");
  if (days === 0) return "today";
  const n = Math.abs(days);
  const unit = n === 1 ? "day" : "days";
  return days > 0 ? `in ${n} ${unit}` : `${n} ${unit} ago`;
}

/** A past renewal not done shows in the warning colour (D-448). */
export const isOverdue = (days: number, done: boolean): boolean => !done && days < 0;

/**
 * What a renewal says about itself under its date: the opportunity working it, or "Renewed", "Didn't renew", or the lost one (D-449). Nothing when nobody is
 * working it. `opportunityName` is the opportunity the renewal names, if any.
 */
export function renewalStateWords(state: RenewalState, opportunityName: string | null): string | null {
  switch (state) {
    case "working": return opportunityName;
    case "lost": return opportunityName ? `${opportunityName}, lost` : "Lost";
    case "renewed": return "Renewed";
    case "not_renewed": return "Didn't renew";
    default: return null;
  }
}

/** Whether "Start the renewal" is offered (D-449): while nobody is working it, and again when the one that was is lost. */
export const canStartRenewal = (state: RenewalState): boolean => state === "open" || state === "lost";

/** Whether the renewal is done (D-449): renewed, or marked "Didn't renew". */
export const isRenewalDone = (state: RenewalState): boolean => state === "renewed" || state === "not_renewed";
