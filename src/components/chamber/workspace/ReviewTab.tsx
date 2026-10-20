import type { ChamberData } from "@/data/chamberTypes";
import { eligibilityChecks, employeeFlag, headcount } from "@/data/manuscript";
import { fieldOpenItems, formatFieldValue, type FieldAction, type ProvenanceMap } from "@/data/provenance";
import { CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";
import ProvenanceField from "./ProvenanceField";

interface ReviewTabProps {
  data: ChamberData;
  provenance?: ProvenanceMap;
  onAction?: (action: FieldAction) => void;
  onProceed: () => void;
}

const ReviewTab = ({ data, provenance = {}, onAction, onProceed }: ReviewTabProps) => {
  const eeCount = headcount(data);
  const needsReview = fieldOpenItems(provenance);
  const checks = eligibilityChecks(data);
  const flaggedEmployees = data.employees.filter(e => employeeFlag(e) !== null);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">Review</h2>
        <p className="text-muted-foreground text-sm">
          All data collected so far, organized by section. Confirm or correct anything Lenore inferred, or tell her about it.
        </p>
      </div>

      {/* Inferred, incomplete, and conflicting values */}
      {needsReview.length > 0 && (
        <div className="bg-card border border-warning/40 rounded-xl p-6 space-y-4">
          <p className="text-xs font-mono text-warning uppercase tracking-wider">
            Needs your review — {needsReview.length} item{needsReview.length === 1 ? "" : "s"}
          </p>
          {needsReview.map((item) => (
            <div key={item.field}>
              <p className="text-[10px] text-muted-foreground mb-0.5">{item.reason}</p>
              <ProvenanceField
                label={item.label}
                field={item.field}
                display={formatFieldValue(data[item.field])}
                raw={data[item.field]}
                provenance={provenance[item.field]}
                onAction={onAction}
              />
            </div>
          ))}
        </div>
      )}

      {/* Eligibility check */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Eligibility Check</p>
        {checks.map((c, i) => (
          <div key={i} className="flex items-start gap-2.5">
            {c.status === "pass" && <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />}
            {c.status === "fail" && <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />}
            {c.status === "unknown" && <HelpCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
            <span className={`text-sm ${c.status === "unknown" ? "text-muted-foreground" : "text-foreground"}`}>
              {c.label}{c.status === "unknown" && " — not yet verified"}
            </span>
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
                      {employeeFlag(emp) && (
                        <span title={employeeFlag(emp) ?? undefined} className="ml-1 text-[10px] text-warning">⚠</span>
                      )}
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
        See Your PEO Matches →
      </button>
    </div>
  );
};

export default ReviewTab;
