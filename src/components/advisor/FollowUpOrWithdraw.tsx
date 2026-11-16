import { useState } from "react";
import { Loader2 } from "lucide-react";
import MailboxForWriting from "@/components/mailbox/MailboxForWriting";
import { useFirstSend } from "@/components/mailbox/useFirstSend";
import { failureWords } from "@/components/workspace/form";
import { followUpNote, replySubject, withdrawalNote, WITHDRAWAL_REASON_LABELS, WITHDRAWAL_REASONS, type WithdrawalReason } from "@/data/peoFollowUp";
import { followUpPeo, withdrawFromPeo, type PeoFollowUp } from "@/lib/peoFollowUpApi";

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
 * Follow up and withdraw (M-2.4): a message on the PEO's own thread, from the advisor's own mailbox, opening with default text kept in code which the
 * advisor edits, to the people the PEO was last sent to. A follow-up carries a fresh link to the version already sent; a withdrawal closes the quote
 * request, revokes its link and records why, for advisors only.
 */
const FollowUpOrWithdraw = (p: FollowUpOrWithdrawProps) => {
  const [mode, setMode] = useState<"follow_up" | "withdraw" | null>(null);
  const [to, setTo] = useState(p.lastSent.to.join(", "));
  const [subject, setSubject] = useState(replySubject(p.lastSent.subject, `${p.companyName}: ${p.fileId}`));
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<WithdrawalReason | "">("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { beforeSend, choice } = useFirstSend({ returnTo: p.returnTo });

  const start = (m: "follow_up" | "withdraw") => {
    setMode(m);
    setProblem(null);
    setNote(m === "follow_up" ? followUpNote(p) : withdrawalNote(p));
  };

  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      if (mode === "withdraw" && reason !== "") await withdrawFromPeo({ quoteRequestId: p.quoteRequestId, to: typed(to), subject, note, reason });
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
  const title = mode === "withdraw" ? `Withdraw from ${p.peo}` : `Follow up with ${p.peo}`;
  return (
    <div className="space-y-2">
      {mode === null ? (
        <div className="flex flex-wrap gap-2">
          {!followUpOk && (
            <p className="w-full text-xs text-muted-foreground">
              {`${p.peo} was sent version ${p.version ?? "on record"} and version ${p.certifiedVersion ?? "on record"} is certified since: send it an update instead of a follow-up.`}
            </p>
          )}
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
            <button type="submit" disabled={busy || (mode === "withdraw" && reason === "")} className="min-h-11 px-4 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60">
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
