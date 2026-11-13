import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import { formatDateTime } from "@/components/advisor/format";
import { fetchIsAdmin } from "@/lib/advisorApi";
import { decideFirm, fetchWaitingFirms, type WaitingFirm } from "@/lib/firmApi";
import { firmUrl } from "@/lib/firmHost";

type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  | { kind: "not_admin" }
  | { kind: "ready"; firms: WaitingFirm[] };

const button = "min-h-11 px-4 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";

/**
 * The firms waiting for approval (story CRM-P1.1 with Q-1.2). A platform admin approves or refuses each; the decision is
 * recorded and a firm is decided once. An admin is no member of any firm (D-16): they see only what is needed to decide.
 */
const AdvisorFirmsPage = () => {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    fetchIsAdmin()
      .then((admin) => (admin ? fetchWaitingFirms().then((firms): Load => ({ kind: "ready", firms })) : ({ kind: "not_admin" } as Load)))
      .then((next) => !cancelled && setLoad(next))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const decide = async (firm: WaitingFirm, approve: boolean) => {
    setBusy(firm.id);
    try {
      await decideFirm(firm.id, approve, notes[firm.id]?.trim() || undefined);
      toast.success(`${firm.name} is ${approve ? "approved" : "refused"}.`);
      setConfirming(null);
      setAttempt((n) => n + 1);
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <AdvisorHeader />
      <main className="container mx-auto px-6 py-8 max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">Firm approvals</h1>
          <p className="text-sm text-muted-foreground">
            A new firm can work at once but can't send to a PEO until you approve it. Check the name and address, such as a look-alike of a
            PEO or of another firm, before you approve. A decision is recorded and can't be changed here.
          </p>
        </div>
        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-12 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading…
          </div>
        )}
        {load.kind === "error" && <AdvisorLoadError error={load.error} what="the waiting firms" onRetry={() => setAttempt((n) => n + 1)} />}
        {load.kind === "not_admin" && <p role="status" className="text-sm">Only an admin can approve firms.</p>}
        {load.kind === "ready" &&
          (load.firms.length === 0 ? (
            <p role="status" className="text-sm text-muted-foreground">No firm is waiting for approval.</p>
          ) : (
            <ul aria-label="Firms waiting for approval" className="space-y-3">
              {load.firms.map((f) => (
                <li key={f.id} className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="font-semibold">{f.name}</span>
                    <span className="font-mono text-xs text-muted-foreground break-all">{firmUrl(f.address).replace("https://", "")}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{`Signed up ${formatDateTime(f.signedUpAt)}${f.ownerEmail ? ` by ${f.ownerEmail}` : ""}`}</span>
                  </div>
                  <div>
                    <label htmlFor={`note-${f.id}`} className="text-xs text-muted-foreground">{`Note for ${f.name}`}</label>
                    <input id={`note-${f.id}`} value={notes[f.id] ?? ""} maxLength={500}
                      onChange={(e) => setNotes((n) => ({ ...n, [f.id]: e.target.value }))}
                      className="w-full min-h-11 bg-muted border border-border rounded-md px-3 text-sm" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => void decide(f, true)} disabled={busy !== null} aria-label={`Approve ${f.name}`}
                      className={`${button} bg-primary text-primary-foreground border-primary hover:bg-primary/90`}>
                      {busy === f.id ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Saving" /> : "Approve"}
                    </button>
                    {confirming === f.id ? (
                      <span className="flex items-center gap-2 text-sm">
                        A refusal can't be undone.
                        <button onClick={() => void decide(f, false)} disabled={busy !== null} className={button}>Yes, refuse</button>
                        <button onClick={() => setConfirming(null)} disabled={busy !== null} className={button}>Keep waiting</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirming(f.id)} disabled={busy !== null} className={button} aria-label={`Refuse ${f.name}`}>Refuse</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </main>
    </div>
  );
};

export default AdvisorFirmsPage;
