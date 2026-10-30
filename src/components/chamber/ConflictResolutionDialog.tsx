import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CensusEmployee, ChamberData } from "@/data/chamberTypes";
import { CENSUS_FACT_LABELS, formatCensusFact } from "@/data/census";
import { MAX_CENSUS_ROWS } from "@/data/census";
import {
  censusMergeFits,
  compareCensus,
  fieldLabel,
  formatValue,
  type CandidateResolution,
  type DocumentCandidate,
} from "@/data/documentCandidates";
import { describeSource, type ProvenanceMap } from "@/data/provenance";

interface ConflictResolutionDialogProps {
  /** The document's value that differs from the intake's; the dialog is open while it's set. */
  candidate: DocumentCandidate | null;
  fileName: string;
  data: ChamberData;
  provenance?: ProvenanceMap;
  onCancel: () => void;
  onResolve: (r: CandidateResolution) => void;
}

type Choice = "current" | "document" | "merge";

const name = (e: CensusEmployee) => `${e.first_name} ${e.last_name}`.trim();
const listNames = (rows: CensusEmployee[], max = 8) =>
  rows.length <= max ? rows.map(name).join(", ") : `${rows.slice(0, max).map(name).join(", ")} and ${rows.length - max} more`;

// When a document says something different from the intake, the prospect decides which is right.
// Nothing changes until they confirm; whichever value they keep is recorded as confirmed.
const ConflictResolutionDialog = ({ candidate, fileName, data, provenance = {}, onCancel, onResolve }: ConflictResolutionDialogProps) => {
  const isCensus = candidate?.field === "census";
  // Two censuses that each fit can merge into one the intake can't hold.
  const mergeFits = !isCensus || censusMergeFits(data.census, candidate.value as CensusEmployee[], candidate.stated);
  const [choice, setChoice] = useState<Choice | null>(null);
  // A census defaults to merging, the choice that loses nothing, when it fits; a single value has no default.
  useEffect(() => setChoice(isCensus && mergeFits ? "merge" : null), [candidate, isCensus, mergeFits]);

  if (!candidate) return null;

  const confirm = () => {
    if (choice === "current") onResolve({ type: "keep_current", candidate });
    else if (choice === "document") onResolve({ type: "use_document", candidate });
    else if (choice === "merge") onResolve({ type: "merge_census", candidate });
  };

  const from = `From ${fileName}${candidate.location ? ` (${candidate.location})` : ""}`;
  const source = provenance[candidate.field]?.source;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg">
        {isCensus ? (
          <CensusChoice candidate={candidate} fileName={fileName} current={data.census} choice={choice} onChoose={setChoice} mergeFits={mergeFits} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Which {fieldLabel(candidate.field).toLowerCase()} is right?</DialogTitle>
              <DialogDescription>
                Your intake and {fileName} disagree. Choose the one to keep; it will be marked as confirmed by you.
              </DialogDescription>
            </DialogHeader>
            <fieldset className="space-y-2">
              <legend className="sr-only">{fieldLabel(candidate.field)}</legend>
              <Option
                value="current"
                checked={choice === "current"}
                onChoose={setChoice}
                title={formatValue(candidate.field, data[candidate.field])}
                detail={source ? describeSource(source) : "In your intake"}
              />
              <Option
                value="document"
                checked={choice === "document"}
                onChoose={setChoice}
                title={formatValue(candidate.field, candidate.value)}
                detail={from}
              />
            </fieldset>
          </>
        )}
        <DialogFooter className="gap-2">
          <button onClick={onCancel} className="border border-border rounded-lg px-4 py-2 text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!choice}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Confirm
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Option = ({
  value,
  checked,
  onChoose,
  title,
  detail,
  disabled = false,
}: {
  value: Choice;
  checked: boolean;
  onChoose: (c: Choice) => void;
  title: string;
  detail: string;
  disabled?: boolean;
}) => (
  <label className={`flex items-start gap-3 rounded-lg border p-3 ${disabled ? "opacity-60" : "cursor-pointer"} ${checked ? "border-primary bg-primary/5" : "border-border"}`}>
    <input type="radio" name="conflict-choice" value={value} checked={checked} disabled={disabled} onChange={() => onChoose(value)} className="mt-1" />
    <span className="min-w-0">
      <span className="block text-sm font-medium break-words">{title}</span>
      <span className="block text-xs text-muted-foreground">{detail}</span>
    </span>
  </label>
);

const CensusChoice = ({
  candidate,
  fileName,
  current,
  choice,
  onChoose,
  mergeFits,
}: {
  candidate: DocumentCandidate;
  fileName: string;
  current: CensusEmployee[];
  choice: Choice | null;
  onChoose: (c: Choice) => void;
  mergeFits: boolean;
}) => {
  const incoming = candidate.value as CensusEmployee[];
  const { matched, added, missing } = compareCensus(current, incoming, candidate.stated);
  const changed = matched.filter((m) => m.changes.length > 0);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Compare with your census</DialogTitle>
        <DialogDescription>
          {fileName} lists {incoming.length} {incoming.length === 1 ? "person" : "people"}; your intake has {current.length}.
          Nothing changes until you confirm.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm max-h-64 overflow-y-auto" aria-label="Differences">
        <p>
          {matched.length} in both{changed.length > 0 && `, ${changed.length} with different details`} · {added.length} only
          in this file · {missing.length} only in your intake
        </p>
        {changed.length > 0 && (
          <ul className="space-y-1 text-xs">
            {changed.map(({ current: c, changes }) => (
              <li key={c.id}>
                <span className="font-medium">{name(c)}:</span>{" "}
                {changes
                  .map((ch) => `${CENSUS_FACT_LABELS[ch.fact]} ${formatCensusFact(ch.fact, ch.from)} → ${formatCensusFact(ch.fact, ch.to)}`)
                  .join("; ")}
              </li>
            ))}
          </ul>
        )}
        {added.length > 0 && <p className="text-xs"><span className="font-medium">Only in this file:</span> {listNames(added)}</p>}
        {missing.length > 0 && <p className="text-xs"><span className="font-medium">Only in your intake:</span> {listNames(missing)}</p>}
      </div>
      <fieldset className="space-y-2">
        <legend className="sr-only">What to do with this census</legend>
        <Option
          value="merge"
          checked={choice === "merge"}
          onChoose={onChoose}
          title="Merge"
          disabled={!mergeFits}
          detail={
            mergeFits
              ? `Update the ${changed.length} whose details differ, add ${added.length} new, and keep the ${missing.length} not in this file.`
              : `Not available: merging would make ${(current.length + added.length).toLocaleString()} people, and an intake holds up to ${MAX_CENSUS_ROWS.toLocaleString()}. Replace with this file's census, or keep yours.`
          }
        />
        <Option
          value="document"
          checked={choice === "document"}
          onChoose={onChoose}
          title="Replace"
          detail={`Use this file's ${incoming.length} as your census${missing.length ? `, removing the ${missing.length} not in it` : ""}.`}
        />
        <Option value="current" checked={choice === "current"} onChoose={onChoose} title="Keep my census" detail="Leave it as it is." />
      </fieldset>
    </>
  );
};

export default ConflictResolutionDialog;
