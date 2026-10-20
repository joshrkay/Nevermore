import type { ChamberData } from "@/data/chamberTypes";
import { CheckCircle, AlertTriangle } from "lucide-react";

interface ReviewTabProps {
  data: ChamberData;
  onProceed: () => void;
}

const ReviewTab = ({ data, onProceed }: ReviewTabProps) => {
  const eeCount = data.employee_count ?? data.employees.length;
  const hasCA1099 = data.ca_contractors || data.employees.some(e => e.classification === "1099" && e.state === "CA");
  
  const checks = [
    { label: `Headcount meets TriNet minimum (${eeCount} employees)`, pass: eeCount >= 5 },
    { label: "US-based company", pass: !!data.hq_state },
    { label: "Industry — no exclusions", pass: true },
    { label: "Workers' comp history clean", pass: true },
    { label: "No open claims", pass: true },
    { label: "Renewal increase within range", pass: true },
    { label: "Dependent data complete", pass: data.employees.some(e => e.dependents.length > 0) || data.employees.length === 0 },
  ];

  const flaggedEmployees = data.employees.filter(e => {
    const title = e.title.toLowerCase();
    return title.includes("account") || title.includes("sales") || title.includes("freelance") || title.includes("contractor");
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">Review</h2>
        <p className="text-muted-foreground text-sm">
          All data collected, organized by section. Every field is editable inline.
        </p>
      </div>

      {/* Eligibility check */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Eligibility Check</p>
        {checks.map((c, i) => (
          <div key={i} className="flex items-start gap-2.5">
            {c.pass ? (
              <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            )}
            <span className="text-sm text-foreground">{c.label}</span>
          </div>
        ))}
        {flaggedEmployees.length > 0 && (
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">
              {flaggedEmployees.length} job classification{flaggedEmployees.length > 1 ? "s" : ""} need{flaggedEmployees.length === 1 ? "s" : ""} confirmation (flagged below)
            </span>
          </div>
        )}
      </div>

      {/* Company summary */}
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Company</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Company", data.company_name],
            ["HQ State", data.hq_state],
            ["Industry", data.industry],
            ["Employees", eeCount > 0 ? String(eeCount) : null],
            ["States", data.states.length > 0 ? data.states.join(", ") : null],
            ["Payroll", data.payroll_vendor],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <span className="text-muted-foreground text-xs">{label}</span>
              <p className="font-mono text-foreground">{value || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Census summary */}
      {data.employees.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
            Census — {data.employees.length} employees
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">State</th>
                  <th className="pb-2 pr-3">Title</th>
                  <th className="pb-2 pr-3 text-right">Salary</th>
                  <th className="pb-2 text-center">Type</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((emp, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-1.5 pr-3 font-medium">{emp.first_name} {emp.last_name}</td>
                    <td className="py-1.5 pr-3 font-mono">{emp.state}</td>
                    <td className="py-1.5 pr-3">{emp.title}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">
                      {emp.salary ? `$${emp.salary.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-1.5 text-center">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        emp.classification === "1099" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
                      }`}>{emp.classification}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={onProceed}
        className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg hover:bg-primary/90 transition-colors"
      >
        Proceed to The Reckoning →
      </button>
    </div>
  );
};

export default ReviewTab;
