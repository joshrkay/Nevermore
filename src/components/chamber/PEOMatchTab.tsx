import { useState, type ReactNode } from "react";
import { AlertTriangle, Users, UserPlus, DollarSign, MapPin, Shield, Zap } from "lucide-react";
import type { ChamberData } from "@/data/chamberTypes";
import { PEO_NAME_MAX, findPeo, groupPeosByFit, listedPeos, peoFit, type FitStatus, type PeoRecord } from "@/data/peoCatalog";
import EligibilityChecks from "@/components/peo/EligibilityChecks";
import { formatCheckedOn, localToday, staleProfileWarning } from "@/data/peoProfiles";
import type { PeoCatalogStatus } from "@/hooks/usePeoCatalog";

export interface PEOMatchTabProps {
  data: ChamberData;
  /** The PEO the packet is prepared for; null until the prospect picks or names one. */
  selectedPeo: string | null;
  onSelect: (name: string) => void;
  onProceed: () => void;
  /** The PEOs, alphabetically, as the database lists them (usePeoCatalog); only those listed are offered. */
  catalog: readonly PeoRecord[];
  /** Whether the PEOs are still loading or couldn't be read; a prospect can name one either way. */
  catalogStatus: PeoCatalogStatus;
  /** Shown under the PEOs, before moving on: the chosen PEO's own questions. */
  children?: ReactNode;
}

/** Each group of PEOs, by how their checks come out. The groups come in a fixed order; nothing is ranked. */
const GROUP_TITLES: Record<FitStatus, string> = {
  meets: "Meets every check",
  unknown: "Some checks can't be told yet",
  does_not_meet: "A check isn't met",
};

