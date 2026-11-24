import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { DownloadsOffNotice, useDownloadsOff } from "@/components/workspace/downloadsOff";
import { LoadFailed } from "@/components/workspace/states";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { formatDay } from "@/data/accountPage";
import { WHOSE_LABELS, type HomeWhose } from "@/data/home";
import { LINE_LABELS, QUOTE_LINES, type QuoteLine } from "@/data/lines";
import {
  cappedWords, customRangeProblem, daysWords, declineReasonsWords, DEFAULT_REPORT_PERIOD, isReportPeriod, lostReasonWords, money, monthWords, periodWords,
  RENEWAL_OUTCOME_WORDS, REPORT_PERIODS, REPORT_TITLES, reportCsv, reportFileName, reportRange, share, stageWords, type ReportKey, type ReportPeriodKey, type Reports,
} from "@/data/reports";
import { downloadBlob } from "@/lib/downloadFile";
import { loadReports } from "@/lib/reportsApi";

type Load = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; reports: Reports };

const panel = "rounded-xl border border-border bg-card p-4 sm:p-5 min-w-0";
const pill = "min-h-11 px-3 rounded-md border border-border text-sm hover:bg-muted aria-pressed:bg-muted aria-pressed:font-semibold";
const th = "text-left font-medium text-muted-foreground py-1.5 pr-4";
const td = "py-1.5 pr-4 align-top";
const num = "py-1.5 pr-4 align-top text-right tabular-nums";
const thNum = "text-right font-medium text-muted-foreground py-1.5 pr-4";
const link = "text-primary underline underline-offset-2 hover:text-foreground";
const isLine = (v: unknown): v is QuoteLine => (QUOTE_LINES as readonly unknown[]).includes(v);

/** A bar as wide as its share of the largest in its column: the picture beside a number, never the only way a number is said. */
const Bar = ({ part, whole, tone = "bg-primary" }: { part: number; whole: number; tone?: string }) => (
  <span aria-hidden="true" className="block h-2 rounded bg-muted overflow-hidden min-w-16">
    <span className={`block h-full ${tone}`} style={{ width: `${whole > 0 ? Math.max(part > 0 ? 4 : 0, Math.round((part / whole) * 100)) : 0}%` }} />
  </span>
);

const Figure = ({ label, value }: { label: string; value: string }) => (
  <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-display text-2xl font-bold tabular-nums">{value}</dd></div>
);

/** One report: its heading, its table as a file (never for a support session, D-128), and what it shows. */
const Panel = ({ id, reports, children }: { id: ReportKey; reports: Reports; children: ReactNode }) => {
  const downloadsOff = useDownloadsOff();
  return (
    <section aria-labelledby={`report-${id}`} className={panel}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 id={`report-${id}`} className="font-display text-xl font-bold mr-auto">{REPORT_TITLES[id]}</h2>
        {!downloadsOff && (
          <button
            type="button"
            onClick={() => downloadBlob(new Blob(["\uFEFF", reportCsv(id, reports)], { type: "text/csv;charset=utf-8" }), reportFileName(id, reports))}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-md border border-border text-sm hover:bg-muted"
          >
            <Download className="w-4 h-4" aria-hidden="true" /> {`Export ${REPORT_TITLES[id]} as CSV`}
          </button>
        )}
      </div>
      {children}
    </section>
  );
};

/**
 * Reports (BR-6.1; CRM-R1.1 to CRM-R1.3): the pipeline, quotes by market, won and lost, renewals and, for an owner, commission, beside the intake funnel.
 * One set of controls (the period, whose work, the line) applies to all five. Each is worked out when the page asks, from the records the person may see;
 * each lists the records its figures count, and each table can be saved as a CSV.
 */
