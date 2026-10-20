import { useState } from "react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { sanitizeChamberPatch } from "@/data/chamberValidation";
import {
  FIELD_KINDS,
  formatFieldValue,
  type FieldAction,
  type FieldKind,
  type FieldKey,
  type FieldProvenance,
  type FieldSource,
} from "@/data/provenance";

const BADGES: Record<FieldProvenance["status"], { text: string; color: string }> = {
  confirmed: { text: "Confirmed", color: "bg-success/15 text-success" },
  inferred: { text: "Lenore inferred this", color: "border border-warning/50 text-warning" },
  incomplete: { text: "Incomplete", color: "bg-warning/15 text-warning" },
  conflicting: { text: "Conflicting answers", color: "bg-destructive/15 text-destructive" },
};

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
}

const ProvenanceField = ({ label, field, display, raw, provenance, onAction, editable = true, children }: ProvenanceFieldProps) => {
  const kind = field === "employees" ? null : FIELD_KINDS[field];
  const canEdit = Boolean(onAction && editable && kind);
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
  const badge = onAction && status ? BADGES[status] : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>

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
          ) : (
            <input
              aria-label={label}
              aria-invalid={invalid}
              type={kind === "number" ? "number" : "text"}
              min={kind === "number" ? 0 : undefined}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={kind === "list" ? "Comma-separated" : undefined}
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
      ) : (
        <p className="text-xs text-muted-foreground/50 italic">Lenore will fill this in...</p>
      )}

      {!editing && onAction && provenance && display && (
        <p className="text-[10px] text-muted-foreground mt-0.5 break-words">{sourceLine(provenance.source)}</p>
      )}

      {!editing && onAction && status === "conflicting" && provenance?.candidates && (
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
        <div className="flex gap-2 mt-1">
          {display && (status === "inferred" || status === "incomplete") && (
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
        </div>
      )}
    </motion.div>
  );
};

export default ProvenanceField;
