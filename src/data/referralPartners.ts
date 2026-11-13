// Referral partners and intake sources as advisors see them (plan J-2.3, decision D43): the kinds of partner, the
// link each partner shares, and how an intake's source reads on the funnel and the submission page. The codes
// themselves are captured in the browser (src/data/intakeSource.ts) and kept by the database
// (migration 20261106100000).

import { SITE_ORIGIN } from "./site";
import { cleanSourceCode, type IntakeSource } from "./intakeSource";
import { FUNNEL_STEPS, type FunnelStep } from "./funnel";

/** The kinds of partner an advisor can choose. The database holds the same list (schemaSync.test.ts). */
export const REFERRAL_PARTNER_KINDS = [
  "accounting",
  "startup_network",
  "law_firm",
  "hr_consultant",
  "benefits_broker",
  "event",
  "other",
] as const;
export type ReferralPartnerKind = (typeof REFERRAL_PARTNER_KINDS)[number];

export const REFERRAL_PARTNER_KIND_LABELS: Record<ReferralPartnerKind, string> = {
  accounting: "Accountant, CPA or fractional CFO",
  startup_network: "Accelerator, VC or startup network",
  law_firm: "Law firm",
  hr_consultant: "HR consultant",
  benefits_broker: "Benefits broker",
  event: "Event or community",
  other: "Other",
};

export const isReferralPartnerKind = (v: unknown): v is ReferralPartnerKind =>
  typeof v === "string" && (REFERRAL_PARTNER_KINDS as readonly string[]).includes(v);

export const partnerKindLabel = (kind: string) => (isReferralPartnerKind(kind) ? REFERRAL_PARTNER_KIND_LABELS[kind] : kind);

/** The longest partner name the database keeps. */
export const PARTNER_NAME_MAX = 120;

/** The link a partner shares: the site's front page with their code. */
export const partnerLink = (code: string) => `${SITE_ORIGIN}/?ref=${encodeURIComponent(code)}`;

/**
 * The firm every intake a browser starts belongs to (D-101): the one `default_firm_id()` returns (migration 20261116090000_firms.sql).
 * Starting an intake for another firm arrives with New quote (Epic 5).
 */
export const DEFAULT_FIRM_ID = "00000000-0000-4000-8000-00000000eaa1";

/** Whether a link carrying this firm's partner code reaches the firm: until intakes can start for other firms, only the default firm's does (D-101). */
export const referralLinksWork = (firmId: string) => firmId === DEFAULT_FIRM_ID;

/** A code to offer for a new partner, from its name: "Acme CFO Partners" gives "acme-cfo-partners". */
export const suggestPartnerCode = (name: string) => cleanSourceCode(name) ?? "";

/** The campaign tags as one phrase, such as "newsletter / email / renewals-2027", or null when there are none. */
export function campaignTags(source: Pick<IntakeSource, "utm_source" | "utm_medium" | "utm_campaign">): string | null {
  const tags = [source.utm_source, source.utm_medium, source.utm_campaign].filter((t): t is string => !!t);
  return tags.length > 0 ? tags.join(" / ") : null;
}

/**
 * Where an intake came from, in words: the partner who referred it (or its referral code, when no partner has that
 * code), then its campaign tags. "No tagged link" when it has neither.
 */
export function describeSource(source: IntakeSource, partnerName: string | null): string {
  const parts: string[] = [];
  if (source.referral_code) {
    parts.push(partnerName ? `Referred by ${partnerName}` : `Referral code ${source.referral_code} (no partner has this code)`);
  }
  const tags = campaignTags(source);
  if (tags) parts.push(`Campaign: ${tags}`);
  return parts.length > 0 ? parts.join(" · ") : "No tagged link";
}

/** One source on the funnel: its codes, the partner its referral code names, and how many intakes reached each step. */
export interface SourceRow {
  /** The firm the row is about; null when the database didn't say. */
  firmId: string | null;
  source: IntakeSource;
  partnerName: string | null;
  counts: Record<FunnelStep, number>;
}

const asCount = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};
const codeOrNull = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

/** The database's rows (advisor_intake_sources) as the funnel page shows them, in the order it returned them. */
export function sourceRows(raw: readonly Record<string, unknown>[]): SourceRow[] {
  return raw.map((r) => ({
    firmId: codeOrNull(r.firm_id),
    source: {
      referral_code: codeOrNull(r.referral_code),
      utm_source: codeOrNull(r.utm_source),
      utm_medium: codeOrNull(r.utm_medium),
      utm_campaign: codeOrNull(r.utm_campaign),
    },
    partnerName: codeOrNull(r.partner_name),
    counts: Object.fromEntries(FUNNEL_STEPS.map((step) => [step, asCount(r[step])])) as Record<FunnelStep, number>,
  }));
}

/**
 * A source's name on the funnel, and the codes under it: the partner (or the unlisted referral code), else the
 * campaign tags, else "No tagged link".
 */
export function sourceTitle(row: Pick<SourceRow, "source" | "partnerName">): { title: string; detail: string | null } {
  const { source, partnerName } = row;
  const tags = campaignTags(source);
  if (source.referral_code) {
    return {
      title: partnerName ?? `Unlisted code ${source.referral_code}`,
      detail: [`ref=${source.referral_code}`, tags].filter(Boolean).join(" · "),
    };
  }
  return { title: tags ?? "No tagged link", detail: null };
}

/** A partner is one firm's: a code is unique within a firm, not across firms, so anything kept for a partner is keyed by both. */
export const partnerKey = (firmId: string | null | undefined, code: string) => `${firmId ?? ""}|${code}`;

/** Each partner's intakes started and certified, summed over every campaign their link was tagged with, by `partnerKey`. */
export function countsByPartner(rows: readonly SourceRow[]): Map<string, { started: number; certified: number }> {
  const totals = new Map<string, { started: number; certified: number }>();
  for (const row of rows) {
    const code = row.source.referral_code;
    if (!code) continue;
    const key = partnerKey(row.firmId, code);
    const t = totals.get(key) ?? { started: 0, certified: 0 };
    totals.set(key, { started: t.started + row.counts.started, certified: t.certified + row.counts.certified });
  }
  return totals;
}
