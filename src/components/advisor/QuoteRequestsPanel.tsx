import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { actorName, formatDateTime } from "./format";
import { toast } from "sonner";
import { PIPELINE_LABELS, type PipelineStatus } from "@/data/advisor";
import { hasNewMail } from "@/data/mailThread";
import { cleanPeoName, findPeo, listedPeos, PEO_NAME_MAX, peoFit, type PeoRecord } from "@/data/peoCatalog";
import type { ChamberData } from "@/data/chamberTypes";
import { localToday, staleProfileWarning } from "@/data/peoProfiles";
import EligibilityChecks from "@/components/peo/EligibilityChecks";
import {
  canRecordSend, describeQuote, describeQuoteRequestEvent, formatDay, isChangeLogEvent, isQuoteNoteKind, isQuoteRequestStatus, olderVersionNote,
  QUOTE_NOTE_KIND_LABELS, QUOTE_NOTE_KINDS, QUOTE_NOTE_MAX, QUOTE_REQUEST_LABELS, quoteNoteKindLabel, quoteReplyDomain, replyAddress, stageToOffer,
  type QuoteNoteKind,
} from "@/data/quoteRequests";
import {
  addQuoteRequestNote, correctQuoteRequestNote, recordQuoteSend, reissueQuoteRequestAddress, setStatus, updateQuoteRequest,
  type QuoteAnswer, type QuoteRequestAddressRow, type QuoteRequestEventRow, type QuoteRequestMessageRow, type QuoteRequestNoteRow, type QuoteRequestRow,
  type QuoteRequestThreadReadRow,
} from "@/lib/advisorApi";

interface QuoteRequestsPanelProps {
  sessionId: string;
  prospectUserId: string;
  status: PipelineStatus;
  /** The submission's latest certified version; null before the first certification. */
  currentVersion: number | null;
  requests: readonly QuoteRequestRow[];
  events: readonly QuoteRequestEventRow[];
  /** What happened on those quote requests outside the product, the latest day first. */
  notes: readonly QuoteRequestNoteRow[];
  /** Each quote request's live reply address: the part before the @. */
  addresses: readonly QuoteRequestAddressRow[];
  /** The mail on the quote requests and when each thread was last opened, for the "new PEO mail" mark. */
  mail?: readonly QuoteRequestMessageRow[];
  threadReads?: readonly QuoteRequestThreadReadRow[];
  /** The subdomain that receives mail; null keeps reply addresses off. The app's setting unless a test supplies one. */
  replyDomain?: string | null;
  /** The answers the advisor sees, to compare with each listed PEO's sourced facts. */
  data: ChamberData;
  /** The PEOs the database holds, alphabetically, with their profiles in use (usePeoCatalog); only listed ones are offered. */
  catalog: readonly PeoRecord[];
  /** Opens Ask the prospect with an underwriter's question in it, for the advisor to edit and send as their own. */
  onAskProspect: (question: string) => void;
  onChanged: () => void;
}

const inputClass = "w-full bg-muted border border-border rounded-md px-3 py-2 text-sm";

const ANSWERS: { value: QuoteAnswer["status"]; label: string }[] = [
  { value: "quoted", label: "Quoted" },
  { value: "declined", label: "Declined" },
  { value: "closed", label: "Closed (withdrawn, expired, or the employer went elsewhere)" },
];

