import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { MAILBOX_PATH, NEW_QUOTE_PATH } from "@/components/workspace/menu";
import { LoadFailed } from "@/components/workspace/states";
import { STAGE_LABELS } from "@/data/accountPage";
import { kindLabel, type RenewalKind } from "@/data/renewals";
import { daysAwayWords, HOME_COUNTS, needKindWords, needWhenWords, recordPath, sendBlockWords, WHOSE_LABELS, type Home, type HomeWhose } from "@/data/home";
import { browserTimeZone, loadHome } from "@/lib/homeApi";
import { noteMyTimeZone } from "@/lib/summaryApi";

type Load = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; home: Home };

const panel = "rounded-xl border border-border bg-card p-4 sm:p-5 min-w-0";
const link = "text-primary underline underline-offset-2 hover:text-foreground";
const pill = "min-h-11 px-3 rounded-md border border-border text-sm hover:bg-muted aria-pressed:bg-muted aria-pressed:font-semibold";

const GreyLines = ({ n }: { n: number }) => (
  <div aria-hidden="true" className="space-y-2">
    {Array.from({ length: n }, (_, i) => <div key={i} className="h-4 rounded bg-muted" style={{ width: `${90 - i * 12}%` }} />)}
  </div>
);

/**
 * Home (CRM-H1; BR-3.1, BR-3.2, BR-5.2): the first page a member of a firm opens. What needs them, five counts that each open their list, renewals coming up,
 * open opportunities by stage and upcoming tasks, for their own work or, where their role allows, their team's or everyone's. A firm with nothing in it yet
 * is shown how to start, and anyone is told what stops them sending. One read (`home_page`), so the page loads and fails as a whole.
 */
