// The firm's reports (docs/BROKER_READINESS_PRD.md BR-6.1; CRM-R1.1 to CRM-R1.3; public.firm_reports, 20261204090000_reports.sql): the period a person
// picks, the words each figure is said in, and each table as a file. Figures are the database's: nothing here counts a record.
import { STAGE_LABELS, formatDay } from "@/data/accountPage";
import type { HomeWhose } from "@/data/home";
import { LOST_REASONS } from "@/data/opportunityClose";
import { DECLINE_REASON_LABELS, type DeclineReason } from "@/data/quoteRequests";
import { csvField, csvLines } from "@/lib/csv";
import type { OpportunityStage } from "@/lib/accountPageApi";

export const REPORTS_PATH = "/reports";

// sync:begin report_limits
export const REPORT_LIMITS = { max_days: 1100, max_rows: 50 } as const;
// sync:end report_limits

// ---------- the period ----------
export const REPORT_PERIODS = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
  { key: "year", label: "This year" },
  { key: "12m", label: "Last 12 months" },
  { key: "custom", label: "Between two dates" },
] as const;
export type ReportPeriodKey = (typeof REPORT_PERIODS)[number]["key"];
export const DEFAULT_REPORT_PERIOD: ReportPeriodKey = "quarter";
export const isReportPeriod = (v: unknown): v is ReportPeriodKey => REPORT_PERIODS.some((p) => p.key === v);

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The first and last day a period covers, as the person's own calendar has today. A period up to now ends today. */
export function reportRange(key: Exclude<ReportPeriodKey, "custom">, now: Date = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const from =
    key === "month" ? new Date(y, m, 1)
    : key === "quarter" ? new Date(y, m - (m % 3), 1)
    : key === "year" ? new Date(y, 0, 1)
    : new Date(y - 1, m, now.getDate() + 1);
  return { from: iso(from), to: iso(now) };
}

/** What is wrong with two typed dates, in words, or null when they make a period the database takes. */
export function customRangeProblem(from: string, to: string): string | null {
  if (!DAY.test(from) || !DAY.test(to)) return "Enter both dates.";
  if (from > to) return "The first date is after the second.";
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  return days > REPORT_LIMITS.max_days ? "A report covers at most three years." : null;
}

// ---------- what the database answers ----------
export interface PipelineReport {
  count: number; value: number;
  stages: { stage: OpportunityStage; count: number; value: number; medianDays: number | null }[];
  owners: { ownerId: string | null; owner: string | null; count: number; value: number }[];
  rows: { id: string; name: string; account: string; stage: OpportunityStage; days: number; value: number | null; owner: string | null }[];
}
export interface MarketsReport {
  sent: number; quoted: number; declined: number; won: number;
  markets: { market: string; sent: number; quoted: number; declined: number; won: number; medianDays: number | null; declineReasons: Record<string, number> }[];
  rows: { id: number; market: string; opportunityId: string; opportunity: string; account: string; sentOn: string; status: string; placed: boolean }[];
}
export interface WonLostReport {
  won: number; lost: number; valueWon: number;
  owners: { ownerId: string | null; owner: string | null; won: number; lost: number }[];
  sources: { source: string; won: number; lost: number }[];
  reasons: { reason: string; count: number }[];
  rows: { id: string; name: string; account: string; outcome: "won" | "lost"; on: string; value: number | null; reason: string | null; owner: string | null }[];
}
export interface RenewalsReport {
  months: { month: string; due: number; worked: number }[];
  kept: number; lost: number; open: number;
  rows: { id: string; accountId: string; account: string; withWhom: string; renewsOn: string; outcome: "kept" | "lost" | "open"; worked: boolean }[];
}
export interface CommissionReport {
  expected: number; received: number;
  months: { month: string; expected: number; received: number }[];
  rows: { placementId: string; accountId: string; account: string; market: string; expected: number; received: number }[];
}
export interface Reports {
  whose: HomeWhose; whoseChoices: HomeWhose[]; line: string | null; from: string; to: string; today: string;
  pipeline: PipelineReport; markets: MarketsReport; wonLost: WonLostReport; renewals: RenewalsReport;
  /** An owner's; absent for anyone else. */
  commission: CommissionReport | null;
}

