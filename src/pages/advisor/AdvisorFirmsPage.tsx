import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import { formatDateTime } from "@/components/advisor/format";
import { fetchIsAdmin } from "@/lib/advisorApi";
import { decideFirm, fetchFirmStates, fetchWaitingFirms, liftFirmSuspension, suspendFirm, type FirmState, type WaitingFirm } from "@/lib/firmApi";
import { firmHostname } from "@/lib/firmHost";

type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  | { kind: "not_admin" }
  | { kind: "ready"; firms: WaitingFirm[]; states: FirmState[] };

const button = "min-h-11 px-4 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const STATE_LABELS: Record<FirmState["state"], string> = { waiting: "Waiting for approval", approved: "Approved", refused: "Refused" };

/**
 * The firms waiting for approval (story CRM-P1.1 with Q-1.2) and every firm with its state (story CRM-P1.8). A platform admin
 * approves or refuses each waiting firm; the decision is recorded and a firm is decided once. Suspending a firm is separate from
 * that decision: any firm can be suspended with a reason and later have its suspension lifted, and both are recorded. An admin is
 * no member of any firm (D-16): they see only what is needed to decide.
 */
const AdvisorFirmsPage = () => {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  // The suspension being asked for or lifted: which firm, and (to suspend) the reason typed.
  const [changing, setChanging] = useState<{ id: string; lift: boolean } | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    fetchIsAdmin()
      .then((admin) =>
        admin
          ? Promise.all([fetchWaitingFirms(), fetchFirmStates()]).then(([firms, states]): Load => ({ kind: "ready", firms, states }))
          : ({ kind: "not_admin" } as Load),
      )
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
      // An ended session is no failure to retry: AdvisorLoadError signs the person out. A refusal (42501) stays a message,
      // since it can also mean the admin belongs to this firm, and the person can still use the page.
      if ((err as { unauthenticated?: boolean }).unauthenticated) setLoad({ kind: "error", error: err as Error });
      else toast.error((err as Error).message);
    }
    setBusy(null);
  };

  const changeSuspension = async (firm: FirmState) => {
    setBusy(firm.id);
    try {
      if (firm.suspended) await liftFirmSuspension(firm.id);
      else await suspendFirm(firm.id, reason.trim());
      toast.success(firm.suspended ? `The suspension of ${firm.name} is lifted.` : `${firm.name} is suspended.`);
      setChanging(null);
      setReason("");
      setAttempt((n) => n + 1);
    } catch (err) {
      if ((err as { unauthenticated?: boolean }).unauthenticated) setLoad({ kind: "error", error: err as Error });
      else toast.error((err as Error).message);
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
        {load.kind === "error" && <AdvisorLoadError error={load.error} what="the firms" onRetry={() => setAttempt((n) => n + 1)} />}
        {load.kind === "not_admin" && <p role="status" className="text-sm">Only an admin can approve or suspend firms.</p>}
        {load.kind === "ready" && (
          <>
            {load.firms.length === 0 ? (
              <p role="status" className="text-sm text-muted-foreground">No firm is waiting for approval.</p>
            ) : (
              <ul aria-label="Firms waiting for approval" className="space-y-3">
              {load.firms.map((f) => (
                <li key={f.id} className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="font-semibold">{f.name}</span>
                    <span className="font-mono text-xs text-muted-foreground break-all">{firmHostname(f.address)}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{`Signed up ${formatDateTime(f.signedUpAt)}${f.signedUpByEmail ? ` by ${f.signedUpByEmail}` : ""}`}</span>
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
            )}
            <section className="space-y-3 pt-4">
              <div>
                <h2 className="font-display text-2xl font-bold mb-1">Every firm</h2>
                <p className="text-sm text-muted-foreground">
                  Suspending a firm shuts its members out of its records and stops its alerts, and mail for it is still held. Nothing is deleted, and
                  lifting the suspension gives everything back as it was. It does not change whether a firm is approved. Suspending and lifting are
                  recorded, and the firm sees them as done by Nevermore.
                  A firm whose owner has asked to close is shown with the day it closes, and after that with the day it closed and a count of
                  what was deleted. Only the firm's owners ask or withdraw; you can't do either for them.
                </p>
              </div>
              {load.states.length === 0 ? (
                <p role="status" className="text-sm text-muted-foreground">There are no firms yet.</p>
              ) : (
                <ul aria-label="Every firm" className="space-y-3">
                  {load.states.map((f) => (
                    <li key={f.id} className="border border-border rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <span className="font-semibold">{f.name}</span>
                        <span className="font-mono text-xs text-muted-foreground break-all">{firmHostname(f.address)}</span>
                        <span className="text-xs rounded-full border border-border px-2 py-0.5">{STATE_LABELS[f.state]}</span>
                        {f.suspended && <span className="text-xs rounded-full border border-destructive text-destructive px-2 py-0.5">Suspended</span>}
                        {f.closingOn && <span className="text-xs rounded-full border border-border px-2 py-0.5">{`Closing on ${formatDate(f.closingOn)}`}</span>}
                        {f.closedOn && <span className="text-xs rounded-full border border-border px-2 py-0.5">{`Closed on ${formatDate(f.closedOn)}`}</span>}
                      </div>
                      {f.closedOn && f.closureDeleted && (
                        <p className="text-sm text-muted-foreground">
                          {`Deleted, by table: ${Object.entries(f.closureDeleted).map(([table, n]) => `${table.replace(/_/g, " ")} ${n}`).join(", ")}.`}
                        </p>
                      )}
                      {f.suspended && (
                        <p className="text-sm text-muted-foreground">
                          {`Suspended${f.suspendedAt ? ` ${formatDateTime(f.suspendedAt)}` : ""}: ${f.suspensionReason ?? ""}`}
                        </p>
                      )}
                      {f.closedOn ? null : changing?.id === f.id ? (
                        <div className="space-y-2">
                          {f.suspended ? (
                            <p className="text-sm">Lift the suspension? Its members get everything back as it was.</p>
                          ) : (
                            <div>
                              <p className="text-sm mb-1">Its members can't use it until you lift the suspension. Nothing is deleted.</p>
                              <label htmlFor={`reason-${f.id}`} className="text-xs text-muted-foreground">{`Reason for suspending ${f.name}`}</label>
                              <input id={`reason-${f.id}`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)}
                                className="w-full min-h-11 bg-muted border border-border rounded-md px-3 text-sm" />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <button onClick={() => void changeSuspension(f)} disabled={busy !== null || (!f.suspended && reason.trim() === "")}
                              className={`${button} bg-primary text-primary-foreground border-primary hover:bg-primary/90`}>
                              {busy === f.id ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Saving" /> : f.suspended ? "Yes, lift" : "Yes, suspend"}
                            </button>
                            <button onClick={() => { setChanging(null); setReason(""); }} disabled={busy !== null} className={button}>
                              {f.suspended ? "Keep suspended" : "Keep it running"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setChanging({ id: f.id, lift: f.suspended }); setReason(""); }} disabled={busy !== null} className={button}
                          aria-label={f.suspended ? `Lift suspension of ${f.name}` : `Suspend ${f.name}`}>
                          {f.suspended ? "Lift suspension" : "Suspend"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default AdvisorFirmsPage;
