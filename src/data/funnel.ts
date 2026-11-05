// The pilot funnel (public.advisor_intake_funnel, migration 20261105092000): for intakes started in a period, how
// many reached each step and how long it took. Steps aren't a strict sequence (an email can be verified before the
// required answers are in), so each is counted against the intakes that started, not against the step before.

/** The steps, in the order the funnel lists them. The database holds the same list (schemaSync.test.ts). */
export const FUNNEL_STEPS = [
  "started",
  "answered",
  "document_uploaded",
  "census_provided",
  "ready_to_certify",
  "email_verified",
  "certified",
  "manuscript_downloaded",
] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const FUNNEL_LABELS: Record<FunnelStep, string> = {
  started: "Started an intake",
  answered: "Gave a first answer",
  document_uploaded: "Uploaded a document",
  census_provided: "Provided an employee census",
  ready_to_certify: "Ready to certify",
  email_verified: "Verified an email",
  certified: "Certified",
  manuscript_downloaded: "Downloaded The Manuscript",
};

/** The periods the page offers, as days back from now. The database answers at most a year at once. */
export const FUNNEL_PERIODS = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "365d", label: "Last 12 months", days: 365 },
] as const;
export type FunnelPeriodKey = (typeof FUNNEL_PERIODS)[number]["key"];
export const DEFAULT_FUNNEL_PERIOD: FunnelPeriodKey = "30d";

export const isFunnelPeriod = (v: unknown): v is FunnelPeriodKey => FUNNEL_PERIODS.some((p) => p.key === v);

/** The period as the database takes it: from `days` ago to now. */
export function funnelRange(key: FunnelPeriodKey, now: Date = new Date()): { from: Date; to: Date } {
  const days = FUNNEL_PERIODS.find((p) => p.key === key)!.days;
  return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), to: now };
}

export interface FunnelRow {
  step: FunnelStep;
  label: string;
  intakes: number;
  /** Of the intakes that started in the period, as a fraction (0 to 1); null when none started. */
  ofStarted: number | null;
  /** The median time from the start to reaching the step, in minutes; null when nothing recorded it. */
  medianMinutes: number | null;
}

const asCount = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};
const asMinutes = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
};

/** The database's rows as the page shows them: every step in order (a missing one at zero), each against the start. */
export function funnelRows(raw: readonly { milestone: string; intakes: unknown; median_minutes: unknown }[]): FunnelRow[] {
  const byStep = new Map(raw.map((r) => [r.milestone, r]));
  const started = asCount(byStep.get("started")?.intakes);
  return FUNNEL_STEPS.map((step) => {
    const r = byStep.get(step);
    const intakes = asCount(r?.intakes);
    return {
      step,
      label: FUNNEL_LABELS[step],
      intakes,
      ofStarted: started > 0 ? Math.min(intakes / started, 1) : null,
      medianMinutes: asMinutes(r?.median_minutes),
    };
  });
}

/** A median time in the unit that reads best: minutes under two hours, hours under two days, then days. */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return "under a minute";
  if (minutes < 120) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

export const formatShare = (share: number | null) => (share === null ? "—" : `${Math.round(share * 100)}%`);
