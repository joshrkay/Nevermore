import { useMemo } from "react";
import { Users, UserPlus, DollarSign, MapPin, Shield, Zap } from "lucide-react";
import type { ChamberData } from "@/data/chamberTypes";
import { scorePEOs } from "@/data/peoScoring";

interface PEOMatchTabProps {
  data: ChamberData;
  onProceed: () => void;
}

const PEOMatchTab = ({ data, onProceed }: PEOMatchTabProps) => {
  const peoResults = useMemo(() => scorePEOs(data), [data]);

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

  const hasEnoughData = (data.employee_count ?? 0) > 0 || data.company_name;

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">PEO Match</h2>
        <p className="text-muted-foreground text-sm">
          {hasEnoughData
            ? "Scored and ranked based on your company profile. More data = more accurate recommendations."
            : "Continue your conversation with Lenore to populate your profile. Scores will update in real time."}
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

      {/* Scoring Factors */}
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
        {peoResults.map((peo, i) => (
          <div key={peo.name} className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display text-xl font-bold">{peo.name}</h3>
                <span className={`text-xs px-2.5 py-1 rounded-full mt-1 inline-block ${
                  i === 0 ? "bg-primary/15 text-primary" :
                  i === 1 ? "bg-emerald-500/15 text-emerald-400" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {peo.label}
                </span>
              </div>
              <span className={`font-mono text-2xl font-bold ${
                peo.score >= 85 ? "text-primary" :
                peo.score >= 75 ? "text-emerald-400" :
                "text-foreground"
              }`}>{peo.score}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full transition-all duration-1000 ${
                  i === 0 ? "bg-primary" : i === 1 ? "bg-emerald-500" : "bg-muted-foreground"
                }`}
                style={{ width: `${peo.score}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mb-3">{peo.rationale}</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {peo.strengths.map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">{s}</span>
              ))}
            </div>
            <p className="text-sm font-mono text-foreground">Estimated PEPM: {peo.pepmRange}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onProceed}
        className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg hover:bg-primary/90 transition-colors"
      >
        Proceed to The Reckoning →
      </button>
    </div>
  );
};

export default PEOMatchTab;