const ReportsPage = () => {
  const { firm } = useWorkspace();
  const firmId = firm?.id ?? null;
  const [params, setParams] = useSearchParams();
  const asked = params.get("period");
  const period: ReportPeriodKey = isReportPeriod(asked) ? asked : DEFAULT_REPORT_PERIOD;
  const line: QuoteLine | null = isLine(params.get("line")) ? (params.get("line") as QuoteLine) : null;
  const customFrom = params.get("from") ?? "";
  const customTo = params.get("to") ?? "";
  const [whose, setWhose] = useState<HomeWhose>("mine");
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  const customProblem = period === "custom" ? customRangeProblem(customFrom, customTo) : null;
  const range = period === "custom" ? (customProblem ? null : { from: customFrom, to: customTo }) : reportRange(period);
  const from = range?.from ?? null;
  const to = range?.to ?? null;

  useEffect(() => {
    if (!firmId || !from || !to) return;
    let cancelled = false;
    // A change of control keeps what is on screen until the new answer is in.
    setLoad((now) => (now.kind === "ready" ? now : { kind: "loading" }));
    loadReports({ firmId, from, to, whose, line }).then(
      (reports) => !cancelled && setLoad({ kind: "ready", reports }),
      (error: Error) => !cancelled && setLoad({ kind: "error", error }),
    );
    return () => {
      cancelled = true;
    };
  }, [firmId, from, to, whose, line, attempt]);

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  const r = load.kind === "ready" ? load.reports : null;

  return (
    <main className="container mx-auto px-4 sm:px-6 py-8 max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold mr-auto">Reports</h1>
        <Link to="/advisor/funnel" className={`text-sm ${link}`}>Intake funnel</Link>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div role="group" aria-label="Period" className="flex flex-wrap gap-2">
          {REPORT_PERIODS.map((p) => (
            <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => set({ period: p.key })} className={pill}>{p.label}</button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted-foreground space-y-1">
              <span className="block">From</span>
              <input type="date" value={customFrom} onChange={(e) => set({ from: e.target.value })} className="min-h-11 bg-muted border border-border rounded-md px-2 text-sm text-foreground" />
            </label>
            <label className="text-xs text-muted-foreground space-y-1">
              <span className="block">To</span>
              <input type="date" value={customTo} onChange={(e) => set({ to: e.target.value })} className="min-h-11 bg-muted border border-border rounded-md px-2 text-sm text-foreground" />
            </label>
          </div>
        )}
        {r && r.whoseChoices.length > 1 && (
          <div role="group" aria-label="Whose work" className="flex gap-2">
            {r.whoseChoices.map((w) => (
              <button key={w} type="button" aria-pressed={r.whose === w} onClick={() => setWhose(w)} className={pill}>{WHOSE_LABELS[w]}</button>
            ))}
          </div>
        )}
        <label className="text-xs text-muted-foreground space-y-1">
          <span className="block">Line</span>
          <select value={line ?? ""} onChange={(e) => set({ line: e.target.value || null })} className="min-h-11 bg-muted border border-border rounded-md px-2 text-sm text-foreground">
            <option value="">Every line</option>
            {QUOTE_LINES.map((l) => <option key={l} value={l}>{LINE_LABELS[l]}</option>)}
          </select>
        </label>
      </div>

      {customProblem && <p role="alert" className="text-sm text-destructive">{customProblem}</p>}
      {!customProblem && load.kind === "error" && <LoadFailed error={load.error} what="the reports" onRetry={() => setAttempt((n) => n + 1)} />}
      {!customProblem && load.kind === "loading" && <p role="status" className="text-sm text-muted-foreground">Loading the reports…</p>}
      <DownloadsOffNotice />

      {r && !customProblem && (
        <>
          <p className="text-sm text-muted-foreground">
            {`${periodWords(r)}. Worked out now, from the records ${r.whose === "mine" ? "you own" : "you may see"}. The pipeline and the coming renewals are as of today, whatever the period.`}
          </p>

          <Panel id="pipeline" reports={r}>
            <dl className="flex flex-wrap gap-8 mb-4">
              <Figure label="Open opportunities" value={String(r.pipeline.count)} />
              <Figure label="Their value" value={money(r.pipeline.value)} />
            </dl>
            <table className="w-full text-sm mb-4">
              <caption className="sr-only">Open opportunities by stage</caption>
              <thead><tr><th className={th}>Stage</th><th className={thNum}>Open</th><th className={th} aria-hidden="true" /><th className={thNum}>Value</th><th className={thNum}>Median days open</th></tr></thead>
              <tbody>
                {r.pipeline.stages.map((s) => (
                  <tr key={s.stage} className="border-t border-border">
                    <td className={td}>{stageWords(s.stage)}</td>
                    <td className={num}>{s.count}</td>
                    <td className={`${td} w-1/3`}><Bar part={s.count} whole={Math.max(...r.pipeline.stages.map((x) => x.count))} /></td>
                    <td className={num}>{money(s.value)}</td>
                    <td className={num}>{daysWords(s.medianDays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.pipeline.owners.length > 1 && (
              <table className="w-full text-sm mb-4">
                <caption className="sr-only">Open opportunities by owner</caption>
                <thead><tr><th className={th}>Owner</th><th className={thNum}>Open</th><th className={thNum}>Value</th></tr></thead>
                <tbody>
                  {r.pipeline.owners.map((o) => (
                    <tr key={o.ownerId ?? "none"} className="border-t border-border"><td className={td}>{o.owner ?? "No owner"}</td><td className={num}>{o.count}</td><td className={num}>{money(o.value)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {r.pipeline.rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing is open.</p> : (
              <>
                <h3 className="font-semibold text-sm mb-1">Open the longest</h3>
                <ul aria-label="Open opportunities, the longest open first" className="text-sm divide-y divide-border">
                  {r.pipeline.rows.map((o) => (
                    <li key={o.id} className="py-1.5 flex flex-wrap gap-x-3">
                      <Link to={`/opportunities/${o.id}`} className={link}>{o.name}</Link>
                      <span className="text-muted-foreground">{`${o.account} · ${stageWords(o.stage)} · open ${daysWords(o.days)}${o.owner ? ` · ${o.owner}` : ""}`}</span>
                    </li>
                  ))}
                </ul>
                {cappedWords(r.pipeline.rows.length, r.pipeline.count) && <p className="text-xs text-muted-foreground mt-1">{cappedWords(r.pipeline.rows.length, r.pipeline.count)}</p>}
              </>
            )}
          </Panel>

          <Panel id="markets" reports={r}>
            <dl className="flex flex-wrap gap-8 mb-4">
              <Figure label="Sent" value={String(r.markets.sent)} />
              <Figure label="Quoted" value={String(r.markets.quoted)} />
              <Figure label="Declined" value={String(r.markets.declined)} />
              <Figure label="Placed" value={String(r.markets.won)} />
            </dl>
            {r.markets.markets.length === 0 ? <p className="text-sm text-muted-foreground">Nothing was sent to a PEO or carrier in this period.</p> : (
              <>
                <table className="w-full text-sm mb-4">
                  <caption className="sr-only">Quote requests first sent in the period, by PEO or carrier</caption>
                  <thead>
                    <tr>
                      <th className={th}>PEO or carrier</th><th className={thNum}>Sent</th><th className={thNum}>Quoted</th><th className={thNum}>Declined</th><th className={thNum}>Placed</th>
                      <th className={thNum}>Win rate</th><th className={thNum}>Median days to a quote</th><th className={th}>Declined because</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.markets.markets.map((m) => (
                      <tr key={m.market} className="border-t border-border">
                        <td className={td}>{m.market}</td><td className={num}>{m.sent}</td><td className={num}>{m.quoted}</td><td className={num}>{m.declined}</td><td className={num}>{m.won}</td>
                        <td className={num}>{share(m.won, m.quoted)}</td><td className={num}>{daysWords(m.medianDays)}</td><td className={td}>{declineReasonsWords(m.declineReasons)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground mb-2">Win rate is placed over quoted.</p>
                <ul aria-label="Quote requests sent in the period" className="text-sm divide-y divide-border">
                  {r.markets.rows.map((q) => (
                    <li key={q.id} className="py-1.5 flex flex-wrap gap-x-3">
                      <Link to={`/opportunities/${q.opportunityId}`} className={link}>{`${q.account}: ${q.opportunity}`}</Link>
                      <span className="text-muted-foreground">{`${q.market} · sent ${formatDay(q.sentOn)}${q.placed ? " · placed" : ""}`}</span>
                    </li>
                  ))}
                </ul>
                {cappedWords(r.markets.rows.length, r.markets.sent) && <p className="text-xs text-muted-foreground mt-1">{cappedWords(r.markets.rows.length, r.markets.sent)}</p>}
              </>
            )}
          </Panel>

          <Panel id="won_lost" reports={r}>
            <dl className="flex flex-wrap gap-8 mb-4">
              <Figure label="Won" value={String(r.wonLost.won)} />
              <Figure label="Lost" value={String(r.wonLost.lost)} />
              <Figure label="Win rate" value={share(r.wonLost.won, r.wonLost.won + r.wonLost.lost)} />
              <Figure label="Value won" value={money(r.wonLost.valueWon)} />
            </dl>
            {r.wonLost.won + r.wonLost.lost === 0 ? <p className="text-sm text-muted-foreground">Nothing was won or lost in this period.</p> : (
              <>
                <div className="grid gap-6 md:grid-cols-3 mb-4">
                  <table className="text-sm">
                    <caption className="text-left font-semibold mb-1">By owner</caption>
                    <thead><tr><th className={th}>Owner</th><th className={thNum}>Won</th><th className={thNum}>Lost</th></tr></thead>
                    <tbody>{r.wonLost.owners.map((o) => <tr key={o.ownerId ?? "none"} className="border-t border-border"><td className={td}>{o.owner ?? "No owner"}</td><td className={num}>{o.won}</td><td className={num}>{o.lost}</td></tr>)}</tbody>
                  </table>
                  <table className="text-sm">
                    <caption className="text-left font-semibold mb-1">By source</caption>
                    <thead><tr><th className={th}>Source</th><th className={thNum}>Won</th><th className={thNum}>Lost</th></tr></thead>
                    <tbody>{r.wonLost.sources.map((s) => <tr key={s.source} className="border-t border-border"><td className={td}>{s.source}</td><td className={num}>{s.won}</td><td className={num}>{s.lost}</td></tr>)}</tbody>
                  </table>
                  <table className="text-sm">
                    <caption className="text-left font-semibold mb-1">Lost because</caption>
                    <thead><tr><th className={th}>Reason</th><th className={thNum}>Lost</th></tr></thead>
                    <tbody>{r.wonLost.reasons.map((s) => <tr key={s.reason} className="border-t border-border"><td className={td}>{lostReasonWords(s.reason)}</td><td className={num}>{s.count}</td></tr>)}</tbody>
                  </table>
                </div>
                <ul aria-label="Opportunities won or lost in the period" className="text-sm divide-y divide-border">
                  {r.wonLost.rows.map((o) => (
                    <li key={o.id} className="py-1.5 flex flex-wrap gap-x-3">
                      <Link to={`/opportunities/${o.id}`} className={link}>{o.name}</Link>
                      <span className="text-muted-foreground">
                        {`${o.account} · ${o.outcome === "won" ? "Won" : `Lost: ${lostReasonWords(o.reason)}`} ${formatDay(o.on)}${o.value !== null ? ` · ${money(o.value)}` : ""}${o.owner ? ` · ${o.owner}` : ""}`}
                      </span>
                    </li>
                  ))}
                </ul>
                {cappedWords(r.wonLost.rows.length, r.wonLost.won + r.wonLost.lost) && <p className="text-xs text-muted-foreground mt-1">{cappedWords(r.wonLost.rows.length, r.wonLost.won + r.wonLost.lost)}</p>}
              </>
            )}
          </Panel>

          <Panel id="renewals" reports={r}>
            <dl className="flex flex-wrap gap-8 mb-4">
              <Figure label="Kept in the period" value={String(r.renewals.kept)} />
              <Figure label="Not renewed" value={String(r.renewals.lost)} />
              <Figure label="Still open" value={String(r.renewals.open)} />
            </dl>
            <table className="w-full text-sm mb-4">
              <caption className="text-left font-semibold mb-1">Due in the next 12 months</caption>
              <thead><tr><th className={th}>Month</th><th className={thNum}>Due</th><th className={th} aria-hidden="true" /><th className={thNum}>Being worked</th></tr></thead>
              <tbody>
                {r.renewals.months.map((m) => (
                  <tr key={m.month} className="border-t border-border">
                    <td className={td}>{monthWords(m.month)}</td><td className={num}>{m.due}</td>
                    <td className={`${td} w-1/3`}><Bar part={m.due} whole={Math.max(...r.renewals.months.map((x) => x.due))} /></td>
                    <td className={num}>{m.worked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.renewals.rows.length > 0 && (
              <ul aria-label="Renewals dated in the period" className="text-sm divide-y divide-border">
                {r.renewals.rows.map((x) => (
                  <li key={x.id} className="py-1.5 flex flex-wrap gap-x-3">
                    <Link to={`/accounts/${x.accountId}`} className={link}>{x.account}</Link>
                    <span className="text-muted-foreground">{`${x.withWhom} · ${formatDay(x.renewsOn)} · ${RENEWAL_OUTCOME_WORDS[x.outcome]}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {r.commission && (
            <Panel id="commission" reports={r}>
              <dl className="flex flex-wrap gap-8 mb-4">
                <Figure label="Expected" value={money(r.commission.expected)} />
                <Figure label="Received" value={money(r.commission.received)} />
              </dl>
              <table className="w-full text-sm mb-4">
                <caption className="sr-only">Commission by month</caption>
                <thead><tr><th className={th}>Month</th><th className={thNum}>Expected</th><th className={thNum}>Received</th><th className={th} aria-hidden="true" /></tr></thead>
                <tbody>
                  {r.commission.months.map((m) => (
                    <tr key={m.month} className="border-t border-border">
                      <td className={td}>{monthWords(m.month)}</td><td className={num}>{money(m.expected)}</td><td className={num}>{money(m.received)}</td>
                      <td className={`${td} w-1/3`}><Bar part={m.received} whole={Math.max(m.expected, m.received)} tone="bg-success" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.commission.rows.length === 0 ? <p className="text-sm text-muted-foreground">No placement has commission expected or received in this period.</p> : (
                <table className="w-full text-sm">
                  <caption className="text-left font-semibold mb-1">By placement</caption>
                  <thead><tr><th className={th}>Account</th><th className={th}>PEO or carrier</th><th className={thNum}>Expected</th><th className={thNum}>Received</th></tr></thead>
                  <tbody>
                    {r.commission.rows.map((c) => (
                      <tr key={c.placementId} className="border-t border-border">
                        <td className={td}><Link to={`/accounts/${c.accountId}`} className={link}>{c.account}</Link></td><td className={td}>{c.market}</td>
                        <td className={num}>{money(c.expected)}</td><td className={num}>{money(c.received)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-xs text-muted-foreground mt-2">Expected is a twelfth of each placement's yearly figure for every month it is in force. Owners only.</p>
            </Panel>
          )}
        </>
      )}
    </main>
  );
};

export default ReportsPage;
