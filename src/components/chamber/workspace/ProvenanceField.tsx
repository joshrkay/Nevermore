import { useState } from "react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { FIELD_CHOICES, formatFein } from "@/data/answerFormat";
import { sanitizeChamberPatch } from "@/data/chamberValidation";
import type { ChamberData } from "@/data/chamberTypes";
import {
  canMarkNotApplicable,
  FIELD_KINDS,
  formatFieldValue,
  showsSource,
  type FieldAction,
  type FieldKind,
  type FieldKey,
  type FieldProvenance,
  type FieldSource,
  verificationSettles,
  visibleAlsoHeard,
} from "@/data/provenance";
import { isRequiredField } from "@/data/readiness";
import { useVerifiedFields } from "./VerifiedFieldsContext";
import { useRequestedFields } from "./RequestedFieldsContext";

const BADGES: Record<FieldProvenance["status"], { text: string; color: string }> = {
  confirmed: { text: "Confirmed", color: "bg-success/15 text-success" },
  inferred: { text: "Lenore captured this — please confirm", color: "border border-warning/50 text-warning" },
  incomplete: { text: "Incomplete", color: "bg-warning/15 text-warning" },
  conflicting: { text: "Conflicting answers", color: "bg-destructive/15 text-destructive" },
  unknown: { text: "Not known yet", color: "border border-warning/50 text-warning" },
  not_applicable: { text: "Doesn't apply", color: "bg-muted text-muted-foreground" },
};

// An advisor verified an answer the prospect hadn't confirmed: it is settled, so no badge asks for a confirmation
// and there are no rival answers to choose between (the Manuscript shows it the same way).
const VERIFIED_BADGE = { text: "Verified by your advisor", color: "bg-success/15 text-success" };

// Statuses that close or park a field without an answer.
const NO_ANSWER_STATUSES: ReadonlySet<FieldProvenance["status"]> = new Set(["unknown", "not_applicable"]);

// Prospect-facing wording; the Manuscript uses describeSource() for advisors.
function sourceLine(source: FieldSource): string {
  switch (source.kind) {
    case "transcript":
      return source.quote ? `From your message: “${source.quote}”` : "From your conversation with Lenore";
    case "document":
      return `From ${source.document_name ?? "an uploaded document"}${source.location ? ` (${source.location})` : ""}`;
    case "prospect_edit":
      return "You confirmed this";
  }
}

const toInput = (kind: FieldKind, raw: unknown): string => {
  if (raw === null || raw === undefined) return "";
  if (kind === "boolean") return raw ? "yes" : "no";
  if (kind === "list" && Array.isArray(raw)) return raw.join(", ");
  if (kind === "fein" && typeof raw === "string") return formatFein(raw);
  return String(raw);
};

const fromInput = (kind: FieldKind, input: string): unknown => {
  const v = input.trim();
  if (kind === "list") return v; // the field schema splits comma-separated text
  if (v === "") return null;
  if (kind === "boolean") return v === "yes";
  return v;
};

interface ProvenanceFieldProps {
  label: string;
  field: FieldKey;
  /** Formatted value, or null when nothing has been captured. */
  display: string | null;
  raw: unknown;
  provenance?: FieldProvenance;
  /** Omit to render read-only (demo mode). */
  onAction?: (action: FieldAction) => void;
  /** False for composite rows whose display isn't a single editable value. */
  editable?: boolean;
  /** Custom rendering for the captured value. */
  children?: ReactNode;
  /** Marks an answer needed before certifying. Defaults to the required answers (src/data/readiness.ts). */
  required?: boolean;
  /** Offers "Doesn't apply" for an unanswered field certification doesn't need (Review only, D28, D31). */
  allowNotApplicable?: boolean;
}