/** Records what one PEO answered. A quote has dates and a fee; a decline or a closure has only a note. */
const AnswerForm = ({ request, onSaved, onCancel }: { request: QuoteRequestRow; onSaved: (status: QuoteAnswer["status"]) => void; onCancel: () => void }) => {
  const id = `answer-${request.id}`;
  const [status, setStatusValue] = useState<QuoteAnswer["status"]>(request.status === "declined" ? "declined" : "quoted");
  const [fee, setFee] = useState(request.admin_fee_pepm === null ? "" : String(request.admin_fee_pepm));
  const [receivedOn, setReceivedOn] = useState(request.quote_received_on ?? "");
  const [expiresOn, setExpiresOn] = useState(request.quote_expires_on ?? "");
  const [startOn, setStartOn] = useState(request.proposed_start_on ?? "");
  const [note, setNote] = useState(request.note ?? "");
  const [saving, setSaving] = useState(false);
  const quoted = status === "quoted";

  const save = async () => {
    setSaving(true);
    try {
      await updateQuoteRequest(request.id, {
        status,
        receivedOn: quoted ? receivedOn || null : null,
        expiresOn: quoted ? expiresOn || null : null,
        startOn: quoted ? startOn || null : null,
        adminFeePepm: quoted && fee.trim() !== "" ? Number(fee) : null,
        note: note.trim() || null,
      });
      toast.success(`Recorded ${request.peo_name}'s answer.`);
      onSaved(status);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 pt-2">
      <label htmlFor={`${id}-status`} className="block text-xs text-muted-foreground">Answer</label>
      <select id={`${id}-status`} value={status} onChange={(e) => setStatusValue(e.target.value as QuoteAnswer["status"])} className={inputClass}>
        {ANSWERS.map((a) => (
          <option key={a.value} value={a.value}>{a.label}</option>
        ))}
      </select>
      {quoted && (
        <>
          <label htmlFor={`${id}-fee`} className="block text-xs text-muted-foreground">Admin fee per employee per month ($)</label>
          <input id={`${id}-fee`} type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className={inputClass} />
          <label htmlFor={`${id}-received`} className="block text-xs text-muted-foreground">Received on</label>
          <input id={`${id}-received`} type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className={inputClass} />
          <label htmlFor={`${id}-expires`} className="block text-xs text-muted-foreground">Expires on</label>
          <input id={`${id}-expires`} type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputClass} />
          <label htmlFor={`${id}-start`} className="block text-xs text-muted-foreground">Proposed start</label>
          <input id={`${id}-start`} type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} className={inputClass} />
        </>
      )}
      <label htmlFor={`${id}-note`} className="block text-xs text-muted-foreground">Note</label>
      <textarea id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={2} className={inputClass} />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-1.5 rounded-md disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save answer
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-md border border-border text-sm">Cancel</button>
      </div>
    </div>
  );
};

/**
 * The address to put in CC when emailing a PEO from one's own mail, so the message and the PEO's replies reach
 * this quote request. An advisor can revoke it and issue a new one, after which the old one stops working.
 */
const ReplyAddress = ({ request, address, onChanged }: { request: QuoteRequestRow; address: string; onChanged: () => void }) => {
  const id = `reply-address-${request.id}`;
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied");
    } catch {
      toast.error("Couldn't copy the address. Select it and copy it instead.");
    }
  };
  const reissue = async () => {
    setSaving(true);
    try {
      await reissueQuoteRequestAddress(request.id);
      toast.success(`Issued a new address for ${request.peo_name}.`);
      setConfirming(false);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-1 rounded-md border border-border p-2">
      <label htmlFor={id} className="block text-xs text-muted-foreground">Reply address</label>
      <div className="flex gap-2">
        <input id={id} readOnly value={address} onFocus={(e) => e.target.select()} className={`${inputClass} font-mono text-xs min-w-0`} />
        <button onClick={copy} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium shrink-0">Copy</button>
      </div>
      <p className="text-xs text-muted-foreground">
        Put this address in CC when you email {request.peo_name} from your own mail. Your message and their replies then reach this quote request.
      </p>
      {confirming ? (
        <div role="alert" className="text-xs space-y-1">
          <p>Issue a new address? Mail sent to this one will no longer reach this quote request, so {request.peo_name} has to be given the new one.</p>
          <div className="flex gap-2">
            <button onClick={reissue} disabled={saving} className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />} Issue a new address
            </button>
            <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded-md border border-border">Keep this one</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="text-xs text-primary underline">Revoke and issue a new address</button>
      )}
    </div>
  );
};

