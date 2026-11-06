import { useMemo, useState, type ReactNode } from "react";
import { Loader2, PencilLine, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type { ChamberData } from "@/data/chamberTypes";
import {
  AUDIT_BADGE_LABELS,
  AUDIT_BADGES,
  auditBadges,
  correctionInput,
  countAuditBadges,
  isStaleRefusal,
  parseCorrection,
  REVIEW_LABELS,
  REVIEW_STATES,
  type AuditBadge,
  type FieldReview,
  type ReviewMap,
  type ReviewState,
} from "@/data/advisor";
import type { ReviewSection } from "@/data/readiness";
import { REVIEW_FIELDS, REVIEW_SECTIONS } from "@/data/reviewFields";
import {
  describeSource,
  FIELD_LABELS,
  formatFieldValue,
  showsSource,
  STATUS_LABELS,
  type FieldKey,
  type ProvenanceMap,
  visibleAlsoHeard,
} from "@/data/provenance";
import type { Json } from "@/integrations/supabase/types";
import { reviewField, type CorrectionChange } from "@/lib/advisorApi";
import { formatDateTime } from "./format";

// The seven sections of The Manuscript, as the prospect's Review shows them. The census is reviewed in
// Workforce, after its other answers, with its table beneath.
const SECTION_FIELDS: Record<ReviewSection, readonly FieldKey[]> = { ...REVIEW_FIELDS, workforce: [...REVIEW_FIELDS.workforce, "census"] };
const FIELDS: readonly FieldKey[] = REVIEW_SECTIONS.flatMap(({ key }) => SECTION_FIELDS[key]);

const sectionId = (section: ReviewSection) => `advisor-section-${section}`;

const AUDIT_CLASS: Record<AuditBadge, string> = {
  prospect_confirmed: "bg-success/15 text-success border-success/40",
  advisor_overridden: "bg-primary/15 text-primary border-primary/40",
};

const AUDIT_ICON: Record<AuditBadge, typeof UserCheck> = {
  prospect_confirmed: UserCheck,
  advisor_overridden: PencilLine,
};

/** Whose value an answer is: the prospect's own confirmation, or an advisor's verified correction. */
export const AuditBadgeChip = ({ badge, count }: { badge: AuditBadge; count?: number }) => {
  const Icon = AUDIT_ICON[badge];
  return (
    <span
      data-testid={count === undefined ? `audit-${badge}` : `audit-summary-${badge}`}
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${AUDIT_CLASS[badge]}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {AUDIT_BADGE_LABELS[badge]}
      {count !== undefined && <span className="font-mono">· {count}</span>}
    </span>
  );
};

const REVIEW_CLASS: Record<ReviewState, string> = {
  verified: "bg-success/15 text-success border-success/40",
  incomplete: "bg-warning/15 text-warning border-warning/40",
  follow_up: "bg-destructive/15 text-destructive border-destructive/40",
};

interface FieldReviewPanelProps {
  sessionId: string;
  data: ChamberData;
  /** `data` exactly as stored; each review names the stored answer it was made on. */
  storedAnswers: Record<string, Json | undefined>;
  provenance: ProvenanceMap;
  reviews: ReviewMap;
  /** Messages that exist in the transcript, so evidence links never point nowhere. */
  messageIds: Set<string>;
  onShowMessage: (messageId: string) => void;
  onChanged: () => void;
  /** The census table, shown in Workforce under the census's own row. */
  census?: ReactNode;
}

type RowProps = Omit<FieldReviewPanelProps, "census"> & { field: FieldKey; badge: AuditBadge | undefined };

const FieldReviewPanel = ({ census, ...props }: FieldReviewPanelProps) => {
  const badges = useMemo(() => auditBadges(props.data, props.provenance, props.reviews), [props.data, props.provenance, props.reviews]);
  const verified = (fields: readonly FieldKey[]) => fields.filter((f) => props.reviews[f]?.review_state === "verified").length;
  const totals = countAuditBadges(badges, FIELDS);
  return (
    <section aria-labelledby="fields-heading" className="border border-border rounded-xl">
      <div className="p-5 border-b border-border space-y-3">
        <div>
          <h2 id="fields-heading" className="font-display text-lg font-bold">Captured fields</h2>
          <p className="text-xs text-muted-foreground">
            {verified(FIELDS)} of {FIELDS.length} verified.{" "}
            Prospect values are never changed here. A correction is kept beside the prospect's value and is used in the
            advisor packet once the field is marked Verified.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Whose values these are">
          {AUDIT_BADGES.map((badge) => (
            <AuditBadgeChip key={badge} badge={badge} count={totals[badge]} />
          ))}
          <span className="text-xs text-muted-foreground">
            {totals.advisor_overridden > 0
              ? "An overridden answer is replaced by the advisor's correction in the advisor packet."
              : "No advisor correction replaces a prospect's answer."}
          </span>
        </div>
        <nav aria-label="Field sections">
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {REVIEW_SECTIONS.map(({ key, title }) => (
              <li key={key}>
                <a href={`#${sectionId(key)}`} className="text-primary underline">{title}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      {REVIEW_SECTIONS.map(({ key, title }) => {
        const fields = SECTION_FIELDS[key];
        const counts = countAuditBadges(badges, fields);
        return (
          <section
            key={key}
            id={sectionId(key)}
            aria-labelledby={`${sectionId(key)}-title`}
            data-testid={`section-${key}`}
            className="border-b border-border last:border-0 scroll-mt-4"
          >
            <div className="px-5 pt-4 pb-2 flex flex-wrap items-baseline justify-between gap-2 bg-muted/30">
              <h3 id={`${sectionId(key)}-title`} className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                {title}
              </h3>
              <p className="text-[11px] text-muted-foreground" data-testid={`section-summary-${key}`}>
                {verified(fields)} of {fields.length} verified
                {counts.prospect_confirmed > 0 && ` · ${counts.prospect_confirmed} prospect confirmed`}
                {counts.advisor_overridden > 0 && ` · ${counts.advisor_overridden} advisor overridden`}
              </p>
            </div>
            <ul className="divide-y divide-border">
              {fields.map((field) => (
                <FieldRow key={field} field={field} badge={badges[field]} {...props} />
              ))}
            </ul>
            {key === "workforce" && census && <div className="px-5 pb-5">{census}</div>}
          </section>
        );
      })}
    </section>
  );
};

const FieldRow = ({
  field,
  badge,
  sessionId,
  data,
  storedAnswers,
  provenance,
  reviews,
  messageIds,
  onShowMessage,
  onChanged,
}: RowProps) => {
  const review: FieldReview | undefined = reviews[field];
  const prov = provenance[field];
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");
  const label = FIELD_LABELS[field];
  const correctable = field !== "census";
  const source = prov?.source;
  const messageId = source?.kind === "transcript" && messageIds.has(source.message_id) ? source.message_id : null;

  const save = async (state: ReviewState | null, correction: CorrectionChange, why = "") => {
    setSaving(true);
    try {
      await reviewField(sessionId, field, state, correction, why, storedAnswers[field]);
      setEditing(false);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
      // The prospect changed this answer after the page loaded: reload to show the advisor the current one.
      if (isStaleRefusal(err)) onChanged();
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
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          {badge && <AuditBadgeChip badge={badge} />}
        </div>
        <p className="font-mono text-sm">{formatFieldValue(data[field])}</p>
        {prov && !showsSource(data[field]) ? (
          // No answer, so no source: a quote here would stand for nothing the prospect said (QA F11).
          <p className="text-xs text-muted-foreground mt-1">{STATUS_LABELS[prov.status]}</p>
        ) : prov ? (
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
        {prov && visibleAlsoHeard(prov).map((heard, i) => (
          <p key={i} className="text-xs text-muted-foreground mt-1">
            {`Also heard: ${formatFieldValue(heard.value)} — ${describeSource(heard.source)}`}
          </p>
        ))}
      </div>

      <div>
        {review?.answer_changed_at && (
          <p className="text-xs text-warning mb-1" role="status">
            The prospect changed this answer after it was reviewed (it was{" "}
            <span className="font-mono">{formatFieldValue(review.answer_changed_from)}</span>). Review it again.
          </p>
        )}
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
              Reason (printed in the final packet the prospect receives)
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