const ProvenanceField = ({ label, field, display, raw, provenance, onAction, editable = true, children, required = isRequiredField(field), allowNotApplicable = false }: ProvenanceFieldProps) => {
  const kind = field === "census" ? null : FIELD_KINDS[field];
  // A table of rows has its own editor (RowsField).
  const canEdit = Boolean(onAction && editable && kind && kind !== "rows");
  const choices = FIELD_CHOICES[field];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  const startEdit = () => {
    setDraft(toInput(kind!, raw));
    setInvalid(false);
    setEditing(true);
  };

  const save = () => {
    const value = fromInput(kind!, draft);
    // Same validation the extraction uses; keep the form open rather than drop the edit.
    if (!(field in sanitizeChamberPatch({ [field]: value }))) {
      setInvalid(true);
      return;
    }
    onAction!({ type: "edit", field, value });
    setEditing(false);
  };

  const status = provenance?.status;
  const verifiedByAdvisor = useVerifiedFields().has(field);
  const requestedByAdvisor = useRequestedFields().has(field);
  // A required answer in conflict still blocks certification whoever verified it, so it keeps its rival answers.
  const settledByAdvisor = verifiedByAdvisor && verificationSettles(status, required);
  // A value the prospect confirmed or typed says so, apart from one Lenore heard stated outright (B-2).
  const badge = onAction && status
    ? settledByAdvisor
      ? VERIFIED_BADGE
      : status === "confirmed" && provenance?.source.kind === "prospect_edit" ? { ...BADGES.confirmed, text: "Confirmed by you" } : BADGES[status]
    // A value with no provenance (typed before provenance existed) the advisor verified is badged too.
    : onAction && verifiedByAdvisor ? VERIFIED_BADGE : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
        {required && (
          <span className="ml-1.5 normal-case tracking-normal font-medium text-primary">Required</span>
        )}
        {requestedByAdvisor && (
          <span className="ml-1.5 normal-case tracking-normal font-medium text-warning">Your advisor asked about this</span>
        )}
      </p>

      {editing ? (
        <form
          className="flex flex-wrap items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {kind === "boolean" ? (
            <select
              aria-label={label}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="text-xs bg-background border border-border rounded px-2 py-1"
            >
              <option value="">Not sure</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          ) : kind === "choice" && choices ? (
            <select
              aria-label={label}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="text-xs bg-background border border-border rounded px-2 py-1"
            >
              <option value="">Not sure</option>
              {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          ) : (
            <input
              aria-label={label}
              aria-invalid={invalid}
              inputMode={kind === "fein" ? "numeric" : undefined}
              type={kind === "number" || kind === "decimal" ? "number" : "text"}
              min={kind === "number" || kind === "decimal" ? 0 : undefined}
              step={kind === "decimal" ? "0.01" : undefined}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={kind === "list" ? "Comma-separated" : kind === "fein" ? "12-3456789" : undefined}
              className="text-xs bg-background border border-border rounded px-2 py-1 min-w-0 flex-1"
            />
          )}
          <button type="submit" className="text-[10px] font-medium px-2 py-1 rounded bg-primary text-primary-foreground">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-[10px] px-2 py-1 rounded text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          {invalid && <p role="alert" className="w-full text-[10px] text-destructive">That doesn't look right. Please check the value.</p>}
        </form>
      ) : display ? (
        <div className="flex flex-wrap items-center gap-2">
          {children ?? <p className="text-sm font-medium">{display}</p>}
          {badge && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.text}</span>}
        </div>
      ) : badge && status && NO_ANSWER_STATUSES.has(status) ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.text}</span>
          {/* A required answer is still needed to certify (src/data/readiness.ts), whatever else is known about it. */}
          {required && <p className="text-xs text-warning">Needed before you can certify.</p>}
        </div>
      ) : required ? (
        <p className="text-xs text-warning">Not provided yet. Needed before you can certify.</p>
      ) : (
        <p className="text-xs text-muted-foreground">Lenore will fill this in...</p>
      )}

      {/* Only an answer has a source (showsSource): a field the prospect hasn't answered is never quoted (QA F11). */}
      {!editing && onAction && provenance && display && showsSource(raw) && (
        <p className="text-[10px] text-muted-foreground mt-0.5 break-words">{sourceLine(provenance.source)}</p>
      )}

      {!editing && onAction && display && provenance && visibleAlsoHeard(provenance, !settledByAdvisor).map((heard, i) => (
        <p key={i} className="text-[10px] text-muted-foreground mt-0.5 break-words">
          {`Also heard: ${formatFieldValue(heard.value)} — ${sourceLine(heard.source)}`}
        </p>
      ))}

      {!editing && onAction && status === "conflicting" && !settledByAdvisor && provenance?.candidates && (
        <ul className="mt-1 space-y-1" aria-label={`Answers for ${label}`}>
          {provenance.candidates.map((c, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="font-medium">{formatFieldValue(c.value)}</span>
              <span className="text-muted-foreground truncate">{sourceLine(c.source)}</span>
              <button
                type="button"
                onClick={() => onAction({ type: "resolve", field, candidate: i })}
                aria-label={`Use ${formatFieldValue(c.value)} for ${label}`}
                className="text-[10px] font-medium px-2 py-0.5 rounded border border-border hover:bg-muted"
              >
                Use this
              </button>
            </li>
          ))}
        </ul>
      )}

      {!editing && onAction && (
        <div className="flex flex-wrap gap-2 mt-1">
          {display && !settledByAdvisor && (status === "inferred" || status === "incomplete") && (
            <button
              type="button"
              onClick={() => onAction({ type: "confirm", field })}
              aria-label={`Confirm ${label}`}
              className="text-[10px] font-medium text-success hover:underline"
            >
              Confirm
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={startEdit} aria-label={`${display ? "Edit" : "Add"} ${label}`} className="text-[10px] text-muted-foreground hover:text-foreground hover:underline">
              {display ? "Edit" : "Add"}
            </button>
          )}
          {/* Only the prospect closes a field this way (D31), and only one they haven't answered. */}
          {allowNotApplicable && status !== "not_applicable" && !display && canMarkNotApplicable(field, { [field]: raw } as unknown as ChamberData) && (
            <button
              type="button"
              onClick={() => onAction({ type: "not_applicable", field })}
              aria-label={`${label} doesn't apply`}
              className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Doesn't apply
            </button>
          )}
          {status === "not_applicable" && (
            <button
              type="button"
              onClick={() => onAction({ type: "reopen", field })}
              aria-label={`Undo: ${label} doesn't apply`}
              className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ProvenanceField;