/**
 * Adds a note for something that happened outside the product (a call, a portal entry, an email sent elsewhere,
 * an underwriter's question), or corrects one. A note leaves the quote request as it is: it never records a send.
 */
const NoteForm = ({ request, note, onSaved, onCancel }: { request: QuoteRequestRow; note?: QuoteRequestNoteRow; onSaved: () => void; onCancel: () => void }) => {
  const id = note ? `note-${note.id}` : `new-note-${request.id}`;
  const [kind, setKind] = useState<QuoteNoteKind>(note && isQuoteNoteKind(note.kind) ? note.kind : "call");
  const [notedOn, setNotedOn] = useState(note?.noted_on ?? localToday());
  const [body, setBody] = useState(note?.body ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      if (note) await correctQuoteRequestNote(note.id, { kind, notedOn, body });
      else await addQuoteRequestNote(request.id, { kind, notedOn, body });
      toast.success(note ? "Corrected the note." : `Added a note on ${request.peo_name}.`);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-2 pt-2">
      <label htmlFor={`${id}-kind`} className="block text-xs text-muted-foreground">Kind</label>
      <select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value as QuoteNoteKind)} className={inputClass}>
        {QUOTE_NOTE_KINDS.map((k) => <option key={k} value={k}>{QUOTE_NOTE_KIND_LABELS[k]}</option>)}
      </select>
      <label htmlFor={`${id}-date`} className="block text-xs text-muted-foreground">Date it happened</label>
      <input id={`${id}-date`} type="date" value={notedOn} max={localToday()} onChange={(e) => setNotedOn(e.target.value)} className={inputClass} />
      <label htmlFor={`${id}-body`} className="block text-xs text-muted-foreground">Note</label>
      <textarea id={`${id}-body`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={QUOTE_NOTE_MAX} rows={2} className={inputClass} />
      <p className="text-xs text-muted-foreground">
        {kind === "email_elsewhere"
          ? "A note doesn't record a send. If the packet went out, use Record a send below."
          : kind === "underwriter_question"
            ? "To ask the prospect, use Ask the prospect on the saved note."
            : "A note leaves the quote request's status as it is."}
      </p>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || body.trim() === "" || !notedOn} className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-1.5 rounded-md disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} {note ? "Save correction" : "Save note"}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-md border border-border text-sm">Cancel</button>
      </div>
    </div>
  );
};

/**
 * The PEOs this submission went to, what each answered, and the notes on what happened outside the product.
 * Advisors send the packet outside the product and record it here; the prospect never sees any of it.
 */
