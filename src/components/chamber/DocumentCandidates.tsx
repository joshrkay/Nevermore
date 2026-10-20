import type { ChamberData } from "@/data/chamberTypes";
import {
  fieldLabel,
  formatValue,
  planCandidateMerge,
  type DocumentCandidate,
  type DocumentExtraction,
} from "@/data/documentCandidates";

interface DocumentCandidatesProps {
  fileName: string;
  extraction: DocumentExtraction;
  data: ChamberData;
  /**
   * Absent when the intake can't be edited from here; candidates are then listed read-only.
   * `replace` is set only for the prospect's explicit "Replace" of an existing answer.
   */
  onApply?: (candidates: DocumentCandidate[], opts: { replace: boolean }) => void;
}

// What Lenore found in one document, side by side with what the intake already holds.
// Nothing is added until the prospect applies it, and an existing answer is only
// replaced through its own "Replace" button.
const DocumentCandidates = ({ fileName, extraction, data, onApply }: DocumentCandidatesProps) => {
  const planned = planCandidateMerge(data, extraction.candidates);
  if (planned.length === 0) return null;
  const pendingNew = planned.filter((p) => p.kind === "new" && !extraction.applied[p.candidate.field]);

  return (
    <div className="mt-2 rounded-lg border border-border bg-card p-3 space-y-2" aria-label={`Found in ${fileName}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Found in <span className="font-medium text-foreground">{fileName}</span>
        </p>
        {onApply && pendingNew.length > 1 && (
          <button
            onClick={() => onApply(pendingNew.map((p) => p.candidate), { replace: false })}
            className="text-xs font-medium text-primary hover:underline"
          >
            Apply all new ({pendingNew.length})
          </button>
        )}
      </div>
      <ul className="divide-y divide-border">
        {planned.map(({ candidate, kind, current }) => {
          const applied = Boolean(extraction.applied[candidate.field]);
          return (
            <li key={candidate.field} className="flex items-start gap-3 py-1.5 text-xs">
              <div className="flex-1 min-w-0">
                <p className="text-muted-foreground">
                  {fieldLabel(candidate.field)}
                  {candidate.location && <span className="ml-1">· {candidate.location}</span>}
                </p>
                <p className="font-mono text-foreground break-words">{formatValue(candidate.field, candidate.value)}</p>
                {kind === "conflict" && !applied && (
                  <p className="text-warning">Your intake has: {formatValue(candidate.field, current)}</p>
                )}
              </div>
              {applied || kind === "same" ? (
                <span className="text-success flex-shrink-0">{applied ? "Applied" : "Already in intake"}</span>
              ) : onApply ? (
                <button
                  onClick={() => onApply([candidate], { replace: kind === "conflict" })}
                  className={`flex-shrink-0 font-medium hover:underline ${kind === "conflict" ? "text-warning" : "text-primary"}`}
                  aria-label={`${kind === "conflict" ? "Replace" : "Apply"} ${fieldLabel(candidate.field)}`}
                >
                  {kind === "conflict" ? "Replace" : "Apply"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default DocumentCandidates;
