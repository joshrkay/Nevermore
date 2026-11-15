import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { keptSeparateWords } from "@/data/mergeWords";
import { MergeError, keepAccountSeparate } from "@/lib/mergeApi";

// The possible-duplicate banner on an account's page (story CRM-S4.3a, screen 37; D-193, D-645, D-661). An account the chain made when a match existed (CRM-Q1.1b) is
// marked "Possible duplicate of ..." for an agent to merge or keep. "Merge" opens the dialog with the marked account's original kept; "Keep separate" clears the mark
// (`account_keep_separate`). The buttons are offered only to someone who may change the account and never in a Nevermore support session: anyone else still reads the
// banner. Merging also needs the other account to be one the person may see; the database says why not, in words, in the dialog.

export function DuplicateBanner({ firmId, accountId, mark, canAct, onMerge, onKeptSeparate }: {
  firmId: string;
  accountId: string;
  /** The account this one may duplicate: a null id and name when the person may not see it. */
  mark: { id: string | null; name: string | null };
  /** The person may change this account and this is not a support session. */
  canAct: boolean;
  onMerge: (otherId: string) => void;
  onKeptSeparate: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const keepSeparate = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const done = await keepAccountSeparate(firmId, accountId);
      toast.success(keptSeparateWords(done.wasDuplicateOf?.name ?? null));
      onKeptSeparate();
    } catch (e) {
      setProblem(e instanceof MergeError ? e.message : "Couldn't keep these separate. Check your connection and try again.");
      setBusy(false);
    }
  };
  const other = mark.id !== null && mark.name !== null ? { id: mark.id, name: mark.name } : null;
  return (
    <div role="note" aria-label="Possible duplicate" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm">
      <Copy className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p>
          <strong className="font-medium">Possible duplicate of </strong>
          {other ? <Link to={`/accounts/${other.id}`} className="font-medium text-primary underline underline-offset-2">{other.name}</Link> : <strong className="font-medium">an account you can't see</strong>}
          <strong className="font-medium">.</strong>
        </p>
        <p className="text-muted-foreground">
          {other
            ? "It matched on a website, a name or a contact's email when it was made. Merge them if they are one business, or keep them separate."
            : "Ask its owner or an owner of the firm if they should be merged. Until then you can keep them separate."}
        </p>
        {problem && <p role="alert" className="mt-1 text-destructive">{problem}</p>}
      </div>
      {canAct && (
        <div className="flex flex-wrap gap-2">
          {other && <Button type="button" size="sm" disabled={busy} onClick={() => onMerge(other.id)}>Merge</Button>}
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void keepSeparate()}>Keep separate</Button>
        </div>
      )}
    </div>
  );
}
