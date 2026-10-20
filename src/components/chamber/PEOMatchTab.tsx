import { useState } from "react";
import { Users, UserPlus, DollarSign, MapPin, Shield, Zap } from "lucide-react";
import type { ChamberData } from "@/data/chamberTypes";
import { PEO_CATALOG, findPeo, peoFit, type FitStatus } from "@/data/peoCatalog";

interface PEOMatchTabProps {
  data: ChamberData;
  /** The PEO the packet is prepared for; null until the prospect picks or names one. */
  selectedPeo: string | null;
  onSelect: (name: string) => void;
  onProceed: () => void;
}

const FIT_TEXT: Record<FitStatus, string> = {
  meets: "✓ Meets",
  does_not_meet: "✗ Doesn't meet",
  unknown: "Not yet confirmed",
};

const PEOMatchTab = ({ data, selectedPeo, onSelect, onProceed }: PEOMatchTabProps) => {
  const [otherName, setOtherName] = useState("");

  const totalDependents = data.employees.reduce((sum, e) => sum + e.dependents.length, 0);
  const avgSalary = data.employees.length > 0
    ? Math.round(data.employees.reduce((sum, e) => sum + (e.salary ?? 0), 0) / data.employees.length)
    : 0;

  const stats = [
    { icon: <Users className="w-5 h-5" />, label: "Total EEs", value: String((data.employee_count ?? data.employees.length) || "—") },
    { icon: <UserPlus className="w-5 h-5" />, label: "Dependents", value: totalDependents > 0 ? String(totalDependents) : "—" },
    { icon: <DollarSign className="w-5 h-5" />, label: "Avg Salary", value: avgSalary > 0 ? `$${avgSalary.toLocaleString()}` : "—" },
    { icon: <MapPin className="w-5 h-5" />, label: "States", value: data.states.length > 0 ? data.states.join(", ") : "—" },
  ];

  const selectedIsListed = selectedPeo !== null && findPeo(selectedPeo) !== undefined;
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
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-400">
              <Zap className="w-3 h-3" /> Has 1099 Contractors
            </span>
          )}
          {data.multiple_entities && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-500/15 text-blue-400">
              <Users className="w-3 h-3" /> Multi-Entity
            </span>
          )}
        </div>
      )}

      {/* PEO Cards */}
      <div className="space-y-4">
        {PEO_CATALOG.map((peo) => (
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
                  className="text-xs font-medium px-3 py-1.5 rounded-full border border-border hover:border-primary/40 transition-colors"
                >
                  Choose {peo.name}
                </button>
              )}
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {peoFit(data, peo).map((check) => (
                <li key={check.label} className="flex justify-between gap-4">
                  <span>{check.label}</span>
                  <span className="font-mono text-foreground">{FIT_TEXT[check.status]}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              {peo.lastVerified ? `Facts checked ${peo.lastVerified}.` : "Not yet checked against this PEO's own materials."}
            </p>
          </div>
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
              maxLength={80}
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
