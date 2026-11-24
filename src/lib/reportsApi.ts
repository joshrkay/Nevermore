// The reports' one read (BR-6.1; public.firm_reports, 20261204090000_reports.sql). The database decides what the person may count; an answer of another
// shape is a failed load.
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AdvisorApiError } from "@/lib/advisorApi";
import { OPPORTUNITY_STAGES } from "@/lib/accountPageApi";
import { browserTimeZone } from "@/lib/homeApi";
import type { HomeWhose } from "@/data/home";
import type { QuoteLine } from "@/data/lines";
import type { Reports } from "@/data/reports";

const FALLBACK = "Couldn't load the reports. Try again.";
const whose = z.enum(["mine", "team", "everyone"]);
const stage = z.enum(OPPORTUNITY_STAGES);
const n = z.coerce.number();
const days = z.coerce.number().nullable();

const answer = z.object({
  whose, whose_choices: z.array(whose), line: z.string().nullable(), from: z.string(), to: z.string(), today: z.string(),
  pipeline: z.object({
    count: n, value: n,
    stages: z.array(z.object({ stage, count: n, value: n, median_days: days })),
    owners: z.array(z.object({ owner_id: z.string().nullable(), owner: z.string().nullable(), count: n, value: n })),
    rows: z.array(z.object({ id: z.string(), name: z.string(), account: z.string(), stage, days: n, value: z.coerce.number().nullable(), owner: z.string().nullable() })),
  }),
  markets: z.object({
    sent: n, quoted: n, declined: n, won: n,
    markets: z.array(z.object({ market: z.string(), sent: n, quoted: n, declined: n, won: n, median_days: days, decline_reasons: z.record(n) })),
    rows: z.array(z.object({
      id: n, market: z.string(), opportunity_id: z.string(), opportunity: z.string(), account: z.string(), sent_on: z.string(), status: z.string(), placed: z.boolean(),
    })),
  }),
  won_lost: z.object({
    won: n, lost: n, value_won: n,
    owners: z.array(z.object({ owner_id: z.string().nullable(), owner: z.string().nullable(), won: n, lost: n })),
    sources: z.array(z.object({ source: z.string(), won: n, lost: n })),
    reasons: z.array(z.object({ reason: z.string(), count: n })),
    rows: z.array(z.object({
      id: z.string(), name: z.string(), account: z.string(), outcome: z.enum(["won", "lost"]), on: z.string(), value: z.coerce.number().nullable(),
      reason: z.string().nullable(), owner: z.string().nullable(),
    })),
  }),
  renewals: z.object({
    months: z.array(z.object({ month: z.string(), due: n, worked: n })),
    kept: n, lost: n, open: n,
    rows: z.array(z.object({
      id: z.string(), account_id: z.string(), account: z.string(), with_whom: z.string(), renews_on: z.string(), outcome: z.enum(["kept", "lost", "open"]), worked: z.boolean(),
    })),
  }),
  commission: z.object({
    expected: n, received: n,
    months: z.array(z.object({ month: z.string(), expected: n, received: n })),
    rows: z.array(z.object({ placement_id: z.string(), account_id: z.string(), account: z.string(), market: z.string(), expected: n, received: n })),
  }).nullable(),
});

export interface ReportsAsk { firmId: string; from: string; to: string; whose: HomeWhose; line: QuoteLine | null }

/** The five reports for a member of the firm. A refusal the database put into words (a period it won't take) is shown in them. */
export async function loadReports(ask: ReportsAsk, timeZone: string = browserTimeZone()): Promise<Reports> {
  const { data, error } = await supabase.rpc("firm_reports", {
    p_firm_id: ask.firmId, p_from: ask.from, p_to: ask.to, p_whose: ask.whose, p_line: ask.line, p_time_zone: timeZone,
  });
  if (error) {
    throw new AdvisorApiError(error.code === "42501" ? "Reports are for members of the firm." : error.code === "22023" && error.message ? error.message : FALLBACK, error.code);
  }
  const parsed = answer.safeParse(data);
  if (!parsed.success) throw new AdvisorApiError(FALLBACK);
  const a = parsed.data;
  return {
    whose: a.whose, whoseChoices: a.whose_choices, line: a.line, from: a.from, to: a.to, today: a.today,
    pipeline: {
      count: a.pipeline.count, value: a.pipeline.value,
      stages: a.pipeline.stages.map((s) => ({ stage: s.stage, count: s.count, value: s.value, medianDays: s.median_days })),
      owners: a.pipeline.owners.map((o) => ({ ownerId: o.owner_id, owner: o.owner, count: o.count, value: o.value })),
      rows: a.pipeline.rows.map((o) => ({ id: o.id, name: o.name, account: o.account, stage: o.stage, days: o.days, value: o.value, owner: o.owner })),
    },
    markets: {
      sent: a.markets.sent, quoted: a.markets.quoted, declined: a.markets.declined, won: a.markets.won,
      markets: a.markets.markets.map((m) => ({ market: m.market, sent: m.sent, quoted: m.quoted, declined: m.declined, won: m.won, medianDays: m.median_days, declineReasons: m.decline_reasons })),
      rows: a.markets.rows.map((q) => ({ id: q.id, market: q.market, opportunityId: q.opportunity_id, opportunity: q.opportunity, account: q.account, sentOn: q.sent_on, status: q.status, placed: q.placed })),
    },
    wonLost: {
      won: a.won_lost.won, lost: a.won_lost.lost, valueWon: a.won_lost.value_won,
      owners: a.won_lost.owners.map((o) => ({ ownerId: o.owner_id, owner: o.owner, won: o.won, lost: o.lost })),
      sources: a.won_lost.sources.map((x) => ({ source: x.source, won: x.won, lost: x.lost })),
      reasons: a.won_lost.reasons.map((x) => ({ reason: x.reason, count: x.count })),
      rows: a.won_lost.rows.map((o) => ({ id: o.id, name: o.name, account: o.account, outcome: o.outcome, on: o.on, value: o.value, reason: o.reason, owner: o.owner })),
    },
    renewals: {
      months: a.renewals.months.map((m) => ({ month: m.month, due: m.due, worked: m.worked })), kept: a.renewals.kept, lost: a.renewals.lost, open: a.renewals.open,
      rows: a.renewals.rows.map((r) => ({ id: r.id, accountId: r.account_id, account: r.account, withWhom: r.with_whom, renewsOn: r.renews_on, outcome: r.outcome, worked: r.worked })),
    },
    commission: a.commission && {
      expected: a.commission.expected, received: a.commission.received,
      months: a.commission.months.map((m) => ({ month: m.month, expected: m.expected, received: m.received })),
      rows: a.commission.rows.map((c) => ({ placementId: c.placement_id, accountId: c.account_id, account: c.account, market: c.market, expected: c.expected, received: c.received })),
    },
  };
}
