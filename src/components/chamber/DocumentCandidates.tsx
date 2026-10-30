import { useState } from "react";
import type { CensusEmployee, ChamberData } from "@/data/chamberTypes";
import { censusAge, censusGaps, censusPay } from "@/data/census";
import {
  fieldLabel,
  formatValue,
  planCandidateMerge,
  type CandidateResolution,
  type DocumentCandidate,
  type DocumentExtraction,
} from "@/data/documentCandidates";
import type { ProvenanceMap } from "@/data/provenance";
import ConflictResolutionDialog from "./ConflictResolutionDialog";

interface DocumentCandidatesProps {
  fileName: string;
  extraction: DocumentExtraction;
  data: ChamberData;
  provenance?: ProvenanceMap;
  /**
   * Absent when the intake can't be edited from here; candidates are then listed read-only.
   * Called with what the prospect decided: apply new values, or settle a difference in the conflict dialog.
   */
  onResolve?: (resolution: CandidateResolution) => void;
}

const PREVIEW_ROWS = 5;

// What Lenore found in one document, side by side with what the intake already holds. Nothing is
// added until the prospect applies it, and a value that differs from the intake's is only settled
// in the conflict dialog, where the prospect picks which one is right.
const DocumentCandidates = ({ fileName, extraction, data, provenance, onResolve }: DocumentCandidatesProps) => {
  const [conflict, setConflict] = useState<DocumentCandidate | null>(null);
  const planned = planCandidateMerge(data, extraction.candidates);
  const { notes } = extraction;
  if (planned.length === 0 && notes.length === 0) return null;
  const settled = (c: DocumentCandidate) => Boolean(extraction.applied[c.field] || extraction.kept[c.field]);
  const pendingNew = planned.filter((p) => p.kind === "new" && !settled(p.candidate));

  return (
    <div className="mt-2 rounded-lg border border-border bg-card p-3 space-y-2" aria-label={`Found in ${fileName}`}>
      {notes.length > 0 && (
        <ul className="space-y-1 text-xs text-warning" aria-label="About this file">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
      {planned.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Found in <span className="font-medium text-foreground">{fileName}</span>
          </p>
          {onResolve && pendingNew.length > 1 && (
            <button
              onClick={() => onResolve({ type: "apply", candidates: pendingNew.map((p) => p.candidate) })}
              className="text-xs font-medium text-primary hover:underline"
            >
              Apply all new ({pendingNew.length})
            </button>
          )}
        </div>
      )}
      <ul className="divide-y divide-border">
        {planned.map(({ candidate, kind, current }) => {
          const applied = Boolean(extraction.applied[candidate.field]);
          const kept = Boolean(extraction.kept[candidate.field]);
          const done = applied || kept || kind === "same";
          return (
            <li key={candidate.field} className="py-1.5 text-xs">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-muted-foreground">
                    {fieldLabel(candidate.field)}
                    {candidate.location && <span className="ml-1">· {candidate.location}</span>}
                  </p>
                  <p className="font-mono text-foreground break-words">{formatValue(candidate.field, candidate.value)}</p>
                  {kind === "conflict" && !done && (
                    <p className="text-warning">Your intake has: {formatValue(candidate.field, current)}</p>
                  )}
                </div>
                {done ? (
                  <span className={`flex-shrink-0 ${kept ? "text-muted-foreground" : "text-success"}`}>
                    {applied ? "Applied" : kept ? "Kept yours" : "Already in intake"}
                  </span>
                ) : onResolve ? (
                  kind === "conflict" ? (
                    <button
                      onClick={() => setConflict(candidate)}
                      className="flex-shrink-0 font-medium hover:underline text-warning"
                      aria-label={`Resolve ${fieldLabel(candidate.field)}`}
                    >
                      Resolve
                    </button>
                  ) : (
                    <button
                      onClick={() => onResolve({ type: "apply", candidates: [candidate] })}
                      className="flex-shrink-0 font-medium hover:underline text-primary"
                      aria-label={`Apply ${fieldLabel(candidate.field)}`}
                    >
                      Apply
                    </button>
                  )
                ) : null}
              </div>
              {candidate.field === "census" && <CensusPreview rows={candidate.value as CensusEmployee[]} />}
            </li>
          );
        })}
      </ul>
      {onResolve && (
        <ConflictResolutionDialog
          candidate={conflict}
          fileName={fileName}
          data={data}
          provenance={provenance}
          onCancel={() => setConflict(null)}
          onResolve={(r) => {
            setConflict(null);
            onResolve(r);
          }}
        />
      )}
    </div>
  );
};

// The people Lenore read, so the prospect can see the rows before any is added, with the
// underwriting details a row still lacks.
const CensusPreview = ({ rows }: { rows: CensusEmployee[] }) => {
  const incomplete = rows.filter((r) => censusGaps(r).length > 0).length;
  return (
    <div className="mt-1.5 space-y-1" aria-label="Employees found">
      {incomplete > 0 && (
        <p className="text-warning">
          {incomplete} of {rows.length} {incomplete === 1 ? "is" : "are"} missing an age, work state, title, or salary.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pr-2 font-normal">Name</th>
              <th className="pr-2 font-normal">Age</th>
              <th className="pr-2 font-normal">State</th>
              <th className="pr-2 font-normal">Title</th>
              <th className="pr-2 font-normal text-right">Pay</th>
              <th className="font-normal">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, PREVIEW_ROWS).map((r) => (
              <tr key={r.id}>
                <td className="pr-2">{`${r.first_name} ${r.last_name}`.trim()}</td>
                <td className="pr-2 font-mono">{censusAge(r) ?? "—"}</td>
                <td className="pr-2 font-mono">{r.work_state || "—"}</td>
                <td className="pr-2">{r.job_title ?? "—"}</td>
                <td className="pr-2 font-mono text-right">{censusPay(r)}</td>
                <td className="whitespace-nowrap">
                  {r.classification === "1099" ? "1099" : "W-2"}
                  {r.employment_type === "part_time" && " PT"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > PREVIEW_ROWS && <p className="text-muted-foreground">and {rows.length - PREVIEW_ROWS} more</p>}
    </div>
  );
};

export default DocumentCandidates;
