import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ChamberData } from "@/data/chamberTypes";
import {
  correctionInput,
  parseCorrection,
  REVIEW_LABELS,
  REVIEW_STATES,
  type FieldReview,
  type ReviewMap,
  type ReviewState,
} from "@/data/advisor";
import {
  describeSource,
  FIELD_LABELS,
  formatFieldValue,
  STATUS_LABELS,
  type FieldKey,
  type ProvenanceMap,
} from "@/data/provenance";
import { reviewField, type CorrectionChange } from "@/lib/advisorApi";
import { formatDateTime } from "./format";

const FIELDS = Object.keys(FIELD_LABELS) as FieldKey[];

const REVIEW_CLASS: Record<ReviewState, string> = {
  verified: "bg-success/15 text-success border-success/40",
  incomplete: "bg-warning/15 text-warning border-warning/40",
  follow_up: "bg-destructive/15 text-destructive border-destructive/40",
};

interface FieldReviewPanelProps {
  sessionId: string;
  data: ChamberData;
  provenance: ProvenanceMap;
  reviews: ReviewMap;
  /** Messages that exist in the transcript, so evidence links never point nowhere. */
  messageIds: Set<string>;
  onShowMessage: (messageId: string) => void;
  onChanged: () => void;
}

const FieldReviewPanel = (props: FieldReviewPanelProps) => {
  const reviewed = FIELDS.filter((f) => props.reviews[f]?.review_state === "verified").length;
  return (
    <section aria-labelledby="fields-heading" className="border border-border rounded-xl">
      <div className="p-5 border-b border-border">
        <h2 id="fields-heading" className="font-display text-lg font-bold">Captured fields</h2>
        <p className="text-xs text-muted-foreground">
          {reviewed} of {FIELDS.length} verified.{" "}
          Prospect values are never changed here. A correction is kept beside the prospect's value and is used in the
          advisor Manuscript once the field is marked Verified.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {FIELDS.map((field) => (
          <FieldRow key={field} field={field} {...props} />
        ))}
      </ul>
    </section>
  );
};

const FieldRow = ({
  field,
  sessionId,
  data,
  provenance,
  reviews,
  messageIds,
  onShowMessage,
  onChanged,
}: FieldReviewPanelProps & { field: FieldKey }) => {
  const review: FieldReview | undefined = reviews[field];
  const prov = provenance[field];
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");
  const label = FIELD_LABELS[field];
  const correctable = field !== "employees";
  const source = prov?.source;
  const messageId = source?.kind === "transcript" && messageIds.has(source.message_id) ? source.message_id : null;

  const save = async (state: ReviewState | null, correction: CorrectionChange, why = "") => {
    setSaving(true);
    try {
      await reviewField(sessionId, field, state, correction, why);
      setEditing(false);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const submitCorrection = () => {
    const parsed = parseCorrection(field, draft);
    if (!parsed) {
      toast.error(`That isn't a valid value for ${label.toLowerCase()}.`);
      return;
    }
    if (!reason.trim()) {
      toast.error("Give a reason for the correction.");
      return;
    }
    // A fresh correction needs verifying before it's used, unless the advisor already marked it.
    void save(review?.review_state ?? "follow_up", { kind: "set", value: parsed.value }, reason);
  };

  return (
    <li className="p-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]" data-testid={`field-${field}`}>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm">{formatFieldValue(data[field])}</p>
        {prov ? (
          <p className="text-xs text-muted-foreground mt-1">
            <span className="mr-1">{STATUS_LABELS[prov.status]} ·</span>
            {describeSource(prov.source)}
            {messageId && (
              <button onClick={() => onShowMessage(messageId)} className="ml-1 text-primary underline">
                View in transcript
              </button>
            )}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">No source recorded</p>
        )}
        {prov?.status === "conflicting" && prov.candidates && (
          <p className="text-xs text-destructive mt-1">
            Conflicting answers: {prov.candidates.map((c) => formatFieldValue(c.value)).join(" vs ")}
          </p>
        )}
      </div>

      <div>
        {review?.has_correction && (
          <div className="text-sm">
            <p className="text-xs text-muted-foreground">Advisor correction</p>
            <p className="font-mono">{formatFieldValue(review.corrected_value)}</p>
            {review.reason && <p className="text-xs text-muted-foreground italic">{review.reason}</p>}
            {review.review_state !== "verified" && (
              <p className="text-xs text-warning">Not used until verified</p>
            )}
          </div>
        )}
        {review && (
          <p className="text-xs text-muted-foreground mt-1">
            {review.updated_by_email ?? "Advisor"} · {formatDateTime(review.updated_at)}
          </p>
        )}
        {editing && (
          <div className="space-y-2 mt-2">
            <label className="block text-xs text-muted-foreground">
              Corrected value
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="mt-1 w-full bg-muted border border-border rounded-md px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Reason
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={2000}
                className="mt-1 w-full bg-muted border border-border rounded-md px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={submitCorrection}
                disabled={saving}
                className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50"
              >
                Save correction
              </button>
              <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap md:flex-col gap-1.5 md:items-end">
        <div className="flex gap-1" role="group" aria-label={`Review ${label}`}>
          {REVIEW_STATES.map((state) => {
            const active = review?.review_state === state;
            return (
              <button
                key={state}
                aria-pressed={active}
                disabled={saving}
                onClick={() => void save(active ? null : state, { kind: "keep" })}
                className={`text-xs px-2 py-1 rounded-md border transition-colors disabled:opacity-50 ${
                  active ? REVIEW_CLASS[state] : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {REVIEW_LABELS[state]}
              </button>
            );
          })}
        </div>
        {correctable && !editing && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setDraft(correctionInput(review?.has_correction ? review.corrected_value : data[field]));
                setReason(review?.reason ?? "");
                setEditing(true);
              }}
              className="text-xs text-primary underline"
            >
              {review?.has_correction ? "Change correction" : "Correct"}
            </button>
            {review?.has_correction && (
              <button
                onClick={() => {
                  const why = window.prompt("Why remove this correction?");
                  if (why?.trim()) void save(review.review_state, { kind: "clear" }, why);
                }}
                className="text-xs text-muted-foreground underline"
              >
                Remove correction
              </button>
            )}
          </div>
        )}
        {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
    </li>
  );
};

export default FieldReviewPanel;
