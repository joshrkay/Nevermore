import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/components/advisor/format";
import { BROKER_PROVIDER_LABELS, BROKER_PROVIDERS, type BrokerProvider } from "@/data/mailboxScopes";
import { disconnectMailbox, fetchMyMailbox, type MyMailbox } from "@/lib/advisorApi";
import { startBrokerSignIn } from "@/lib/brokerAuth";
import { LoadFailed } from "@/components/workspace/states";
import { failureWords } from "@/components/workspace/form/failureWords";

type Load = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; mailbox: MyMailbox };

/**
 * The broker's own mailbox (story M-4.3; docs/adr/0005): whether the product can send submissions as them, and a way to
 * stop it. Connecting is signing in with Google or Microsoft again, which asks for the send permission; the product
 * never reads a mailbox. Disconnecting deletes what lets it send, and sending then says no mailbox is connected.
 */
const AdvisorMailboxPage = () => {
  const [params] = useSearchParams();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<BrokerProvider | "disconnect" | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    fetchMyMailbox()
      .then((mailbox) => !cancelled && setLoad({ kind: "ready", mailbox }))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const connect = async (provider: BrokerProvider) => {
    setBusy(provider);
    try {
      await startBrokerSignIn(provider, "/advisor/mailbox");
    } catch {
      toast.error(`We couldn't start connecting ${BROKER_PROVIDER_LABELS[provider]}. Try again in a minute.`);
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await disconnectMailbox();
      toast.success("Your mailbox is disconnected. Nevermore can no longer send as you.");
      setConfirming(false);
      setAttempt((n) => n + 1);
    } catch (err) {
      toast.error(failureWords(err, "That didn't go through. Check your connection and try again."));
    }
    setBusy(null);
  };

  const button = "min-h-11 px-4 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8 max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">Your mailbox</h1>
          <p className="text-sm text-muted-foreground">
            When Nevermore sends a submission to a PEO, it can send it from your own address, so it reaches the PEO as you and is in your Sent
            folder. It can only send: it never reads your inbox, contacts or drafts.
          </p>
        </div>
        {params.get("connect") === "failed" && (
          <p role="alert" className="text-sm border border-warning/40 bg-warning/10 rounded-lg px-4 py-3">
            We couldn't connect your mailbox. Either sending wasn't allowed on the Google or Microsoft screen, or the connection didn't go through. Try
            again below. Until then you can send by hand from your own mail with the thread's address in CC.
          </p>
        )}
        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-12 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Checking your mailbox…
          </div>
        )}
        {load.kind === "error" && <LoadFailed error={load.error} what="your mailbox" onRetry={() => setAttempt((n) => n + 1)} />}
        {load.kind === "ready" && load.mailbox.connected && (
          <section className="border border-border rounded-xl p-5 space-y-3" aria-label="Connected mailbox">
            <p className="text-sm">
              <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold mr-2">Connected</span>
              <strong>{load.mailbox.address}</strong>
              {load.mailbox.provider && ` through ${BROKER_PROVIDER_LABELS[load.mailbox.provider]}`}
              {load.mailbox.connectedAt && `, since ${formatDateTime(load.mailbox.connectedAt)}`}
            </p>
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                Disconnect it? Nevermore can no longer send as you until you connect again.
                <button onClick={disconnect} disabled={busy !== null} className={button}>
                  {busy === "disconnect" ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Disconnecting" /> : "Yes, disconnect"}
                </button>
                <button onClick={() => setConfirming(false)} disabled={busy !== null} className={button}>Keep it</button>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)} className={button}>Disconnect</button>
            )}
          </section>
        )}
        {load.kind === "ready" && !load.mailbox.connected && (
          <section className="border border-border rounded-xl p-5 space-y-3" aria-label="No mailbox connected">
            <p className="text-sm">
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold mr-2">Not connected</span>
              Nevermore can't send as you yet. You can still send by hand from your own mail with the thread's address in CC.
            </p>
            <div className="flex flex-wrap gap-3">
              {BROKER_PROVIDERS.map((provider) => (
                <button key={provider} onClick={() => connect(provider)} disabled={busy !== null} className={button}>
                  {busy === provider ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Connecting" /> : `Connect with ${BROKER_PROVIDER_LABELS[provider]}`}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default AdvisorMailboxPage;
