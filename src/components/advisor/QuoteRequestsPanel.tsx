import { useState } from "react";
import { Loader2 } from "lucide-react";
import { actorName, formatDateTime } from "./format";
import { toast } from "sonner";
import { PIPELINE_LABELS, type PipelineStatus } from "@/data/advisor";
import { cleanPeoName, PEO_CATALOG, PEO_NAME_MAX, peoFit, type PeoRecord } from "@/data/peoCatalog";
import type { ChamberData } from "@/data/chamberTypes";
import { canRecordSend, describeQuote, describeQuoteRequestEvent, formatDay, isQuoteRequestStatus, olderVersionNote, QUOTE_REQUEST_LABELS, stageToOffer } from "@/data/quoteRequests";
import { noteUnderwriterQuestion, recordQuoteSend, setStatus, updateQuoteRequest, type QuoteAnswer, type QuoteRequestEventRow, type QuoteRequestRow } from "@/lib/advisorApi";

interface QuoteRequestsPanelProps {
  sessionId: string;
  prospectUserId: string;
  status: PipelineStatus;
  /** The submission's latest certified version; null before the first certification. */
  currentVersion: number | null;
  requests: readonly QuoteRequestRow[];
  events: readonly QuoteRequestEventRow[];
  /** The answers the advisor sees, to compare with each listed PEO's sourced facts. */
  data: ChamberData;
  /** The PEOs with sourced facts; the app's catalog unless a test supplies one. */
  catalog?: readonly PeoRecord[];
  /** Opens Ask the prospect with an underwriter's question in it, for the advisor to edit and send as their own. */
  onAskProspect: (question: string) => void;
  onChanged: () => void;
}

/** Today in the advisor's own calendar, as a date input holds it. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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

/** Notes a question the PEO's underwriter asked. It goes on the history and leaves the status as it is. */
const QuestionForm = ({ request, onSaved, onCancel }: { request: QuoteRequestRow; onSaved: () => void; onCancel: () => void }) => {
  const id = `question-${request.id}`;
  const [question, setQuestion] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await noteUnderwriterQuestion(request.id, question);
      toast.success(`Noted ${request.peo_name}'s question.`);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-2 pt-2">
      <label htmlFor={id} className="block text-xs text-muted-foreground">Underwriter's question</label>
      <textarea id={id} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} rows={2} className={inputClass} />
      <p className="text-xs text-muted-foreground">To ask the prospect, use Ask the prospect above.</p>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || question.trim() === ""} className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-1.5 rounded-md disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save question
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-md border border-border text-sm">Cancel</button>
      </div>
    </div>
  );
};

/**
 * The PEOs this submission went to and what each answered. Advisors send the packet outside the product and record
 * it here; the prospect never sees any of it.
 */
const QuoteRequestsPanel = ({ sessionId, prospectUserId, status, requests, events, currentVersion, data, catalog = PEO_CATALOG, onAskProspect, onChanged }: QuoteRequestsPanelProps) => {
  const [catalogPeo, setCatalogPeo] = useState("");
  const [otherPeo, setOtherPeo] = useState("");
  const [sentOn, setSentOn] = useState(today);
  const [saving, setSaving] = useState(false);
  // The pipeline step offered after a send or a quote, until the advisor takes it or says not now.
  const [offer, setOffer] = useState<PipelineStatus | null>(null);
  // The quote request whose answer is being recorded.
  const [answering, setAnswering] = useState<number | null>(null);
  const [asking, setAsking] = useState<number | null>(null);
  const peo = cleanPeoName(catalogPeo || otherPeo);
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
          // The same warnings the prospect saw on PEO Match, for a PEO whose facts are listed.
          const listed = catalog.find((p) => p.name.toLowerCase() === r.peo_name.toLowerCase());
          const misfits = listed ? peoFit(data, listed).filter((c) => c.status === "does_not_meet") : [];
          return (
            <li key={r.id} data-testid={`quote-request-${r.id}`} className="border-l-2 border-border pl-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.peo_name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                  {isQuoteRequestStatus(r.status) ? QUOTE_REQUEST_LABELS[r.status] : r.status}
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
              {misfits.length > 0 && (
                <div role="alert" className="text-xs rounded-md bg-warning/10 text-warning px-2 py-1">
                  {misfits.map((m) => <p key={m.label}>{m.label}</p>)}
                </div>
              )}
              {quote && <p className="text-sm">{quote}</p>}
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
              ) : asking === r.id ? (
                <QuestionForm
                  request={r}
                  onCancel={() => setAsking(null)}
                  onSaved={() => {
                    setAsking(null);
                    onChanged();
                  }}
                />
              ) : (
                <div className="flex gap-3">
                  {r.status !== "closed" && (
                    <button onClick={() => setAnswering(r.id)} className="text-xs text-primary underline">Record answer</button>
                  )}
                  <button onClick={() => setAsking(r.id)} className="text-xs text-primary underline">Note a question</button>
                </div>
              )}
              <ol aria-label={`${r.peo_name} history`} className="space-y-1 pt-1">
                {events.filter((e) => e.quote_request_id === r.id).map((e) => (
                  <li key={e.id} className="text-xs text-muted-foreground">
                    {describeQuoteRequestEvent(e)} · {actorName(e.changed_by, e.changed_by_email, prospectUserId)} · {formatDateTime(e.changed_at)}
                    {e.field === "underwriter_question" && e.new_value && (
                      <>
                        {" · "}
                        <button onClick={() => onAskProspect(e.new_value!)} className="text-primary underline">Ask the prospect</button>
                      </>
                    )}
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
          {PEO_CATALOG.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
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
