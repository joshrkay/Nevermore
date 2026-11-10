import { useMemo, useState } from "react";
import { Loader2, MailQuestion, X } from "lucide-react";
import { toast } from "sonner";
import {
  canRequestInformation,
  followUpFieldsOf,
  INFORMATION_REQUEST_MAX,
  PIPELINE_LABELS,
  REQUESTABLE_FIELDS,
  type PipelineStatus,
  type ReviewMap,
} from "@/data/advisor";
import { FIELD_LABELS, type FieldKey } from "@/data/provenance";
import { requestInformation, type InformationRequestRow } from "@/lib/advisorApi";
import { actorName, formatDateTime } from "./format";

interface InformationRequestPanelProps {
  sessionId: string;
  prospectUserId: string;
  status: PipelineStatus;
  /** The prospect has certified this intake at least once. */
  certifiedOnce: boolean;
  intakeStatus: string;
  reviews: ReviewMap;
  requests: readonly InformationRequestRow[];
  /** A message to start from, such as an underwriter's question the advisor chose to ask. */
  initialMessage?: string;
  onChanged: () => void;
}

const labelOf = (field: string) => FIELD_LABELS[(field === "employees" ? "census" : field) as FieldKey] ?? field;

/** Why a request can't be sent now, in the advisor's terms. */
function blockedReason(status: PipelineStatus, certifiedOnce: boolean, intakeStatus: string): string {
  if (!certifiedOnce) return "Available once the prospect has certified their intake.";
  if (["archived", "revoked", "expired"].includes(intakeStatus)) return "This intake is closed, so the prospect can't answer a request on it.";
  return `A submission at ${PIPELINE_LABELS[status]} can't move to ${PIPELINE_LABELS.information_requested}.`;
}

/**
 * Asks the prospect for more information: a message and the answers it is about, which start as the fields
 * marked Needs follow-up. Sending emails the prospect (to their account's address), shows the request in their
 * intake, and moves the submission to Information requested; certifying again answers it. Earlier requests are
 * listed below, newest first.
 */
const InformationRequestPanel = ({
  sessionId,
  prospectUserId,
  status,
  certifiedOnce,
  intakeStatus,
  reviews,
  requests,
  initialMessage,
  onChanged,
}: InformationRequestPanelProps) => {
  const followUps = useMemo(() => followUpFieldsOf(reviews), [reviews]);
  const [message, setMessage] = useState(initialMessage ?? "");
  // The selection follows the follow-up marks as the advisor changes them on this page, keeping what the advisor
  // chose here: a follow-up they took out stays out, and an answer they added stays in.
  const [removed, setRemoved] = useState<ReadonlySet<FieldKey>>(new Set());
  const [added, setAdded] = useState<FieldKey[]>([]);
  const fields = useMemo(
    () => [...followUps.filter((f) => !removed.has(f)), ...added.filter((f) => !followUps.includes(f))],
    [followUps, removed, added],
  );
  const remove = (f: FieldKey) => {
    setRemoved((current) => new Set(current).add(f));
    setAdded((current) => current.filter((x) => x !== f));
  };
  const add = (f: FieldKey) => {
    setRemoved((current) => {
      const next = new Set(current);
      next.delete(f);
      return next;
    });
    setAdded((current) => (current.includes(f) ? current : [...current, f]));
  };
  const [saving, setSaving] = useState(false);
  const allowed = canRequestInformation(status, certifiedOnce, intakeStatus);
  const others = REQUESTABLE_FIELDS.filter((f) => !fields.includes(f));

  const send = async () => {
    setSaving(true);
    try {
      await requestInformation(sessionId, message, fields);
      setMessage("");
      toast.success("Request sent. The prospect will get an email and see it in their intake.");
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="information-request-heading" className="border border-border rounded-xl p-5 space-y-3">
      <h2 id="information-request-heading" className="font-display text-lg font-bold flex items-center gap-2">
        <MailQuestion className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        Ask the prospect
      </h2>

      {allowed ? (
        <>
          <p className="text-xs text-muted-foreground">
            Emailed to the prospect and shown in their intake, and the submission moves to{" "}
            {PIPELINE_LABELS.information_requested}. Certifying again answers it. The prospect reads this, so leave out
            employee details.
          </p>
          <label htmlFor="information-request-message" className="block text-xs text-muted-foreground">
            What do you need from them?
          </label>
          <textarea
            id="information-request-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={INFORMATION_REQUEST_MAX}
            rows={4}
            className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-muted-foreground text-right" aria-live="polite">
            {message.length} / {INFORMATION_REQUEST_MAX}
          </p>

          <fieldset className="space-y-2">
            <legend className="text-xs text-muted-foreground">
              About these answers{followUps.length > 0 ? " (the ones marked Needs follow-up to start)" : " (optional)"}
            </legend>
            {fields.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Answers the request is about">
                {fields.map((f) => (
                  <li key={f} className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-2 py-0.5">
                    {labelOf(f)}
                    <button
                      type="button"
                      onClick={() => remove(f)}
                      aria-label={`Remove ${labelOf(f)}`}
                      className="rounded-full p-0.5 hover:bg-background"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">None: the request is about something no answer holds, such as a document.</p>
            )}
            {others.length > 0 && (
              <>
                <label htmlFor="information-request-add" className="sr-only">Add an answer</label>
                <select
                  id="information-request-add"
                  value=""
                  onChange={(e) => {
                    const f = e.target.value as FieldKey;
                    if (f) add(f);
                  }}
                  className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Add an answer…</option>
                  {others.map((f) => (
                    <option key={f} value={f}>{labelOf(f)}</option>
                  ))}
                </select>
              </>
            )}
          </fieldset>

          <button
            onClick={send}
            disabled={saving || message.trim() === ""}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Send request
          </button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{blockedReason(status, certifiedOnce, intakeStatus)}</p>
      )}

      {requests.length > 0 && (
        <div className="pt-2 border-t border-border space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground">Sent to the prospect</h3>
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="text-sm space-y-1">
                <p className="whitespace-pre-wrap">{r.message}</p>
                {r.fields.length > 0 && <p className="text-xs text-muted-foreground">About: {r.fields.map(labelOf).join(", ")}</p>}
                <p className="text-xs text-muted-foreground">
                  {actorName(r.requested_by, r.requested_by_email, prospectUserId)} · {formatDateTime(r.requested_at)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default InformationRequestPanel;
