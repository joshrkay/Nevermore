// A person's own switch for the daily summary and the time zone their morning is in (docs/BROKER_READINESS_PRD.md BR-3.3). Theirs alone, whatever firms
// they belong to.
import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { loadMySummarySettings, saveMySummarySettings, type SummarySettings } from "@/lib/summaryApi";
import { browserTimeZone } from "@/lib/homeApi";
import { LoadFailed } from "@/components/workspace/states";
import { failureWords, SaveFailed } from "@/components/workspace/form";

type Load = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; saved: SummarySettings };

/** The zones offered: every one the browser knows, with the person's own and the one saved always among them. */
function zoneChoices(...always: string[]): string[] {
  let known: string[] = [];
  try {
    known = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    known = [];
  }
  return [...new Set([...always, ...known])].sort();
}

export const DailySummarySettings = () => {
  const id = useId();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<SummarySettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    loadMySummarySettings().then(
      (saved) => { if (!cancelled) { setLoad({ kind: "ready", saved }); setDraft(saved); } },
      (error: Error) => !cancelled && setLoad({ kind: "error", error }),
    );
    return () => { cancelled = true; };
  }, [attempt]);

  if (load.kind === "loading") return <p role="status" className="text-sm text-muted-foreground">Loading your daily summary settings…</p>;
  if (load.kind === "error" || !draft) return <LoadFailed error={load.kind === "error" ? load.error : new Error("Couldn't load your settings.")} what="your daily summary settings" onRetry={() => setAttempt((n) => n + 1)} />;
  const { saved } = load;
  const changed = draft.dailySummary !== saved.dailySummary || draft.timeZone !== saved.timeZone;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const now = await saveMySummarySettings(draft);
      setLoad({ kind: "ready", saved: now });
      setDraft(now);
      toast.success(now.dailySummary ? "You'll get the daily summary on weekday mornings when something needs you." : "The daily summary is off.");
    } catch (err) {
      setProblem(failureWords(err, "Your settings weren't saved. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void save(e)} className="space-y-3" aria-label="Daily summary">
      <p className="text-sm text-muted-foreground">
        One email on weekday mornings saying what needs you: tasks due, quotes about to expire, intakes and leads gone quiet. Only when there is something to say.
      </p>
      <label className="flex items-center gap-3 min-h-11 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={draft.dailySummary} onChange={(e) => setDraft({ ...draft, dailySummary: e.target.checked })} />
        Send me the daily summary
      </label>
      <div className="space-y-1 max-w-sm">
        <label htmlFor={`${id}-zone`} className="text-sm font-medium">Your time zone</label>
        <select id={`${id}-zone`} value={draft.timeZone} onChange={(e) => setDraft({ ...draft, timeZone: e.target.value })}
          className="w-full min-h-11 bg-muted border border-border rounded-md px-3 py-2 text-sm">
          {zoneChoices(saved.timeZone, browserTimeZone()).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">It arrives at about 7 in the morning there.</p>
      </div>
      <SaveFailed message={problem} className="font-normal" />
      <button type="submit" disabled={busy || !changed} className="inline-flex items-center justify-center min-h-11 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
        Save
      </button>
    </form>
  );
};
