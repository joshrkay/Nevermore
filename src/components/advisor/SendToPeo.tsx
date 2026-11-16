import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import MailboxForWriting from "@/components/mailbox/MailboxForWriting";
import { useFirstSend } from "@/components/mailbox/useFirstSend";
import { failureWords } from "@/components/workspace/form";
import { DRAFT_WORDING_NOTICE } from "@/data/legalWording";
import { peoSendBlockPreview, peoSendSubject } from "@/data/peoSend";
import { quoteReplyDomain, replyAddress } from "@/data/quoteRequests";
import { loadPeoSendContext, sendToPeo, type PeoSend, type PeoSendContext } from "@/lib/peoSendApi";
import { loadRegisteredElsewhere } from "@/lib/peoRegistrationsApi";
import { registeredElsewhereWords } from "@/data/peoRegistrations";

export interface SendToPeoProps {
  sessionId: string;
  peo: string;
  companyName: string;
  fileId: string;
  version: number | null;
  /** The open items the link will list (the bundle plan's missing items). */
  openItems: readonly string[];
  /** This page, to come back to after connecting a mailbox. */
  returnTo: string;
  /** Stores the bundle's files and issues its link for the PEO's quote request (issueBundleLink). */
  issueLink: PeoSend["issueLink"];
  /**
   * The version the PEO holds when it is older than `version` (M-2.3): the composer is then the update, which says under the note what changed
   * since it. Null or left out for a first send.
   */
  updateFrom?: number | null;
  /** The button's and the form's name when it is not "Send to <PEO>": a quote's page words a send to a closed PEO "Send again" (CRM-Q3.2). */
  label?: string;
  /** After the send is queued. */
  onSent: () => void;
  /** The advisor chose to send it from their own mail instead: the page offers to record that send (the existing recorded send, M-2.5). */
  onSendYourself: () => void;
}

/** Each address typed, split on commas, spaces and line breaks. */
const typed = (text: string) => text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);

/**
 * Send to a PEO (M-2.1): addressed to one or more people at the PEO, picked from its contacts or typed, with the advisor's cover note and, under it,
 * the fixed block the database writes (the link, File ID and version, open items, the advisor's name, firm and phone, the draft line). It goes from
 * the advisor's own mailbox (ADR 0005); with none connected, sending is off: useFirstSend (6.1) offers to connect one, or to send it from their own
 * mail with the reply address in CC and record that send.
 */
const SendToPeo = (p: SendToPeoProps) => {
  const update = p.updateFrom != null && p.version !== null && p.updateFrom < p.version;
  const title = p.label ?? (update ? `Send version ${p.version} to ${p.peo}` : `Send to ${p.peo}`);
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<PeoSendContext | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [others, setOthers] = useState("");
  const [subject, setSubject] = useState(peoSendSubject(p.companyName, p.fileId, p.version));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [queued, setQueued] = useState<string | null>(null);
  // Q-2.2 (D-604): another firm registered this employer with this PEO, and when; never who. It warns and never blocks the send.
  const [elsewhere, setElsewhere] = useState<string | null>(null);
  const replyDomain = quoteReplyDomain();
  const { beforeSend, choice } = useFirstSend({
    returnTo: p.returnTo,
    // Only with an address that receives: with receiving off there is none to put in CC (quoteReplyDomain).
    ownMail: context?.reply_address && replyDomain ? { replyAddress: replyAddress(context.reply_address, replyDomain), onSendYourself: p.onSendYourself } : undefined,
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadPeoSendContext(p.sessionId, p.peo).then(
      (c) => !cancelled && setContext(c),
      (err) => !cancelled && setProblem(failureWords(err, "We couldn't load the PEO's contacts.")),
    );
    // Unread, there is simply no warning: the send never waits on it.
    loadRegisteredElsewhere(p.sessionId).then((rows) => !cancelled && setElsewhere(registeredElsewhereWords(rows, p.peo)), () => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, p.sessionId, p.peo]);

  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await sendToPeo({
        sessionId: p.sessionId, peo: p.peo, to: [...picked, ...typed(others)], subject, note, issueLink: p.issueLink, ...(update ? { update: true } : {}),
      });
      setQueued(`Queued to ${p.peo} from ${context?.mailbox.address ?? "your mailbox"}. It is on the ${p.peo} thread, and in your Sent folder once it goes.`);
      setOpen(false);
      p.onSent();
    } catch (err) {
      setProblem(failureWords(err, "The send didn't go through. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (email: string) => setPicked((now) => (now.includes(email) ? now.filter((x) => x !== email) : [...now, email]));

  return (
    <div className="space-y-2">
      {queued && <p role="status" className="text-sm">{queued}</p>}
      {/* M-2.3: offered, never sent on its own; nothing goes until the advisor sends it. */}
      {update && !queued && <p className="text-sm">{`${p.peo} has version ${p.updateFrom}. Version ${p.version} is certified.`}</p>}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 px-4 rounded-md border border-primary text-primary text-sm font-medium">
          {title}
        </button>
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
          {elsewhere && <p role="note" className="text-xs text-warning">{elsewhere}</p>}
          {context && context.contacts.length > 0 && (
            <fieldset className="space-y-1">
              <legend className="text-xs text-muted-foreground">{`To, at ${p.peo}`}</legend>
              {context.contacts.map((c) => (
                <label key={c.email} className="flex items-center gap-2 min-h-11">
                  <input type="checkbox" checked={picked.includes(c.email)} onChange={() => toggle(c.email)} />
                  <span>{`${c.name}${c.role ? `, ${c.role}` : ""} (${c.email})`}</span>
                </label>
              ))}
            </fieldset>
          )}
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Other addresses</span>
            <input value={others} onChange={(e) => setOthers(e.target.value)} className="w-full min-h-11 bg-muted border border-border rounded-md px-3" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Subject</span>
            <input value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} className="w-full min-h-11 bg-muted border border-border rounded-md px-3" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Your note</span>
            <textarea value={note} maxLength={50000} rows={5} onChange={(e) => setNote(e.target.value)} className="w-full bg-muted border border-border rounded-md px-3 py-2" />
          </label>
          <section aria-label="Added under your note" className="rounded-md bg-muted p-2 text-xs text-muted-foreground space-y-0.5">
            <p className="font-medium">Added under your note; you can't change it. The PEO gets a link, never the files.</p>
            {update && <p>{`What changed since version ${p.updateFrom}: each answer by its name and the census by count, never a value`}</p>}
            {peoSendBlockPreview({ fileId: p.fileId, version: p.version, openItems: p.openItems }).map((line) => <p key={line}>{line}</p>)}
            <p className="italic">{DRAFT_WORDING_NOTICE}</p>
          </section>
          {problem && <p role="alert" className="text-xs text-destructive">{problem}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="min-h-11 px-4 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Send
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="min-h-11 px-4 rounded-md border border-border">Cancel</button>
          </div>
        </form>
      )}
      {choice}
    </div>
  );
};

export default SendToPeo;
