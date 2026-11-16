import { isOpenQuoteRequest } from "@/data/quoteRequests";
import { formatDay, formatWhen } from "@/data/accountPage";
import { replySubject } from "@/data/peoFollowUp";
import type { ChangedField } from "@/lib/recordVersion";

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

/** n x 10^places as a whole number (the inputs have at most two decimals, the database's `numeric(14, 2)`; four are kept so an older longer figure is not cut). */
const scaled = (n: number, places: number): bigint => BigInt(Math.round(n * 10 ** places));
/** numerator / divisor, to the nearest whole number, halves up (both positive). */
const halfUp = (numerator: bigint, divisor: bigint): bigint => (numerator * 2n + divisor) / (2n * divisor);

/**
 * "Expected commission, a year" (D-466): ((percent / 100) x admin fee per employee per month x employees x 12) for a share, (per employee x employees x 12) for
 * dollars per employee, the number itself for flat; to the cent, half up. Worked in integer cents (BigInt), never in floating point, so an exact half cent is never
 * turned down by drift. Null when what it needs is not known (the quote's admin fee, the employees).
 */
export function expectedCommissionYearly(c: { basis: string; rate: number; adminFeePepm: number | null; employees: number | null }): number | null {
  if (!Number.isFinite(c.rate) || c.rate < 0) return null;
  const toDollars = (cents: bigint) => Number(cents) / 100;
  if (c.basis === "flat") return toDollars(halfUp(scaled(c.rate, 4), 100n));
  if (c.employees === null || !Number.isInteger(c.employees) || c.employees < 0) return null;
  const months = BigInt(c.employees) * 12n;
  // dollars x 10^4 per employee per month, over 10^2 to reach cents.
  if (c.basis === "per_employee") return toDollars(halfUp(scaled(c.rate, 4) * months, 100n));
  // percent x 10^4, admin fee x 10^4: (percent / 100) x fee = product / 10^10 dollars = product / 10^8 cents.
  if (c.basis === "share") return c.adminFeePepm === null ? null : toDollars(halfUp(scaled(c.rate, 4) * scaled(c.adminFeePepm, 4) * months, 100_000_000n));
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

// ---------- the commission form's rules, shared by the win's dialog and the later change (D-466) ----------

/** Dollars or a percent as a person types them: digits, and up to two decimals. */
export const MONEY = /^\d+(\.\d{1,2})?$/;

/** What is wrong with the commission fields of a form, in words, by field. The database asks the same and says the rest. */
export function commissionProblems(v: { commission_basis?: string; commission_rate?: string; commission_yearly?: string }): { path: string; message: string }[] {
  const problems: { path: string; message: string }[] = [];
  const { commission_basis: basis = "", commission_rate: rateText = "", commission_yearly: yearly = "" } = v;
  if (basis !== "") {
    const rate = Number(rateText);
    if (!MONEY.test(rateText) || rate <= 0) problems.push({ path: "commission_rate", message: "Enter the commission's number, like 20." });
    else if (basis === "share" && rate > 100) problems.push({ path: "commission_rate", message: "A share is a percent: 100 at most." });
    if (yearly !== "" && !MONEY.test(yearly)) problems.push({ path: "commission_yearly", message: "Enter the expected commission in dollars, like 7650." });
  }
  return problems;
}

// ---------- who changed what, in the page's words (D-46) ----------

const PAYMENT_FIELDS: Record<string, string> = { received_on: "Day received", amount: "Amount", note: "Note" };
const COMMISSION_FIELDS: Record<string, string> = {
  commission_basis: "Commission basis", commission_rate: "Commission rate", commission_expected_yearly: "Expected commission, a year",
};
const humanField = (field: string) => `${field.charAt(0).toUpperCase()}${field.slice(1).replace(/_/g, " ")}`;
export const paymentFieldLabel = (field: string): string => PAYMENT_FIELDS[field] ?? humanField(field);
export const commissionFieldLabel = (field: string): string => COMMISSION_FIELDS[field] ?? humanField(field);

/** "Amount changed by marcus@x.example, Nov 12, 2026, 10:00 AM": one entry of a conflict's `changed` list, its field in the page's words and never a column name. */
export const changedLine = (c: ChangedField, label: (field: string) => string): string => `${label(c.field)} changed by ${c.who}, ${formatWhen(c.at)}`;

/** What the close reads of a quote request and of the mail on its thread: enough to say who is still open and what was last written. */
export interface TellRequest { id: number; peo_name: string; status: string }
export interface TellMessage { quote_request_id: number; direction: string; subject: string | null; recorded_at: string }

/** The PEOs a close offers to tell (D-1722), as the database works it out again. */
export const peosToTell = <Q extends TellRequest>(quoteRequests: readonly Q[], mail: readonly TellMessage[], winnerId: number | null): Q[] => quoteRequests.filter((q) => q.id !== winnerId && (isOpenQuoteRequest(q.status) || q.status === "quoted") && mail.some((m) => m.quote_request_id === q.id && m.direction === "sent"));

/** The subject the one note opens with: an answer to the newest message the product sent the PEOs it tells, else to the account's name (D-1724). */
export function withdrawalSubject(told: readonly TellRequest[], mail: readonly TellMessage[], accountName: string): string {
  const ids = new Set(told.map((q) => q.id));
  const newest = mail.filter((m) => m.direction === "sent" && ids.has(m.quote_request_id)).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
  return replySubject(newest?.subject ?? null, accountName);
}