const PEOMatchTab = ({ data, selectedPeo, onSelect, onProceed, catalog: everyPeo, catalogStatus, children }: PEOMatchTabProps) => {
  // Only the PEOs an admin lists are offered; one chosen before it stopped being listed reads as the prospect's own.
  const catalog = listedPeos(everyPeo);
  const [otherName, setOtherName] = useState("");
  // A stale profile is still offered, with when it was last checked (the one rule, src/data/peoProfiles.ts).
  const today = localToday();
  const stale = (peo: PeoRecord) => staleProfileWarning(peo, today);

  const totalDependents = data.census.reduce((sum, e) => sum + (e.dependents?.length ?? 0), 0);
  const avgSalary = data.census.length > 0
    ? Math.round(data.census.reduce((sum, e) => sum + (e.annual_salary ?? 0), 0) / data.census.length)
    : 0;

  const stats = [
    // 0 is an answer; only no count and no census is "—".
    { icon: <Users className="w-5 h-5" />, label: "Total EEs", value: data.employee_count !== null ? String(data.employee_count) : data.census.length > 0 ? String(data.census.length) : "—" },
    { icon: <UserPlus className="w-5 h-5" />, label: "Dependents", value: totalDependents > 0 ? String(totalDependents) : "—" },
    { icon: <DollarSign className="w-5 h-5" />, label: "Avg Salary", value: avgSalary > 0 ? `$${avgSalary.toLocaleString()}` : "—" },
    { icon: <MapPin className="w-5 h-5" />, label: "States", value: data.states.length > 0 ? data.states.join(", ") : "—" },
  ];

  const selectedIsListed = selectedPeo !== null && findPeo(catalog, selectedPeo) !== undefined;
  const trimmedOther = otherName.trim();

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">PEO Match</h2>
        <p className="text-muted-foreground text-sm">
          Choose the PEO this packet is prepared for, or name another. We don't rank PEOs or estimate their prices;
          the checks below compare only what you've told us with what the PEO has published.
        </p>
      </div>

      {/* Company Profile Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-muted rounded-lg p-4 text-center">
            <div className="text-muted-foreground mb-2 flex justify-center">{s.icon}</div>
            <p className="text-lg font-bold font-mono">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Facts that matter for fit */}
      {data.virgin_medical !== null && (
        <div className="flex flex-wrap gap-2">
          {data.virgin_medical && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/15 text-primary">
              <Shield className="w-3 h-3" /> Virgin Medical Group
            </span>
          )}
          {data.has_1099 && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-warning/15 text-warning">
              <Zap className="w-3 h-3" /> Has 1099 Contractors
            </span>
          )}
          {data.multiple_entities && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-secondary/15 text-secondary">
              <Users className="w-3 h-3" /> Multi-Entity
            </span>
          )}
        </div>
      )}

      {/* PEO Cards */}
      <div className="space-y-4">
        {catalogStatus === "loading" && <p className="text-sm text-muted-foreground">Loading the PEOs…</p>}
        {catalogStatus === "failed" && (
          <p role="alert" className="text-sm rounded-lg bg-warning/10 text-warning px-3 py-2">
            We couldn't load the list of PEOs. You can still name yours below.
          </p>
        )}
        {catalog.length > 0 && <p className="text-xs text-muted-foreground">Alphabetical in each group. Nothing here is a ranking.</p>}
        {groupPeosByFit(data, catalog, today).map((group) => (
          <section key={group.outcome} aria-labelledby={`fit-group-${group.outcome}`} className="space-y-4">
            <h3 id={`fit-group-${group.outcome}`} className="text-sm font-medium text-muted-foreground">{GROUP_TITLES[group.outcome]} · {group.peos.length}</h3>
            {group.peos.map((peo) => (
          <div key={peo.name} className={`bg-card border rounded-xl p-6 transition-colors ${
            peo.name === selectedPeo ? "border-primary" : "border-border hover:border-primary/30"
          }`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-display text-xl font-bold">{peo.name}</h3>
              {peo.name === selectedPeo ? (
                <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary/15 text-primary">✓ Selected</span>
              ) : (
                <button
                  onClick={() => onSelect(peo.name)}
                  className="text-xs font-medium px-3 py-1.5 min-h-11 rounded-full border border-border hover:border-primary/40 transition-colors"
                >
                  Choose {peo.name}
                </button>
              )}
            </div>
            {/* A check not met is a warning, never a reason to hide or block a PEO: facts go stale and PEOs make exceptions. */}
            <EligibilityChecks peo={peo.name} checks={peoFit(data, peo, today)} note={`A check that isn't met is a warning. You can still choose ${peo.name}.`} />
            {stale(peo) ? (
              <p className="text-xs text-warning mt-3 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                {stale(peo)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-3">
                {peo.lastVerified ? `Facts checked ${formatCheckedOn(peo.lastVerified)}.` : "Not yet checked against this PEO's own materials."}
              </p>
            )}
          </div>
            ))}
          </section>
        ))}

        <div className={`bg-card border rounded-xl p-6 ${selectedPeo && !selectedIsListed ? "border-primary" : "border-border"}`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="font-display text-xl font-bold">Another PEO</h3>
            {selectedPeo && !selectedIsListed && (
              <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary/15 text-primary">✓ Selected</span>
            )}
          </div>
          {selectedPeo && !selectedIsListed && <p className="text-sm mb-3">Prepared for {selectedPeo}.</p>}
          <label htmlFor="other-peo" className="text-sm text-muted-foreground block mb-2">Another PEO</label>
          <div className="flex gap-2">
            <input
              id="other-peo"
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              maxLength={PEO_NAME_MAX}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
            <button
              disabled={trimmedOther === ""}
              onClick={() => onSelect(trimmedOther)}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-border hover:border-primary/40 transition-colors disabled:opacity-40"
            >
              Use this PEO
            </button>
          </div>
        </div>
      </div>

      {children}

      <button
        onClick={onProceed}
        className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg hover:bg-primary/90 transition-colors"
      >
        {selectedPeo ? `Proceed with ${selectedPeo} →` : "Continue without choosing a PEO →"}
      </button>
    </div>
  );
};

export default PEOMatchTab;
