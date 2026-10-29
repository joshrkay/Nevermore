import type { ChamberData } from "@/data/chamberTypes";
import { censusAge, censusGaps, censusPay } from "@/data/census";
import { motion } from "framer-motion";

interface CensusWorkspaceTabProps {
  data: ChamberData;
  isDemo: boolean;
}

const CensusWorkspaceTab = ({ data, isDemo }: CensusWorkspaceTabProps) => {
  const { census } = data;
  const withGaps = census.filter((e) => censusGaps(e).length > 0).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Employee Census</h3>
        <span className="text-[10px] text-muted-foreground font-mono">{census.length} employees</span>
      </div>

      {census.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground/50 italic text-sm">
          Upload a census on the Upload tab, or Lenore will build the roster as you talk...
        </div>
      ) : (
        <>
          {withGaps > 0 && (
            <p className="text-xs text-warning">
              {withGaps} {withGaps === 1 ? "row is" : "rows are"} missing an underwriting detail (age, work state, title or
              salary). Underwriters will ask for it.
            </p>
          )}
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">#</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Name</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Age</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">State</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Title</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Pay</th>
                  <th className="text-center px-3 py-2 text-muted-foreground font-medium">Type</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Tier</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">WC code</th>
                </tr>
              </thead>
              <tbody>
                {census.map((emp, i) => {
                  const gaps = censusGaps(emp);
                  return (
                    <motion.tr
                      key={emp.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 20) * 0.03 }}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 py-2 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">
                        {emp.first_name} {emp.last_name}
                        {gaps.length > 0 && (
                          <span className="ml-1 text-[10px] text-warning" title={`Missing: ${gaps.join(", ")}`}>
                            ⚠ missing {gaps.join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{censusAge(emp) ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">
                        {emp.work_state || "—"}
                        {emp.zip_code && <span className="text-muted-foreground"> {emp.zip_code}</span>}
                      </td>
                      <td className="px-3 py-2">{emp.job_title || "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{censusPay(emp)}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          emp.classification === "1099"
                            ? "bg-warning/15 text-warning"
                            : "bg-secondary/15 text-secondary"
                        }`}>
                          {emp.classification === "1099" ? "1099" : "W-2"}
                          {emp.employment_type === "part_time" && " PT"}
                        </span>
                        {emp.classification === "1099" && emp.work_state === "CA" && (
                          <span className="ml-1 text-[9px] text-warning">⚠ AB5</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">{emp.coverage_tier ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">{emp.class_code ?? "—"}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CensusWorkspaceTab;
