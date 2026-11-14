import { useState } from "react";
import { BellRing, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { actorName, formatDateTime } from "./format";
import { DownloadsOffNotice, useDownloadsOff } from "@/components/workspace/downloadsOff";
import { describeQuoteRequestEvent, formatDay, isChangeLogEvent, isQuoteRequestStatus, QUOTE_REQUEST_LABELS, quoteNoteKindLabel } from "@/data/quoteRequests";
import {
  buildTimeline, describeAttachment, hasNewMail, isThreadEvent, latestRecordedAt, splitQuotedText, type ThreadAttachment, type TimelineEntry,
} from "@/data/mailThread";
import {
  mailAttachmentUrl, moveMessageOffThread, openQuoteRequestThread, recordActivity,
  type QuoteRequestEventRow, type QuoteRequestMailAttachmentRow, type QuoteRequestMessageRow, type QuoteRequestNoteRow, type QuoteRequestRow,
  type QuoteRequestThreadReadRow,
} from "@/lib/advisorApi";
import { failureWords } from "@/components/workspace/form/failureWords";

interface PeoThreadPanelProps {
  prospectUserId: string;
  requests: readonly QuoteRequestRow[];
  messages: readonly QuoteRequestMessageRow[];
  attachments: readonly QuoteRequestMailAttachmentRow[];
  notes: readonly QuoteRequestNoteRow[];
  events: readonly QuoteRequestEventRow[];
  reads: readonly QuoteRequestThreadReadRow[];
  /** After a thread is marked opened, so the page can reload the marks the rest of the console shows. */
  onOpened?: () => void;
}

const badge = "text-xs px-2 py-0.5 rounded-full whitespace-nowrap";

const statusLabel = (s: string) => (isQuoteRequestStatus(s) ? QUOTE_REQUEST_LABELS[s] : s);

/** One message: who wrote it, its text with the quoted history behind a button, and its attachments. */
const MessageEntry = ({ entry, showPeo, onMoved }: { entry: Extract<TimelineEntry, { kind: "message" }>; showPeo: boolean; onMoved?: () => void }) => {
  const { message: m, attachments } = entry;
  const [showQuoted, setShowQuoted] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const downloadsOff = useDownloadsOff();
  const [moving, setMoving] = useState<"closed" | "asking" | "busy">("closed");
  const [note, setNote] = useState("");

  // Mail that landed on the wrong thread goes to the holding list, where an admin assigns it. Nothing is deleted.
  const moveOff = async () => {
    setMoving("busy");
    try {
      await moveMessageOffThread(m.id, note);
      toast.success("Moved to the holding list. An admin will place it.");
      onMoved?.();
    } catch (err) {
      toast.error(failureWords(err, "That didn't go through. Check your connection and try again."));
      setMoving("asking");
    }
  };
  const { visible, quoted } = splitQuotedText(m.body_text ?? "");
  const byHand = m.direction === "sent_by_hand";

  const open = async (a: ThreadAttachment) => {
    setOpening(a.id);
    try {
      const url = await mailAttachmentUrl(a);
      void recordActivity("document_downloaded", "quote_request", String(entry.requestId));
      window.location.assign(url);
    } catch (err) {
      toast.error(failureWords(err, "That didn't go through. Check your connection and try again."));
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {showPeo && <span className={`${badge} bg-foreground text-background font-semibold`}>{entry.peo}</span>}
        <span className={`${badge} font-semibold ${byHand ? "bg-secondary/15 text-secondary" : m.is_automatic ? "bg-muted text-muted-foreground" : "bg-success/15 text-success"}`}>
          {byHand ? "Sent by hand" : m.is_automatic ? "Automatic reply" : "Received"}
        </span>
        <span className="font-medium text-sm">{m.from_name ?? m.from_address}</span>
        {m.from_name && <span className="font-mono text-xs text-muted-foreground">{m.from_address}</span>}
        {m.new_sender && <span className={`${badge} bg-warning/15 text-warning font-semibold`}>New sender</span>}
        <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(entry.at)}</span>
      </div>
      {byHand && m.to_addresses.length > 0 && <p className="text-xs text-muted-foreground">to {m.to_addresses.join(", ")}</p>}
      {m.subject && <p className="text-sm font-semibold">{m.subject}</p>}
      <p className="text-sm whitespace-pre-wrap break-words">{visible || "(no text)"}</p>
      {m.body_truncated && <p className="text-xs text-muted-foreground">This message was long, so only its first part is kept.</p>}
      {quoted && (
        <div>
          <button onClick={() => setShowQuoted((s) => !s)} aria-expanded={showQuoted} className="text-xs text-primary underline py-2">
            {showQuoted ? "Hide quoted text" : "Show quoted text"}
          </button>
          {showQuoted && <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words border-l-2 border-border pl-2">{quoted}</p>}
        </div>
      )}
      {attachments.length > 0 && downloadsOff && <DownloadsOffNotice />}
      {attachments.length > 0 && (
        <ul aria-label="Attachments" className="space-y-1.5">
          {attachments.map((a) => {
            const d = describeAttachment(a);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-2 border border-border rounded-md px-2 py-1.5 text-xs">
                <Paperclip className="w-3 h-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="font-medium text-sm break-all">{a.file_name}</span>
                <span className="text-muted-foreground">{d.text}</span>
                {d.openable && !downloadsOff && (
                  <button onClick={() => open(a)} disabled={opening === a.id} className="ml-auto text-primary underline py-1.5 px-1 disabled:opacity-50">
                    {opening === a.id ? <Loader2 className="w-3 h-3 animate-spin inline" aria-label="Opening" /> : "Open"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {moving === "closed" ? (
        <button onClick={() => setMoving("asking")} className="text-xs text-muted-foreground underline py-2">Not for this quote request? Move it off this thread</button>
      ) : (
        <div className="border border-border rounded-md p-3 space-y-2 text-sm">
          <p>It goes to the holding list for an admin to assign to the right quote request. It is not deleted, and the sender is not told.</p>
          <label htmlFor={`move-note-${m.id}`} className="text-xs text-muted-foreground block">Why (optional, shown to the admin)</label>
          <input
            id={`move-note-${m.id}`}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            className="w-full min-h-11 bg-muted border border-border rounded-md px-3 text-sm"
          />
          <div className="flex gap-2">
            <button onClick={moveOff} disabled={moving === "busy"} className="min-h-11 px-4 rounded-md border border-border hover:bg-muted disabled:opacity-50">
              {moving === "busy" ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Moving" /> : "Move to the holding list"}
            </button>
            <button onClick={() => setMoving("closed")} disabled={moving === "busy"} className="min-h-11 px-4 rounded-md border border-border hover:bg-muted disabled:opacity-50">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

/** One line of a thread, whatever it is. */
const Entry = ({ entry, showPeo, prospectUserId, corrected, onMoved }: { entry: TimelineEntry; showPeo: boolean; prospectUserId: string; corrected: boolean; onMoved?: () => void }) => {
  if (entry.kind === "message") return <MessageEntry entry={entry} showPeo={showPeo} onMoved={onMoved} />;
  const peo = showPeo ? <span className={`${badge} bg-foreground text-background font-semibold`}>{entry.peo}</span> : null;
  if (entry.kind === "note") {
    const n = entry.note;
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {peo}
          <span className={`${badge} bg-card border border-border font-semibold`}>{`Note · ${quoteNoteKindLabel(n.kind)}`}</span>
          <span className="text-sm font-medium">{actorName(n.created_by, n.created_by_email, prospectUserId)}</span>
          <span className="ml-auto text-xs text-muted-foreground">{formatDay(n.noted_on)}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">{n.body}</p>
        {corrected && <p className="text-xs text-muted-foreground">Corrected: the earlier text is in the change log.</p>}
      </div>
    );
  }
  const who = actorName(entry.by.id, entry.by.email, prospectUserId);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {peo}
      {entry.kind === "send" ? (
        <>
          <span className={`${badge} bg-muted font-semibold`}>Send recorded</span>
          <span>{`${entry.version ? `Version ${entry.version}` : "The packet"} sent ${formatDay(entry.sentOn)}, recorded by ${who}.`}</span>
        </>
      ) : (
        <>
          <span className={`${badge} bg-muted font-semibold`}>Status</span>
          <span>{`${statusLabel(entry.from)} → ${statusLabel(entry.to)}, by ${who}.`}</span>
        </>
      )}
      <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(entry.at)}</span>
    </div>
  );
};

/**
 * The conversation with each PEO, in the main column: one thread per quote request, and all of them on one
 * timeline, newest first (story M-3.4). Choosing a thread opens it, which clears its "new PEO mail" mark for the
 * whole team, through the latest message this page showed. The prospect never sees any of it.
 */
const PeoThreadPanel = ({ prospectUserId, requests, messages, attachments, notes, events, reads, onOpened }: PeoThreadPanelProps) => {
  const [selected, setSelected] = useState<number | "all" | null>(null);
  // Threads opened since the page loaded, through the time shown: the mark clears at once, not on the next load.
  const [opened, setOpened] = useState<Record<number, string>>({});

  if (requests.length === 0) return null;

  const effectiveReads = [
    ...reads.filter((r) => !(r.quote_request_id in opened)),
    ...Object.entries(opened).map(([id, at]) => ({ quote_request_id: Number(id), last_opened_at: at })),
  ];
  const isNew = (id: number) => hasNewMail(id, messages, effectiveReads);

  const choose = async (choice: number | "all") => {
    setSelected(choice);
    const ids = (choice === "all" ? requests.map((r) => r.id) : [choice]).filter(isNew);
    for (const id of ids) {
      const through = latestRecordedAt(id, messages);
      if (!through) continue;
      try {
        await openQuoteRequestThread(id, through);
        setOpened((o) => ({ ...o, [id]: through }));
        onOpened?.();
      } catch (err) {
        // The thread still shows; its mark stays, so the next open tries again.
        toast.error(failureWords(err, "That didn't go through. Check your connection and try again."));
      }
    }
  };

  const shown = selected === null ? [] : selected === "all" ? requests : requests.filter((r) => r.id === selected);
  const entries = buildTimeline({ requests: shown, messages, attachments, notes, events });
  const correctedNotes = new Set(events.filter((e) => e.note_id !== null).map((e) => e.note_id));
  const changeLog = selected === null || selected === "all" ? [] : events.filter((e) => e.quote_request_id === selected && !isThreadEvent(e) && isChangeLogEvent(e));
  const countFor = (id: number) => messages.filter((m) => m.quote_request_id === id).length;

  return (
    <section aria-labelledby="peo-threads-heading" className="border border-border rounded-xl p-5 space-y-4">
      <div>
        <h2 id="peo-threads-heading" className="font-display text-lg font-bold">PEO threads</h2>
        <p className="text-xs text-muted-foreground">
          Mail sent to each quote request's reply address, with your notes, sends and status changes, newest first. The prospect never sees it.
        </p>
      </div>
      <div role="group" aria-label="Choose a thread" className="flex flex-wrap gap-2">
        {requests.map((r) => (
          <button
            key={r.id}
            onClick={() => choose(r.id)}
            aria-pressed={selected === r.id}
            className={`flex items-center gap-2 px-3 py-2 min-h-11 rounded-full border text-sm ${selected === r.id ? "bg-foreground text-background border-foreground" : "bg-card border-border"}`}
          >
            <span className="font-medium">{r.peo_name}</span>
            <span className="text-xs opacity-80">{`${countFor(r.id)} message${countFor(r.id) === 1 ? "" : "s"}`}</span>
            {isNew(r.id) && (
              <span className={`${badge} bg-secondary text-secondary-foreground font-semibold inline-flex items-center gap-1`}>
                <BellRing className="w-3 h-3" aria-hidden="true" /> New PEO mail
              </span>
            )}
          </button>
        ))}
        {requests.length > 1 && (
          <button
            onClick={() => choose("all")}
            aria-pressed={selected === "all"}
            className={`px-3 py-2 min-h-11 rounded-full border text-sm font-medium ${selected === "all" ? "bg-foreground text-background border-foreground" : "bg-card border-border"}`}
          >
            All PEOs
          </button>
        )}
      </div>

      {selected === null ? (
        <p className="text-sm text-muted-foreground">Choose a PEO to read its thread.</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet. Mail to the reply address, notes, sends and status changes appear on this thread.</p>
      ) : (
        <ol aria-label={selected === "all" ? "All PEOs, newest first" : `${shown[0]?.peo_name} thread, newest first`} className="space-y-3">
          {entries.map((e) => (
            <li key={e.key} className="border border-border rounded-xl bg-card p-3">
              <Entry entry={e} showPeo={selected === "all"} prospectUserId={prospectUserId} corrected={e.kind === "note" && correctedNotes.has(e.note.id)} onMoved={onOpened} />
            </li>
          ))}
        </ol>
      )}

      {changeLog.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer py-2">{`Change log (${changeLog.length})`}</summary>
          <ol className="space-y-1 pt-1">
            {changeLog.map((e) => (
              <li key={e.id}>{`${describeQuoteRequestEvent(e)} · ${actorName(e.changed_by, e.changed_by_email, prospectUserId)} · ${formatDateTime(e.changed_at)}`}</li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
};

export default PeoThreadPanel;