// ---------- words ----------
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
/** "$12,000". */
export const money = (n: number | null): string => (n === null ? "" : dollars.format(n));
/** "1 day", "4 days", "2.5 days"; nothing when there is none. */
export const daysWords = (n: number | null): string => (n === null ? "" : `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? "day" : "days"}`);
/** A share as a whole percent, "33%"; a dash when there is nothing to take a share of. */
export const share = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "-");
/** "Nov 2026" for "2026-11". */
export const monthWords = (month: string): string => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("en-US", { year: "numeric", month: "short" });
};
export const stageWords = (stage: OpportunityStage): string => STAGE_LABELS[stage] ?? stage;
export const lostReasonWords = (reason: string | null): string => LOST_REASONS.find((r) => r.value === reason)?.label ?? "Not said";
export const declineReasonWords = (reason: string): string => DECLINE_REASON_LABELS[reason as DeclineReason] ?? (reason === "not_said" ? "Not said" : reason);
/** "Price (2), No capacity (1)" */
export const declineReasonsWords = (reasons: Record<string, number>): string =>
  Object.entries(reasons).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([r, n]) => `${declineReasonWords(r)} (${n})`).join(", ");
export const RENEWAL_OUTCOME_WORDS: Record<RenewalsReport["rows"][number]["outcome"], string> = { kept: "Kept", lost: "Not renewed", open: "Open" };
export const periodWords = (r: Pick<Reports, "from" | "to">): string => `${formatDay(r.from)} to ${formatDay(r.to)}`;
/** Said under a list that holds fewer records than its figure counts. */
export const cappedWords = (shown: number, counted: number): string | null =>
  counted > shown ? `Showing ${shown} of ${counted}.` : null;

// ---------- each table as a file ----------
export type ReportKey = "pipeline" | "markets" | "won_lost" | "renewals" | "commission";
export const REPORT_TITLES: Record<ReportKey, string> = {
  pipeline: "Pipeline", markets: "Quotes by market", won_lost: "Won and lost", renewals: "Renewals", commission: "Commission",
};

/** The table a panel shows, as heading and rows of plain values: the file holds what the screen says and nothing else. */
export function reportTable(key: ReportKey, r: Reports): { headings: string[]; rows: (string | number | null)[][] } {
  switch (key) {
    case "pipeline":
      return { headings: ["Stage", "Open", "Value", "Median days open"], rows: r.pipeline.stages.map((s) => [stageWords(s.stage), s.count, s.value, s.medianDays]) };
    case "markets":
      return {
        headings: ["PEO or carrier", "Sent", "Quoted", "Declined", "Placed", "Win rate", "Median days to a quote", "Declined because"],
        rows: r.markets.markets.map((m) => [m.market, m.sent, m.quoted, m.declined, m.won, m.quoted > 0 ? share(m.won, m.quoted) : "", m.medianDays, declineReasonsWords(m.declineReasons)]),
      };
    case "won_lost":
      return {
        headings: ["Opportunity", "Account", "Outcome", "On", "Value", "Reason", "Owner"],
        rows: r.wonLost.rows.map((o) => [o.name, o.account, o.outcome === "won" ? "Won" : "Lost", o.on, o.value, o.outcome === "lost" ? lostReasonWords(o.reason) : "", o.owner]),
      };
    case "renewals":
      return { headings: ["Month", "Due", "Being worked"], rows: r.renewals.months.map((m) => [monthWords(m.month), m.due, m.worked]) };
    case "commission":
      return {
        headings: ["Account", "PEO or carrier", "Expected", "Received"],
        rows: (r.commission?.rows ?? []).map((c) => [c.account, c.market, c.expected, c.received]),
      };
  }
}

export const reportFileName = (key: ReportKey, r: Pick<Reports, "from" | "to">): string => `${key.replace("_", "-")}-${r.from}-to-${r.to}.csv`;

/** The file's text, every cell made safe to open in a spreadsheet (src/lib/csv.ts). */
export function reportCsv(key: ReportKey, r: Reports): string {
  const t = reportTable(key, r);
  return csvLines([t.headings.map(csvField), ...t.rows.map((row) => row.map(csvField))]);
}