const QuoteRequestsPanel = ({ sessionId, prospectUserId, status, requests, events, notes, addresses, mail = [], threadReads = [], replyDomain = quoteReplyDomain(), currentVersion, data, catalog, onAskProspect, onChanged }: QuoteRequestsPanelProps) => {
  const [catalogPeo, setCatalogPeo] = useState("");
  const [otherPeo, setOtherPeo] = useState("");
  // Today in the advisor's own calendar, as a date input holds it.
  const [sentOn, setSentOn] = useState(localToday);
  const [saving, setSaving] = useState(false);
  // The pipeline step offered after a send or a quote, until the advisor takes it or says not now.
  const [offer, setOffer] = useState<PipelineStatus | null>(null);
  // The quote request whose answer is being recorded.
  const [answering, setAnswering] = useState<number | null>(null);
  // The quote request a note is being added to, and the note being corrected.
  const [noting, setNoting] = useState<number | null>(null);
  const [correcting, setCorrecting] = useState<number | null>(null);
  const peo = cleanPeoName(catalogPeo || otherPeo);
  // The PEO chosen to record a send to, when it is one we list: a stale profile is still sent to, with a warning.
  const chosen = catalogPeo ? findPeo(catalog, catalogPeo) : undefined;
  const chosenStale = chosen ? staleProfileWarning(chosen, localToday()) : null;
  // Whether the PEO being recorded is the one the employer says it is in now, names compared ignoring case and spacing.
  const sameName = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");
  const isCurrentPeo = data.in_peo !== false && Boolean(peo) && Boolean(data.current_peo) && sameName(peo, data.current_peo ?? "");

  const move = async (to: PipelineStatus) => {
    setOffer(null);
    try {
      await setStatus(sessionId, to, "");
      toast.success(`Status changed to ${PIPELINE_LABELS[to]}.`);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const send = async () => {
    if (!peo) return;
    setSaving(true);
    try {
      await recordQuoteSend(sessionId, peo, sentOn);
      toast.success(`Recorded the send to ${peo}.`);
      setOffer(stageToOffer("send", status));
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="quote-requests-heading" className="border border-border rounded-xl p-5 space-y-4">
      <h2 id="quote-requests-heading" className="font-display text-lg font-bold">Quote requests</h2>
      {offer && (
        <div role="status" className="flex flex-wrap items-center gap-2 text-sm border border-primary/40 rounded-md p-2">
          <span className="flex-1">Move the submission on?</span>
          <button onClick={() => move(offer)} className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs">
            Move to {PIPELINE_LABELS[offer]}
          </button>
          <button onClick={() => setOffer(null)} className="px-2 py-1 rounded-md border border-border text-xs">Not now</button>
        </div>
      )}
      <ul className="space-y-3">
        {requests.map((r) => {
          const quote = r.status === "quoted" ? describeQuote(r) : "";
          const older = olderVersionNote(r, currentVersion);
          // The same checks the prospect saw on PEO Match, for a PEO the catalog holds.
          const listed = findPeo(catalog, r.peo_name);
          // A stale profile is still read, with when it was last checked (src/data/peoProfiles.ts).
          const stale = listed ? staleProfileWarning(listed, localToday()) : null;
          // Shown only while a receiving subdomain is set: an address that can't receive would bounce.
          const local = replyDomain ? addresses.find((a) => a.quote_request_id === r.id && a.revoked_at === null)?.local_part : undefined;
          return (
            <li key={r.id} data-testid={`quote-request-${r.id}`} className="border-l-2 border-border pl-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.peo_name}</span>
                <span className="flex items-center gap-1.5">
                  {hasNewMail(r.id, mail, threadReads) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-semibold whitespace-nowrap">New PEO mail</span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                    {isQuoteRequestStatus(r.status) ? QUOTE_REQUEST_LABELS[r.status] : r.status}
                  </span>
                </span>
              </div>
              {r.sent_on && (
                <p className="text-xs text-muted-foreground">
                  {`Sent ${formatDay(r.sent_on)}${r.sent_version !== null ? ` · version ${r.sent_version}` : ""}`}
                </p>
              )}
              {older && (
                <p className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning inline-block">{older}</p>
              )}
              {listed && <EligibilityChecks peo={listed.name} checks={peoFit(data, listed, localToday())} />}
              {stale && (
                <p className="text-xs text-warning flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" aria-hidden="true" />
                  {stale}
                </p>
              )}
              {quote && <p className="text-sm">{quote}</p>}
              {local && replyDomain && <ReplyAddress request={r} address={replyAddress(local, replyDomain)} onChanged={onChanged} />}
              {r.note && <p className="text-xs text-muted-foreground italic">{r.note}</p>}
              {answering === r.id ? (
                <AnswerForm
                  request={r}
                  onCancel={() => setAnswering(null)}
                  onSaved={(answered) => {
                    setAnswering(null);
                    setOffer(answered === "quoted" ? stageToOffer("quote", status) : null);
                    onChanged();
                  }}
                />
              ) : noting === r.id ? (
                <NoteForm
                  request={r}
                  onCancel={() => setNoting(null)}
                  onSaved={() => {
                    setNoting(null);
                    onChanged();
                  }}
                />
              ) : (
                <div className="flex gap-3">
                  {r.status !== "closed" && (
                    <button onClick={() => setAnswering(r.id)} className="text-xs text-primary underline">Record answer</button>
                  )}
                  <button onClick={() => setNoting(r.id)} className="text-xs text-primary underline">Add a note</button>
                </div>
              )}
              <ul aria-label={`${r.peo_name} notes`} className="space-y-2 pt-1">
                {notes.filter((n) => n.quote_request_id === r.id).map((n) => (
                  <li key={n.id} data-testid={`quote-note-${n.id}`} className="text-xs rounded-md bg-muted px-2 py-1.5 space-y-1">
                    {correcting === n.id ? (
                      <NoteForm
                        request={r}
                        note={n}
                        onCancel={() => setCorrecting(null)}
                        onSaved={() => {
                          setCorrecting(null);
                          onChanged();
                        }}
                      />
                    ) : (
                      <>
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">{quoteNoteKindLabel(n.kind)}</span> · {formatDay(n.noted_on)} · {actorName(n.created_by, n.created_by_email, prospectUserId)}
                          {events.some((e) => e.note_id === n.id) && " · corrected"}
                        </p>
                        <p className="text-sm whitespace-pre-wrap break-words">{n.body}</p>
                        <div className="flex gap-3">
                          <button onClick={() => setCorrecting(n.id)} className="text-primary underline">Correct</button>
                          {n.kind === "underwriter_question" && (
                            <button onClick={() => onAskProspect(n.body)} className="text-primary underline">Ask the prospect</button>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <ol aria-label={`${r.peo_name} history`} className="space-y-1 pt-1">
                {events.filter((e) => e.quote_request_id === r.id && isChangeLogEvent(e)).map((e) => (
                  <li key={e.id} className="text-xs text-muted-foreground">
                    {describeQuoteRequestEvent(e)} · {actorName(e.changed_by, e.changed_by_email, prospectUserId)} · {formatDateTime(e.changed_at)}
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ul>

      {!canRecordSend(status) ? (
        <p className="text-xs text-muted-foreground">Move to Ready for market first.</p>
      ) : (
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Record a send</h3>
        <label htmlFor="quote-peo" className="block text-xs text-muted-foreground">PEO</label>
        <select id="quote-peo" value={catalogPeo} onChange={(e) => setCatalogPeo(e.target.value)} className={inputClass}>
          <option value="">Another PEO (type it below)</option>
          {listedPeos(catalog).map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
        {chosen && <EligibilityChecks peo={chosen.name} checks={peoFit(data, chosen, localToday())} />}
        {chosenStale && (
          <p className="text-xs text-warning flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" aria-hidden="true" />
            {chosenStale}
          </p>
        )}
        {!catalogPeo && (
          <>
            <label htmlFor="quote-other-peo" className="block text-xs text-muted-foreground">Another PEO</label>
            <input
              id="quote-other-peo"
              value={otherPeo}
              onChange={(e) => setOtherPeo(e.target.value)}
              maxLength={PEO_NAME_MAX}
              className={inputClass}
            />
          </>
        )}
        {/* The employer's own PEO (K-1.3): a warning, never a block, as an eligibility check is. */}
        {isCurrentPeo && (
          <p role="alert" className="text-xs text-warning">
            This employer says it is with {data.current_peo} now. Check before sending its packet to its own PEO.
          </p>
        )}
        <label htmlFor="quote-sent-on" className="block text-xs text-muted-foreground">Sent on</label>
        <input id="quote-sent-on" type="date" value={sentOn} onChange={(e) => setSentOn(e.target.value)} className={inputClass} />
        <button
          onClick={send}
          disabled={saving || !peo || !sentOn}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Record send
        </button>
      </div>
      )}
    </section>
  );
};

export default QuoteRequestsPanel;
