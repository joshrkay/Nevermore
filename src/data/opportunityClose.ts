import { formatDay } from "@/data/accountPage";

// The rules of closing an opportunity as a person sees them (story CRM-O1.3b, D-465 to D-468, D-472). The database decides every rule that binds; this words them and
// works out the figures the dialog offers before it asks.

/** How an expected commission is worked out (D-466): a share of the admin fee, dollars per employee per month, or dollars flat a year. */
export const COMMISSION_BASES = [
  { value: "share", label: "A share of the admin fee", numberLabel: "Share (percent)" },
  { value: "per_employee", label: "Dollars per employee per month", numberLabel: "Dollars per employee per month" },
  { value: "flat", label: "Dollars flat, a year", numberLabel: "Dollars a year" },
] as const;

/** The fixed list of reasons a search is lost (D-468), by the database's own keys. */
export const LOST_REASONS = [
  { value: "stayed_with_current_provider", label: "Stayed with current provider" },
  { value: "price", label: "Price" },
  { value: "went_direct", label: "Went direct to a PEO" },
  { value: "no_decision", label: "No decision" },
  { value: "other", label: "Other" },
] as const;

export const lostReasonWords = (reason: string): string => LOST_REASONS.find((r) => r.value === reason)?.label ?? reason;

const cents = (n: number): number => Math.round((n + 1e-9) * 100) / 100;

/**
 * "Expected commission, a year" (D-466): ((percent / 100) x admin fee per employee per month x employees x 12) for a share, (per employee x employees x 12) for
 * dollars per employee, the number itself for flat; to the cent, half up. Null when what it needs is not known (the quote's admin fee, the employees).
 */
export function expectedCommissionYearly(c: { basis: string; rate: number; adminFeePepm: number | null; employees: number | null }): number | null {
  if (!Number.isFinite(c.rate)) return null;
  if (c.basis === "flat") return cents(c.rate);
  if (c.employees === null) return null;
  if (c.basis === "per_employee") return cents(c.rate * c.employees * 12);
  if (c.basis === "share") return c.adminFeePepm === null ? null : cents((c.rate / 100) * c.adminFeePepm * c.employees * 12);
  return null;
}

/** The arithmetic the dialog shows beside the yearly figure (D-466), or null when it has none to show. */
export function commissionArithmetic(c: { basis: string; rate: number; adminFeePepm: number | null; employees: number | null }): string | null {
  const total = expectedCommissionYearly(c);
  if (total === null) return null;
  const dollars = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (c.basis === "flat") return `${dollars(c.rate)} a year`;
  if (c.basis === "per_employee") return `${dollars(c.rate)} × ${c.employees} employees × 12 months = ${dollars(total)}`;
  return `${c.rate}% × ${dollars(c.adminFeePepm as number)} × ${c.employees} employees × 12 months = ${dollars(total)}`;
}

/** The renewal's default (D-465): a year after the start, both as a date field gives them. Empty for a start that is no day. */
export function renewalAfter(start: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  if (!m) return "";
  const next = new Date(Date.UTC(Number(m[1]) + 1, Number(m[2]) - 1, Number(m[3])));
  return next.toISOString().slice(0, 10);
}

/** The won or lost banner's line (D-472): "Won · <PEO> · from <start> · renews <date>", or "Lost · <reason>". */
export function outcomeBannerWords(o: {
  stage: "won" | "lost"; peoName: string | null; startDate: string | null; renewsOn: string | null; lostReason: string | null; lostNote: string | null;
}): string {
  if (o.stage === "won") {
    return ["Won", o.peoName, o.startDate && `from ${formatDay(o.startDate)}`, o.renewsOn && `renews ${formatDay(o.renewsOn)}`].filter(Boolean).join(" · ");
  }
  if (!o.lostReason) return "Lost";
  const reason = lostReasonWords(o.lostReason);
  return `Lost · ${reason}${o.lostReason === "other" && o.lostNote ? `: ${o.lostNote}` : ""}`;
}

/** Why a closed quote closed (D-424, D-464, D-468). Null for a quote that is not closed with a reason. */
export function quoteCloseWords(reason: string | null): string | null {
  return reason === "went_elsewhere" ? "The employer went elsewhere" : reason === "search_ended" ? "The search ended" : null;
}
