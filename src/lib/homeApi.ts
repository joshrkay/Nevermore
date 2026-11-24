// Home's one read (CRM-H1; public.home_page, 20261128090000_home.sql). The database decides what the person sees; an answer of another shape is a failed load.
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AdvisorApiError } from "@/lib/advisorApi";
import { OPPORTUNITY_STAGES } from "@/lib/accountPageApi";
import type { Home, HomeWhose } from "@/data/home";

const FALLBACK = "Couldn't load Home. Try again.";
const recordType = z.enum(["inbox", "opportunity", "quote", "lead", "account"]);
const whose = z.enum(["mine", "team", "everyone"]);

const answer = z.object({
  whose,
  whose_choices: z.array(whose),
  empty: z.boolean(),
  blocks_sending: z.enum(["waiting_for_approval", "refused", "no_mailbox"]).nullable(),
  needs: z.array(z.object({
    kind: z.enum(["new_mail", "intake_certified", "quote_expiring", "intake_quiet", "task_due", "lead_quiet"]),
    record_type: recordType, record_id: z.string(), name: z.string().nullable(), about: z.string().nullable(), at: z.string(), owner: z.string().nullable(),
  })),
  needs_total: z.number(),
  counts: z.object({ open_leads: z.number(), open_opportunities: z.number(), quotes_waiting: z.number(), renewals_due: z.number(), won_this_quarter: z.number() }),
  stages: z.array(z.object({ stage: z.enum(OPPORTUNITY_STAGES), count: z.number() })),
  renewals: z.array(z.object({ id: z.string(), account_id: z.string(), account_name: z.string(), kind: z.string(), with_whom: z.string(), renews_on: z.string(), days_away: z.number() })),
  upcoming_tasks: z.array(z.object({
    id: z.string(), title: z.string().nullable(), due_on: z.string(), days_away: z.number(), record_type: recordType, record_id: z.string(), name: z.string().nullable(), assignee: z.string().nullable(),
  })),
});

/** The person's own time zone, as their browser has it: Home's "today" is theirs. */
export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/** Home for a member of the firm, showing their own work, their team's or everyone's (the database answers with the one it used). */
export async function loadHome(firmId: string, whoseAsked: HomeWhose, timeZone: string = browserTimeZone()): Promise<Home> {
  const { data, error } = await supabase.rpc("home_page", { p_firm_id: firmId, p_whose: whoseAsked, p_time_zone: timeZone });
  if (error) throw new AdvisorApiError(error.code === "42501" ? "Home is for members of the firm." : FALLBACK, error.code);
  const parsed = answer.safeParse(data);
  if (!parsed.success) throw new AdvisorApiError(FALLBACK);
  const a = parsed.data;
  return {
    whose: a.whose, whoseChoices: a.whose_choices, empty: a.empty, blocksSending: a.blocks_sending,
    needs: a.needs.map((n) => ({ kind: n.kind, recordType: n.record_type, recordId: n.record_id, name: n.name, about: n.about, at: n.at, owner: n.owner })),
    needsTotal: a.needs_total,
    counts: { openLeads: a.counts.open_leads, openOpportunities: a.counts.open_opportunities, quotesWaiting: a.counts.quotes_waiting, renewalsDue: a.counts.renewals_due, wonThisQuarter: a.counts.won_this_quarter },
    stages: a.stages.map((s) => ({ stage: s.stage, count: s.count })),
    renewals: a.renewals.map((r) => ({ id: r.id, accountId: r.account_id, accountName: r.account_name, kind: r.kind, withWhom: r.with_whom, renewsOn: r.renews_on, daysAway: r.days_away })),
    upcomingTasks: a.upcoming_tasks.map((t) => ({ id: t.id, title: t.title, dueOn: t.due_on, daysAway: t.days_away, recordType: t.record_type, recordId: t.record_id, name: t.name, assignee: t.assignee })),
  };
}
