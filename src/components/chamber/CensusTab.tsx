import { useState } from "react";
import { MOCK_EMPLOYEES } from "@/data/mockData";
import type { Employee } from "@/data/mockData";
import { CheckCircle, AlertTriangle, AlertOctagon } from "lucide-react";

// W/C class code assignments based on job classification
const getClassCode = (emp: Employee): { code: string; label: string; status: "confirmed" | "verify" | "risk" } => {
  const title = emp.jobClassification.toLowerCase();
  if (title.includes("account") && (title.includes("executive") || title.includes("manager"))) {
    return { code: "8742", label: "Outside Sales?", status: "verify" };
  }
  if (title.includes("freelance") || title.includes("contractor")) {
    return { code: "—", label: "Reclassification Risk", status: "risk" };
  }
  if (title.includes("designer") || title.includes("editor") || title.includes("motion") || title.includes("drafting")) {
    return { code: "8820", label: "Drafting / Design", status: "confirmed" };
  }
  return { code: "8810", label: "Clerical", status: "confirmed" };
};

const CensusTab = () => {
  const [employees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const flaggedCount = employees.filter((e) => {
    const cc = getClassCode(e);
    return cc.status !== "confirmed";
  }).length;

  const statusIcon = (status: Employee["status"]) => {
    switch (status) {
      case "confirmed": return <CheckCircle className="w-4 h-4 text-success" />;
      case "flagged": return <AlertTriangle className="w-4 h-4 text-warning" />;
      case "missing": return <AlertOctagon className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">The Census</h2>
        <p className="text-muted-foreground text-sm">Review and confirm employee data. Edit flagged rows inline.</p>
      </div>

      {/* Class code warning banner */}
      {flaggedCount > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-foreground text-sm font-medium">
              Lenore has flagged {flaggedCount} employee{flaggedCount > 1 ? "s" : ""} whose job duties may affect workers' comp classification.
            </p>
            <p className="text-muted-foreground text-xs mt-1">She'll ask a few quick questions to resolve these before submission.</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">#</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Employee Name</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">State</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Job Classification</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">W/C Class Code</th>
              <th className="text-right px-4 py-3 text-muted-foreground font-medium">Annual Salary</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">DOB</th>
              <th className="text-right px-4 py-3 text-muted-foreground font-medium">Dependents</th>
              <th className="text-center px-4 py-3 text-muted-foreground font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const cc = getClassCode(emp);
              return (
                <tr
                  key={emp.id}
                  className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                    emp.status === "missing" ? "bg-primary/5" : emp.status === "flagged" ? "bg-warning/5" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-muted-foreground">{emp.id}</td>
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3 font-mono">{emp.state}</td>
                  <td className="px-4 py-3">{emp.jobClassification}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium font-mono ${
                      cc.status === "confirmed" ? "bg-success/15 text-success" :
                      cc.status === "verify" ? "bg-warning/15 text-warning" :
                      "bg-destructive/15 text-destructive"
                    }`}>
                      {cc.status === "confirmed" && <>✓ {cc.code} {cc.label}</>}
                      {cc.status === "verify" && <>⚠ Verify — {cc.label}</>}
                      {cc.status === "risk" && <>🔴 {cc.label}</>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">${emp.annualSalary.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{emp.dob}</td>
                  <td className="px-4 py-3 text-right">
                    {emp.dependents === null ? (
                      <input
                        type="number"
                        placeholder="—"
                        className="w-12 bg-muted border border-warning/40 rounded px-2 py-1 text-sm text-center text-foreground outline-none focus:border-primary"
                      />
                    ) : (
                      <span className="font-mono">{emp.dependents}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5" title={emp.flag}>
                      {statusIcon(emp.status)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-success" /> Confirmed</span>
        <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-warning" /> Flagged</span>
        <span className="flex items-center gap-1"><AlertOctagon className="w-3 h-3 text-primary" /> Missing / Risk</span>
      </div>
    </div>
  );
};

export default CensusTab;
