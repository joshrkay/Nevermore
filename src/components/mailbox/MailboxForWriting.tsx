import { useEffect, useState } from "react";
import { fetchMyMailbox, type MyMailbox } from "@/lib/advisorApi";
import { PanelFailed } from "@/components/workspace/states";
import ConnectButtons from "./ConnectButtons";

type Load = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; mailbox: MyMailbox };

export interface MailboxForWritingProps {
  /** The page to come back to after connecting: the place to write itself (brokerNext must keep it, D-650). */
  returnTo: string;
  /** `conversation_for(...).mailbox.last_send_failed`: the person's newest send failed for a mailbox reason, such as the permission taken back (D-634). */
  lastSendFailed?: boolean;
}

/**
 * The mailbox line on every place to write (story CRM-E1.1; docs/adr/0005; slice 6.3 mounts it on the contact, lead, account and opportunity pages).
 * With no mailbox it asks to connect one from here, with Google or Microsoft; connected, it names the address the message goes from; after the
 * newest send failed for a mailbox reason (the provider took the permission back, or refused the send) it says so, with Reconnect.
 */
const MailboxForWriting = ({ returnTo, lastSendFailed = false }: MailboxForWritingProps) => {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

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

  if (load.kind === "error") {
    return (
      <section aria-label="Your mailbox" className="border border-border rounded-lg p-3 text-sm">
        <PanelFailed what="your mailbox" error={load.error} onRetry={() => setAttempt((n) => n + 1)} />
      </section>
    );
  }
  if (load.kind !== "ready") return null;
  if (load.mailbox.connected && !lastSendFailed) {
    return (
      <section aria-label="Your mailbox" className="border border-border rounded-lg p-3 text-sm">
        <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold mr-2">Connected</span>
        Writing from <strong>{load.mailbox.address}</strong>
      </section>
    );
  }
  // A send refused for a mailbox reason keeps Reconnect even while a token is kept: a 401 or 403 from the send leaves it in place (D-632, D-651).
  return (
    <section aria-label="Your mailbox" className="border border-border rounded-lg p-3 space-y-2 text-sm">
      {load.mailbox.connected && (
        <p>
          Writing from <strong>{load.mailbox.address}</strong>
        </p>
      )}
      {lastSendFailed ? (
        <p role="alert">
          <strong>Your last message didn't go.</strong> Google or Microsoft no longer lets Nevermore send as you. Reconnect to write from here.
        </p>
      ) : (
        <p>Connect your email to write from here</p>
      )}
      <ConnectButtons returnTo={returnTo} verb={lastSendFailed ? "Reconnect" : "Connect"} />
    </section>
  );
};

export default MailboxForWriting;
