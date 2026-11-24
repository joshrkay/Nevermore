import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import MailboxForWriting from "@/components/mailbox/MailboxForWriting";
import { useFirstSend } from "@/components/mailbox/useFirstSend";
import { failureWords } from "@/components/workspace/form";
import { followUpNote, replySubject, withdrawalNote, WITHDRAWAL_REASON_LABELS, WITHDRAWAL_REASONS, type WithdrawalReason } from "@/data/peoFollowUp";
import { fillTemplate, type FirmTemplates } from "@/data/messageTemplates";
import { formatDay } from "@/data/quoteRequests";
import { followUpPeo, replyToPeo, withdrawFromPeo, type PeoFollowUp } from "@/lib/peoFollowUpApi";
import { firmTemplatesOrNone } from "@/lib/templatesApi";

export interface FollowUpOrWithdrawProps {
  quoteRequestId: number;
  peo: string;
  companyName: string;
  fileId: string;
  /** The version the PEO was sent. */
  version: number | null;
  /** The last certified version, which the PEO card's link is built from: a follow-up is offered only while it is the version sent (D-1623). */
  certifiedVersion: number | null;
  sentOn: string | null;
  /** The newest message the product sent on the PEO's thread: who it went to and its subject. */
  lastSent: { to: readonly string[]; subject: string | null };
  /** This page, to come back to after connecting a mailbox. */
  returnTo: string;
  /** Issues the follow-up's fresh bundle link, for the version already sent. */
  issueLink: PeoFollowUp["issueLink"];
  /** After a message is queued. */
  onDone: () => void;
}

/** Each address typed, split on commas, spaces and line breaks. */
const typed = (text: string) => text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);

/**
 * Reply, follow up and withdraw (M-2.4, BR-3.4): a message on the PEO's own thread, from the advisor's own mailbox, to the people the PEO was last sent
 * to. A follow-up and a withdrawal open with the firm's own template (BR-3.5), or the text kept in code when it has none; the advisor edits either. A
 * follow-up carries a fresh link to the version already sent; a withdrawal closes the quote request, revokes its link and records why, for advisors
 * only; a reply is the advisor's own words and changes nothing else.
 */
type Mode = "reply" | "follow_up" | "withdraw";

const FollowUpOrWithdraw = (p: FollowUpOrWithdrawProps) => {
  const [mode, setMode] = useState<Mode | null>(null);
  const [templates, setTemplates] = useState<FirmTemplates>({});
  const [to, setTo] = useState(p.lastSent.to.join(", "));
  const [subject, setSubject] = useState(replySubject(p.lastSent.subject, `${p.companyName}: ${p.fileId}`));
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<WithdrawalReason | "">("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { beforeSend, choice } = useFirstSend({ returnTo: p.returnTo });

  // The firm's own opening text, when it has any. Unread, each message opens with ours: the composer never waits on it.
  useEffect(() => {
    let cancelled = false;
    void firmTemplatesOrNone().then((t) => !cancelled && setTemplates(t));
    return () => {
      cancelled = true;
    };
  }, []);

  const opening = (m: Mode) => {
    if (m === "reply") return "";
    const own = templates[m === "follow_up" ? "follow_up" : "withdrawal"];
    if (own) return fillTemplate(own, { company: p.companyName, file_id: p.fileId, version: p.version, sent_on: p.sentOn ? formatDay(p.sentOn) : null, market: p.peo });
    return m === "follow_up" ? followUpNote(p) : withdrawalNote(p);
  };

  const start = (m: Mode) => {
    setMode(m);
    setProblem(null);
    setNote(opening(m));
  };

  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      if (mode === "withdraw" && reason !== "") await withdrawFromPeo({ quoteRequestId: p.quoteRequestId, to: typed(to), subject, note, reason });
      else if (mode === "reply") await replyToPeo({ quoteRequestId: p.quoteRequestId, to: typed(to), subject, note });
      else await followUpPeo({ quoteRequestId: p.quoteRequestId, to: typed(to), subject, note, issueLink: p.issueLink });
      setMode(null);
      p.onDone();
    } catch (err) {
      setProblem(failureWords(err, "That didn't go through. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  // The fresh link is built from the card's plan, the last certified version: only that version is followed up (a newer one is an update, M-2.3).
  const followUpOk = p.version !== null && p.version === p.certifiedVersion;
  const title = mode === "withdraw" ? `Withdraw from ${p.peo}` : mode === "reply" ? `Reply to ${p.peo}` : `Follow up with ${p.peo}`;
  return (
    <div className="space-y-2">
      {mode === null ? (
        <div className="flex flex-wrap gap-2">
          {!followUpOk && (
            <p className="w-full text-xs text-muted-foreground">
              {`${p.peo} was sent version ${p.version ?? "on record"} and version ${p.certifiedVersion ?? "on record"} is certified since: send it an update instead of a follow-up.`}
            </p>
          )}
          <button type="button" onClick={() => start("reply")} className="min-h-11 px-4 rounded-md border border-border text-sm font-medium">{`Reply to ${p.peo}`}</button>
          {followUpOk && <button type="button" onClick={() => start("follow_up")} className="min-h-11 px-4 rounded-md border border-border text-sm font-medium">{`Follow up with ${p.peo}`}</button>}
          <button type="button" onClick={() => start("withdraw")} className="min-h-11 px-4 rounded-md border border-border text-sm font-medium">{`Withdraw from ${p.peo}`}</button>
        </div>
      ) : (
        <form
          aria-label={title}
          className="border border-border rounded-md p-3 space-y-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void beforeSend(send);
          }}
        >
          <MailboxForWriting returnTo={p.returnTo} />
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">To</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} className="w-full min-h-11 bg-muted border border-border rounded-md px-3" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Subject</span>
            <input value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} className="w-full min-h-11 bg-muted border border-border rounded-md px-3" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Your note</span>
            <textarea value={note} maxLength={50000} rows={6} onChange={(e) => setNote(e.target.value)} className="w-full bg-muted border border-border rounded-md px-3 py-2" />
          </label>
          {mode === "reply" && <p className="text-xs text-muted-foreground">{`Goes on the ${p.peo} thread as you write it, with no bundle link. Nothing else changes.`}</p>}
          {mode === "withdraw" && (
            <div className="space-y-1">
              <label htmlFor={`withdraw-reason-${p.quoteRequestId}`} className="block text-xs text-muted-foreground">Why (for advisors only)</label>
              <select
                id={`withdraw-reason-${p.quoteRequestId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value as WithdrawalReason | "")}
                className="w-full min-h-11 bg-muted border border-border rounded-md px-3"
              >
                <option value="">Choose a reason</option>
                {WITHDRAWAL_REASONS.map((r) => <option key={r} value={r}>{WITHDRAWAL_REASON_LABELS[r]}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">{`Only advisors see the reason; ${p.peo} is not told it.`}</p>
            </div>
          )}
          {problem && <p role="alert" className="text-xs text-destructive">{problem}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || (mode === "withdraw" && reason === "") || (mode === "reply" && note.trim() === "")} className="min-h-11 px-4 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Send
            </button>
            <button type="button" onClick={() => setMode(null)} disabled={busy} className="min-h-11 px-4 rounded-md border border-border">Cancel</button>
          </div>
        </form>
      )}
      {choice}
    </div>
  );
};

export default FollowUpOrWithdraw;
