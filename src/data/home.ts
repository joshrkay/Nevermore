// Home (CRM-H1; docs/BROKER_READINESS_PRD.md BR-3.1, BR-3.2, BR-5.2): the words and the addresses of what public.home_page answers. The database decides
// what is on Home; this says how each line reads and where it opens.
import type { OpportunityStage } from "@/lib/accountPageApi";

/** The day counts Home goes by, as the database has them (public.home_days; schemaSync holds the two equal). */
export const HOME_DAYS = { quote_expiring: 14, intake_quiet: 7, lead_quiet: 7, upcoming_tasks: 14, renewals: 120 } as const;

export const HOME_PATH = "/home";

export type HomeWhose = "mine" | "team" | "everyone";
export const WHOSE_LABELS: Record<HomeWhose, string> = { mine: "Mine", team: "My team", everyone: "Everyone" };

export type NeedKind = "new_mail" | "intake_certified" | "quote_expiring" | "intake_quiet" | "task_due" | "lead_quiet";
export type HomeRecordType = "inbox" | "opportunity" | "quote" | "lead" | "account";

export interface HomeNeed { kind: NeedKind; recordType: HomeRecordType; recordId: string; name: string | null; about: string | null; at: string; owner: string | null }
export interface HomeCounts { openLeads: number; openOpportunities: number; quotesWaiting: number; renewalsDue: number; wonThisQuarter: number }
export interface HomeRenewal { id: string; accountId: string; accountName: string; kind: string; withWhom: string; renewsOn: string; daysAway: number }
export interface HomeTask { id: string; title: string | null; dueOn: string; daysAway: number; recordType: HomeRecordType; recordId: string; name: string | null; assignee: string | null }
export type SendBlock = "waiting_for_approval" | "refused" | "no_mailbox";

export interface Home {
  whose: HomeWhose;
  whoseChoices: HomeWhose[];
  /** The firm has no lead and no account yet. */
  empty: boolean;
  blocksSending: SendBlock | null;
  needs: HomeNeed[];
  /** How many lines need the person in all; `needs` holds the first of them. */
  needsTotal: number;
  counts: HomeCounts;
  stages: { stage: OpportunityStage; count: number }[];
  renewals: HomeRenewal[];
  upcomingTasks: HomeTask[];
}

/** Where a line of Home opens: the record it is about. New mail opens the inbox, which lists the thread. */
export function recordPath(type: HomeRecordType, id: string): string {
  switch (type) {
    case "inbox": return "/inbox";
    case "opportunity": return `/opportunities/${id}`;
    case "quote": return `/quotes/${id}`;
    case "lead": return `/leads/${id}`;
    case "account": return `/accounts/${id}`;
  }
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** What kind of line it is, in the words a member reads. A task says whether it is due today or overdue. */
export function needKindWords(need: Pick<HomeNeed, "kind" | "at">, now: Date = new Date()): string {
  switch (need.kind) {
    case "new_mail": return "New mail";
    case "intake_certified": return "Intake certified";
    case "quote_expiring": return "Quote expiring";
    case "intake_quiet": return "Intake quiet";
    case "lead_quiet": return "Lead quiet";
    case "task_due": return new Date(need.at).toDateString() === now.toDateString() ? "Task due today" : "Task overdue";
  }
}

/** When, said for its kind: a quote's expiry and a task's due day are days ahead or behind; the rest are when something last happened. */
export function needWhenWords(need: Pick<HomeNeed, "kind" | "at">): string {
  switch (need.kind) {
    case "quote_expiring": return `Expires ${day(need.at)}`;
    case "task_due": return `Due ${day(need.at)}`;
    case "intake_certified": return `Certified ${day(need.at)}`;
    case "intake_quiet": return `Nothing new since ${day(need.at)}`;
    case "lead_quiet": return `No activity since ${day(need.at)}`;
    case "new_mail": return `Received ${day(need.at)}`;
  }
}

/** How far off a day is, in words: "today", "in 3 days", "2 days overdue". */
export function daysAwayWords(daysAway: number): string {
  if (daysAway === 0) return "today";
  const n = Math.abs(daysAway);
  const days = n === 1 ? "1 day" : `${n} days`;
  return daysAway > 0 ? `in ${days}` : `${days} overdue`;
}

/** What stops the person sending now, said with what to do about it; null when nothing does. */
export function sendBlockWords(block: SendBlock | null): string | null {
  switch (block) {
    case "waiting_for_approval": return "Nevermore hasn't approved your firm to send to PEOs yet. You can start quotes and work on intakes meanwhile.";
    case "refused": return "Nevermore did not approve your firm, so nothing can be sent to a PEO from here.";
    case "no_mailbox": return "Connect your mailbox before you send: quotes go out from your own address.";
    default: return null;
  }
}

/** The five counts across the top, each with the list it opens. */
export const HOME_COUNTS: { key: keyof HomeCounts; label: string; to: string }[] = [
  { key: "openLeads", label: "Open leads", to: "/leads" },
  { key: "openOpportunities", label: "Open opportunities", to: "/accounts" },
  { key: "quotesWaiting", label: "Quotes waiting on a PEO", to: "/quotes" },
  { key: "renewalsDue", label: `Renewals in the next ${HOME_DAYS.renewals} days`, to: "/accounts" },
  { key: "wonThisQuarter", label: "Won this quarter", to: "/accounts" },
];
