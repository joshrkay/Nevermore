import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BROKER_PROVIDER_LABELS, BROKER_PROVIDERS, type BrokerProvider } from "@/data/mailboxScopes";
import { startBrokerSignIn } from "@/lib/brokerAuth";

/**
 * Connect Google and Connect Microsoft (or Reconnect), from wherever a mailbox is asked for (story CRM-E1.1). Each is the existing broker sign-in,
 * which asks Google or Microsoft for the send permission only, never to read (docs/adr/0005, src/data/mailboxScopes.ts), and comes back to `returnTo`.
 */
const ConnectButtons = ({ returnTo, verb = "Connect" }: { returnTo: string; verb?: "Connect" | "Reconnect" }) => {
  const [busy, setBusy] = useState<BrokerProvider | null>(null);
  const connect = async (provider: BrokerProvider) => {
    setBusy(provider);
    try {
      await startBrokerSignIn(provider, returnTo);
    } catch {
      toast.error(`We couldn't start connecting ${BROKER_PROVIDER_LABELS[provider]}. Try again in a minute.`);
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {BROKER_PROVIDERS.map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => connect(provider)}
          disabled={busy !== null}
          className="min-h-11 px-4 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50"
        >
          {busy === provider ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Connecting" /> : `${verb} ${BROKER_PROVIDER_LABELS[provider]}`}
        </button>
      ))}
    </div>
  );
};

export default ConnectButtons;
