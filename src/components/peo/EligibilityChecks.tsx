import { AlertTriangle, Check, Minus } from "lucide-react";
import { FIT_WORDS, NOT_MET_NOTE, type FitStatus, type PeoFitCheck } from "@/data/peoCatalog";
import { formatCheckedOn } from "@/data/peoProfiles";

// Each outcome has its own icon shape beside its words, so colour is never the only sign.
const ICONS: Record<FitStatus, typeof Check> = { meets: Check, does_not_meet: AlertTriangle, unknown: Minus };
const TONE: Record<FitStatus, string> = { meets: "text-success", does_not_meet: "text-warning", unknown: "text-muted-foreground" };

/**
 * A PEO's eligibility checks (peoFit), one per rule: a tick, a warning triangle or a dash with the outcome in words,
 * the PEO's fact against the employer's, and when the rule was checked. A check that isn't met is a warning: `note`
 * says so beside them, and nothing here hides, blocks or ranks a PEO.
 */
const EligibilityChecks = ({ peo, checks, note = NOT_MET_NOTE }: { peo: string; checks: readonly PeoFitCheck[]; note?: string }) => (
  <div className="space-y-1.5">
    <ul aria-label={`Eligibility checks for ${peo}`} className="space-y-1.5 text-sm">
      {checks.map((c) => {
        const Icon = ICONS[c.status];
        return (
          <li key={c.rule} className="flex items-start gap-2">
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${TONE[c.status]}`} aria-hidden="true" />
            <span className="min-w-0">
              <span className={`font-medium ${TONE[c.status]}`}>{FIT_WORDS[c.status]}</span>
              {" · "}
              <span className="font-medium">{c.label}:</span> {c.sentence}
              {c.checkedOn && (
                <span className={`block text-xs ${c.stale ? "text-warning" : "text-muted-foreground"}`}>
                  checked {formatCheckedOn(c.checkedOn)}{c.stale ? " · may be out of date" : ""}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
    {checks.some((c) => c.status === "does_not_meet") && <p className="text-xs text-warning">{note}</p>}
  </div>
);

export default EligibilityChecks;
