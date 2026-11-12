import { NOT_MET_NOTE, type PeoFitCheck } from "@/data/peoCatalog";
import { checkedLine } from "@/data/peoProfiles";
import FitIcon, { FitWords } from "./FitIcon";

/**
 * A PEO's eligibility checks (peoFit), one per rule: a tick, a warning triangle or a dash with the outcome in words,
 * the PEO's fact against the employer's, and when the rule was checked. A check that isn't met is a warning: `note`
 * says so beside them, and nothing here hides, blocks or ranks a PEO.
 */
const EligibilityChecks = ({ peo, checks, note = NOT_MET_NOTE }: { peo: string; checks: readonly PeoFitCheck[]; note?: string }) => (
  <div className="space-y-1.5">
    <ul aria-label={`Eligibility checks for ${peo}`} className="space-y-1.5 text-sm">
      {checks.map((c) => (
        <li key={c.rule} className="flex items-start gap-2">
          <FitIcon status={c.status} />
          <span className="min-w-0">
            <FitWords status={c.status} />
            {" · "}
            <span className="font-medium">{c.label}:</span> {c.sentence}
            {c.checkedOn && (
              <span className={`block text-xs ${c.stale ? "text-warning" : "text-muted-foreground"}`}>{checkedLine(c.checkedOn, c.stale)}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
    {checks.some((c) => c.status === "does_not_meet") && <p className="text-xs text-warning">{note}</p>}
  </div>
);

export default EligibilityChecks;