const HomePage = () => {
  const { firm, isOwner, role } = useWorkspace();
  // Import is an owner's or a lead's (CRM-X4.1): nobody else is offered a button that would refuse them (D-24).
  const mayImport = isOwner || role === "Lead";
  const [whose, setWhose] = useState<HomeWhose>("mine");
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const firmId = firm?.id ?? null;

  useEffect(() => {
    if (!firmId) return;
    let cancelled = false;
    // Switching whose work, or asking again, keeps what is on screen until the new answer is in.
    setLoad((now) => (now.kind === "ready" ? now : { kind: "loading" }));
    loadHome(firmId, whose, browserTimeZone()).then(
      (home) => !cancelled && setLoad({ kind: "ready", home }),
      (error: Error) => !cancelled && setLoad({ kind: "error", error }),
    );
    return () => { cancelled = true; };
  }, [firmId, whose, attempt]);

  // The daily summary goes by the person's own morning (BR-3.3): the zone this browser is in is kept for a person who has none yet.
  useEffect(() => {
    if (firmId) void noteMyTimeZone(browserTimeZone());
  }, [firmId]);

  const home = load.kind === "ready" ? load.home : null;
  const block = home ? sendBlockWords(home.blocksSending) : null;

  return (
    <main className="container mx-auto px-4 sm:px-6 py-8 max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold mr-auto">Home</h1>
        {home && home.whoseChoices.length > 1 && (
          <div role="group" aria-label="Whose work" className="flex gap-2">
            {home.whoseChoices.map((w) => (
              <button key={w} type="button" aria-pressed={home.whose === w} onClick={() => setWhose(w)} className={pill}>{WHOSE_LABELS[w]}</button>
            ))}
          </div>
        )}
      </div>

      {load.kind === "error" && <LoadFailed error={load.error} what="Home" onRetry={() => setAttempt((n) => n + 1)} />}

      {load.kind === "loading" && (
        <div role="status" aria-label="Loading Home" className="space-y-6">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <div key={i} className={panel}><GreyLines n={2} /></div>)}</div>
          {["Needs you", "Renewals coming up", "Open opportunities by stage"].map((h) => (
            <section key={h} className={panel}><h2 className="font-semibold mb-3">{h}</h2><GreyLines n={3} /></section>
          ))}
        </div>
      )}

      {block && (
        <p role="status" className="rounded-lg bg-warning/10 text-warning px-4 py-3 text-sm">
          {block}{" "}
          {home?.blocksSending === "no_mailbox" && <Link to={MAILBOX_PATH} className="underline underline-offset-2 font-medium">Connect your mailbox</Link>}
        </p>
      )}

      {home?.empty && (
        <section aria-labelledby="home-start" className={panel}>
          <h2 id="home-start" className="font-display text-xl font-bold mb-1">{mayImport ? "Start with a quote or bring in your book" : "Start with a quote"}</h2>
          <p className="text-sm text-muted-foreground mb-4">Nothing is here yet. A quote makes the account, its contact and its opportunity as it goes.</p>
          <ol aria-label="The three steps to a first quote" className="list-decimal pl-5 space-y-1 text-sm mb-4">
            <li>Start a new quote for an employer and add what you already know.</li>
            <li>The employer answers the rest with Lenore and certifies it.</li>
            <li>Choose the PEOs, review each email, and send.</li>
          </ol>
          <Link to={NEW_QUOTE_PATH} className="inline-flex items-center gap-2 min-h-11 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" aria-hidden="true" /> New quote
          </Link>
          {mayImport && (
            <Link to="/import" className="inline-flex items-center min-h-11 px-4 ml-2 rounded-md border border-border text-sm hover:bg-muted">Import a CSV</Link>
          )}
        </section>
      )}

      {home && !home.empty && (
        <>
          <ul aria-label="Counts" className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            {HOME_COUNTS.map((c) => (
              <li key={c.key}>
                <Link to={c.to} className={`${panel} block h-full hover:bg-muted`}>
                  <span className="block font-display text-3xl font-bold">{home.counts[c.key]}</span>
                  <span className="block text-sm text-muted-foreground">{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          <section aria-labelledby="home-needs" className={panel}>
            <h2 id="home-needs" className="font-semibold mb-3">Needs you</h2>
            {home.needs.length === 0 ? (
              <p className="text-sm text-muted-foreground">You're caught up.</p>
            ) : (
              <>
                <ul aria-label="Needs you" className="divide-y divide-border">
                  {home.needs.map((n) => (
                    <li key={`${n.kind}-${n.recordType}-${n.recordId}`} className="py-3 grid gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr_auto] text-sm">
                      <span className="font-medium">{needKindWords(n)}</span>
                      <span className="min-w-0">
                        <Link to={recordPath(n.recordType, n.recordId)} className={link}>{n.name ?? "Open it"}</Link>
                        {n.about && <span className="text-muted-foreground"> · {n.about}</span>}
                      </span>
                      <span className="text-muted-foreground sm:text-right">{needWhenWords(n)} · {n.owner ?? "No owner"}</span>
                    </li>
                  ))}
                </ul>
                {home.needsTotal > home.needs.length && <p className="text-sm text-muted-foreground mt-3">{`Showing the first ${home.needs.length} of ${home.needsTotal}.`}</p>}
              </>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="home-tasks" className={panel}>
              <h2 id="home-tasks" className="font-semibold mb-3">Upcoming tasks</h2>
              {home.upcomingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open task is due in the next 14 days.</p>
              ) : (
                <ul aria-label="Upcoming tasks" className="divide-y divide-border">
                  {home.upcomingTasks.map((t) => (
                    <li key={t.id} className="py-3 text-sm">
                      <span className="block font-medium">{t.title ?? "Task"}</span>
                      <span className="block text-muted-foreground">
                        <Link to={recordPath(t.recordType, t.recordId)} className={link}>{t.name ?? "Open it"}</Link>
                        {" · "}<span className={t.daysAway < 0 ? "text-warning" : undefined}>{`Due ${daysAwayWords(t.daysAway)}`}</span>
                        {t.assignee ? ` · ${t.assignee}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="home-renewals" className={panel}>
              <h2 id="home-renewals" className="font-semibold mb-3">Renewals coming up</h2>
              {home.renewals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing renews in the next 120 days.</p>
              ) : (
                <ul aria-label="Renewals coming up" className="divide-y divide-border">
                  {home.renewals.map((r) => (
                    <li key={r.id} className="py-3 text-sm">
                      <Link to={`/accounts/${r.accountId}`} className={`${link} font-medium`}>{r.accountName}</Link>
                      <span className="block text-muted-foreground">
                        {kindLabel(r.kind as RenewalKind)} with {r.withWhom} · <span className={r.daysAway < 0 ? "text-warning" : undefined}>{daysAwayWords(r.daysAway)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-labelledby="home-stages" className={panel}>
            <h2 id="home-stages" className="font-semibold mb-3">Open opportunities by stage</h2>
            <ul aria-label="Open opportunities by stage" className="grid gap-3 grid-cols-2 sm:grid-cols-5">
              {home.stages.map((s) => (
                <li key={s.stage} className="rounded-lg bg-muted px-3 py-2 flex flex-col">
                  <span className="text-sm text-muted-foreground order-1">{STAGE_LABELS[s.stage]}</span>
                  <span className="font-display text-2xl font-bold order-2">{s.count}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
};

export default HomePage;
