import { useEffect, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import { formatDateTime } from "@/components/advisor/format";
import { HELD_REASON_LABELS, heldDaysLeft } from "@/data/quoteRequests";
import { describeAttachment } from "@/data/mailThread";
import {
  assignHeldMessage, discardHeldMessage, fetchIsAdmin, loadHeldMail,
  type AssignableRequest, type HeldMail, type QuoteRequestMessageRow,
} from "@/lib/advisorApi";
import { LoadFailed } from "@/components/workspace/states";
import { failureWords, DID_NOT_GO_THROUGH } from "@/components/workspace/form";

type Load = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "not_admin" } | { kind: "ready"; held: HeldMail };

const buttonClass = "min-h-11 px-4 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";

const label = (r: AssignableRequest) => `${r.fileId || `Quote request ${r.id}`} · ${r.company} · ${r.peo}`;

/** What an admin is told about where a held message came from. */
function provenance(m: QuoteRequestMessageRow, held: HeldMail): string {
  const to = m.address_local_part ?? "";
  if (m.held_reason === "moved_by_advisor") {
    const from = m.moved_from_quote_request_id !== null ? held.names.get(m.moved_from_quote_request_id) : undefined;
    const note = m.moved_note ? `: "${m.moved_note}"` : "";
    return `Moved by ${m.moved_by_email ?? "an advisor"}${from ? ` from ${from}` : ""}${note}`;
  }
  const was = held.requests.find((r) => r.localParts.includes(to));
  const base = `To: ${to || "(unknown)"}`;
  return m.held_reason === "revoked_address" && was ? `${base}. It belonged to ${label(was)}.` : base;
}

const HeldMessage = ({ message, held, onDone }: { message: QuoteRequestMessageRow; held: HeldMail; onDone: () => void }) => {
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState<"assign" | "discard" | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const attachments = held.attachments.filter((a) => a.message_id === message.id);
  const days = heldDaysLeft(message.held_at ?? message.recorded_at);

  const run = async (kind: "assign" | "discard") => {
    setBusy(kind);
    try {
      if (kind === "assign") await assignHeldMessage(message.id, Number(target));
      else await discardHeldMessage(message.id);
      toast.success(kind === "assign" ? "Assigned. It is new PEO mail on that thread." : "Discarded.");
      onDone();
    } catch (err) {
      toast.error(failureWords(err, DID_NOT_GO_THROUGH));
      setBusy(null);
    }
  };

  return (
    <article className="border border-border rounded-xl bg-card p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-semibold">{HELD_REASON_LABELS[message.held_reason ?? ""] ?? "Held"}</span>
        <span className="font-medium">{message.from_name ?? message.from_address}</span>
        {message.from_name && <span className="font-mono text-xs text-muted-foreground">{message.from_address}</span>}
        <span className="ml-auto text-xs text-muted-foreground">{`Arrived ${formatDateTime(message.recorded_at)} · deleted in ${days} day${days === 1 ? "" : "s"}`}</span>
      </div>
      <p className="text-xs text-muted-foreground break-all">{provenance(message, held)}</p>
      {message.subject && <p className="text-sm font-semibold">{message.subject}</p>}
      <p className="text-sm whitespace-pre-wrap break-words">{message.body_text || "(no text)"}</p>
      {attachments.length > 0 && (
        <ul aria-label="Attachments" className="space-y-1">
          {attachments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
              <Paperclip className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium break-all">{a.file_name}</span>
              <span className="text-muted-foreground">{describeAttachment(a).text}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-3 pt-1">
        <div className="flex flex-col gap-1 min-w-0 grow sm:grow-0 sm:w-96">
          <label htmlFor={`assign-${message.id}`} className="text-xs text-muted-foreground">Assign to a quote request</label>
          <select
            id={`assign-${message.id}`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="min-h-11 bg-muted border border-border rounded-md px-3 text-sm"
          >
            <option value="">Choose one…</option>
            {held.requests.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
          </select>
        </div>
        <button onClick={() => run("assign")} disabled={!target || busy !== null} className={`${buttonClass} bg-primary text-primary-foreground border-primary hover:bg-primary/90`}>
          {busy === "assign" ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Assigning" /> : "Assign"}
        </button>
        {confirmDiscard ? (
          <span className="flex items-center gap-2 text-sm">
            Discard it and its files for good?
            <button onClick={() => run("discard")} disabled={busy !== null} className={buttonClass}>
              {busy === "discard" ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Discarding" /> : "Yes, discard"}
            </button>
            <button onClick={() => setConfirmDiscard(false)} disabled={busy !== null} className={buttonClass}>Keep</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDiscard(true)} disabled={busy !== null} className={buttonClass}>Discard</button>
        )}
      </div>
    </article>
  );
};

/**
 * The holding list (story M-3.3): mail that reached a revoked or never-issued address, or that an advisor moved off a
 * thread. Nothing is attached by guesswork: an admin assigns each message to a quote request or discards it, and a
 * message nobody deals with is deleted 30 days after it was held. Senders get no reply.
 */
const AdvisorHeldMailPage = () => {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    fetchIsAdmin()
      .then((admin) => (admin ? loadHeldMail().then((held): Load => ({ kind: "ready", held })) : ({ kind: "not_admin" } as Load)))
      .then((next) => !cancelled && setLoad(next))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div className="min-h-screen bg-background">
      <AdvisorHeader />
      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <h1 className="font-display text-3xl font-bold mb-1">Held mail</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Mail that arrived for a reply address that was revoked or never issued, or that an advisor moved off a thread. Nothing is
          attached by guesswork: assign each message to a quote request or discard it. A message nobody deals with is deleted 30 days
          after it was held. Senders get no reply.
        </p>
        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-16 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading held mail…
          </div>
        )}
        {load.kind === "error" && <LoadFailed error={load.error} what="the holding list" onRetry={() => setAttempt((n) => n + 1)} />}
        {load.kind === "not_admin" && <p role="status" className="text-sm">Only an admin can see held mail.</p>}
        {load.kind === "ready" && (load.held.messages.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">Nothing is being held.</p>
        ) : (
          <div className="space-y-4">
            {load.held.messages.map((m) => (
              <HeldMessage key={m.id} message={m} held={load.held} onDone={() => setAttempt((n) => n + 1)} />
            ))}
          </div>
        ))}
      </main>
    </div>
  );
};

export default AdvisorHeldMailPage;
