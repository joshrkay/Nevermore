import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import {
  DEFAULT_FUNNEL_PERIOD,
  formatDuration,
  formatShare,
  FUNNEL_PERIODS,
  funnelRange,
  funnelRows,
  isFunnelPeriod,
  type FunnelPeriodKey,
  type FunnelRow,
  type FunnelStep,
} from "@/data/funnel";
import { sourceRows, sourceTitle, type SourceRow } from "@/data/referralPartners";
import { loadFunnel, loadIntakeSourcesOfMyFirms, type MemberFirm } from "@/lib/advisorApi";

type Load = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; rows: FunnelRow[]; sources: SourceRow[]; firms: MemberFirm[] };

/**
 * The pilot funnel: of the intakes started in a period, how many reached each step, and the median time it took.
 * Counts only: the record behind it holds no answers, names or addresses (migration 20261105092000).
 */
const AdvisorFunnelPage = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("period");
  const period: FunnelPeriodKey = isFunnelPeriod(requested) ? requested : DEFAULT_FUNNEL_PERIOD;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    const { from, to } = funnelRange(period);
    Promise.all([loadFunnel(from, to), loadIntakeSourcesOfMyFirms(from, to)])
      .then(([raw, mine]) => !cancelled && setLoad({ kind: "ready", rows: funnelRows(raw), sources: sourceRows(mine.rows), firms: mine.firms }))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => {
      cancelled = true;
    };
  }, [period, attempt]);

  const choose = (key: FunnelPeriodKey) => setParams(key === DEFAULT_FUNNEL_PERIOD ? {} : { period: key });

  return (
    <div className="min-h-screen bg-background">
      <AdvisorHeader />
      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <h1 className="font-display text-3xl font-bold mb-1">Intake funnel</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Of the intakes started in the period, how many reached each step, and the median time from starting. Each step
          is a share of the intakes that started, since prospects don't all take them in this order.
        </p>

        <div role="radiogroup" aria-label="Intakes started" className="flex flex-wrap gap-2 mb-6">
          {FUNNEL_PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={p.key === period}
              onClick={() => choose(p.key)}
              className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                p.key === period ? "border-primary bg-primary/10 text-foreground font-medium" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-24 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading the funnel…
          </div>
        )}

        {load.kind === "error" && <AdvisorLoadError error={load.error} what="the funnel" onRetry={() => setAttempt((n) => n + 1)} />}

        {load.kind === "ready" && (load.rows[0].intakes === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <p className="font-medium">No intakes started in this period.</p>
            <p className="text-sm text-muted-foreground">Choose a longer period, or come back once prospects have started.</p>
          </div>
        ) : (
          <>
            <FunnelTable rows={load.rows} />
            <SourceTable sources={load.sources} firms={load.firms} />
          </>
        ))}

        <p className="text-xs text-muted-foreground mt-6">
          Counts only: nothing behind this page holds an answer, a name or an address. Intakes from before the funnel was
          recorded were filled in from what the database still held, so their times are left out of the medians. An
          intake that is deleted is still counted. The record is kept for a year from each intake's start.
        </p>
      </main>
    </div>
  );
};

/** A table first (every number readable as text), with a bar per step: one hue, its length the share of starts. */
const FunnelTable = ({ rows }: { rows: FunnelRow[] }) => (
  <table className="w-full text-sm border-collapse">
    <caption className="sr-only">Intakes that reached each step, of those started in the period</caption>
    <thead>
      <tr className="text-left text-xs text-muted-foreground border-b border-border">
        <th scope="col" className="py-2 pr-4 font-normal">Step</th>
        <th scope="col" className="py-2 pr-4 font-normal w-2/5"><span className="sr-only">Share of started, as a bar</span></th>
        <th scope="col" className="py-2 pr-4 font-normal text-right">Intakes</th>
        <th scope="col" className="py-2 pr-4 font-normal text-right">Of started</th>
        <th scope="col" className="py-2 font-normal text-right">Median time</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r) => (
        <tr key={r.step} className="border-b border-border/60">
          <th scope="row" className="py-2.5 pr-4 font-normal text-left whitespace-nowrap">{r.label}</th>
          <td className="py-2.5 pr-4" aria-hidden="true">
            {/* 12px thick, grown from the left, its far end rounded 4px; no track, so the data is the only ink. */}
            <div className="h-3 rounded-r bg-primary" style={{ width: `${(r.ofStarted ?? 0) * 100}%` }} />
          </td>
          <td className="py-2.5 pr-4 text-right tabular-nums">{r.intakes.toLocaleString("en-US")}</td>
          <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{formatShare(r.ofStarted)}</td>
          <td className="py-2.5 text-right tabular-nums text-muted-foreground">{r.step === "started" ? "—" : formatDuration(r.medianMinutes)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

// The steps compared across sources: enough to see where each channel's intakes stop, in a table that fits the page.
const SOURCE_STEPS: { step: FunnelStep; label: string }[] = [
  { step: "started", label: "Started" },
  { step: "answered", label: "First answer" },
  { step: "census_provided", label: "Census" },
  { step: "ready_to_certify", label: "Ready to certify" },
  { step: "certified", label: "Certified" },
];

/** The same intakes, by the link each started from: the sources with the most intakes first. */
const SourceTable = ({ sources, firms }: { sources: SourceRow[]; firms: MemberFirm[] }) => (
  <section aria-labelledby="by-source-heading" className="mt-10">
    <h2 id="by-source-heading" className="font-display text-xl font-bold mb-1">By source</h2>
    <p className="text-sm text-muted-foreground mb-4">
      Where these intakes came from: the referral code or campaign tags of the link each one was started from. Intakes
      started without a tagged link are counted together.{" "}
      <Link to="/advisor/partners" className="underline underline-offset-2 hover:text-foreground">Referral partners</Link>
    </p>
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <caption className="sr-only">Intakes from each source that reached each step</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th scope="col" className="py-2 pr-4 font-normal">Source</th>
            {SOURCE_STEPS.map((s) => (
              <th key={s.step} scope="col" className="py-2 pr-4 font-normal text-right whitespace-nowrap">{s.label}</th>
            ))}
            <th scope="col" className="py-2 font-normal text-right whitespace-nowrap">Certified of started</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((row) => {
            const { title, detail } = sourceTitle(row);
            const started = row.counts.started;
            // A member of several firms sees each firm's rows apart, so each row says whose it is.
            const firmName = firms.length > 1 ? firms.find((f) => f.id === row.firmId)?.name : undefined;
            return (
              <tr key={[row.firmId, row.source.referral_code, row.source.utm_source, row.source.utm_medium, row.source.utm_campaign].join("|")} className="border-b border-border/60">
                <th scope="row" className="py-2.5 pr-4 font-normal text-left">
                  <span className="block">{title}</span>
                  {detail && <span className="block text-xs text-muted-foreground font-mono">{detail}</span>}
                  {firmName && <span className="block text-xs text-muted-foreground">{firmName}</span>}
                </th>
                {SOURCE_STEPS.map((s) => (
                  <td key={s.step} className="py-2.5 pr-4 text-right tabular-nums">{row.counts[s.step].toLocaleString("en-US")}</td>
                ))}
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                  {formatShare(started > 0 ? Math.min(row.counts.certified / started, 1) : null)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </section>
);

export default AdvisorFunnelPage;
